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
import { Op } from 'sequelize';
import { createHash } from 'crypto';

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
  private static readonly CAPTURED_VALUES_START = '[Captured Values]';
  private static readonly CAPTURED_VALUES_END = '[/Captured Values]';

  private static hasAdminOverride(actorRoles: string[] = []) {
    return actorRoles.includes('ADMIN') || actorRoles.includes('SUPERVISOR');
  }

  private static canResolveSnag(
    snag: any,
    actorId: string | undefined,
    actorRoles: string[] = []
  ) {
    if (this.hasAdminOverride(actorRoles)) {
      return true;
    }

    if (!actorId) {
      return false;
    }

    return snag.assigned_to === actorId;
  }

  private static canCloseSnag(actorRoles: string[] = []) {
    return actorRoles.includes('ENGINEER') || this.hasAdminOverride(actorRoles);
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
    if (taskStatus === 'IN_PROGRESS') return 'IN_PROGRESS';
    if (taskStatus === 'COMPLETED_BY_MECHANIC') return 'COMPLETED_BY_MECHANIC';
    if (taskStatus === 'CERTIFIED_BY_ENGINEER' || taskStatus === 'SIGNED' || taskStatus === 'LOCKED') {
      return 'CERTIFIED_BY_ENGINEER';
    }

    return 'OPEN';
  }

  private static getMeasurementDefinitions(description: string | null | undefined) {
    return Array.from(String(description || '').matchAll(/\[([^\]]*)\]/g)).map((match, index) => {
      const rawLabel = String(match[1] || '').trim();
      return {
        key: `field_${index}`,
        label: rawLabel || `Value ${index + 1}`,
        position: index + 1,
      };
    });
  }

  private static splitWorkPerformed(workPerformed: string | null | undefined) {
    const value = String(workPerformed || '').trim();
    const start = value.indexOf(this.CAPTURED_VALUES_START);
    const end = value.indexOf(this.CAPTURED_VALUES_END);

    if (start === -1 || end === -1 || end < start) {
      return { captured: '', note: value };
    }

    const captured = value
      .slice(start + this.CAPTURED_VALUES_START.length, end)
      .trim();
    const before = value.slice(0, start).trim();
    const after = value
      .slice(end + this.CAPTURED_VALUES_END.length)
      .trim();

    return {
      captured,
      note: [before, after].filter(Boolean).join('\n\n').trim(),
    };
  }

  private static extractCleanWorkPerformedNote(workPerformed: string | null | undefined) {
    return this.splitWorkPerformed(workPerformed).note || null;
  }

  private static parseCapturedValues(captured: string) {
    const values = new Map<string, string>();

    captured
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) {
          return;
        }

        const label = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();

        if (!label) {
          return;
        }

        values.set(label, value);
      });

    return values;
  }

  private static parseStructuredMeasurements(
    taskDescription: string | null | undefined,
    measurementsPayload: unknown
  ) {
    if (
      measurementsPayload === undefined ||
      measurementsPayload === null ||
      (typeof measurementsPayload === 'string' && measurementsPayload.trim() === '')
    ) {
      return null;
    }

    let parsedPayload: any;

    if (typeof measurementsPayload === 'string') {
      try {
        parsedPayload = JSON.parse(measurementsPayload);
      } catch {
        return null;
      }
    } else {
      parsedPayload = measurementsPayload;
    }

    if (!Array.isArray(parsedPayload)) {
      return null;
    }

    const definitions = this.getMeasurementDefinitions(taskDescription);
    const valuesByKey = new Map<string, string | null>();
    const valuesByLabel = new Map<string, string | null>();
    const valuesByPosition = new Map<number, string | null>();

    parsedPayload.forEach((entry: any, index: number) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }

      const fieldKey = String(entry.field_key || '').trim();
      const fieldLabel = String(entry.field_label || '').trim();
      const rawPosition = Number(entry.position);
      const value = String(entry.value ?? '').trim() || null;

      if (fieldKey) {
        valuesByKey.set(fieldKey, value);
      }

      if (fieldLabel) {
        valuesByLabel.set(fieldLabel, value);
      }

      if (Number.isFinite(rawPosition) && rawPosition > 0) {
        valuesByPosition.set(rawPosition, value);
      } else {
        valuesByPosition.set(index + 1, value);
      }
    });

    return definitions.map((definition) => ({
      field_key: definition.key,
      field_label: definition.label,
      position: definition.position,
      value:
        valuesByKey.get(definition.key) ??
        valuesByPosition.get(definition.position) ??
        valuesByLabel.get(definition.label) ??
        null,
    }));
  }

  private static buildMeasurementSnapshot(
    taskDescription: string | null | undefined,
    workPerformed: string | null | undefined,
    measurementsPayload?: unknown
  ) {
    const structuredMeasurements = this.parseStructuredMeasurements(
      taskDescription,
      measurementsPayload
    );

    if (structuredMeasurements) {
      return structuredMeasurements;
    }

    const definitions = this.getMeasurementDefinitions(taskDescription);
    const { captured } = this.splitWorkPerformed(workPerformed);
    const capturedValues = this.parseCapturedValues(captured);

    return definitions.map((definition) => ({
      field_key: definition.key,
      field_label: definition.label,
      position: definition.position,
      value: capturedValues.get(definition.label) || null,
    }));
  }

  private static async syncExecutionMeasurements(
    executionId: string,
    taskDescription: string | null | undefined,
    workPerformed: string | null | undefined,
    measurementsPayload: unknown,
    transaction: any
  ) {
    const structuredMeasurements = this.parseStructuredMeasurements(
      taskDescription,
      measurementsPayload
    );
    const definitions = this.getMeasurementDefinitions(taskDescription);
    const { captured } = this.splitWorkPerformed(workPerformed);
    const capturedValues = this.parseCapturedValues(captured);
    const measurementRows = structuredMeasurements || definitions.map((definition) => ({
      field_key: definition.key,
      field_label: definition.label,
      position: definition.position,
      value: capturedValues.get(definition.label) || null,
    }));

    await WorkpackMeasurement.destroy({
      where: { execution_id: executionId },
      transaction,
    });

    if (measurementRows.length === 0) {
      return;
    }

    await WorkpackMeasurement.bulkCreate(
      measurementRows.map((definition) => ({
        execution_id: executionId,
        field_key: definition.field_key,
        field_label: definition.field_label,
        position: definition.position,
        value: definition.value || null,
      })),
      { transaction }
    );
  }

  private static async recordExecutionSignature(
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

  private static async getLatestExecution(
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

  private static async ensureExecutionForTask(
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

      if (!this.canStartTaskAsMechanic(task, actorId, actorRoles)) {
        throw new Error('TASK_OWNED_BY_ANOTHER_MECHANIC');
      }

      const execution = await this.ensureExecutionForTask(pack.id, task, actorId, transaction);
      const previousTaskStatus = task.status;
      const previousExecutionStatus = execution.status;

      task.status = 'IN_PROGRESS' as TaskStatusCode;
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
      await this.appendExecutionAuditEntry({
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

      if (!this.canEditTaskAsMechanic(task, actorId, actorRoles)) {
        throw new Error('TASK_OWNED_BY_ANOTHER_MECHANIC');
      }

      const execution = await this.ensureExecutionForTask(pack.id, task, actorId, transaction);
      const previousTaskStatus = task.status;
      const previousExecutionStatus = execution.status;
      const submittedWorkPerformed = workPerformed?.trim() || task.work_performed || null;
      const nextWorkPerformed = this.extractCleanWorkPerformedNote(submittedWorkPerformed);

      task.work_performed = nextWorkPerformed;

      task.status = 'COMPLETED_BY_MECHANIC' as TaskStatusCode;
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
      await this.syncExecutionMeasurements(
        execution.id,
        task.description,
        submittedWorkPerformed,
        measurementsPayload,
        transaction
      );
      await this.recordExecutionSignature(
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
      await this.appendExecutionAuditEntry({
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
      await this.appendExecutionAuditEntry({
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

      const { pack } = await this.getExecutablePackForTask(taskId, transaction);

      if (task.status !== 'COMPLETED_BY_MECHANIC') {
        throw new Error('TASK_CERTIFY_BLOCKED');
      }

      const execution = await this.ensureExecutionForTask(pack.id, task, actorId, transaction);
      const previousTaskStatus = task.status;
      const previousExecutionStatus = execution.status;

      task.status = 'CERTIFIED_BY_ENGINEER' as TaskStatusCode;
      (task as any).engineer_certified_by = actorId ?? null;
      (task as any).engineer_certified_at = new Date();
      task.version = (task.version || 0) + 1;

      await task.save({ transaction });

      if (!execution.started_at) {
        execution.started_at = new Date();
      }
      if (!execution.completed_at) {
        execution.completed_at = new Date();
      }
      if (!execution.started_by) {
        execution.started_by = (task as any).assigned_to || actorId || null;
      }
      if (!execution.completed_by) {
        execution.completed_by = (task as any).mechanic_completed_by || actorId || null;
      }
      execution.status = 'CERTIFIED_BY_ENGINEER';
      execution.certified_by = actorId ?? null;
      execution.certified_at = new Date();
      execution.version = (execution.version || 0) + 1;
      await execution.save({ transaction });
      await this.recordExecutionSignature(
        execution.id,
        'ENGINEER',
        'APPROVAL',
        actorId,
        transaction
      );

      await AuditService.log({
        table_name: 'task_cards',
        row_id: task.id,
        action: 'TASK_CERTIFIED_BY_ENGINEER',
        actor_id: actorId ?? null,
        new_values: { status: 'CERTIFIED_BY_ENGINEER' }
      }, transaction);
      await this.appendExecutionAuditEntry({
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
      await this.appendExecutionAuditEntry({
        executionId: execution.id,
        workpackId: pack.id,
        taskId: task.id,
        userId: actorId,
        action: 'SIGNATURE_RECORDED',
        field: 'engineer_signature',
        oldValue: null,
        newValue: {
          role: 'ENGINEER',
          signature_type: 'APPROVAL',
          user_id: actorId ?? null,
        },
        metadata: {
          signed_at: new Date().toISOString(),
        },
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

  static async saveWorkPerformed(
    taskId: string,
    workPerformed: string,
    actorId?: string,
    actorRoles: string[] = [],
    measurementsPayload?: unknown
  ) {

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

      if (task.status !== 'IN_PROGRESS') {
        throw new Error('TASK_NOT_STARTED');
      }

      if (['CERTIFIED_BY_ENGINEER', 'LOCKED'].includes(task.status)) {
        throw new Error('TASK_NOTE_EDIT_BLOCKED');
      }

      if (!this.canEditTaskAsMechanic(task, actorId, actorRoles)) {
        throw new Error('TASK_OWNED_BY_ANOTHER_MECHANIC');
      }

      const execution = await this.ensureExecutionForTask(pack.id, task, actorId, transaction);
      const previousWorkPerformed = task.work_performed || null;
      const previousMeasurements = this.buildMeasurementSnapshot(task.description, previousWorkPerformed);
      const previousNote = this.splitWorkPerformed(previousWorkPerformed).note;
      const submittedWorkPerformed = workPerformed?.trim() || null;
      const nextWorkPerformed = this.extractCleanWorkPerformedNote(submittedWorkPerformed);

      task.work_performed = nextWorkPerformed;
      task.assigned_to = actorId ?? null;
      task.version = (task.version || 0) + 1;

      await task.save({ transaction });

      execution.status = this.mapTaskStatusToExecutionStatus(task.status);
      execution.version = (execution.version || 0) + 1;

      if (execution.status !== 'OPEN' && !execution.started_at) {
        execution.started_at = new Date();
      }

      if (execution.status !== 'OPEN' && !execution.started_by) {
        execution.started_by = actorId ?? null;
      }

      await execution.save({ transaction });
      await this.syncExecutionMeasurements(
        execution.id,
        task.description,
        submittedWorkPerformed,
        measurementsPayload,
        transaction
      );
      const nextMeasurements = this.buildMeasurementSnapshot(
        task.description,
        submittedWorkPerformed,
        measurementsPayload
      );
      const nextNote = this.splitWorkPerformed(task.work_performed).note;

      await AuditService.log({
        table_name: 'task_cards',
        row_id: task.id,
        action: 'TASK_WORK_NOTE_UPDATED',
        actor_id: actorId ?? null,
        new_values: { work_performed: task.work_performed }
      }, transaction);
      await this.appendExecutionAuditEntry({
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

  static async reportSnag(
    workpackId: string,
    data: {
      description: string;
      category?: string;
      priority?: string;
    },
    actorId?: string
  ) {
    this.requireAuth(actorId);

    const normalizedDescription = String(data.description || '').trim();
    const normalizedCategory = String(data.category || '').trim() || null;
    const normalizedPriority = String(data.priority || 'MEDIUM').trim().toUpperCase() || 'MEDIUM';
    if (!normalizedDescription) {
      throw new Error('SNAG_DESCRIPTION_REQUIRED');
    }

    return sequelize.transaction(async (transaction) => {
      const pack = await Workpack.findByPk(workpackId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!pack) throw new Error('WORKPACK_NOT_FOUND');

      const status = await WorkpackStatus.findByPk(pack.status_id, { transaction });
      if (!status) throw new Error('STATUS_NOT_FOUND');
      if (status.code === 'DRAFT') throw new Error('SNAGS_NOT_ALLOWED_IN_DRAFT');

      const latestSnag = await WorkpackSnag.findOne({
        where: { workpack_id: workpackId },
        order: [['snag_no', 'DESC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const nextSnagNo = (latestSnag?.snag_no || 0) + 1;

      const snag = await WorkpackSnag.create(
        {
          workpack_id: workpackId,
          snag_no: nextSnagNo,
          description: normalizedDescription,
          category: normalizedCategory,
          priority: normalizedPriority,
          status: 'OPEN',
          created_by: actorId ?? null,
          created_at: new Date(),
          version: 1,
        },
        { transaction }
      );

      await this.appendSnagAuditEntry(
        {
          snagId: snag.id,
          workpackId,
          userId: actorId,
          action: 'SNAG_CREATED',
          newValue: {
            snag_no: snag.snag_no,
            description: snag.description,
            category: snag.category,
            priority: snag.priority,
            status: snag.status,
          },
        },
        transaction
      );

      return snag;
    });
  }

  static async startSnag(snagId: string, actorId?: string) {
    this.requireAuth(actorId);

    return sequelize.transaction(async (transaction) => {
      const snag = await WorkpackSnag.findByPk(snagId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!snag) throw new Error('SNAG_NOT_FOUND');
      if (snag.status !== 'OPEN') throw new Error('SNAG_START_BLOCKED');

      const previous = {
        status: snag.status,
        assigned_to: snag.assigned_to,
        started_by: snag.started_by,
        started_at: snag.started_at,
      };

      snag.status = 'IN_PROGRESS';
      snag.assigned_to = actorId ?? null;
      snag.started_by = actorId ?? null;
      snag.started_at = new Date();
      snag.version = snag.version + 1;

      await snag.save({ transaction });

      await this.appendSnagAuditEntry(
        {
          snagId: snag.id,
          workpackId: snag.workpack_id,
          userId: actorId,
          action: 'SNAG_STARTED',
          oldValue: previous,
          newValue: {
            status: snag.status,
            assigned_to: snag.assigned_to,
            started_by: snag.started_by,
            started_at: snag.started_at,
          },
        },
        transaction
      );

      return snag;
    });
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
    this.requireAuth(actorId);

    const normalizedResolution = String(data.resolution_notes || '').trim();
    const normalizedPartsUsed = String(data.parts_used || '').trim() || null;
    const normalizedTimeSpent = String(data.time_spent_minutes || '').trim();
    const timeSpentMinutes = normalizedTimeSpent ? Number(normalizedTimeSpent) : null;

    if (!normalizedResolution) {
      throw new Error('SNAG_RESOLUTION_REQUIRED');
    }
    if (normalizedTimeSpent && (!Number.isFinite(timeSpentMinutes ?? NaN) || (timeSpentMinutes ?? 0) < 0)) {
      throw new Error('SNAG_TIME_SPENT_INVALID');
    }

    return sequelize.transaction(async (transaction) => {
      const snag = await WorkpackSnag.findByPk(snagId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!snag) throw new Error('SNAG_NOT_FOUND');
      if (snag.status !== 'IN_PROGRESS') throw new Error('SNAG_RESOLVE_BLOCKED');
      if (!this.canResolveSnag(snag, actorId, actorRoles)) {
        throw new Error('SNAG_RESOLVE_NOT_ASSIGNED');
      }

      const previous = {
        status: snag.status,
        resolution_notes: snag.resolution_notes,
        parts_used: snag.parts_used,
        time_spent_minutes: snag.time_spent_minutes,
        resolved_by: snag.resolved_by,
        resolved_at: snag.resolved_at,
      };

      snag.status = 'RESOLVED';
      snag.resolution_notes = normalizedResolution;
      snag.parts_used = normalizedPartsUsed;
      snag.time_spent_minutes = timeSpentMinutes;
      snag.resolved_by = actorId ?? null;
      snag.resolved_at = new Date();
      snag.version = snag.version + 1;

      await snag.save({ transaction });

      await this.appendSnagAuditEntry(
        {
          snagId: snag.id,
          workpackId: snag.workpack_id,
          userId: actorId,
          action: 'SNAG_RESOLVED',
          oldValue: previous,
          newValue: {
            status: snag.status,
            resolution_notes: snag.resolution_notes,
            parts_used: snag.parts_used,
            time_spent_minutes: snag.time_spent_minutes,
            resolved_by: snag.resolved_by,
            resolved_at: snag.resolved_at,
          },
        },
        transaction
      );

      return snag;
    });
  }

  static async closeSnag(snagId: string, actorId?: string, actorRoles: string[] = []) {
    this.requireAuth(actorId);

    if (!this.canCloseSnag(actorRoles)) {
      throw new Error('SNAG_CLOSE_ROLE_BLOCKED');
    }

    return sequelize.transaction(async (transaction) => {
      const snag = await WorkpackSnag.findByPk(snagId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!snag) throw new Error('SNAG_NOT_FOUND');
      if (snag.status !== 'RESOLVED') throw new Error('SNAG_CLOSE_BLOCKED');

      const previous = {
        status: snag.status,
        closed_by: snag.closed_by,
        closed_at: snag.closed_at,
      };

      snag.status = 'CLOSED';
      snag.closed_by = actorId ?? null;
      snag.closed_at = new Date();
      snag.version = snag.version + 1;

      await snag.save({ transaction });

      await this.appendSnagAuditEntry(
        {
          snagId: snag.id,
          workpackId: snag.workpack_id,
          userId: actorId,
          action: 'SNAG_CLOSED',
          oldValue: previous,
          newValue: {
            status: snag.status,
            closed_by: snag.closed_by,
            closed_at: snag.closed_at,
          },
        },
        transaction
      );

      return snag;
    });
  }
}
