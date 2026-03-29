import {
  sequelize,
  Workpack,
  WorkpackStatus,
  WorkpackTask,
  TaskCard,
  TaskTemplate,
  Aircraft,
} from '../../models/index.js';
import { AuditService } from '../audit/audit.service.js';

type WorkpackStatusCode =
  | 'DRAFT'
  | 'ISSUED'
  | 'IN_PROGRESS'
  | 'CERTIFIED';

type TaskStatusCode =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'COMPLETED_BY_MECHANIC'
  | 'CERTIFIED_BY_ENGINEER'
  | 'SIGNED'
  | 'LOCKED';

export class WorkpackService {

  /* ============================================================
     STATE MACHINE
  ============================================================ */

  private static allowedTransitions: Record<WorkpackStatusCode, WorkpackStatusCode[]> = {
    DRAFT: ['ISSUED'],
    ISSUED: ['IN_PROGRESS'],
    IN_PROGRESS: ['CERTIFIED'],
    CERTIFIED: [],
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

  private static async getExecutablePackForTask(taskId: string, transaction: any) {
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

      const existingWorkOrder = await Workpack.findOne({
        where: { work_order_number: data.work_order_number },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (existingWorkOrder) {
        throw new Error('WORKPACK_ALREADY_EXISTS');
      }

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

      if (tasks.length === 0) {
        throw new Error('Cannot close: Workpack has no tasks');
      }

      if (tasks.some(t => t.status !== 'CERTIFIED_BY_ENGINEER')) {
        throw new Error('Cannot close: Tasks not engineer certified');
      }

      (pack as any).certified_by = actorId ?? null;
      (pack as any).certified_at = new Date();

      await this.transition(pack, 'CERTIFIED', actorId, transaction);
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

  /* ============================================================
     ADD TASK FROM TEMPLATE
  ============================================================ */

  static async addTaskFromTemplate(workpackId: string, templateId: string, actorId?: string) {

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

      const aircraft = await Aircraft.findByPk(pack.aircraft_id, { transaction });
      if (!aircraft) throw new Error('INVALID_AIRCRAFT');

      const template = await TaskTemplate.findByPk(templateId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!template || !template.is_active) {
        throw new Error('TASK_TEMPLATE_NOT_FOUND');
      }

      if (template.scope === 'MODEL' && template.aircraft_model_id !== aircraft.model_id) {
        throw new Error('TASK_TEMPLATE_NOT_COMPATIBLE_WITH_AIRCRAFT');
      }

      if (template.scope === 'AIRCRAFT' && template.aircraft_id !== aircraft.id) {
        throw new Error('TASK_TEMPLATE_NOT_COMPATIBLE_WITH_AIRCRAFT');
      }

      const existingTemplateTaskLinks = await WorkpackTask.findAll({
        where: { workpack_id: workpackId },
        transaction
      });

      const existingTemplateTaskIds = existingTemplateTaskLinks.map((link) => link.task_id);

      if (existingTemplateTaskIds.length > 0) {
        const existingTemplateTask = await TaskCard.findOne({
          where: {
            id: existingTemplateTaskIds,
            template_source_id: template.id
          },
          transaction
        });

        if (existingTemplateTask) {
          throw new Error('TASK_TEMPLATE_ALREADY_ADDED_TO_WORKPACK');
        }
      }

      const task = await TaskCard.create({
        title: template.title,
        description: template.description,
        status: 'OPEN',
        template_source_id: template.id,
        aircraft_id: aircraft.id,
        component_id: null,
        version: 0
      }, { transaction });

      await WorkpackTask.create({
        workpack_id: workpackId,
        task_id: task.id
      }, { transaction });

      await AuditService.log({
        table_name: 'task_cards',
        row_id: task.id,
        action: 'CREATE_FROM_TEMPLATE',
        actor_id: actorId ?? null,
        new_values: { template_id: template.id, title: task.title }
      }, transaction);

      await AuditService.log({
        table_name: 'workpacks',
        row_id: workpackId,
        action: 'TASK_TEMPLATE_ADDED',
        actor_id: actorId ?? null,
        new_values: { template_id: template.id, task_id: task.id }
      }, transaction);
    });
  }

  /* ============================================================
     DELETE DRAFT WORKPACK
  ============================================================ */

  static async deleteDraft(workpackId: string, actorId?: string) {

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
        throw new Error('ONLY_DRAFT_WORKPACKS_CAN_BE_DELETED');
      }

      await WorkpackTask.destroy({
        where: { workpack_id: workpackId },
        transaction
      });

      await AuditService.log({
        table_name: 'workpacks',
        row_id: workpackId,
        action: 'DELETE_DRAFT',
        actor_id: actorId ?? null
      }, transaction);

      await pack.destroy({ transaction });
    });
  }

  /* ============================================================
     START TASK (MECHANIC)
  ============================================================ */

  static async startTask(taskId: string, actorId?: string) {

    this.requireAuth(actorId);

    return sequelize.transaction(async (transaction) => {

      const task = await TaskCard.findByPk(taskId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!task) throw new Error('TASK_NOT_FOUND');

      const { pack, status } = await this.getExecutablePackForTask(taskId, transaction);

      if (status.code === 'ISSUED') {
        await this.transition(pack, 'IN_PROGRESS', actorId, transaction);
      }

      if (task.status !== 'OPEN') {
        throw new Error('TASK_START_BLOCKED');
      }

      task.status = 'IN_PROGRESS' as TaskStatusCode;
      task.assigned_to = actorId ?? null;
      task.version = (task.version || 0) + 1;

      await task.save({ transaction });

      await AuditService.log({
        table_name: 'task_cards',
        row_id: task.id,
        action: 'TASK_STARTED',
        actor_id: actorId ?? null,
        new_values: { status: 'IN_PROGRESS' }
      }, transaction);

      return task;
    });
  }

  /* ============================================================
     COMPLETE TASK (MECHANIC)
  ============================================================ */

  static async completeTask(taskId: string, actorId?: string) {

    this.requireAuth(actorId);

    return sequelize.transaction(async (transaction) => {

      const task = await TaskCard.findByPk(taskId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!task) throw new Error('TASK_NOT_FOUND');

      const { pack, status } = await this.getExecutablePackForTask(taskId, transaction);

      if (status.code === 'ISSUED') {
        await this.transition(pack, 'IN_PROGRESS', actorId, transaction);
      }

      if (!['IN_PROGRESS'].includes(task.status)) {
        throw new Error('TASK_COMPLETE_BLOCKED');
      }

      task.status = 'COMPLETED_BY_MECHANIC' as TaskStatusCode;
      task.assigned_to = actorId ?? null;
      (task as any).mechanic_completed_by = actorId ?? null;
      (task as any).mechanic_completed_at = new Date();
      task.version = (task.version || 0) + 1;

      await task.save({ transaction });

      await AuditService.log({
        table_name: 'task_cards',
        row_id: task.id,
        action: 'TASK_COMPLETED_BY_MECHANIC',
        actor_id: actorId ?? null,
        new_values: { status: 'COMPLETED_BY_MECHANIC' }
      }, transaction);

      return task;
    });
  }

  /* ============================================================
     CERTIFY TASK (ENGINEER)
  ============================================================ */

  static async signTask(taskId: string, actorId?: string) {

    this.requireAuth(actorId);

    return sequelize.transaction(async (transaction) => {

      const task = await TaskCard.findByPk(taskId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!task) throw new Error('TASK_NOT_FOUND');

      await this.getExecutablePackForTask(taskId, transaction);

      if (task.status !== 'COMPLETED_BY_MECHANIC') {
        throw new Error('TASK_CERTIFY_BLOCKED');
      }

      task.status = 'CERTIFIED_BY_ENGINEER' as TaskStatusCode;
      (task as any).engineer_certified_by = actorId ?? null;
      (task as any).engineer_certified_at = new Date();
      task.version = (task.version || 0) + 1;

      await task.save({ transaction });

      await AuditService.log({
        table_name: 'task_cards',
        row_id: task.id,
        action: 'TASK_CERTIFIED_BY_ENGINEER',
        actor_id: actorId ?? null,
        new_values: { status: 'CERTIFIED_BY_ENGINEER' }
      }, transaction);

      return task;
    });
  }

  /* ============================================================
     LOCK TASK (QA/LEGACY)
  ============================================================ */

  static async lockTask(taskId: string, actorId?: string) {

    this.requireAuth(actorId);

    return sequelize.transaction(async (transaction) => {

      const task = await TaskCard.findByPk(taskId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!task) throw new Error('TASK_NOT_FOUND');

      await this.getExecutablePackForTask(taskId, transaction);

      if (!['CERTIFIED_BY_ENGINEER', 'SIGNED'].includes(task.status)) {
        throw new Error('TASK_LOCK_BLOCKED');
      }

      task.status = 'LOCKED' as TaskStatusCode;
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

  /* ============================================================
     SAVE MECHANIC WORK NOTE
  ============================================================ */

  static async saveWorkPerformed(taskId: string, workPerformed: string, actorId?: string) {

    this.requireAuth(actorId);

    return sequelize.transaction(async (transaction) => {

      const task = await TaskCard.findByPk(taskId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!task) throw new Error('TASK_NOT_FOUND');

      const { pack, status } = await this.getExecutablePackForTask(taskId, transaction);

      if (status.code === 'ISSUED') {
        await this.transition(pack, 'IN_PROGRESS', actorId, transaction);
      }

      if (['CERTIFIED_BY_ENGINEER', 'LOCKED'].includes(task.status)) {
        throw new Error('TASK_NOTE_EDIT_BLOCKED');
      }

      task.work_performed = workPerformed?.trim() || null;
      task.assigned_to = actorId ?? null;
      task.version = (task.version || 0) + 1;

      await task.save({ transaction });

      await AuditService.log({
        table_name: 'task_cards',
        row_id: task.id,
        action: 'TASK_WORK_NOTE_UPDATED',
        actor_id: actorId ?? null,
        new_values: { work_performed: task.work_performed }
      }, transaction);

      return task;
    });
  }
}
