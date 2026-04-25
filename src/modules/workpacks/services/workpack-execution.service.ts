import {
  Workpack,
  WorkpackExecution,
  WorkpackSignature,
  WorkpackStatus,
  WorkpackTask,
} from '../../../models/index.js';

export class WorkpackExecutionService {
  static mapTaskStatusToExecutionStatus(taskStatus: string): string {
    if (taskStatus === 'IN_PROGRESS') return 'IN_PROGRESS';
    if (taskStatus === 'COMPLETED_BY_MECHANIC') return 'COMPLETED_BY_MECHANIC';
    if (taskStatus === 'CERTIFIED_BY_ENGINEER' || taskStatus === 'SIGNED' || taskStatus === 'LOCKED') {
      return 'CERTIFIED_BY_ENGINEER';
    }

    return 'OPEN';
  }

  static async recordExecutionSignature(
    executionId: string,
    role: 'MECHANIC' | 'ENGINEER',
    signatureType: 'WORK' | 'REVIEW' | 'APPROVAL',
    userId: string | undefined,
    transaction: any
  ) {
    if (!userId) {
      return;
    }

    const existingSignature = await WorkpackSignature.findOne({
      where: {
        execution_id: executionId,
        role,
        signature_type: signatureType,
        user_id: userId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (existingSignature) {
      existingSignature.signed_at = new Date();
      await existingSignature.save({ transaction });
      return;
    }

    await WorkpackSignature.create(
      {
        execution_id: executionId,
        role,
        signature_type: signatureType,
        user_id: userId,
        signed_at: new Date(),
      },
      { transaction }
    );
  }

  static async getLatestExecution(
    workpackId: string,
    taskId: string,
    transaction: any
  ) {
    return WorkpackExecution.findOne({
      where: {
        workpack_id: workpackId,
        task_id: taskId,
      },
      order: [['attempt_no', 'DESC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  }

  static async ensureExecutionForTask(
    packId: string,
    task: any,
    actorId: string | undefined,
    transaction: any
  ) {
    const existing = await this.getLatestExecution(packId, task.id, transaction);
    if (existing) {
      return existing;
    }

    const executionStatus = this.mapTaskStatusToExecutionStatus(task.status);
    const execution = await WorkpackExecution.create(
      {
        workpack_id: packId,
        task_id: task.id,
        attempt_no: 1,
        status: executionStatus,
        started_by:
          executionStatus !== 'OPEN' ? ((task as any).assigned_to || actorId || null) : null,
        completed_by: (task as any).mechanic_completed_by || null,
        certified_by: (task as any).engineer_certified_by || null,
        started_at:
          executionStatus !== 'OPEN'
            ? ((task as any).updated_at || new Date())
            : null,
        completed_at: (task as any).mechanic_completed_at || null,
        certified_at: (task as any).engineer_certified_at || null,
        version: 1,
      },
      { transaction }
    );

    return execution;
  }

  static async getExecutablePackForTask(taskId: string, transaction: any) {
    const links = await WorkpackTask.findAll({
      where: { task_id: taskId },
      transaction
    });

    if (links.length === 0) {
      throw new Error('TASK_NOT_ASSIGNED_TO_WORKPACK');
    }

    const workpackIds = links.map(link => link.workpack_id);
    const packs = await Workpack.findAll({
      where: { id: workpackIds },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    const packStatuses = await WorkpackStatus.findAll({
      where: { id: packs.map(pack => pack.status_id) },
      transaction
    });

    const statusById = new Map(packStatuses.map(status => [status.id, status]));

    const inProgressPack = packs.find(pack => statusById.get(pack.status_id)?.code === 'IN_PROGRESS');
    if (inProgressPack) {
      return {
        pack: inProgressPack,
        status: statusById.get(inProgressPack.status_id)!
      };
    }

    const issuedPack = packs.find(pack => statusById.get(pack.status_id)?.code === 'ISSUED');
    if (issuedPack) {
      return {
        pack: issuedPack,
        status: statusById.get(issuedPack.status_id)!
      };
    }

    throw new Error('TASK_NOT_IN_EXECUTABLE_WORKPACK');
  }
}
