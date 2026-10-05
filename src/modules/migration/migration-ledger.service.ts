import { withTenantTransaction } from '../tenancy/tenant-transaction.js';
import sequelize from '../../config/database.js';
import { QueryTypes } from 'sequelize';
import {
  MigrationBatch,
  MigrationBatchRow,
  MigrationCreatedTarget,
} from '../../models/index.js';
import { AuditService } from '../audit/audit.service.js';
import {
  assertTenantQueryAuthority,
  type TenantQueryAuthority,
} from '../tenancy/tenant-query-authority.js';

export class MigrationLedgerService {
  static readonly batchStatuses = [
    'DRAFT',
    'DRY_RUN',
    'APPROVED',
    'EXECUTING',
    'COMPLETE',
    'FAILED',
    'ROLLED_BACK',
    'PARTIALLY_ROLLED_BACK',
  ];

  static readonly rowStatuses = [
    'PENDING',
    'MIGRATED',
    'FAILED',
    'SKIPPED',
    'ROLLED_BACK',
  ];

  static readonly auditActions = [
    'MIGRATION_DRY_RUN_CREATED',
    'MIGRATION_APPROVED',
    'MIGRATION_EXECUTED',
    'MIGRATION_ROLLED_BACK',
  ];

  static async createBatch(data: {
    tenant_id: string;
    migration_type: string;
    status?: string;
    created_by?: string | null;
    dry_run_summary?: Record<string, unknown>;
    execution_summary?: Record<string, unknown>;
    rollback_summary?: Record<string, unknown>;
    report_reference?: string | null;
    metadata?: Record<string, unknown>;
  }, transaction?: any) {
    const migrationType = String(data.migration_type || '').trim();
    const status = this.normalizeBatchStatus(data.status || 'DRAFT');

    if (!migrationType) {
      throw new Error('Migration type is required.');
    }

    return MigrationBatch.create(
      {
        tenant_id: data.tenant_id,
        migration_type: migrationType,
        status,
        created_by: data.created_by || null,
        dry_run_summary: data.dry_run_summary || {},
        execution_summary: data.execution_summary || {},
        rollback_summary: data.rollback_summary || {},
        report_reference: data.report_reference || null,
        metadata: data.metadata || {},
      },
      { transaction }
    );
  }

  static async createRow(data: {
    batch_id: string;
    source_table: string;
    source_row_id: string;
    migration_category?: string | null;
    decision?: string | null;
    status?: string;
    source_snapshot?: Record<string, unknown>;
    planned_target_snapshot?: Record<string, unknown>;
    actual_target_snapshot?: Record<string, unknown>;
    warnings?: unknown[];
    conflicts?: unknown[];
    failure_reason?: string | null;
    rollback_status?: string | null;
    metadata?: Record<string, unknown>;
  }, transaction?: any) {
    const batch = await MigrationBatch.findByPk(data.batch_id, { transaction });

    if (!batch) {
      throw new Error('Migration batch not found.');
    }

    const sourceTable = String(data.source_table || '').trim();
    const sourceRowId = String(data.source_row_id || '').trim();

    if (!sourceTable) {
      throw new Error('Source table is required.');
    }

    if (!sourceRowId) {
      throw new Error('Source row id is required.');
    }

    return MigrationBatchRow.create(
      {
        batch_id: batch.id,
        source_table: sourceTable,
        source_row_id: sourceRowId,
        migration_category: data.migration_category || null,
        decision: data.decision || null,
        status: this.normalizeRowStatus(data.status || 'PENDING'),
        source_snapshot: data.source_snapshot || {},
        planned_target_snapshot: data.planned_target_snapshot || {},
        actual_target_snapshot: data.actual_target_snapshot || {},
        warnings: data.warnings || [],
        conflicts: data.conflicts || [],
        failure_reason: data.failure_reason || null,
        rollback_status: data.rollback_status || null,
        metadata: data.metadata || {},
      },
      { transaction }
    );
  }

