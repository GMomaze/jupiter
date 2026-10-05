import { sequelize } from '../../models/index.js';
import { MeasurementService } from './services/measurement.service.js';
import { WorkpackAuditService } from './services/workpack-audit.service.js';
import { WorkpackExecutionService } from './services/workpack-execution.service.js';
import { SnagService } from './services/snag.service.js';
import { TaskExecutionService } from './services/task-execution.service.js';
import { WorkpackPlanningService } from './services/workpack-planning.service.js';
import { WorkpackServiceBulletinService } from './services/workpack-service-bulletin.service.js';
import { WorkpackLifecycleService } from './services/workpack-lifecycle.service.js';
import type { TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';

type WorkpackStatusCode =
  | 'DRAFT'
  | 'ISSUED'
  | 'IN_PROGRESS'
  | 'CERTIFIED'
  | 'CLOSED';

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
    return WorkpackServiceBulletinService.getOpenRelevantServiceBulletinsForAircraft(
      aircraftId,
      transaction
    );
  }

  /* ============================================================
      STATE MACHINE
  ============================================================ */

  private static validateTransition(current: WorkpackStatusCode, target: WorkpackStatusCode) {
    return WorkpackLifecycleService.validateTransition(current, target);
  }

  private static requireAuth(actorId?: string) {
    if (process.env.NODE_ENV !== 'test' && !actorId) {
      throw new Error('UNAUTHENTICATED');
    }
  }

  private static async getExecutablePackForTask(authority: TenantQueryAuthority, taskId: string, transaction: any) {
    return WorkpackExecutionService.getExecutablePackForTask(authority, taskId, transaction);
  }

  /* ============================================================
      CREATE
  ============================================================ */

  static async create(
    data: { work_order_number: string; aircraft_id: string },
    tenantAuthority: TenantQueryAuthority,
    actorId?: string
  ) {
    return WorkpackLifecycleService.create(
      data,
      tenantAuthority,
      actorId,
      sequelize,
      this.requireAuth.bind(this)
    );
  }

  /* ============================================================
      INTERNAL TRANSITION
  ============================================================ */

  private static async transition(
    pack: { id: string },
    target: 'IN_PROGRESS',
    actorId: string | undefined,
    transaction: any
  ) {
    return WorkpackLifecycleService.transition(pack as any, target, actorId, transaction);
  }

  /* ============================================================
      ISSUE
  ============================================================ */

  static async issue(authority: TenantQueryAuthority, id: string, actorId?: string) {
    return WorkpackLifecycleService.issue(
      authority,
      id,
      actorId,
      sequelize,
      this.requireAuth.bind(this)
    );
  }

  /* ============================================================
      START WORK
  ============================================================ */

  static async startWork(authority: TenantQueryAuthority, id: string, actorId?: string) {
    return WorkpackLifecycleService.startWork(
      authority,
      id,
      actorId,
      sequelize,
      this.requireAuth.bind(this)
    );
  }

  /* ============================================================
      CLOSE
  ============================================================ */

  static async close(authority: TenantQueryAuthority, id: string, actorId?: string) {
    return WorkpackLifecycleService.close(
      authority,
      id,
      actorId,
      sequelize,
      this.requireAuth.bind(this)
    );
  }

  static async certify(authority: TenantQueryAuthority, id: string, actorId?: string, actorRoles: string[] = []) {
    return WorkpackLifecycleService.certify(
      authority,
      id,
      actorId,
      actorRoles,
      sequelize,
      this.requireAuth.bind(this)
    );
  }

  static async getCertificationBlockingErrors(authority: TenantQueryAuthority, id: string, actorRoles: string[] = []) {
    return WorkpackLifecycleService.getCertificationBlockingErrors(
      authority,
      id,
      actorRoles,
      sequelize
    );
  }

  static async getCloseBlockingErrors(authority: TenantQueryAuthority, id: string) {
    return WorkpackLifecycleService.getCloseBlockingErrors(authority, id, sequelize);
  }

  /* ============================================================
      ADD TASK
  ============================================================ */

  static async addTask(authority: TenantQueryAuthority, workpackId: string, taskId: string, actorId?: string) {
    return WorkpackPlanningService.addTask(
      authority,
      workpackId,
      taskId,
      actorId,
      sequelize,
      this.requireAuth.bind(this)
    );
  }

  /* ============================================================
      REMOVE TASK
  ============================================================ */

  static async removeTask(authority: TenantQueryAuthority, workpackId: string, taskId: string, actorId?: string) {
    return WorkpackPlanningService.removeTask(
      authority,
      workpackId,
      taskId,
      actorId,
      sequelize,
      this.requireAuth.bind(this)
    );
  }

  /* ============================================================
      ADD TASK FROM TEMPLATE
  ============================================================ */

  static async addTaskFromTemplate(authority: TenantQueryAuthority, workpackId: string, templateId: string, actorId?: string) {
    return WorkpackPlanningService.addTaskFromTemplate(
      authority,
      workpackId,
      templateId,
      actorId,
      sequelize,
      this.requireAuth.bind(this)
    );
  }

  static async addServiceBulletins(
    authority: TenantQueryAuthority,
    workpackId: string,
    serviceBulletinIds: string[],
    actorId?: string
  ) {
    return WorkpackServiceBulletinService.addServiceBulletins(
      authority,
      workpackId,
      serviceBulletinIds,
      actorId,
      sequelize,
      this.requireAuth.bind(this)
    );
  }

  /* ============================================================
      DELETE DRAFT WORKPACK
  ============================================================ */

  static async deleteDraft(authority: TenantQueryAuthority, workpackId: string, actorId?: string) {
    return WorkpackLifecycleService.deleteDraft(
      authority,
      workpackId,
      actorId,
      sequelize,
      this.requireAuth.bind(this)
    );
  }

  /* ============================================================
      START TASK (MECHANIC)
  ============================================================ */

  static async startTask(authority: TenantQueryAuthority, taskId: string, actorId?: string, actorRoles: string[] = []) {
    return TaskExecutionService.startTask(
      authority,
      taskId,
      actorId,
      actorRoles,
      sequelize,
      this.requireAuth.bind(this),
      this.canStartTaskAsMechanic.bind(this),
      this.getExecutablePackForTask.bind(this, authority),
      this.transition.bind(this),
      this.ensureExecutionForTask.bind(this)
    );
  }

  /* ============================================================
      COMPLETE TASK (MECHANIC)
  ============================================================ */

  static async completeTask(
    authority: TenantQueryAuthority,
    taskId: string,
    actorId?: string,
    actorRoles: string[] = [],
    workPerformed?: string,
    measurementsPayload?: unknown
  ) {
    return TaskExecutionService.completeTask(
      authority,
      taskId,
      actorId,
      actorRoles,
      workPerformed,
      measurementsPayload,
      sequelize,
      this.requireAuth.bind(this),
      this.canEditTaskAsMechanic.bind(this),
      this.getExecutablePackForTask.bind(this, authority),
      this.transition.bind(this),
      this.ensureExecutionForTask.bind(this)
    );
  }

  /* ============================================================
      CERTIFY TASK (ENGINEER)
  ============================================================ */

  static async signTask(authority: TenantQueryAuthority, taskId: string, actorId?: string, actorRoles: string[] = []) {
    return TaskExecutionService.signTask(
      authority,
      taskId,
      actorId,
      actorRoles,
      sequelize,
      this.requireAuth.bind(this),
      this.getExecutablePackForTask.bind(this, authority),
      this.getLatestExecution.bind(this)
    );
  }

  /* ============================================================
      LOCK TASK (QA/LEGACY)
  ============================================================ */

  static async lockTask(authority: TenantQueryAuthority, taskId: string, actorId?: string) {
    return TaskExecutionService.lockTask(
      authority,
      taskId,
      actorId,
      sequelize,
      this.requireAuth.bind(this),
      this.getExecutablePackForTask.bind(this, authority)
    );
  }

  /* ============================================================
      SAVE MECHANIC WORK NOTE
  ============================================================ */

  static async saveWorkPerformed(
    authority: TenantQueryAuthority,
    taskId: string,
    workPerformed: string,
    actorId?: string,
    actorRoles: string[] = [],
    measurementsPayload?: unknown
  ) {
    return TaskExecutionService.saveWorkPerformed(
      authority,
      taskId,
      workPerformed,
      actorId,
      actorRoles,
      measurementsPayload,
      sequelize,
      this.requireAuth.bind(this),
      this.canEditTaskAsMechanic.bind(this),
      this.getExecutablePackForTask.bind(this, authority),
      this.transition.bind(this),
      this.ensureExecutionForTask.bind(this)
    );
  }

  static async startSnag(authority: TenantQueryAuthority, snagId: string, actorId?: string, actorRoles: string[] = []) {
    return SnagService.startSnag(
      authority,
      snagId,
      actorId,
      actorRoles,
      sequelize,
      this.requireAuth.bind(this),
      this.appendSnagAuditEntry.bind(this)
    );
  }

  static async resolveSnag(
    authority: TenantQueryAuthority,
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
      authority,
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

  static async closeSnag(authority: TenantQueryAuthority, snagId: string, actorId?: string, actorRoles: string[] = []) {
    return SnagService.closeSnag(
      authority,
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
