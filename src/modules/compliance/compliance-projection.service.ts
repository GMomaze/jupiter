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
  'REQUIRED',
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
    compliance_basis: normalizeComplianceBasis(bulletin.compliance_type, 'REQUIRED'),
    status: normalizeComplianceStatus(bulletin.status),
  };

  await ComplianceItem.create(payload as any, { transaction });
}

export class ComplianceProjectionService {
  static async projectAdSources(_transaction?: Transaction): Promise<never> {
    throw new Error('DORMANT_COMPLIANCE_PROJECTION_WRITER_DISABLED');
  }

  static async projectSbSources(_transaction?: Transaction): Promise<never> {
    throw new Error('DORMANT_COMPLIANCE_PROJECTION_WRITER_DISABLED');
  }

  static async projectAdAndSbSources(): Promise<never> {
    throw new Error('DORMANT_COMPLIANCE_PROJECTION_WRITER_DISABLED');
  }
}