  static async saveLegacyAircraftComponentDryRun(authority: TenantQueryAuthority, data: {
    report: any;
    filters?: Record<string, unknown>;
    actor_id?: string | null;
  }) {
    assertTenantQueryAuthority(authority);
    const report = data.report || {};
    const rows: any[] = Array.isArray(report.rows) ? report.rows : [];
    const filters = data.filters || {};

    return withTenantTransaction(authority, async (transaction) => {
      const sourceRowIds = rows.map((row: any) => String(row?.source?.id || '').trim());
      if (sourceRowIds.some((id: string) => !id) || new Set(sourceRowIds).size !== sourceRowIds.length) {
        throw new Error('TENANT_MIGRATION_BATCH_INVALID');
      }
      if (sourceRowIds.length > 0) {
        const authorizedRows = await sequelize.query<{ id: string }>(
          `SELECT ac.id
             FROM aircraft_components ac
             JOIN aircraft a ON a.id = ac.aircraft_id
            WHERE ac.id IN (:sourceRowIds)
              AND ac.custodian_tenant_id = :tenantId
              AND a.tenant_id = :tenantId`,
          {
            replacements: { sourceRowIds, tenantId: authority.tenantId },
            transaction,
            type: QueryTypes.SELECT,
          },
        );
        if (authorizedRows.length !== sourceRowIds.length) {
          throw new Error('TENANT_MIGRATION_BATCH_INVALID');
        }
      }
      const batch = await this.createBatch(
        {
          tenant_id: authority.tenantId,
          migration_type: 'LEGACY_AIRCRAFT_COMPONENT_TO_SERIALIZED',
          status: 'DRY_RUN',
          created_by: data.actor_id || null,
          dry_run_summary: {
            ...(report.summary || {}),
            category_counts: report.category_counts || {},
            readiness_score: report.readiness_score || 0,
            warning_count: Array.isArray(report.warnings) ? report.warnings.length : 0,
            blocker_count: Array.isArray(report.blockers) ? report.blockers.length : 0,
          },
          metadata: {
            mode: 'SAVED_DRY_RUN',
            source_report_mode: report.mode || 'UNSAVED_DRY_RUN',
            source_generated_at: report.generated_at || null,
            saved_at: new Date().toISOString(),
            filters,
          },
        },
        transaction
      );

      for (const row of rows) {
        await this.createRow(
          {
            batch_id: batch.id,
            source_table: 'aircraft_components',
            source_row_id: String(row?.source?.id || ''),
            migration_category: row?.migration_category || null,
            status: 'PENDING',
            source_snapshot: row?.source || {},
            planned_target_snapshot: {
              proposed_serialized_component: row?.proposed_serialized_component || {},
              proposed_installation: row?.proposed_installation || {},
              proposed_life_state: row?.proposed_life_state || {},
              proposed_maintenance_event: row?.proposed_maintenance_event || {},
              reconciliation: row?.reconciliation || null,
              idempotency: row?.idempotency || null,
            },
            warnings: Array.isArray(row?.warnings) ? row.warnings : [],
            conflicts: Array.isArray(row?.blockers) ? row.blockers : [],
            metadata: {
              confidence: row?.confidence || null,
              dry_run_generated_at: report.generated_at || null,
              dry_run_mode: report.mode || 'UNSAVED_DRY_RUN',
            },
          },
          transaction
        );
      }

      await this.recordAuditEvent(
        batch.id,
        'MIGRATION_DRY_RUN_CREATED',
        data.actor_id || null,
        null,
        {
          status: batch.status,
          migration_type: batch.migration_type,
          dry_run_summary: batch.dry_run_summary,
          metadata: batch.metadata,
        },
        'Saved migration dry-run batch.',
        transaction
      );

      return batch;
    });
  }

  static async getSavedDryRunBatch(authority: TenantQueryAuthority, batchId: string) {
    assertTenantQueryAuthority(authority);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(batchId)) {
      return null;
    }
    const batch = await MigrationBatch.findOne({
      where: { id: batchId, tenant_id: authority.tenantId },
      include: [
        {
          model: MigrationBatchRow,
          as: 'Rows',
          required: false,
        },
      ],
      order: [[{ model: MigrationBatchRow, as: 'Rows' }, 'created_at', 'ASC']],
    });

    if (!batch) return null;

