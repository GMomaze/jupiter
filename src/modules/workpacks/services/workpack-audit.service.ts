import { WorkpackAuditLog, WorkpackSnagAuditLog } from '../../../models/index.js';
import { createHash } from 'crypto';

export class WorkpackAuditService {
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
      workpackId: string;
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
