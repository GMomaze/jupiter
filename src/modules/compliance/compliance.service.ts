import { QueryTypes } from 'sequelize';
import { sequelize } from '../../models/index.js';

type AircraftComplianceStatus =
  | 'DUE'
  | 'IN_PROGRESS'
  | 'COMPLIANT'
  | 'NOT_APPLICABLE';

type AircraftComplianceDisplayStatus =
  | 'DUE'
  | 'OVERDUE'
  | 'COMPLIANT'
  | 'NOT_APPLICABLE';

type AircraftRow = {
  id: string;
  registration: string;
  serial_number: string;
  model_id: string;
  total_time_hours: string | number;
};

type ComplianceQueryRow = {
  compliance_item_id: string;
  item_type: 'AD' | 'SB';
  code: string;
  title: string;
  description: string | null;
  authority: string | null;
  revision: string | null;
  issued_on: string | null;
  effective_on: string | null;
  compliance_basis: string;
  compliance_item_status: string;
  source_table: string | null;
  source_id: string | null;
  aircraft_compliance_id: string | null;
  aircraft_compliance_status: AircraftComplianceStatus | null;
  last_complied_at: Date | string | null;
  next_due_at: Date | string | null;
  last_complied_hours: string | number | null;
  next_due_hours: string | number | null;
  compliance_method: string | null;
  complied_workpack_id: string | null;
  notes: string | null;
  aircraft_total_time_hours: string | number;
};

type WorkpackComplianceSummaryRow = {
  workpack_id: string;
  workpack_compliance_id: string;
  compliance_item_id: string;
  item_type: 'AD' | 'SB';
  code: string;
  title: string;
  description: string | null;
  authority: string | null;
  revision: string | null;
  issued_on: string | null;
  effective_on: string | null;
  compliance_basis: string;
  completed_at: Date | string | null;
};

