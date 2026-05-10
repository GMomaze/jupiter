import { Transaction } from 'sequelize';
import { sequelize } from '../../models/index.js';
import { ComplianceItem } from '../../models/ComplianceItem.js';
import { AirworthinessDirective } from '../../models/AirworthinessDirective.js';
import { ServiceBulletin } from '../../models/ServiceBulletin.js';

type ProjectionSourceType = 'AD' | 'SB';

type ProjectionFailure = {
  sourceType: ProjectionSourceType;
  sourceId: string;
  reason: string;
};

type ProjectionSummary = {
  totalAdSourcesInspected: number;
  adComplianceItemsInserted: number;
  adDuplicatesSkipped: number;
  totalSbSourcesInspected: number;
  sbComplianceItemsInserted: number;
  sbDuplicatesSkipped: number;
  failures: ProjectionFailure[];
};

type ColumnDefinition = {
  allowNull: boolean;
  type: string;
};

type TableDefinition = Record<string, ColumnDefinition>;

const COMPLIANCE_STATUS_VALUES = new Set([
  'ACTIVE',
  'SUPERSEDED',
  'CANCELLED',
  'INACTIVE',
]);

const COMPLIANCE_BASIS_VALUES = new Set([
  'MANDATORY',
  'RECOMMENDED',
  'MANUAL',
]);

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeOptionalText(value: unknown) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeComplianceStatus(value: unknown) {
  const normalized = normalizeString(value).toUpperCase();
  return COMPLIANCE_STATUS_VALUES.has(normalized) ? normalized : 'ACTIVE';
}

function normalizeComplianceBasis(value: unknown, fallback: string) {
  const normalized = normalizeString(value).toUpperCase();

  if (COMPLIANCE_BASIS_VALUES.has(normalized)) {
    return normalized;
  }

  return fallback;
}

async function getComplianceItemDefinition() {
  return (await sequelize.getQueryInterface().describeTable(
    'compliance_items'
  )) as TableDefinition;
}

function assertProjectionColumns(definition: TableDefinition) {
  const requiredColumns = [
    'item_type',
    'code',
    'title',
    'source_type',
    'source_id',
    'status',
  ];

  for (const column of requiredColumns) {
    if (!definition[column]) {
      throw new Error(
        `Compliance projection requires compliance_items.${column} before projection can run.`
      );
    }
  }
}

async function findExistingProjection(
  sourceType: ProjectionSourceType,
  sourceId: string,
  transaction: Transaction
) {
  return ComplianceItem.findOne({
    where: {
      source_type: sourceType,
      source_id: sourceId,
    } as any,
    transaction,
  });
}

async function createAdProjection(
  directive: AirworthinessDirective,
  definition: TableDefinition,
  transaction: Transaction
) {
  const payload: Record<string, unknown> = {
    item_type: 'AD',
    code: normalizeString(directive.ad_number),
    title:
      normalizeOptionalText(directive.subject) ||
      normalizeOptionalText(directive.subject_heading) ||
      normalizeString(directive.ad_number),
    description: normalizeOptionalText(directive.summary),
    authority: normalizeOptionalText(directive.authority),
    revision: normalizeOptionalText(directive.revision),
    effective_on: directive.effective_date || null,
    source_table: definition.source_table ? 'airworthiness_directives' : undefined,
    source_type: 'AD',
    source_id: directive.id,
    compliance_basis: 'MANDATORY',
    status: normalizeComplianceStatus(directive.status),
  };

  await ComplianceItem.create(payload as any, { transaction });
}

