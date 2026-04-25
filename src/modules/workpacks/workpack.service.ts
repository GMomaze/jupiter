import {
  sequelize,
  Workpack,
  WorkpackStatus,
  WorkpackTask,
  TaskCard,
  WorkpackExecution,
  WorkpackMeasurement,
  WorkpackSignature,
  WorkpackSnag,
  WorkpackAuditLog,
  WorkpackSnagAuditLog,
  TaskTemplate,
  Aircraft,
  AircraftComponent,
  ServiceBulletin,
  ComponentModel,
  AircraftSbCompliance,
  Manufacturer,
  AssetType,
} from '../../models/index.js';
import { AuditService } from '../audit/audit.service.js';
import { MeasurementService } from './services/measurement.service.js';
import { WorkpackAuditService } from './services/workpack-audit.service.js';
import { WorkpackExecutionService } from './services/workpack-execution.service.js';
import { SnagService } from './services/snag.service.js';
import { TaskExecutionService } from './services/task-execution.service.js';
import { Op } from 'sequelize';

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
  private static readonly CAPTURED_VALUES_START = MeasurementService.CAPTURED_VALUES_START;
  private static readonly CAPTURED_VALUES_END = MeasurementService.CAPTURED_VALUES_END;

  private static hasAdminOverride(actorRoles: string[] = []) {
    return actorRoles.includes('ADMIN') || actorRoles.includes('SUPERVISOR');
  }

  private static canResolveSnag(
    snag: any,
    actorId: string | undefined,
    actorRoles: string[] = []
  ) {
    return SnagService.canResolveSnag(snag, actorId, actorRoles);
  }

  private static canCloseSnag(actorRoles: string[] = []) {
    return SnagService.canCloseSnag(actorRoles);
  }

  private static canEditTaskAsMechanic(
    task: any,
    actorId: string | undefined,
    actorRoles: string[] = []
  ) {
    if (this.hasAdminOverride(actorRoles)) {
      return true;
    }

    if (!actorId) {
      return false;
    }

    if (task.status !== 'IN_PROGRESS') {
      return false;
    }

    return task.assigned_to === actorId;
  }

  private static canStartTaskAsMechanic(
    task: any,
    actorId: string | undefined,
    actorRoles: string[] = []
  ) {
    if (this.hasAdminOverride(actorRoles)) {
      return true;
    }

    if (!actorId) {
      return false;
    }

    return task.status === 'OPEN';
  }

  private static mapTaskStatusToExecutionStatus(taskStatus: string): string {
    return WorkpackExecutionService.mapTaskStatusToExecutionStatus(taskStatus);
  }

  private static getMeasurementDefinitions(description: string | null | undefined) {
    return MeasurementService.getMeasurementDefinitions(description);
  }

  private static splitWorkPerformed(workPerformed: string | null | undefined) {
    return MeasurementService.splitWorkPerformed(workPerformed);
  }

  private static extractCleanWorkPerformedNote(workPerformed: string | null | undefined) {
    return MeasurementService.extractCleanWorkPerformedNote(workPerformed);
  }

  private static parseCapturedValues(captured: string) {
    return MeasurementService.parseCapturedValues(captured);
  }

  private static parseStructuredMeasurements(
    taskDescription: string | null | undefined,
    measurementsPayload: unknown
  ) {
    return MeasurementService.parseStructuredMeasurements(taskDescription, measurementsPayload);
  }

  private static buildMeasurementSnapshot(
    taskDescription: string | null | undefined,
    workPerformed: string | null | undefined,
    measurementsPayload?: unknown
  ) {
    return MeasurementService.buildMeasurementSnapshot(
      taskDescription,
      workPerformed,
      measurementsPayload
    );
  }

  private static async syncExecutionMeasurements(
    executionId: string,
    taskDescription: string | null | undefined,
    workPerformed: string | null | undefined,
    measurementsPayload: unknown,
    transaction: any
  ) {
    await MeasurementService.syncExecutionMeasurements(
      executionId,
      taskDescription,
      workPerformed,
      measurementsPayload,
      transaction
    );
  }

  private static async recordExecutionSignature(
    executionId: string,
    role: 'MECHANIC' | 'ENGINEER',
    signatureType: 'WORK' | 'REVIEW' | 'APPROVAL',
    userId: string | undefined,
    transaction: any
  ) {
    await WorkpackExecutionService.recordExecutionSignature(
      executionId,
      role,
      signatureType,
      userId,
      transaction
    );
  }

  private static async appendExecutionAuditEntry(
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
    await WorkpackAuditService.appendExecutionAuditEntry(params, transaction);
  }

  private static async appendSnagAuditEntry(
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
    await WorkpackAuditService.appendSnagAuditEntry(params, transaction);
  }

  private static async getLatestExecution(
    workpackId: string,
    taskId: string,
    transaction: any
  ) {
    return WorkpackExecutionService.getLatestExecution(workpackId, taskId, transaction);
  }

  private static async ensureExecutionForTask(
    packId: string,
    task: any,
    actorId: string | undefined,
    transaction: any
  ) {
    return WorkpackExecutionService.ensureExecutionForTask(
      packId,
      task,
      actorId,
      transaction
    );
  }

  private static async getOpenRelevantServiceBulletinsForAircraft(
    aircraftId: string,
    transaction: any
  ) {
    const aircraft = await Aircraft.findByPk(aircraftId, {
      attributes: ['id', 'model_id'],
      include: [
        {
          model: AircraftComponent,
          as: 'installed_components',
          required: false,
          attributes: ['model_id'],
        },
      ],
      transaction,
    });

    if (!aircraft) {
      throw new Error('INVALID_AIRCRAFT');
    }

    const relevantModelIds = Array.from(
      new Set([
        aircraft.model_id,
        ...((aircraft as any).installed_components || []).map(
          (component: any) => component.model_id
        ),
      ].filter(Boolean))
    );

    const bulletins = await ServiceBulletin.findAll({
      where: {
        status: 'ACTIVE',
      },
      include: [
        {
          model: ComponentModel,
          as: 'ApplicableModels',
          attributes: ['id', 'model_name', 'manufacturer_id', 'asset_type_id'],
          where: {
            id: {
              [Op.in]: relevantModelIds,
            },
          },
          through: { attributes: [] },
          include: [
            {
              model: Manufacturer,
              attributes: ['id', 'name', 'code'],
              required: false,
            },
            {
              model: AssetType,
              attributes: ['id', 'code', 'label'],
              required: false,
            },
          ],
        },
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (bulletins.length === 0) {
      return [];
    }

    const complianceRows = await AircraftSbCompliance.findAll({
      where: {
        aircraft_id: aircraftId,
        service_bulletin_id: {
          [Op.in]: bulletins.map((bulletin) => bulletin.id),
        },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const complianceByBulletinId = new Map(
      complianceRows.map((row: any) => [row.service_bulletin_id, row.status])
    );

    return bulletins.filter(
      (bulletin: any) => (complianceByBulletinId.get(bulletin.id) || 'OPEN') === 'OPEN'
    );
  }

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
    return WorkpackExecutionService.getExecutablePackForTask(taskId, transaction);
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

      const aircraft = await Aircraft.findByPk(data.aircraft_id, {
        attributes: ['id'],
        transaction,
      });
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

      const blockingSnags = await WorkpackSnag.count({
        where: {
          workpack_id: id,
          status: {
            [Op.ne]: 'CLOSED',
          },
        },
        transaction,
      });

      if (blockingSnags > 0) {
        throw new Error('WORKPACK_CLOSE_BLOCKED_BY_OPEN_SNAGS');
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
      if (task.aircraft_id !== pack.aircraft_id) {
        throw new Error('Task belongs to a different aircraft and cannot be added to this workpack.');
      }

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

      const aircraft = await Aircraft.findByPk(pack.aircraft_id, {
        attributes: ['id', 'model_id'],
        transaction
      });
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

      // ✅ Map template values (number and description) to the new TaskCard instance
      const task = await TaskCard.create({
        task_card_number: template.task_card_number,
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

  static async addServiceBulletins(
    workpackId: string,
    serviceBulletinIds: string[],
    actorId?: string
  ) {
    this.requireAuth(actorId);

    const uniqueIds = Array.from(
      new Set((serviceBulletinIds || []).map((id) => String(id).trim()).filter(Boolean))
    );

    if (uniqueIds.length === 0) {
      throw new Error('NO_SERVICE_BULLETINS_SELECTED');
    }

    return sequelize.transaction(async (transaction) => {
      const pack = await Workpack.findByPk(workpackId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!pack) throw new Error('WORKPACK_NOT_FOUND');

      const status = await WorkpackStatus.findByPk(pack.status_id, { transaction });
      if (!status) throw new Error('STATUS_NOT_FOUND');

      if (status.code !== 'DRAFT') {
        throw new Error('MUTATION_BLOCKED');
      }

      const availableBulletins = await this.getOpenRelevantServiceBulletinsForAircraft(
        pack.aircraft_id,
        transaction
      );
      const availableById = new Map(
        availableBulletins.map((bulletin: any) => [bulletin.id, bulletin])
      );

      const requestedBulletins = uniqueIds.map((id) => availableById.get(id)).filter(Boolean) as any[];

      if (requestedBulletins.length !== uniqueIds.length) {
        throw new Error('INVALID_SERVICE_BULLETIN_SELECTION');
      }

      const existingLinks = await WorkpackTask.findAll({
        where: { workpack_id: workpackId },
        transaction,
      });

      const existingTasks = existingLinks.length
        ? await TaskCard.findAll({
            where: {
              id: existingLinks.map((link) => link.task_id),
              service_bulletin_id: {
                [Op.in]: uniqueIds,
              },
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
          })
        : [];

      const existingBulletinIds = new Set(
        existingTasks.map((task: any) => task.service_bulletin_id).filter(Boolean)
      );

      let createdCount = 0;

      for (const bulletin of requestedBulletins) {
        if (existingBulletinIds.has(bulletin.id)) {
          continue;
        }

        const task = await TaskCard.create(
          {
            task_card_number: `SB-${bulletin.sb_number}`,
            title: `SB ${bulletin.sb_number}: ${bulletin.title}`,
            description: [
              `Service bulletin task for ${bulletin.sb_number}.`,
              bulletin.description || 'No service bulletin description provided.',
              bulletin.document_url ? `Source: ${bulletin.document_url}` : null,
            ]
              .filter(Boolean)
              .join('\n\n'),
            status: 'OPEN',
            aircraft_id: pack.aircraft_id,
            component_id: null,
            service_bulletin_id: bulletin.id,
            version: 0,
          },
          { transaction }
        );

        await WorkpackTask.create(
          {
            workpack_id: workpackId,
            task_id: task.id,
          },
          { transaction }
        );

        await AuditService.log(
          {
            table_name: 'task_cards',
            row_id: task.id,
            action: 'CREATE_FROM_SERVICE_BULLETIN',
            actor_id: actorId ?? null,
            new_values: {
              service_bulletin_id: bulletin.id,
              sb_number: bulletin.sb_number,
              title: task.title,
            },
          },
          transaction
        );

        createdCount += 1;
      }

      await AuditService.log(
        {
          table_name: 'workpacks',
          row_id: workpackId,
          action: 'SERVICE_BULLETINS_ADDED',
          actor_id: actorId ?? null,
          new_values: {
            service_bulletin_ids: uniqueIds,
            created_count: createdCount,
          },
        },
        transaction
      );

      return { createdCount };
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

  static async startTask(taskId: string, actorId?: string, actorRoles: string[] = []) {
    return TaskExecutionService.startTask(
      taskId,
      actorId,
      actorRoles,
      sequelize,
      this.requireAuth.bind(this),
      this.canStartTaskAsMechanic.bind(this),
      this.getExecutablePackForTask.bind(this),
      this.transition.bind(this),
      this.ensureExecutionForTask.bind(this)
    );
  }

  /* ============================================================
      COMPLETE TASK (MECHANIC)
  ============================================================ */

  static async completeTask(
    taskId: string,
    actorId?: string,
    actorRoles: string[] = [],
    workPerformed?: string,
    measurementsPayload?: unknown
  ) {
    return TaskExecutionService.completeTask(
      taskId,
      actorId,
      actorRoles,
      workPerformed,
      measurementsPayload,
      sequelize,
      this.requireAuth.bind(this),
      this.canEditTaskAsMechanic.bind(this),
      this.getExecutablePackForTask.bind(this),
      this.transition.bind(this),
      this.ensureExecutionForTask.bind(this)
    );
  }

  /* ============================================================
      CERTIFY TASK (ENGINEER)
  ============================================================ */

  static async signTask(taskId: string, actorId?: string) {
    return TaskExecutionService.signTask(
      taskId,
      actorId,
      sequelize,
      this.requireAuth.bind(this),
      this.getExecutablePackForTask.bind(this),
      this.ensureExecutionForTask.bind(this)
    );
  }

  /* ============================================================
      LOCK TASK (QA/LEGACY)
  ============================================================ */

  static async lockTask(taskId: string, actorId?: string) {
    return TaskExecutionService.lockTask(
      taskId,
      actorId,
      sequelize,
      this.requireAuth.bind(this),
      this.getExecutablePackForTask.bind(this)
    );
  }

  /* ============================================================
      SAVE MECHANIC WORK NOTE
  ============================================================ */

  static async saveWorkPerformed(
    taskId: string,
    workPerformed: string,
    actorId?: string,
    actorRoles: string[] = [],
    measurementsPayload?: unknown
  ) {
    return TaskExecutionService.saveWorkPerformed(
      taskId,
      workPerformed,
      actorId,
      actorRoles,
      measurementsPayload,
      sequelize,
      this.requireAuth.bind(this),
      this.canEditTaskAsMechanic.bind(this),
      this.getExecutablePackForTask.bind(this),
      this.transition.bind(this),
      this.ensureExecutionForTask.bind(this)
    );
  }

  static async reportSnag(
    workpackId: string,
    data: {
      description: string;
      category?: string;
      priority?: string;
    },
    actorId?: string
  ) {
    return SnagService.reportSnag(
      workpackId,
      data,
      actorId,
      sequelize,
      this.requireAuth.bind(this),
      this.appendSnagAuditEntry.bind(this)
    );
  }

  static async startSnag(snagId: string, actorId?: string) {
    return SnagService.startSnag(
      snagId,
      actorId,
      sequelize,
      this.requireAuth.bind(this),
      this.appendSnagAuditEntry.bind(this)
    );
  }

  static async resolveSnag(
    snagId: string,
    data: {
      resolution_notes: string;
      parts_used?: string;
      time_spent_minutes?: string | number | null;
    },
    actorId?: string,
    actorRoles: string[] = []
  ) {
    return SnagService.resolveSnag(
      snagId,
      data,
      actorId,
      actorRoles,
      sequelize,
      this.requireAuth.bind(this),
      this.canResolveSnag.bind(this),
      this.appendSnagAuditEntry.bind(this)
    );
  }

  static async closeSnag(snagId: string, actorId?: string, actorRoles: string[] = []) {
    return SnagService.closeSnag(
      snagId,
      actorId,
      actorRoles,
      sequelize,
      this.requireAuth.bind(this),
      this.canCloseSnag.bind(this),
      this.appendSnagAuditEntry.bind(this)
    );
  }
}
