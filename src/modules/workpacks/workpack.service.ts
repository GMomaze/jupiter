import {
  sequelize,
  Workpack,
  WorkpackStatus,
  WorkpackTask,
  TaskCard,
  Aircraft,
} from '../../models/index.js';
import { AuditService } from '../audit/audit.service.js';

type WorkpackStatusCode =
  | 'DRAFT'
  | 'ISSUED'
  | 'IN_PROGRESS'
  | 'CLOSED';

export class WorkpackService {

  /* ============================================================
     STATE MACHINE
  ============================================================ */

  private static allowedTransitions: Record<WorkpackStatusCode, WorkpackStatusCode[]> = {
    DRAFT: ['ISSUED'],
    ISSUED: ['IN_PROGRESS'],
    IN_PROGRESS: ['CLOSED'],
    CLOSED: [],
  };

  private static validateTransition(current: WorkpackStatusCode, target: WorkpackStatusCode) {
    if (!this.allowedTransitions[current]?.includes(target)) {
      throw new Error(`INVALID_WORKPACK_TRANSITION: ${current} → ${target}`);
    }
  }

  private static requireAuth(actorId?: string) {
    if (process.env.NODE_ENV !== 'test' && !actorId) {
      throw new Error('UNAUTHENTICATED');
    }
  }

  /* ============================================================
     CREATE
  ============================================================ */

  static async create(
    data: { work_order_number: string; aircraft_id: string },
    actorId?: string
  ) {

    this.requireAuth(actorId);

    return sequelize.transaction(async (transaction) => {

      const aircraft = await Aircraft.findByPk(data.aircraft_id, { transaction });
      if (!aircraft) throw new Error('INVALID_AIRCRAFT');

      const draftStatus = await WorkpackStatus.findOne({
        where: { code: 'DRAFT' },
        transaction
      });

      if (!draftStatus) throw new Error('WORKPACK_STATUS_DRAFT_NOT_FOUND');

      const existingDraft = await Workpack.findOne({
        where: {
          aircraft_id: data.aircraft_id,
          status_id: draftStatus.id
        },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (existingDraft) {
        throw new Error('VALIDATION_FAILED: Aircraft already has DRAFT.');
      }

      const pack = await Workpack.create({
        work_order_number: data.work_order_number,
        aircraft_id: data.aircraft_id,
        status_id: draftStatus.id,
        version: 0
      }, { transaction });

      await AuditService.log({
        table_name: 'workpacks',
        row_id: pack.id,
        action: 'CREATE',
        actor_id: actorId ?? null
      }, transaction);

      return pack;
    });
  }

  /* ============================================================
     INTERNAL TRANSITION
  ============================================================ */

  private static async transition(
    pack: Workpack,
    target: WorkpackStatusCode,
    actorId: string | undefined,
    transaction: any
  ) {

    const currentStatus = await WorkpackStatus.findByPk(pack.status_id, { transaction });
    if (!currentStatus) throw new Error('STATUS_NOT_FOUND');

    this.validateTransition(currentStatus.code as WorkpackStatusCode, target);

    const targetStatus = await WorkpackStatus.findOne({
      where: { code: target },
      transaction
    });

    if (!targetStatus) throw new Error('TARGET_STATUS_NOT_FOUND');

    pack.status_id = targetStatus.id;
    pack.version = pack.version + 1;

    await pack.save({ transaction });

    await AuditService.log({
      table_name: 'workpacks',
      row_id: pack.id,
      action: 'STATUS_CHANGE',
      actor_id: actorId ?? null,
      new_values: { status: target }
    }, transaction);
  }

  /* ============================================================
     ISSUE
  ============================================================ */

  static async issue(id: string, actorId?: string) {

    this.requireAuth(actorId);

    return sequelize.transaction(async (transaction) => {

      const pack = await Workpack.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!pack) throw new Error('WORKPACK_NOT_FOUND');

      const currentStatus = await WorkpackStatus.findByPk(pack.status_id, { transaction });
      if (!currentStatus) throw new Error('STATUS_NOT_FOUND');

      // STRICT: Only DRAFT can issue
      if (currentStatus.code !== 'DRAFT') {
        throw new Error('MUTATION_BLOCKED');
      }

      // Check tasks BEFORE transition
      const taskLinks = await WorkpackTask.findAll({
        where: { workpack_id: id },
        transaction
      });

      if (taskLinks.length === 0) {
        throw new Error('Cannot issue an empty workpack');
      }

      const taskIds = taskLinks.map(t => t.task_id);

      const tasks = await TaskCard.findAll({
        where: { id: taskIds },
        transaction
      });

      if (tasks.some(t => t.status !== 'OPEN')) {
        throw new Error('ISSUE_FAILED: Tasks must be OPEN');
      }

      await this.transition(pack, 'ISSUED', actorId, transaction);
    });
  }

  /* ============================================================
     START WORK
  ============================================================ */

  static async startWork(id: string, actorId?: string) {

    this.requireAuth(actorId);

    return sequelize.transaction(async (transaction) => {

      const pack = await Workpack.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!pack) throw new Error('WORKPACK_NOT_FOUND');

      const currentStatus = await WorkpackStatus.findByPk(pack.status_id, { transaction });
      if (!currentStatus) throw new Error('STATUS_NOT_FOUND');

      if (currentStatus.code !== 'ISSUED') {
        throw new Error('MUTATION_BLOCKED');
      }

      await this.transition(pack, 'IN_PROGRESS', actorId, transaction);
    });
  }

