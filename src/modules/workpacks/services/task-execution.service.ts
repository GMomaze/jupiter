import { TaskCard } from '../../../models/index.js';
import { AuditService } from '../../audit/audit.service.js';
import { MeasurementService } from './measurement.service.js';
import { SnagService } from './snag.service.js';
import { WorkpackAuditService } from './workpack-audit.service.js';
import { WorkpackExecutionService } from './workpack-execution.service.js';

type TransitionPack = {
  id: string;
};

type ExecutablePackStatus = {
  code: string;
};

type ExecutablePackResult = {
  pack: any;
  status: ExecutablePackStatus;
};

export class TaskExecutionService {
  static async createExecutionSnag(params: {
    workpack_id?: string | null;
    aircraft_id: string;
    component_id?: string | null;
    defect_text: string;
    created_by: string;
  }) {
    return SnagService.createSnag(params);
  }

  static async getExecutionSnags(workpackId: string) {
    return SnagService.getSnagsForWorkpack(workpackId);
  }

  static async getOpenExecutionSnags(workpackId: string) {
    return SnagService.getOpenSnagsForWorkpack(workpackId);
  }

  static async startTask(
    taskId: string,
    actorId: string | undefined,
    actorRoles: string[],
    sequelize: any,
    requireAuth: (actorId?: string) => void,
    canStartTaskAsMechanic: (
      task: any,
      actorId: string | undefined,
      actorRoles: string[]
    ) => boolean,
    getExecutablePackForTask: (
      taskId: string,
      transaction: any
    ) => Promise<ExecutablePackResult>,
    transition: (
      pack: TransitionPack,
      target: 'IN_PROGRESS',
      actorId: string | undefined,
      transaction: any
    ) => Promise<void>,
    ensureExecutionForTask: (
      packId: string,
      task: any,
      actorId: string | undefined,
      transaction: any
    ) => Promise<any>
  ) {
    requireAuth(actorId);

    return sequelize.transaction(async (transaction: any) => {
      const task = await TaskCard.findByPk(taskId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!task) throw new Error('TASK_NOT_FOUND');

      const { pack, status } = await getExecutablePackForTask(taskId, transaction);

      if (status.code === 'ISSUED') {
        await transition(pack, 'IN_PROGRESS', actorId, transaction);
      }

      if (task.status !== 'OPEN') {
        throw new Error('TASK_START_BLOCKED');
      }

      if (!canStartTaskAsMechanic(task, actorId, actorRoles)) {
        throw new Error('TASK_OWNED_BY_ANOTHER_MECHANIC');
      }

      const execution = await ensureExecutionForTask(pack.id, task, actorId, transaction);
      const previousTaskStatus = task.status;
      const previousExecutionStatus = execution.status;

      task.status = 'IN_PROGRESS';
      task.assigned_to = actorId ?? null;
      task.version = (task.version || 0) + 1;

      await task.save({ transaction });

      execution.status = 'IN_PROGRESS';
      execution.started_by = actorId ?? null;
      execution.started_at = new Date();
      execution.version = (execution.version || 0) + 1;
      await execution.save({ transaction });

      await AuditService.log({
        table_name: 'task_cards',
        row_id: task.id,
        action: 'TASK_STARTED',
        actor_id: actorId ?? null,
        new_values: { status: 'IN_PROGRESS' }
      }, transaction);
      await WorkpackAuditService.appendExecutionAuditEntry({
        executionId: execution.id,
        workpackId: pack.id,
        taskId: task.id,
        userId: actorId,
        action: 'TASK_STARTED',
        field: 'status',
        oldValue: {
          task_status: previousTaskStatus,
          execution_status: previousExecutionStatus,
        },
        newValue: {
          task_status: task.status,
          execution_status: execution.status,
        },
        metadata: {
          assigned_to: task.assigned_to,
          started_at: execution.started_at?.toISOString?.() || execution.started_at || null,
        },
      }, transaction);

      return task;
    });
  }

