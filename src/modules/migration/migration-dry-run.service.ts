import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import { LibraryService } from '../library/library.service.js';

type MigrationCategory =
  | 'AUTO_MIGRATE'
  | 'MANUAL_REVIEW_REQUIRED'
  | 'CONFLICT'
  | 'BLOCKED'
  | 'SKIP';

type PreviewOptions = {
  aircraft_id?: string | null;
  source_row_ids?: string[];
  include_removed?: boolean;
  include_quarantined?: boolean;
  include_historical?: boolean;
};

const categoryOrder: MigrationCategory[] = [
  'AUTO_MIGRATE',
  'MANUAL_REVIEW_REQUIRED',
  'CONFLICT',
  'BLOCKED',
  'SKIP',
];

export class MigrationDryRunService {
  static async previewLegacyAircraftComponentMigration(options: PreviewOptions = {}) {
    const generatedAt = new Date().toISOString();
    const sourceRows = await this.getLegacySourceRows(options);
    const [serializedRows, completedLedgerRows, reconciliation] = await Promise.all([
      this.getSerializedRows(),
      this.getCompletedLedgerRows(sourceRows.map((row) => row.id)),
      LibraryService.getSerializedComponentReconciliationReport(),
    ]);
    const activeSerializedRows = serializedRows.filter((row) => !row.serialized_removed_at);
    const rows = sourceRows.map((sourceRow) =>
      this.buildPreviewRow(
        sourceRow,
        serializedRows,
        activeSerializedRows,
        completedLedgerRows,
        reconciliation
      )
    );
    const categoryCounts = this.buildCategoryCounts(rows);
    const nonSkippedRows = rows.filter((row) => row.migration_category !== 'SKIP');
    const readinessScore = nonSkippedRows.length
      ? Number(((categoryCounts.AUTO_MIGRATE / nonSkippedRows.length) * 100).toFixed(1))
      : 0;

    return {
      generated_at: generatedAt,
      mode: 'UNSAVED_DRY_RUN',
      summary: {
        source_rows_evaluated: sourceRows.length,
        auto_migrate_count: categoryCounts.AUTO_MIGRATE,
        manual_review_count: categoryCounts.MANUAL_REVIEW_REQUIRED,
        conflict_count: categoryCounts.CONFLICT,
        blocked_count: categoryCounts.BLOCKED,
        skip_count: categoryCounts.SKIP,
        readiness_score: readinessScore,
      },
      category_counts: categoryCounts,
      readiness_score: readinessScore,
      rows,
      blockers: rows.flatMap((row) =>
        row.blockers.map((blocker: string) => ({
          source_row_id: row.source.id,
          blocker,
        }))
      ),
      warnings: rows.flatMap((row) =>
        row.warnings.map((warning: string) => ({
          source_row_id: row.source.id,
          warning,
        }))
      ),
    };
  }