  /* ============================================================
     CLOSE
  ============================================================ */

  static async close(id: string, actorId?: string) {

    this.requireAuth(actorId);

    return sequelize.transaction(async (transaction) => {

      const pack = await Workpack.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!pack) throw new Error('WORKPACK_NOT_FOUND');

      const currentStatus = await WorkpackStatus.findByPk(pack.status_id, { transaction });
      if (!currentStatus) throw new Error('STATUS_NOT_FOUND');

      if (currentStatus.code !== 'IN_PROGRESS') {
        throw new Error('MUTATION_BLOCKED');
      }

      const taskLinks = await WorkpackTask.findAll({
        where: { workpack_id: id },
        transaction
      });

      const taskIds = taskLinks.map(t => t.task_id);

      const tasks = await TaskCard.findAll({
        where: { id: taskIds },
        transaction
      });

      if (tasks.some(t => t.status !== 'LOCKED')) {
        throw new Error('Cannot close: Tasks not LOCKED');
      }

      await this.transition(pack, 'CLOSED', actorId, transaction);
    });
  }

  /* ============================================================
     ADD TASK
  ============================================================ */

  static async addTask(workpackId: string, taskId: string, actorId?: string) {

    this.requireAuth(actorId);

    return sequelize.transaction(async (transaction) => {

      const pack = await Workpack.findByPk(workpackId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!pack) throw new Error('WORKPACK_NOT_FOUND');

      const status = await WorkpackStatus.findByPk(pack.status_id, { transaction });
      if (!status) throw new Error('STATUS_NOT_FOUND');

      if (status.code !== 'DRAFT') {
        throw new Error('MUTATION_BLOCKED');
      }

      const task = await TaskCard.findByPk(taskId, { transaction });
      if (!task) throw new Error('INVALID_TASK');

      await WorkpackTask.findOrCreate({
        where: { workpack_id: workpackId, task_id: taskId },
        transaction
      });

      await AuditService.log({
        table_name: 'workpacks',
        row_id: workpackId,
        action: 'TASK_ADDED',
        actor_id: actorId ?? null,
        new_values: { task_id: taskId }
      }, transaction);
    });
  }

  /* ============================================================
     REMOVE TASK
  ============================================================ */

  static async removeTask(workpackId: string, taskId: string, actorId?: string) {

    this.requireAuth(actorId);

    return sequelize.transaction(async (transaction) => {

      const pack = await Workpack.findByPk(workpackId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!pack) throw new Error('WORKPACK_NOT_FOUND');

      const status = await WorkpackStatus.findByPk(pack.status_id, { transaction });
      if (!status) throw new Error('STATUS_NOT_FOUND');

      if (status.code !== 'DRAFT') {
        throw new Error('MUTATION_BLOCKED');
      }

      await WorkpackTask.destroy({
        where: { workpack_id: workpackId, task_id: taskId },
        transaction
      });

      await AuditService.log({
        table_name: 'workpacks',
        row_id: workpackId,
        action: 'TASK_REMOVED',
        actor_id: actorId ?? null,
        new_values: { task_id: taskId }
      }, transaction);
    });
  }
}