async function createSbProjection(
  bulletin: ServiceBulletin,
  definition: TableDefinition,
  transaction: Transaction
) {
  const payload: Record<string, unknown> = {
    item_type: 'SB',
    code: normalizeString(bulletin.sb_number),
    title: normalizeString(bulletin.title) || normalizeString(bulletin.sb_number),
    description: normalizeOptionalText(bulletin.description),
    revision: normalizeOptionalText(bulletin.revision),
    issued_on: bulletin.issued_on || null,
    source_table: definition.source_table ? 'service_bulletins' : undefined,
    source_type: 'SB',
    source_id: bulletin.id,
    compliance_basis: normalizeComplianceBasis(bulletin.compliance_type, 'MANUAL'),
    status: normalizeComplianceStatus(bulletin.status),
  };

  await ComplianceItem.create(payload as any, { transaction });
}

export class ComplianceProjectionService {
  static async projectAdSources(transaction?: Transaction) {
    const definition = await getComplianceItemDefinition();
    assertProjectionColumns(definition);

    const runProjection = async (activeTransaction: Transaction) => {
      const directives = await AirworthinessDirective.findAll({
        order: [['ad_number', 'ASC'], ['created_at', 'ASC']],
        transaction: activeTransaction,
      });

      let inserted = 0;
      let duplicates = 0;
      const failures: ProjectionFailure[] = [];

      for (const directive of directives) {
        const existing = await findExistingProjection(
          'AD',
          directive.id,
          activeTransaction
        );

        if (existing) {
          duplicates += 1;
          continue;
        }

        try {
          await createAdProjection(directive, definition, activeTransaction);
          inserted += 1;
        } catch (error: any) {
          failures.push({
            sourceType: 'AD',
            sourceId: directive.id,
            reason: error?.message || 'Unable to project AD source record.',
          });
          throw error;
        }
      }

      return {
        totalAdSourcesInspected: directives.length,
        adComplianceItemsInserted: inserted,
        adDuplicatesSkipped: duplicates,
        failures,
      };
    };

    if (transaction) {
      return runProjection(transaction);
    }

    return sequelize.transaction(runProjection);
  }

  static async projectSbSources(transaction?: Transaction) {
    const definition = await getComplianceItemDefinition();
    assertProjectionColumns(definition);

    const runProjection = async (activeTransaction: Transaction) => {
      const bulletins = await ServiceBulletin.findAll({
        order: [['created_at', 'ASC'], ['sb_number', 'ASC']],
        transaction: activeTransaction,
      });

      let inserted = 0;
      let duplicates = 0;
      const failures: ProjectionFailure[] = [];

      for (const bulletin of bulletins) {
        const existing = await findExistingProjection(
          'SB',
          bulletin.id,
          activeTransaction
        );

        if (existing) {
          duplicates += 1;
          continue;
        }

        try {
          await createSbProjection(bulletin, definition, activeTransaction);
          inserted += 1;
        } catch (error: any) {
          failures.push({
            sourceType: 'SB',
            sourceId: bulletin.id,
            reason: error?.message || 'Unable to project SB source record.',
          });
          throw error;
        }
      }

      return {
        totalSbSourcesInspected: bulletins.length,
        sbComplianceItemsInserted: inserted,
        sbDuplicatesSkipped: duplicates,
        failures,
      };
    };

    if (transaction) {
      return runProjection(transaction);
    }

    return sequelize.transaction(runProjection);
  }

  static async projectAdAndSbSources(): Promise<ProjectionSummary> {
    const definition = await getComplianceItemDefinition();
    assertProjectionColumns(definition);

    return sequelize.transaction(async (transaction) => {
      const adResult = await this.projectAdSources(transaction);
      const sbResult = await this.projectSbSources(transaction);

      return {
        totalAdSourcesInspected: adResult.totalAdSourcesInspected,
        adComplianceItemsInserted: adResult.adComplianceItemsInserted,
        adDuplicatesSkipped: adResult.adDuplicatesSkipped,
        totalSbSourcesInspected: sbResult.totalSbSourcesInspected,
        sbComplianceItemsInserted: sbResult.sbComplianceItemsInserted,
        sbDuplicatesSkipped: sbResult.sbDuplicatesSkipped,
        failures: [...adResult.failures, ...sbResult.failures],
      };
    });
  }
}