  private static async getLegacySourceRows(options: PreviewOptions) {
    const whereClauses: string[] = [];
    const replacements: Record<string, unknown> = {};
    const sourceRowIds = Array.isArray(options.source_row_ids)
      ? options.source_row_ids.map((id) => String(id || '').trim()).filter(Boolean)
      : [];

    if (sourceRowIds.length > 0) {
      whereClauses.push('ac.id IN (:sourceRowIds)');
      replacements.sourceRowIds = sourceRowIds;
    } else {
      if (options.aircraft_id) {
        whereClauses.push('ac.aircraft_id = :aircraftId');
        replacements.aircraftId = String(options.aircraft_id).trim();
      }

      const statuses = ['INSTALLED'];

      if (options.include_quarantined) {
        statuses.push('QUARANTINED');
      }

      if (options.include_removed || options.include_historical) {
        statuses.push('REMOVED');
      }

      whereClauses.push('ac.current_status IN (:statuses)');
      replacements.statuses = statuses;

      if (!options.include_removed && !options.include_historical) {
        whereClauses.push('ac.removed_at IS NULL');
      }
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    return sequelize.query(
      `
        SELECT
          ac.id,
          ac.aircraft_id,
          aircraft.registration AS aircraft_registration,
          ac.model_id,
          ac.serial_number,
          ac.position_code,
          ac.installation_date,
          ac.tsn_at_install,
          ac.tso_at_install,
          ac.current_status,
          ac.install_af_hours,
          ac.is_quarantined,
          ac.removed_at,
          cm.model_code,
          cm.model_name,
          cm.asset_type_id,
          at.code AS asset_type_code,
          at.label AS asset_type_label,
          at.is_installable_on_aircraft,
          at.is_required_for_aircraft
        FROM aircraft_components ac
        LEFT JOIN aircraft
          ON aircraft.id = ac.aircraft_id
        LEFT JOIN component_models cm
          ON cm.id = ac.model_id
        LEFT JOIN rf_asset_type at
          ON at.id = cm.asset_type_id
        ${whereSql}
        ORDER BY aircraft.registration ASC NULLS LAST, ac.position_code ASC NULLS LAST, ac.serial_number ASC NULLS LAST, ac.id ASC
      `,
      {
        type: QueryTypes.SELECT,
        replacements,
      }
    ) as Promise<any[]>;
  }

  private static async getSerializedRows() {
    return sequelize.query(
      `
        SELECT
          sc.id AS serialized_component_id,
          sc.component_model_id,
          sc.serial_number,
          sc.status AS serialized_status,
          aci.id AS serialized_installation_id,
          aci.aircraft_id,
          aci.position AS serialized_position,
          aci.removed_at AS serialized_removed_at,
          cm.asset_type_id AS serialized_asset_type_id,
          cm.model_code AS serialized_model_code,
          cm.model_name AS serialized_model_name
        FROM serialized_components sc
        LEFT JOIN aircraft_component_installations aci
          ON aci.serialized_component_id = sc.id
        LEFT JOIN component_models cm
          ON cm.id = sc.component_model_id
        ORDER BY sc.serial_number ASC, aci.removed_at ASC NULLS FIRST, aci.created_at DESC NULLS LAST
      `,
      { type: QueryTypes.SELECT }
    ) as Promise<any[]>;
  }

  private static async getCompletedLedgerRows(sourceRowIds: string[]) {
    if (sourceRowIds.length === 0) {
      return new Map<string, any>();
    }

    const rows = await sequelize.query(
      `
        SELECT source_row_id, status, batch_id, id AS batch_row_id
        FROM migration_batch_rows
        WHERE source_table = 'aircraft_components'
          AND source_row_id IN (:sourceRowIds)
          AND status = 'MIGRATED'
      `,
      {
        type: QueryTypes.SELECT,
        replacements: { sourceRowIds },
      }
    ) as any[];

    return new Map(rows.map((row) => [String(row.source_row_id), row]));
  }

  private static buildPreviewRow(
    sourceRow: any,
    serializedRows: any[],
    activeSerializedRows: any[],
    completedLedgerRows: Map<string, any>,
    reconciliation: any
  ) {
    const warnings: string[] = [];
    const blockers: string[] = [];
    const idempotency = this.buildIdempotency(sourceRow, completedLedgerRows);
    const sourceSnapshot = this.buildSourceSnapshot(sourceRow);
    const exactSerialized = this.findExactSerializedComponent(sourceRow, serializedRows);
    const activeExactInstallation = exactSerialized
      ? activeSerializedRows.find((row) => row.serialized_component_id === exactSerialized.serialized_component_id)
      : null;
    const serialAnyModel = this.findSerializedBySerial(sourceRow, serializedRows);
    const positionConflict = this.findActiveSerializedPositionConflict(sourceRow, activeSerializedRows);
    const reconciliationRow = this.findReconciliationRow(sourceRow, reconciliation);

    if (!this.normalize(sourceRow.serial_number)) blockers.push('Missing serial number.');
    if (!this.normalize(sourceRow.aircraft_id)) blockers.push('Missing aircraft.');
    if (!this.normalize(sourceRow.model_id)) blockers.push('Missing component model.');
    if (!sourceRow.installation_date || Number.isNaN(new Date(sourceRow.installation_date).getTime())) {
      blockers.push('Missing or invalid installation date.');
    }
    if (sourceRow.is_installable_on_aircraft === false) {
      blockers.push('Component model asset type is not installable on aircraft.');
    }
    if (completedLedgerRows.has(String(sourceRow.id))) {
      idempotency.status = 'ALREADY_MIGRATED_LEDGER';
    }
    if (activeExactInstallation && reconciliationRow?.bucket === 'MATCHED') {
      idempotency.status = 'ALREADY_MIGRATED_OR_MATCHED';
    } else if (activeExactInstallation) {
      blockers.push('Existing active serialized installation with same serial and model.');
      idempotency.status = 'ACTIVE_INSTALLATION_EXISTS_BLOCK';
    }
    if (serialAnyModel && !exactSerialized) {
      blockers.push('Serialized component with same serial but different model exists.');
      idempotency.status = 'SERIAL_EXISTS_DIFFERENT_MODEL';
    }
    if (positionConflict) {
      blockers.push('Active serialized installation already occupies the same aircraft, asset type, and position.');
    }
    if (reconciliationRow?.bucket && [
      'MODEL_MISMATCH',
      'SERIAL_MISMATCH',
      'POSITION_MISMATCH',
      'INSTALLATION_CONFLICT',
    ].includes(reconciliationRow.bucket)) {
      blockers.push(`Reconciliation conflict: ${reconciliationRow.bucket}.`);
    }

    const status = this.normalize(sourceRow.current_status);
    const isRemoved = Boolean(sourceRow.removed_at) || status === 'REMOVED';
    const isQuarantined = Boolean(sourceRow.is_quarantined) || status === 'QUARANTINED';

    if (isRemoved) warnings.push('Removed or historical row requires manual review.');
    if (isQuarantined) warnings.push('Quarantined row requires manual review.');
    if (!sourceRow.position_code) warnings.push('No legacy position code captured.');
    if (Number(sourceRow.tsn_at_install || 0) === 0) warnings.push('TSN appears to be zero or defaulted.');
    if (Number(sourceRow.tso_at_install || 0) === 0) warnings.push('TSO appears to be zero or defaulted.');

    const migrationCategory = this.determineCategory({
      blockers,
      completedLedgerRows,
      sourceRow,
      activeExactInstallation,
      reconciliationRow,
      isRemoved,
      isQuarantined,
    });
    const proposedSerializedComponent = this.buildProposedSerializedComponent(
      sourceRow,
      exactSerialized,
      migrationCategory
    );
    const proposedInstallation = this.buildProposedInstallation(
      sourceRow,
      exactSerialized,
      migrationCategory,
      isRemoved
    );
    const proposedLifeState = this.buildProposedLifeState(sourceRow, exactSerialized, migrationCategory);
    const proposedMaintenanceEvent = this.buildProposedMaintenanceEvent(sourceRow, migrationCategory);

    return {
      source: sourceSnapshot,
      proposed_serialized_component: proposedSerializedComponent,
      proposed_installation: proposedInstallation,
      proposed_life_state: proposedLifeState,
      proposed_maintenance_event: proposedMaintenanceEvent,
      migration_category: migrationCategory,
      confidence: this.confidenceForCategory(migrationCategory, reconciliationRow),
      warnings,
      blockers,
      idempotency,
      reconciliation: reconciliationRow
        ? {
            bucket: reconciliationRow.bucket,
            confidence: reconciliationRow.confidence,
            match_basis: reconciliationRow.match_basis,
            conflict_flags: reconciliationRow.conflict_flags || [],
          }
        : null,
    };
  }

  private static buildSourceSnapshot(row: any) {
    return {
      table: 'aircraft_components',
      id: row.id,
      aircraft_id: row.aircraft_id,
      aircraft_registration: row.aircraft_registration || null,
      model_id: row.model_id,
      model_code: row.model_code || null,
      model_name: row.model_name || null,
      asset_type_id: row.asset_type_id || null,
      asset_type_code: row.asset_type_code || null,
      serial_number: row.serial_number || null,
      position_code: row.position_code || null,
      installation_date: row.installation_date || null,
      removed_at: row.removed_at || null,
      current_status: row.current_status || null,
      tsn_at_install: this.numericOrNull(row.tsn_at_install),
      tso_at_install: this.numericOrNull(row.tso_at_install),
      install_af_hours: this.numericOrNull(row.install_af_hours),
      is_quarantined: Boolean(row.is_quarantined),
      source_snapshot: {
        ...row,
      },
    };
  }

  private static buildIdempotency(sourceRow: any, completedLedgerRows: Map<string, any>) {
    const migratedLedgerRow = completedLedgerRows.get(String(sourceRow.id));

    return {
      status: migratedLedgerRow ? 'ALREADY_MIGRATED_LEDGER' : 'NOT_PREVIOUSLY_MIGRATED',
      migration_batch_id: migratedLedgerRow?.batch_id || null,
      migration_batch_row_id: migratedLedgerRow?.batch_row_id || null,
    };
  }

  private static buildProposedSerializedComponent(
    sourceRow: any,
    exactSerialized: any | null,
    category: MigrationCategory
  ) {
    if (category === 'BLOCKED' || category === 'CONFLICT' || category === 'SKIP') {
      return { action: 'NONE' };
    }

    if (exactSerialized) {
      return {
        action: 'REUSE',
        existing_serialized_component_id: exactSerialized.serialized_component_id,
        component_model_id: exactSerialized.component_model_id,
        serial_number: exactSerialized.serial_number,
        status: exactSerialized.serialized_status,
      };
    }

    return {
      action: 'CREATE',
      component_model_id: sourceRow.model_id,
      serial_number: sourceRow.serial_number,
      status: category === 'AUTO_MIGRATE' ? 'INSTALLED' : 'AVAILABLE',
      notes: `Dry-run preview only. Source legacy aircraft_components id: ${sourceRow.id}`,
    };
  }

  private static buildProposedInstallation(
    sourceRow: any,
    exactSerialized: any | null,
    category: MigrationCategory,
    isRemoved: boolean
  ) {
    if (category === 'BLOCKED' || category === 'CONFLICT' || category === 'SKIP') {
      return { action: 'NONE' };
    }

    return {
      action: isRemoved ? 'CREATE_HISTORICAL' : 'CREATE_ACTIVE',
      aircraft_id: sourceRow.aircraft_id,
      serialized_component_id_preview: exactSerialized?.serialized_component_id || 'NEW_SERIALIZED_COMPONENT',
      installation_context: 'LEGACY_MIGRATION_PREVIEW',
      installed_at: sourceRow.installation_date || null,
      removed_at: isRemoved ? sourceRow.removed_at || null : null,
      position: sourceRow.position_code || null,
      install_tsn: this.numericOrNull(sourceRow.tsn_at_install),
      install_tso: this.numericOrNull(sourceRow.tso_at_install),
      notes: `Dry-run preview only. Source legacy aircraft_components id: ${sourceRow.id}`,
    };
  }

  private static buildProposedLifeState(
    sourceRow: any,
    exactSerialized: any | null,
    category: MigrationCategory
  ) {
    if (category === 'BLOCKED' || category === 'CONFLICT' || category === 'SKIP') {
      return { action: 'NONE' };
    }

    return {
      action: exactSerialized ? 'REUSE_EXISTING' : 'CREATE',
      tsn_hours: this.numericOrNull(sourceRow.tsn_at_install),
      tso_hours: this.numericOrNull(sourceRow.tso_at_install),
      csn_cycles: null,
      cso_cycles: null,
      overhaul_reference_date: null,
      calendar_reference_date: null,
      notes: `Dry-run preview only. Source legacy aircraft_components id: ${sourceRow.id}`,
    };
  }

  private static buildProposedMaintenanceEvent(sourceRow: any, category: MigrationCategory) {
    if (category === 'BLOCKED' || category === 'CONFLICT' || category === 'SKIP') {
      return { action: 'NONE' };
    }

    return {
      action: 'CREATE',
      event_type: 'UNKNOWN_HISTORY_IMPORT',
      occurred_at: null,
      evidence_summary:
        `Dry-run preview only. Would preserve legacy aircraft_components source id ${sourceRow.id}.`,
      notes: [
        'LEGACY_MIGRATION_PREVIEW',
        `Source Table: aircraft_components`,
        `Source Row ID: ${sourceRow.id}`,
        `Serial Number: ${sourceRow.serial_number || '-'}`,
        `Model ID: ${sourceRow.model_id || '-'}`,
      ].join('\n'),
    };
  }

  private static determineCategory(params: {
    blockers: string[];
    completedLedgerRows: Map<string, any>;
    sourceRow: any;
    activeExactInstallation: any | null;
    reconciliationRow: any | null;
    isRemoved: boolean;
    isQuarantined: boolean;
  }): MigrationCategory {
    if (
      params.completedLedgerRows.has(String(params.sourceRow.id)) ||
      (params.activeExactInstallation && params.reconciliationRow?.bucket === 'MATCHED')
    ) {
      return 'SKIP';
    }

    if (params.blockers.length > 0) {
      return params.blockers.some((blocker) => /Missing|invalid|not installable/i.test(blocker))
        ? 'BLOCKED'
        : 'CONFLICT';
    }

    if (params.isRemoved || params.isQuarantined) {
      return 'MANUAL_REVIEW_REQUIRED';
    }

    return 'AUTO_MIGRATE';
  }

  private static findExactSerializedComponent(sourceRow: any, serializedRows: any[]) {
    const serial = this.normalize(sourceRow.serial_number);
    const modelId = this.normalize(sourceRow.model_id);

    if (!serial || !modelId) return null;

    return serializedRows.find(
      (row) =>
        this.normalize(row.serial_number) === serial &&
        this.normalize(row.component_model_id) === modelId
    ) || null;
  }

  private static findSerializedBySerial(sourceRow: any, serializedRows: any[]) {
    const serial = this.normalize(sourceRow.serial_number);

    if (!serial) return null;

    return serializedRows.find((row) => this.normalize(row.serial_number) === serial) || null;
  }

  private static findActiveSerializedPositionConflict(sourceRow: any, activeSerializedRows: any[]) {
    const aircraftId = this.normalize(sourceRow.aircraft_id);
    const position = this.normalize(sourceRow.position_code);
    const assetTypeId = this.normalize(sourceRow.asset_type_id);

    if (!aircraftId || !position || !assetTypeId) return null;

    return activeSerializedRows.find(
      (row) =>
        this.normalize(row.aircraft_id) === aircraftId &&
        this.normalize(row.serialized_position) === position &&
        this.normalize(row.serialized_asset_type_id) === assetTypeId
    ) || null;
  }

  private static findReconciliationRow(sourceRow: any, reconciliation: any) {
    const rows = Array.isArray(reconciliation?.details) ? reconciliation.details : [];

    return rows.find((row: any) => String(row.legacy_component_id || '') === String(sourceRow.id)) || null;
  }

  private static buildCategoryCounts(rows: Array<{ migration_category: MigrationCategory }>) {
    return categoryOrder.reduce((counts, category) => {
      counts[category] = rows.filter((row) => row.migration_category === category).length;
      return counts;
    }, {} as Record<MigrationCategory, number>);
  }

  private static confidenceForCategory(category: MigrationCategory, reconciliationRow: any) {
    if (category === 'BLOCKED' || category === 'CONFLICT') return 'NONE';
    if (category === 'SKIP') return 'HIGH';
    if (reconciliationRow?.confidence) return reconciliationRow.confidence;
    if (category === 'AUTO_MIGRATE') return 'MEDIUM';
    return 'LOW';
  }

  private static normalize(value: unknown) {
    return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
  }

  private static numericOrNull(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
}