  static async completeTask(
    taskId: string,
    actorId: string | undefined,
    actorRoles: string[],
    workPerformed: string | undefined,
    measurementsPayload: unknown,
    sequelize: any,
    requireAuth: (actorId?: string) => void,
    canEditTaskAsMechanic: (
      task: any,
      actorId: string | undefined,
      actorRoles: string[]
    ) => boolean,
    getExecutablePackForTask: (
      taskId: string,
      transaction: any
    ) => Promise<ExecutablePackResult>,
    transition: (
      pack: TransitionPack,
      target: 'IN_PROGRESS',
      actorId: string | undefined,
      transaction: any
    ) => Promise<void>,
    ensureExecutionForTask: (
      packId: string,
      task: any,
      actorId: string | undefined,
      transaction: any
    ) => Promise<any>
  ) {
    requireAuth(actorId);

    return sequelize.transaction(async (transaction: any) => {
      const task = await TaskCard.findByPk(taskId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!task) throw new Error('TASK_NOT_FOUND');

      const { pack, status } = await getExecutablePackForTask(taskId, transaction);

      if (status.code === 'ISSUED') {
        await transition(pack, 'IN_PROGRESS', actorId, transaction);
      }

      if (!['IN_PROGRESS'].includes(task.status)) {
        throw new Error('TASK_COMPLETE_BLOCKED');
      }

      if (!canEditTaskAsMechanic(task, actorId, actorRoles)) {
        throw new Error('TASK_OWNED_BY_ANOTHER_MECHANIC');
      }

      const execution = await ensureExecutionForTask(pack.id, task, actorId, transaction);
      const previousTaskStatus = task.status;
      const previousExecutionStatus = execution.status;
      const submittedWorkPerformed = workPerformed?.trim() || task.work_performed || null;
      const nextWorkPerformed = MeasurementService.extractCleanWorkPerformedNote(submittedWorkPerformed);

      task.work_performed = nextWorkPerformed;

      task.status = 'COMPLETED_BY_MECHANIC';
      task.assigned_to = actorId ?? null;
      (task as any).mechanic_completed_by = actorId ?? null;
      (task as any).mechanic_completed_at = new Date();
      task.version = (task.version || 0) + 1;

      await task.save({ transaction });

      if (!execution.started_at) {
        execution.started_at = new Date();
      }
      if (!execution.started_by) {
        execution.started_by = actorId ?? null;
      }
      execution.status = 'COMPLETED_BY_MECHANIC';
      execution.completed_by = actorId ?? null;
      execution.completed_at = new Date();
      execution.version = (execution.version || 0) + 1;
      await execution.save({ transaction });
      await MeasurementService.syncExecutionMeasurements(
        execution.id,
        task.description,
        submittedWorkPerformed,
        measurementsPayload,
        transaction
      );
      await WorkpackExecutionService.recordExecutionSignature(
        execution.id,
        'MECHANIC',
        'WORK',
        actorId,
        transaction
      );

      await AuditService.log({
        table_name: 'task_cards',
        row_id: task.id,
        action: 'TASK_COMPLETED_BY_MECHANIC',
        actor_id: actorId ?? null,
        new_values: { status: 'COMPLETED_BY_MECHANIC' }
      }, transaction);
      await WorkpackAuditService.appendExecutionAuditEntry({
        executionId: execution.id,
        workpackId: pack.id,
        taskId: task.id,
        userId: actorId,
        action: 'TASK_COMPLETED_BY_MECHANIC',
        field: 'status',
        oldValue: {
          task_status: previousTaskStatus,
          execution_status: previousExecutionStatus,
        },
        newValue: {
          task_status: task.status,
          execution_status: execution.status,
        },
        metadata: {
          completed_at: execution.completed_at?.toISOString?.() || execution.completed_at || null,
        },
      }, transaction);
      await WorkpackAuditService.appendExecutionAuditEntry({
        executionId: execution.id,
        workpackId: pack.id,
        taskId: task.id,
        userId: actorId,
        action: 'SIGNATURE_RECORDED',
        field: 'mechanic_signature',
        oldValue: null,
        newValue: {
          role: 'MECHANIC',
          signature_type: 'WORK',
          user_id: actorId ?? null,
        },
        metadata: {
          signed_at: new Date().toISOString(),
        },
      }, transaction);

      return task;
    });
  }