    return batch.get({ plain: true }) as any;
  }

  static async recordTarget(data: {
    batch_id: string;
    batch_row_id: string;
    target_table: string;
    target_row_id: string;
    created_snapshot?: Record<string, unknown>;
    rollback_action?: string | null;
    rollback_status?: string;
    rollback_timestamp?: Date | string | null;
    metadata?: Record<string, unknown>;
  }) {
    const [batch, batchRow] = await Promise.all([
      MigrationBatch.findByPk(data.batch_id),
      MigrationBatchRow.findByPk(data.batch_row_id),
    ]);

    if (!batch) {
      throw new Error('Migration batch not found.');
    }

    if (!batchRow) {
      throw new Error('Migration batch row not found.');
    }

    if (String(batchRow.batch_id) !== String(batch.id)) {
      throw new Error('Migration target row does not belong to the supplied batch.');
    }

    const targetTable = String(data.target_table || '').trim();
    const targetRowId = String(data.target_row_id || '').trim();

    if (!targetTable) {
      throw new Error('Target table is required.');
    }

    if (!targetRowId) {
      throw new Error('Target row id is required.');
    }

    return MigrationCreatedTarget.create({
      batch_id: batch.id,
      batch_row_id: batchRow.id,
      target_table: targetTable,
      target_row_id: targetRowId,
      created_snapshot: data.created_snapshot || {},
      rollback_action: data.rollback_action || null,
      rollback_status: String(data.rollback_status || 'PENDING').trim().toUpperCase(),
      rollback_timestamp: data.rollback_timestamp || null,
      metadata: data.metadata || {},
    });
  }

  static async updateBatchStatus(
    batchId: string,
    status: string,
    data: {
      actor_id?: string | null;
      reason?: string | null;
      dry_run_summary?: Record<string, unknown>;
      execution_summary?: Record<string, unknown>;
      rollback_summary?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    return sequelize.transaction(async (transaction) => {
      const batch = await MigrationBatch.findByPk(batchId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!batch) {
        throw new Error('Migration batch not found.');
      }

      const nextStatus = this.normalizeBatchStatus(status);
      const oldValues = {
        status: batch.status,
        dry_run_summary: batch.dry_run_summary,
        execution_summary: batch.execution_summary,
        rollback_summary: batch.rollback_summary,
        metadata: batch.metadata,
      };
      const updates: Record<string, unknown> = {
        status: nextStatus,
      };

      if (data.dry_run_summary) updates.dry_run_summary = data.dry_run_summary;
      if (data.execution_summary) updates.execution_summary = data.execution_summary;
      if (data.rollback_summary) updates.rollback_summary = data.rollback_summary;
      if (data.metadata) updates.metadata = data.metadata;

      if (nextStatus === 'APPROVED') {
        updates.approved_by = data.actor_id || null;
        updates.approved_at = new Date();
      }

      if (nextStatus === 'EXECUTING' || nextStatus === 'COMPLETE') {
        updates.executed_by = data.actor_id || null;
        updates.executed_at = new Date();
      }

      if (nextStatus === 'ROLLED_BACK' || nextStatus === 'PARTIALLY_ROLLED_BACK') {
        updates.rolled_back_by = data.actor_id || null;
        updates.rolled_back_at = new Date();
      }

      const updatedBatch = await batch.update(updates, { transaction });
      const auditAction = this.auditActionForBatchStatus(nextStatus);

      if (auditAction) {
        await this.recordAuditEvent(
          updatedBatch.id,
          auditAction,
          data.actor_id || null,
          oldValues,
          {
            status: updatedBatch.status,
            dry_run_summary: updatedBatch.dry_run_summary,
            execution_summary: updatedBatch.execution_summary,
            rollback_summary: updatedBatch.rollback_summary,
            metadata: updatedBatch.metadata,
          },
          data.reason || null,
          transaction
        );
      }

      return updatedBatch;
    });
  }

  static async updateRowStatus(
    rowId: string,
    status: string,
    data: {
      actual_target_snapshot?: Record<string, unknown>;
      failure_reason?: string | null;
      rollback_status?: string | null;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    const row = await MigrationBatchRow.findByPk(rowId);

    if (!row) {
      throw new Error('Migration batch row not found.');
    }

    return row.update({
      status: this.normalizeRowStatus(status),
      actual_target_snapshot: data.actual_target_snapshot || row.actual_target_snapshot,
      failure_reason:
        data.failure_reason !== undefined ? data.failure_reason : row.failure_reason,
      rollback_status:
        data.rollback_status !== undefined ? data.rollback_status : row.rollback_status,
      metadata: data.metadata || row.metadata,
    });
  }

  static async updateTargetStatus(
    targetId: string,
    data: {
      rollback_action?: string | null;
      rollback_status?: string;
      rollback_timestamp?: Date | string | null;
      metadata?: Record<string, unknown>;
    }
  ) {
    const target = await MigrationCreatedTarget.findByPk(targetId);

    if (!target) {
      throw new Error('Migration created target not found.');
    }

    return target.update({
      rollback_action:
        data.rollback_action !== undefined ? data.rollback_action : target.rollback_action,
      rollback_status: data.rollback_status
        ? String(data.rollback_status).trim().toUpperCase()
        : target.rollback_status,
      rollback_timestamp:
        data.rollback_timestamp !== undefined
          ? data.rollback_timestamp
          : target.rollback_timestamp,
      metadata: data.metadata || target.metadata,
    });
  }

  static async recordAuditEvent(
    batchId: string,
    action: string,
    actorId: string | null,
    oldValues: Record<string, unknown> | null,
    newValues: Record<string, unknown> | null,
    reason: string | null,
    transaction?: any
  ) {
    const normalizedAction = String(action || '').trim().toUpperCase();

    if (!this.auditActions.includes(normalizedAction)) {
      throw new Error('Unsupported migration audit action.');
    }

    return AuditService.log(
      {
        table_name: 'migration_batches',
        row_id: batchId,
        action: normalizedAction,
        actor_id: actorId,
        old_values: oldValues,
        new_values: newValues,
        reason,
      },
      transaction
    );
  }

  private static normalizeBatchStatus(status: string) {
    const normalized = String(status || '').trim().toUpperCase();

    if (!this.batchStatuses.includes(normalized)) {
      throw new Error('Invalid migration batch status.');
    }

    return normalized;
  }

  private static normalizeRowStatus(status: string) {
    const normalized = String(status || '').trim().toUpperCase();

    if (!this.rowStatuses.includes(normalized)) {
      throw new Error('Invalid migration row status.');
    }

    return normalized;
  }

  private static auditActionForBatchStatus(status: string) {
    if (status === 'DRY_RUN') return 'MIGRATION_DRY_RUN_CREATED';
    if (status === 'APPROVED') return 'MIGRATION_APPROVED';
    if (status === 'COMPLETE') return 'MIGRATION_EXECUTED';
    if (status === 'ROLLED_BACK' || status === 'PARTIALLY_ROLLED_BACK') {
      return 'MIGRATION_ROLLED_BACK';
    }

    return null;
  }
}
