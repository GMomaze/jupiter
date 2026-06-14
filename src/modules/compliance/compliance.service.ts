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

export type ComplianceScopeMode =
  | 'CURRENT'
  | 'SERIALIZED_PREVIEW'
  | 'SERIALIZED_ACTIVE';

type ComplianceScopeOptions = {
  scopeMode?: ComplianceScopeMode;
};

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

type ComplianceScopeModelRow = {
  model_id: string;
  model_code: string | null;
  model_name: string | null;
  manufacturer_name: string | null;
  asset_type_code: string | null;
  source_label: 'AIRCRAFT' | 'LEGACY_COMPONENT' | 'SERIALIZED_COMPONENT';
  source_reference: string | null;
};

type ComplianceScopeCandidateRow = {
  compliance_item_id: string | null;
  item_type: 'AD' | 'SB' | null;
  code: string;
  title: string;
  source_type: string | null;
  source_table: string | null;
  source_id: string;
  matched_model_id: string;
  candidate_source: string;
};

export class ComplianceService {
  private static isComplianceScopeOptions(value: unknown): value is ComplianceScopeOptions {
    return Boolean(
      value &&
      typeof value === 'object' &&
      'scopeMode' in value
    );
  }

  private static normalizeScopeMode(value: unknown): ComplianceScopeMode {
    const scopeMode = String(value || 'CURRENT') as ComplianceScopeMode;

    if (!['CURRENT', 'SERIALIZED_PREVIEW', 'SERIALIZED_ACTIVE'].includes(scopeMode)) {
      throw new Error('INVALID_COMPLIANCE_SCOPE_MODE');
    }

    return scopeMode;
  }

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

  private static collapseModelScope(rows: ComplianceScopeModelRow[]) {
    const byModelId = new Map<string, ComplianceScopeModelRow & { source_labels: string[]; source_references: string[] }>();

    for (const row of rows) {
      const modelId = String(row.model_id || '').trim();

      if (!modelId) {
        continue;
      }

      const existing = byModelId.get(modelId);

      if (!existing) {
        byModelId.set(modelId, {
          ...row,
          source_labels: [row.source_label],
          source_references: row.source_reference ? [row.source_reference] : [],
        });
        continue;
      }

      if (!existing.source_labels.includes(row.source_label)) {
        existing.source_labels.push(row.source_label);
      }

      if (row.source_reference && !existing.source_references.includes(row.source_reference)) {
        existing.source_references.push(row.source_reference);
      }
    }

    return Array.from(byModelId.values()).sort((left, right) =>
      (left.model_code || left.model_name || left.model_id).localeCompare(
        right.model_code || right.model_name || right.model_id
      )
    );
  }