  static async signTask(
    taskId: string,
    actorId: string | undefined,
    actorRoles: string[],
    sequelize: any,
    requireAuth: (actorId?: string) => void,
    getExecutablePackForTask: (
      taskId: string,
      transaction: any
    ) => Promise<ExecutablePackResult>,
    getLatestExecution: (
      packId: string,
      taskId: string,
      transaction: any
    ) => Promise<any>
  ) {
    requireAuth(actorId);

    return sequelize.transaction(async (transaction: any) => {
      if (!actorRoles.includes('ENGINEER')) {
        throw new Error('TASK_CERTIFY_ROLE_BLOCKED');
      }

      const task = await TaskCard.findByPk(taskId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!task) throw new Error('TASK_NOT_FOUND');

      const { pack } = await getExecutablePackForTask(taskId, transaction);

      if (task.status === 'LOCKED') {
        throw new Error('TASK_CERTIFY_LOCKED');
      }

      if (task.status !== 'COMPLETED_BY_MECHANIC') {
        throw new Error('TASK_CERTIFY_BLOCKED');
      }

      const execution = await getLatestExecution(pack.id, task.id, transaction);
      if (!execution) {
        throw new Error('TASK_CERTIFY_EXECUTION_MISSING');
      }

      if (execution.status !== 'COMPLETED_BY_MECHANIC') {
        throw new Error('TASK_CERTIFY_EXECUTION_BLOCKED');
      }

      const previousTaskStatus = task.status;
      const previousExecutionStatus = execution.status;
      const certificationTimestamp = new Date();

      task.status = 'CERTIFIED_BY_ENGINEER';
      (task as any).engineer_certified_by = actorId ?? null;
      (task as any).engineer_certified_at = certificationTimestamp;
      task.version = (task.version || 0) + 1;

      await task.save({ transaction });

      execution.status = 'CERTIFIED_BY_ENGINEER';
      execution.certified_by = actorId ?? null;
      execution.certified_at = certificationTimestamp;
      execution.version = (execution.version || 0) + 1;
      await execution.save({ transaction });

      await AuditService.log({
        table_name: 'task_cards',
        row_id: task.id,
        action: 'TASK_CERTIFIED_BY_ENGINEER',
        actor_id: actorId ?? null,
        new_values: { status: 'CERTIFIED_BY_ENGINEER' }
      }, transaction);
      await WorkpackAuditService.appendExecutionAuditEntry({
        executionId: execution.id,
        workpackId: pack.id,
        taskId: task.id,
        userId: actorId,
        action: 'TASK_CERTIFIED_BY_ENGINEER',
        field: 'status',
        oldValue: {
          task_status: previousTaskStatus,
          execution_status: previousExecutionStatus,
        },
        newValue: {
          task_status: task.status,
          execution_status: execution.status,
        },
        metadata: {
          certified_at: execution.certified_at?.toISOString?.() || execution.certified_at || null,
        },
      }, transaction);

      return task;
    });
  }

  static async lockTask(
    taskId: string,
    actorId: string | undefined,
    sequelize: any,
    requireAuth: (actorId?: string) => void,
    getExecutablePackForTask: (
      taskId: string,
      transaction: any
    ) => Promise<ExecutablePackResult>
  ) {
    requireAuth(actorId);

    return sequelize.transaction(async (transaction: any) => {
      const task = await TaskCard.findByPk(taskId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!task) throw new Error('TASK_NOT_FOUND');

      await getExecutablePackForTask(taskId, transaction);

      if (task.status !== 'CERTIFIED_BY_ENGINEER') {
        throw new Error('TASK_LOCK_BLOCKED');
      }

      task.status = 'LOCKED';
      task.version = (task.version || 0) + 1;

      await task.save({ transaction });

      await AuditService.log({
        table_name: 'task_cards',
        row_id: task.id,
        action: 'TASK_LOCKED',
        actor_id: actorId ?? null,
        new_values: { status: 'LOCKED' }
      }, transaction);

      return task;
    });
  }

