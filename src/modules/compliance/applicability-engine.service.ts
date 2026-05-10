import { QueryTypes } from 'sequelize';
import { sequelize } from '../../models/index.js';

export type ApplicabilityItem = {
  source_type: 'AD' | 'SB' | 'SID';
  source_id: string;
  reference: string;
  title: string;
  description: string | null;
  interval_hours: number | null;
  interval_months: number | null;
  applicability_reason: string;
  source_table: string;
  is_projected_compliance: boolean;
};

export type ApplicabilityResult = {
  aircraft_id: string;
  model_id: string | null;
  items: ApplicabilityItem[];
};

type AircraftRow = {
  id: string;
  model_id: string | null;
};

type ProjectedComplianceRow = {
  source_type: 'AD' | 'SB';
  source_id: string;
  reference: string;
  title: string;
  description: string | null;
};

type SidApplicabilityRow = {
  source_id: string;
  reference: string;
  title: string;
  description: string | null;
  interval_hours: number | null;
  interval_months: number | null;
};

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function tableExists(table: string) {
  return sequelize
    .getQueryInterface()
    .describeTable(table)
    .then(() => true)
    .catch(() => false);
}

export class ApplicabilityEngineService {
  private static mergeDeduplicatedItems(items: ApplicabilityItem[]) {
    const deduplicated = new Map<string, ApplicabilityItem>();

    for (const item of items) {
      const key = `${item.source_type}:${item.source_id}`;
      if (!deduplicated.has(key)) {
        deduplicated.set(key, item);
      }
    }

    return Array.from(deduplicated.values()).sort((left, right) => {
      const sourceTypeCompare = left.source_type.localeCompare(right.source_type);
      if (sourceTypeCompare !== 0) {
        return sourceTypeCompare;
      }

      return left.reference.localeCompare(right.reference);
    });
  }

  private static async getAircraft(aircraftId: string) {
    const rows = await sequelize.query<AircraftRow>(
      `
      SELECT
        a.id,
        a.model_id
      FROM aircraft a
      WHERE a.id = :aircraftId
      LIMIT 1
      `,
      {
        replacements: { aircraftId },
        type: QueryTypes.SELECT,
      }
    );

    return rows[0] || null;
  }

  private static async getProjectedComplianceItemsForModel(modelId: string) {
    const hasComplianceAssignments = await tableExists('compliance_assignments');

    if (!hasComplianceAssignments) {
      return [] as ApplicabilityItem[];
    }

    const rows = await sequelize.query<ProjectedComplianceRow>(
      `
      SELECT
        COALESCE(ci.source_type, ci.item_type)::varchar AS source_type,
        ci.source_id::text AS source_id,
        ci.code AS reference,
        ci.title,
        ci.description
      FROM compliance_assignments ca
      JOIN compliance_items ci
        ON ci.id = ca.compliance_item_id
      WHERE ca.assignment_type = 'MODEL'
        AND ca.model_id = :modelId
        AND ca.is_active = TRUE
        AND ci.status = 'ACTIVE'
        AND COALESCE(ci.source_type, ci.item_type) IN ('AD', 'SB')
      ORDER BY ci.code ASC
      `,
      {
        replacements: { modelId },
        type: QueryTypes.SELECT,
      }
    );

    return rows
      .filter((row) => row.source_id && row.reference)
      .map((row) => ({
        source_type: row.source_type,
        source_id: row.source_id,
        reference: normalizeString(row.reference),
        title: normalizeString(row.title),
        description: row.description ? normalizeString(row.description) : null,
        interval_hours: null,
        interval_months: null,
        applicability_reason: 'Model-level compliance assignment matched aircraft model',
        source_table: 'compliance_items',
        is_projected_compliance: true,
      }));
  }

  private static async getSidItemsForModel(modelId: string) {
    const hasSidApplicability = await tableExists('sid_model_applicability');
    const hasSidMaster = await tableExists('supplemental_inspection_documents');

    if (!hasSidApplicability || !hasSidMaster) {
      return [] as ApplicabilityItem[];
    }

    const rows = await sequelize.query<SidApplicabilityRow>(
      `
      SELECT
        sid.id::text AS source_id,
        sid.reference,
        sid.title,
        sid.description,
        COALESCE(sid.repeat_interval_hours, sid.initial_interval_hours) AS interval_hours,
        COALESCE(sid.repeat_interval_months, sid.initial_interval_months) AS interval_months
      FROM sid_model_applicability sma
      JOIN supplemental_inspection_documents sid
        ON sid.id = sma.sid_id
      WHERE sma.model_id = :modelId
        AND sma.is_active = TRUE
        AND sid.is_active = TRUE
      ORDER BY sid.reference ASC
      `,
      {
        replacements: { modelId },
        type: QueryTypes.SELECT,
      }
    );

    return rows.map((row) => ({
      source_type: 'SID' as const,
      source_id: row.source_id,
      reference: normalizeString(row.reference),
      title: normalizeString(row.title),
      description: row.description ? normalizeString(row.description) : null,
      interval_hours: toNullableNumber(row.interval_hours),
      interval_months: toNullableNumber(row.interval_months),
      applicability_reason: 'SID model applicability matched aircraft model',
      source_table: 'supplemental_inspection_documents',
      is_projected_compliance: false,
    }));
  }

  static async getApplicabilityForAircraft(
    aircraftId: string
  ): Promise<ApplicabilityResult> {
    const aircraft = await this.getAircraft(aircraftId);

    if (!aircraft) {
      throw new Error('INVALID_AIRCRAFT');
    }

    if (!aircraft.model_id) {
      return {
        aircraft_id: aircraft.id,
        model_id: null,
        items: [],
      };
    }

    const [projectedComplianceItems, sidItems] = await Promise.all([
      this.getProjectedComplianceItemsForModel(aircraft.model_id),
      this.getSidItemsForModel(aircraft.model_id),
    ]);

    return {
      aircraft_id: aircraft.id,
      model_id: aircraft.model_id,
      items: this.mergeDeduplicatedItems([
        ...projectedComplianceItems,
        ...sidItems,
      ]),
    };
  }
}