  static async getSerializedComplianceScopeComparisonForAircraft(
    aircraftId: string,
    transaction?: any
  ) {
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

    const scopeRows = await sequelize.query<ComplianceScopeModelRow>(
      `
      WITH scope_sources AS (
        SELECT
          a.model_id,
          'AIRCRAFT'::text AS source_label,
          a.registration::text AS source_reference
        FROM aircraft a
        WHERE a.id = :aircraftId
          AND a.model_id IS NOT NULL

        UNION ALL

        SELECT
          ac.model_id,
          'LEGACY_COMPONENT'::text AS source_label,
          CONCAT_WS(' | ', NULLIF(ac.position_code, ''), NULLIF(ac.serial_number, '')) AS source_reference
        FROM aircraft_components ac
        WHERE ac.aircraft_id = :aircraftId
          AND ac.removed_at IS NULL
          AND ac.model_id IS NOT NULL

        UNION ALL

        SELECT
          sc.component_model_id AS model_id,
          'SERIALIZED_COMPONENT'::text AS source_label,
          CONCAT_WS(' | ', NULLIF(aci.position, ''), NULLIF(sc.serial_number, '')) AS source_reference
        FROM aircraft_component_installations aci
        JOIN serialized_components sc
          ON sc.id = aci.serialized_component_id
        WHERE aci.aircraft_id = :aircraftId
          AND aci.removed_at IS NULL
          AND sc.component_model_id IS NOT NULL
      )
      SELECT
        ss.model_id::text AS model_id,
        cm.model_code,
        cm.model_name,
        m.name AS manufacturer_name,
        at.code AS asset_type_code,
        ss.source_label::varchar AS source_label,
        NULLIF(ss.source_reference, '') AS source_reference
      FROM scope_sources ss
      JOIN component_models cm
        ON cm.id = ss.model_id
      LEFT JOIN manufacturers m
        ON m.id = cm.manufacturer_id
      LEFT JOIN rf_asset_type at
        ON at.id = cm.asset_type_id
      ORDER BY ss.source_label ASC, cm.model_code ASC NULLS LAST, cm.model_name ASC
      `,
      {
        replacements: { aircraftId },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    const currentRows = scopeRows.filter((row) =>
      row.source_label === 'AIRCRAFT' || row.source_label === 'LEGACY_COMPONENT'
    );
    const serializedRows = scopeRows.filter((row) => row.source_label === 'SERIALIZED_COMPONENT');
    const currentScope = this.collapseModelScope(currentRows);
    const proposedScope = this.collapseModelScope(scopeRows);
    const currentModelIds = new Set(currentScope.map((row) => row.model_id));
    const proposedModelIds = new Set(proposedScope.map((row) => row.model_id));
    const addedSerializedModelIds = Array.from(proposedModelIds).filter(
      (modelId) => !currentModelIds.has(modelId)
    );

    const candidateAddedItems = addedSerializedModelIds.length
      ? await sequelize.query<ComplianceScopeCandidateRow>(
          `
          WITH added_models AS (
            SELECT id AS model_id
            FROM component_models
            WHERE id IN (:addedModelIds)
          ),
          sb_candidates AS (
            SELECT DISTINCT
              ci.id::text AS compliance_item_id,
              ci.item_type,
              ci.code,
              ci.title,
              ci.source_type,
              ci.source_table,
              ci.source_id::text AS source_id,
              sbm.model_id::text AS matched_model_id,
              'SERVICE_BULLETIN_MODEL'::text AS candidate_source
            FROM added_models am
            JOIN service_bulletin_models sbm
              ON sbm.model_id = am.model_id
            JOIN service_bulletins sb
              ON sb.id = sbm.service_bulletin_id
            LEFT JOIN compliance_items ci
              ON ci.source_table = 'service_bulletins'
             AND ci.source_id = sb.id
             AND ci.status = 'ACTIVE'
            WHERE COALESCE(sb.is_active, TRUE) = TRUE
              AND COALESCE(NULLIF(UPPER(sb.status), ''), 'ACTIVE') = 'ACTIVE'
          ),
          assignment_candidates AS (
            SELECT DISTINCT
              ci.id::text AS compliance_item_id,
              ci.item_type,
              ci.code,
              ci.title,
              ci.source_type,
              ci.source_table,
              ci.source_id::text AS source_id,
              ca.model_id::text AS matched_model_id,
              'COMPLIANCE_ASSIGNMENT'::text AS candidate_source
            FROM added_models am
            JOIN compliance_assignments ca
              ON ca.model_id = am.model_id
             AND ca.assignment_type = 'MODEL'
             AND ca.is_active = TRUE
            JOIN compliance_items ci
              ON ci.id = ca.compliance_item_id
             AND ci.status = 'ACTIVE'
          )
          SELECT *
          FROM (
            SELECT * FROM sb_candidates
            UNION
            SELECT * FROM assignment_candidates
          ) candidates
          WHERE source_id IS NOT NULL
            AND code IS NOT NULL
          ORDER BY code ASC, title ASC, matched_model_id ASC
          `,
          {
            replacements: { addedModelIds: addedSerializedModelIds },
            type: QueryTypes.SELECT,
            transaction,
          }
        )
      : [];

    return {
      aircraft: {
        id: aircraft.id,
        registration: aircraft.registration,
        serial_number: aircraft.serial_number,
        model_id: aircraft.model_id,
      },
      current_scope: {
        models: currentScope,
        model_ids: currentScope.map((row) => row.model_id),
        source_labels: ['AIRCRAFT', 'LEGACY_COMPONENT'],
      },
      proposed_scope: {
        models: proposedScope,
        model_ids: proposedScope.map((row) => row.model_id),
        source_labels: ['AIRCRAFT', 'LEGACY_COMPONENT', 'SERIALIZED_COMPONENT'],
      },
      serialized_scope: {
        active_installation_models: this.collapseModelScope(serializedRows),
        added_model_ids: addedSerializedModelIds,
        removed_installations_excluded: true,
      },
      duplicate_collapsed_model_ids: Array.from(proposedModelIds),
      candidate_added_items: candidateAddedItems,
      safety: {
        read_only: true,
        live_compliance_scope_changed: false,
        workpack_attachment_changed: false,
      },
    };
  }

  static async resolveComplianceModelScopeForAircraft(
    aircraftId: string,
    mode: ComplianceScopeMode = 'CURRENT',
    transaction?: any
  ) {
    const scopeMode = this.normalizeScopeMode(mode);

    const comparison = await this.getSerializedComplianceScopeComparisonForAircraft(
      aircraftId,
      transaction
    );
    const selectedScope =
      scopeMode === 'CURRENT'
        ? comparison.current_scope
        : comparison.proposed_scope;

    return {
      mode: scopeMode,
      aircraft: comparison.aircraft,
      models: selectedScope.models,
      model_ids: selectedScope.model_ids,
      source_labels: selectedScope.source_labels,
      serialized_scope: comparison.serialized_scope,
      duplicate_collapsed_model_ids: comparison.duplicate_collapsed_model_ids,
      candidate_added_items:
        scopeMode === 'CURRENT' ? [] : comparison.candidate_added_items,
      comparison,
      safety: {
        read_only: true,
        default_mode: scopeMode === 'CURRENT',
        live_compliance_scope_changed: false,
        workpack_attachment_changed: false,
        serialized_active_defined_only: scopeMode === 'SERIALIZED_ACTIVE',
      },
    };
  }

  private static deduplicateComplianceRows(rows: ComplianceQueryRow[]) {
    const byComplianceItemId = new Map<string, ComplianceQueryRow>();

    for (const row of rows) {
      if (!byComplianceItemId.has(row.compliance_item_id)) {
        byComplianceItemId.set(row.compliance_item_id, row);
      }
    }

    return Array.from(byComplianceItemId.values());
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

  static async getApplicableComplianceForAircraft(
    aircraftId: string,
    transactionOrOptions?: any,
    options?: ComplianceScopeOptions
  ) {
    const transaction = this.isComplianceScopeOptions(transactionOrOptions)
      ? undefined
      : transactionOrOptions;
    const scopeOptions = this.isComplianceScopeOptions(transactionOrOptions)
      ? transactionOrOptions
      : options;
    const scopeMode = this.normalizeScopeMode(scopeOptions?.scopeMode);
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

    const rows = scopeMode === 'CURRENT'
      ? await sequelize.query<ComplianceQueryRow>(
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
        )
      : this.deduplicateComplianceRows(
          await sequelize.query<ComplianceQueryRow>(
            `
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
                      AND sbm.model_id IN (:modelIds)
                  )
                )
              )
            ORDER BY ci.item_type ASC, ci.code ASC
            `,
            {
              replacements: {
                aircraftId,
                modelIds: (
                  await this.resolveComplianceModelScopeForAircraft(
                    aircraftId,
                    scopeMode,
                    transaction
                  )
                ).model_ids,
              },
              type: QueryTypes.SELECT,
              transaction,
            }
          )
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