  static async saveWorkPerformed(
    taskId: string,
    workPerformed: string,
    actorId: string | undefined,
    actorRoles: string[],
    measurementsPayload: unknown,
    sequelize: any,
    requireAuth: (actorId?: string) => void,
    canEditTaskAsMechanic: (
      task: any,
      actorId: string | undefined,
      actorRoles: string[]
    ) => boolean,
    getExecutablePackForTask: (
      taskId: string,
      transaction: any
    ) => Promise<ExecutablePackResult>,
    transition: (
      pack: TransitionPack,
      target: 'IN_PROGRESS',
      actorId: string | undefined,
      transaction: any
    ) => Promise<void>,
    ensureExecutionForTask: (
      packId: string,
      task: any,
      actorId: string | undefined,
      transaction: any
    ) => Promise<any>
  ) {
    requireAuth(actorId);

    return sequelize.transaction(async (transaction: any) => {
      const task = await TaskCard.findByPk(taskId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!task) throw new Error('TASK_NOT_FOUND');

      const { pack, status } = await getExecutablePackForTask(taskId, transaction);

      if (status.code === 'ISSUED') {
        await transition(pack, 'IN_PROGRESS', actorId, transaction);
      }

      if (task.status !== 'IN_PROGRESS') {
        throw new Error('TASK_NOT_STARTED');
      }

      if (['CERTIFIED_BY_ENGINEER', 'LOCKED'].includes(task.status)) {
        throw new Error('TASK_NOTE_EDIT_BLOCKED');
      }

      if (!canEditTaskAsMechanic(task, actorId, actorRoles)) {
        throw new Error('TASK_OWNED_BY_ANOTHER_MECHANIC');
      }

      const execution = await ensureExecutionForTask(pack.id, task, actorId, transaction);
      const previousWorkPerformed = task.work_performed || null;
      const previousMeasurements = MeasurementService.buildMeasurementSnapshot(task.description, previousWorkPerformed);
      const previousNote = MeasurementService.splitWorkPerformed(previousWorkPerformed).note;
      const submittedWorkPerformed = workPerformed?.trim() || null;
      const nextWorkPerformed = MeasurementService.extractCleanWorkPerformedNote(submittedWorkPerformed);

      task.work_performed = nextWorkPerformed;
      task.assigned_to = actorId ?? null;
      task.version = (task.version || 0) + 1;

      await task.save({ transaction });

      execution.status = WorkpackExecutionService.mapTaskStatusToExecutionStatus(task.status);
      execution.version = (execution.version || 0) + 1;

      if (execution.status !== 'OPEN' && !execution.started_at) {
        execution.started_at = new Date();
      }

      if (execution.status !== 'OPEN' && !execution.started_by) {
        execution.started_by = actorId ?? null;
      }

      await execution.save({ transaction });
      await MeasurementService.syncExecutionMeasurements(
        execution.id,
        task.description,
        submittedWorkPerformed,
        measurementsPayload,
        transaction
      );
      const nextMeasurements = MeasurementService.buildMeasurementSnapshot(
        task.description,
        submittedWorkPerformed,
        measurementsPayload
      );
      const nextNote = MeasurementService.splitWorkPerformed(task.work_performed).note;

      await AuditService.log({
        table_name: 'task_cards',
        row_id: task.id,
        action: 'TASK_WORK_NOTE_UPDATED',
        actor_id: actorId ?? null,
        new_values: { work_performed: task.work_performed }
      }, transaction);
      await WorkpackAuditService.appendExecutionAuditEntry({
        executionId: execution.id,
        workpackId: pack.id,
        taskId: task.id,
        userId: actorId,
        action: 'TASK_WORK_NOTE_UPDATED',
        field: 'work_performed',
        oldValue: {
          note: previousNote,
          measurements: previousMeasurements,
        },
        newValue: {
          note: nextNote,
          measurements: nextMeasurements,
        },
        metadata: {
          measurement_count: nextMeasurements.length,
        },
      }, transaction);

      return task;
    });
  }
}
