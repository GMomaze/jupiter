import { WorkpackAuditLog, WorkpackSnagAuditLog } from '../../../models/index.js';
import { createHash } from 'crypto';
import type { TenantQueryAuthority } from '../../tenancy/tenant-query-authority.js';
import { assertTenantQueryAuthority } from '../../tenancy/tenant-query-authority.js';
import { workpackTenantRepository } from '../workpack-tenant.repository.js';

export class WorkpackAuditService {
  static async getSnagAuditEntries(
    authority: TenantQueryAuthority,
    snagId: string,
    transaction?: any,
  ) {
    assertTenantQueryAuthority(authority);
    const snag = await workpackTenantRepository.getSnagById(
      authority, snagId, transaction ? { transaction } : {}
    );
    if (!snag) return [];
    return WorkpackSnagAuditLog.findAll({
      where: { snag_id: snag.id },
      order: [['sequence', 'ASC']],
      ...(transaction ? { transaction } : {}),
    });
  }

  static async appendExecutionAuditEntry(
    params: {
      executionId: string;
      workpackId: string;
      taskId: string;
      userId?: string | undefined;
      action: string;
      field?: string | null;
      oldValue?: unknown;
      newValue?: unknown;
      metadata?: Record<string, unknown>;
    },
    transaction: any
  ) {
    const latestEntry = await WorkpackAuditLog.findOne({
      where: { execution_id: params.executionId },
      order: [['sequence', 'DESC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const sequence = latestEntry ? latestEntry.sequence + 1 : 1;
    const previousHash = latestEntry?.hash || '';
    const normalizedOldValue = params.oldValue ?? {};
    const normalizedNewValue = params.newValue ?? {};
    const payload = JSON.stringify({
      execution_id: params.executionId,
      workpack_id: params.workpackId,
      task_id: params.taskId,
      user_id: params.userId || null,
      action: params.action,
      field: params.field || null,
      old_value: normalizedOldValue,
      new_value: normalizedNewValue,
      metadata: params.metadata || {},
      previous_hash: previousHash,
      sequence,
    });
    const hash = createHash('sha256').update(payload).digest('hex');

    await WorkpackAuditLog.create(
      {
        execution_id: params.executionId,
        workpack_id: params.workpackId,
        task_id: params.taskId,
        user_id: params.userId ?? null,
        action: params.action,
        field: params.field || null,
        old_value: normalizedOldValue,
        new_value: normalizedNewValue,
        metadata: params.metadata || {},
        previous_hash: previousHash,
        hash,
        sequence,
      },
      { transaction }
    );
  }

  static async appendSnagAuditEntry(
    params: {
      snagId: string;
      workpackId: string | null;
      userId?: string | undefined;
      action: string;
      field?: string | null;
      oldValue?: unknown;
      newValue?: unknown;
      metadata?: Record<string, unknown>;
    },
    transaction: any
  ) {
    const latestEntry = await WorkpackSnagAuditLog.findOne({
      where: { snag_id: params.snagId },
      order: [['sequence', 'DESC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const sequence = latestEntry ? latestEntry.sequence + 1 : 1;
    const previousHash = latestEntry?.hash || '';
    const normalizedOldValue = params.oldValue ?? {};
    const normalizedNewValue = params.newValue ?? {};
    const payload = JSON.stringify({
      snag_id: params.snagId,
      workpack_id: params.workpackId,
      user_id: params.userId || null,
      action: params.action,
      field: params.field || null,
      old_value: normalizedOldValue,
      new_value: normalizedNewValue,
      metadata: params.metadata || {},
      previous_hash: previousHash,
      sequence,
    });
    const hash = createHash('sha256').update(payload).digest('hex');

    await WorkpackSnagAuditLog.create(
      {
        snag_id: params.snagId,
        workpack_id: params.workpackId,
        user_id: params.userId ?? null,
        action: params.action,
        field: params.field || null,
        old_value: normalizedOldValue,
        new_value: normalizedNewValue,
        metadata: params.metadata || {},
        previous_hash: previousHash,
        hash,
        sequence,
      },
      { transaction }
    );
  }
}