export class ComplianceService {
  private static toNumber(value: string | number | null | undefined) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private static toDate(value: Date | string | null | undefined) {
    if (!value) {
      return null;
    }

    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private static calculateAircraftStatus(
    aircraftTotalTimeHours: number | null,
    aircraftComplianceStatus: AircraftComplianceStatus | null,
    nextDueHours: number | null,
    nextDueAt: Date | null
  ): AircraftComplianceDisplayStatus {
    if (aircraftComplianceStatus === 'NOT_APPLICABLE') {
      return 'NOT_APPLICABLE';
    }

    const now = new Date();
    const isOverdueByHours =
      aircraftTotalTimeHours !== null &&
      nextDueHours !== null &&
      aircraftTotalTimeHours >= nextDueHours;
    const isOverdueByDate = nextDueAt !== null && nextDueAt.getTime() <= now.getTime();

    if (isOverdueByHours || isOverdueByDate) {
      return 'OVERDUE';
    }

    if (aircraftComplianceStatus === 'COMPLIANT') {
      return 'COMPLIANT';
    }

    return 'DUE';
  }

  static async getApplicableComplianceForAircraft(aircraftId: string, transaction?: any) {
    const aircraftRows = await sequelize.query<AircraftRow>(
      `
      SELECT
        a.id,
        a.registration,
        a.serial_number,
        a.model_id,
        a.total_time_hours
      FROM aircraft a
      WHERE a.id = :aircraftId
      LIMIT 1
      `,
      {
        replacements: { aircraftId },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    const aircraft = aircraftRows[0];

    if (!aircraft) {
      throw new Error('INVALID_AIRCRAFT');
    }

    const rows = await sequelize.query<ComplianceQueryRow>(
      `
      WITH relevant_model_ids AS (
        SELECT a.model_id
        FROM aircraft a
        WHERE a.id = :aircraftId

        UNION

        SELECT ac.model_id
        FROM aircraft_components ac
        WHERE ac.aircraft_id = :aircraftId
          AND ac.removed_at IS NULL
      )
      SELECT
        ci.id AS compliance_item_id,
        ci.item_type,
        ci.code,
        ci.title,
        ci.description,
        ci.authority,
        ci.revision,
        ci.issued_on,
        ci.effective_on,
        ci.compliance_basis,
        ci.status AS compliance_item_status,
        ci.source_table,
        ci.source_id,
        ac.id AS aircraft_compliance_id,
        ac.status AS aircraft_compliance_status,
        ac.last_complied_at,
        ac.next_due_at,
        ac.last_complied_hours,
        ac.next_due_hours,
        ac.compliance_method,
        ac.complied_workpack_id,
        ac.notes,
        a.total_time_hours AS aircraft_total_time_hours
      FROM aircraft a
      JOIN compliance_items ci
        ON ci.status = 'ACTIVE'
       AND ci.item_type IN ('AD', 'SB')
      LEFT JOIN aircraft_compliance ac
        ON ac.aircraft_id = a.id
       AND ac.compliance_item_id = ci.id
      WHERE a.id = :aircraftId
        AND (
          ci.item_type = 'AD'
          OR ac.id IS NOT NULL
          OR (
            ci.item_type = 'SB'
            AND ci.source_table = 'service_bulletins'
            AND EXISTS (
              SELECT 1
              FROM service_bulletin_models sbm
              WHERE sbm.service_bulletin_id = ci.source_id
                AND sbm.model_id IN (SELECT model_id FROM relevant_model_ids)
            )
          )
        )
      ORDER BY ci.item_type ASC, ci.code ASC
      `,
      {
        replacements: { aircraftId },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    const aircraftTotalTimeHours = this.toNumber(aircraft.total_time_hours);

    return {
      aircraft: {
        id: aircraft.id,
        registration: aircraft.registration,
        serial_number: aircraft.serial_number,
        model_id: aircraft.model_id,
        total_time_hours: aircraftTotalTimeHours,
      },
      items: rows.map((row) => {
        const nextDueHours = this.toNumber(row.next_due_hours);
        const lastCompliedHours = this.toNumber(row.last_complied_hours);
        const nextDueAt = this.toDate(row.next_due_at);
        const lastCompliedAt = this.toDate(row.last_complied_at);

        return {
          compliance_item_id: row.compliance_item_id,
          item_type: row.item_type,
          code: row.code,
          title: row.title,
          description: row.description,
          authority: row.authority,
          revision: row.revision,
          issued_on: row.issued_on,
          effective_on: row.effective_on,
          compliance_basis: row.compliance_basis,
          status: row.compliance_item_status,
          source_table: row.source_table,
          source_id: row.source_id,
          aircraft_compliance: {
            id: row.aircraft_compliance_id,
            stored_status: row.aircraft_compliance_status,
            computed_status: this.calculateAircraftStatus(
              aircraftTotalTimeHours,
              row.aircraft_compliance_status,
              nextDueHours,
              nextDueAt
            ),
            last_complied_at: lastCompliedAt,
            next_due_at: nextDueAt,
            last_complied_hours: lastCompliedHours,
            next_due_hours: nextDueHours,
            compliance_method: row.compliance_method,
            complied_workpack_id: row.complied_workpack_id,
            notes: row.notes,
          },
        };
      }),
    };
  }

  static async getComplianceSummaryForWorkpack(workpackId: string, transaction?: any) {
    const rows = await sequelize.query<WorkpackComplianceSummaryRow>(
      `
      SELECT
        wc.workpack_id,
        wc.id AS workpack_compliance_id,
        wc.compliance_item_id,
        ci.item_type,
        ci.code,
        ci.title,
        ci.description,
        ci.authority,
        ci.revision,
        ci.issued_on,
        ci.effective_on,
        ci.compliance_basis,
        wc.completed_at
      FROM workpack_compliance wc
      JOIN compliance_items ci
        ON ci.id = wc.compliance_item_id
      WHERE wc.workpack_id = :workpackId
        AND wc.status = 'COMPLETED'
      ORDER BY ci.item_type ASC, ci.code ASC
      `,
      {
        replacements: { workpackId },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    const items = rows.map((row) => ({
      workpack_compliance_id: row.workpack_compliance_id,
      compliance_item_id: row.compliance_item_id,
      item_type: row.item_type,
      code: row.code,
      title: row.title,
      description: row.description,
      authority: row.authority,
      revision: row.revision,
      issued_on: row.issued_on,
      effective_on: row.effective_on,
      compliance_basis: row.compliance_basis,
      completed_at: this.toDate(row.completed_at),
    }));

    return {
      workpack_id: workpackId,
      ad_items: items.filter((item) => item.item_type === 'AD'),
      sb_items: items.filter((item) => item.item_type === 'SB'),
    };
  }
}
