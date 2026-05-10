import {
  Aircraft,
  TaskCard,
  Workpack,
  WorkpackSnag,
  WorkpackStatus,
  WorkpackTask,
} from '../../../models/index.js';
import { AuditService } from '../../audit/audit.service.js';
import { ComplianceService } from '../../compliance/compliance.service.js';
import { Op, QueryTypes } from 'sequelize';

type WorkpackStatusCode =
  | 'DRAFT'
  | 'ISSUED'
  | 'IN_PROGRESS'
  | 'CERTIFIED'
  | 'CLOSED';

export class WorkpackLifecycleService {
  private static allowedTransitions: Record<WorkpackStatusCode, WorkpackStatusCode[]> = {
    DRAFT: ['ISSUED'],
    ISSUED: ['IN_PROGRESS'],
    IN_PROGRESS: ['CERTIFIED'],
    CERTIFIED: ['CLOSED'],
    CLOSED: [],
  };

  private static hasEngineerAuthority(actorRoles: string[] = []) {
    return actorRoles.includes('ENGINEER');
  }

  private static createBlockingError(message: string, blockingErrors: string[]) {
    const error = new Error(message) as Error & { blockingErrors?: string[] };
    error.blockingErrors = blockingErrors;
    return error;
  }

  private static async ensureClosedStatus(transaction: any) {
    const existing = await WorkpackStatus.findOne({
      where: { code: 'CLOSED' },
      transaction,
    });

    if (existing) {
      return existing;
    }

    return WorkpackStatus.create(
      {
        code: 'CLOSED',
        label: 'Closed',
        description: 'Final administrative workpack close completed',
        is_active: true,
        system_locked: false,
      } as any,
      { transaction }
    );
  }

  private static summarizeBlockingTaskStatuses(tasks: TaskCard[]) {
    const counts = new Map<string, number>();

    tasks.forEach((task) => {
      const status = String(task.status || '').trim();
      if (!status || ['CERTIFIED_BY_ENGINEER', 'LOCKED'].includes(status)) {
        return;
      }

      counts.set(status, (counts.get(status) || 0) + 1);
    });

    const issues: string[] = [];

    counts.forEach((count, status) => {
      if (status === 'OPEN') {
        issues.push(`${count} task${count === 1 ? ' is' : 's are'} still OPEN.`);
        return;
      }

      if (status === 'IN_PROGRESS') {
        issues.push(`${count} task${count === 1 ? ' is' : 's are'} still IN_PROGRESS.`);
        return;
      }

      if (status === 'COMPLETED_BY_MECHANIC') {
        issues.push(
          `${count} task${count === 1 ? ' is' : 's are'} still awaiting engineer certification.`
        );
        return;
      }

      issues.push(
        `${count} task${count === 1 ? ' is' : 's are'} not ready for workpack certification or close (${status}).`
      );
    });

    return issues;
  }

  private static summarizeBlockingSnagStatuses(snags: WorkpackSnag[]) {
    const counts = new Map<string, number>();

    snags.forEach((snag) => {
      const status = String((snag as any).status || '').trim();
      if (!status || status === 'CLOSED') {
        return;
      }

      counts.set(status, (counts.get(status) || 0) + 1);
    });

    const issues: string[] = [];

    counts.forEach((count, status) => {
      if (status === 'OPEN') {
        issues.push(`${count} snag${count === 1 ? ' is' : 's are'} still OPEN.`);
        return;
      }

      if (status === 'IN_PROGRESS') {
        issues.push(`${count} snag${count === 1 ? ' is' : 's are'} still IN_PROGRESS.`);
        return;
      }

      if (status === 'RESOLVED') {
        issues.push(
          `${count} snag${count === 1 ? ' is' : 's are'} still RESOLVED and must be CLOSED before workpack close.`
        );
        return;
      }

      issues.push(
        `${count} snag${count === 1 ? ' is' : 's are'} not ready for workpack close (${status}).`
      );
    });

    return issues;
  }

  private static async collectTerminalStateBlockingErrors(
    params: {
      workpackId: string;
      currentStatusCode: string;
      pack: Workpack;
      sequelize: any;
      transaction: any;
      mode: 'CERTIFY' | 'CLOSE';
      actorRoles?: string[];
    }
  ) {
    const {
      workpackId,
      currentStatusCode,
      pack,
      sequelize,
      transaction,
      mode,
      actorRoles = [],
    } = params;
    const issues: string[] = [];

    if (mode === 'CERTIFY') {
      if (!this.hasEngineerAuthority(actorRoles)) {
        issues.push('Only engineer users may certify the workpack.');
      }

      if (currentStatusCode !== 'IN_PROGRESS') {
        issues.push('Workpack is not IN_PROGRESS.');
      }
    }

    if (mode === 'CLOSE') {
      if (currentStatusCode === 'CLOSED') {
        issues.push('Workpack is already CLOSED.');
        return issues;
      }

      if (currentStatusCode !== 'CERTIFIED') {
        issues.push('Workpack is not CERTIFIED.');
      }

      const closedStatus = await this.ensureClosedStatus(transaction);
      if (!closedStatus) {
        issues.push('CLOSED workpack status is not configured');
      }

      if (!(pack as any).certified_by) {
        issues.push('Workpack certification record is missing certified_by.');
      }

      if (!(pack as any).certified_at) {
        issues.push('Workpack certification record is missing certified_at.');
      }
    }

    const taskLinks = await WorkpackTask.findAll({
      where: { workpack_id: workpackId },
      transaction,
    });

    const taskIds = taskLinks.map((taskLink) => taskLink.task_id);

    if (taskIds.length === 0) {
      issues.push('Workpack has no tasks.');
      return issues;
    }

    const tasks = await TaskCard.findAll({
      where: { id: taskIds },
      transaction,
    });

    issues.push(...this.summarizeBlockingTaskStatuses(tasks));

    const latestExecutionRows = await sequelize.query(
      `
      SELECT
        wt.task_id,
        latest_execution.status
      FROM workpack_tasks wt
      LEFT JOIN LATERAL (
        SELECT we.status
        FROM workpack_executions we
        WHERE we.workpack_id = wt.workpack_id
          AND we.task_id = wt.task_id
        ORDER BY we.attempt_no DESC
        LIMIT 1
      ) latest_execution ON TRUE
      WHERE wt.workpack_id = :workpackId
      ORDER BY wt.task_id ASC
      `,
      {
        replacements: { workpackId: workpackId },
        type: QueryTypes.SELECT,
        transaction,
      }
    ) as Array<{ task_id: string; status: string | null }>;

    const missingExecutionCount = latestExecutionRows.filter((row) => !row.status).length;
    if (missingExecutionCount > 0) {
      issues.push(
        `${missingExecutionCount} task${missingExecutionCount === 1 ? ' is' : 's are'} missing execution records.`
      );
    }

    const nonCertifiedExecutionCounts = new Map<string, number>();
    latestExecutionRows.forEach((row) => {
      const status = String(row.status || '').trim();
      if (!status || status === 'CERTIFIED_BY_ENGINEER') {
        return;
      }

      nonCertifiedExecutionCounts.set(
        status,
        (nonCertifiedExecutionCounts.get(status) || 0) + 1
      );
    });

    nonCertifiedExecutionCounts.forEach((count, status) => {
      if (status === 'OPEN') {
        issues.push(`${count} execution${count === 1 ? ' is' : 's are'} still OPEN.`);
        return;
      }

      if (status === 'IN_PROGRESS') {
        issues.push(`${count} execution${count === 1 ? ' is' : 's are'} still IN_PROGRESS.`);
        return;
      }

      if (status === 'COMPLETED_BY_MECHANIC') {
        issues.push(
          `${count} execution${count === 1 ? ' is' : 's are'} still awaiting engineer certification.`
        );
        return;
      }

      issues.push(
        `${count} execution${count === 1 ? ' is' : 's are'} not ready for workpack certification or close (${status}).`
      );
    });

    const [blockingComplianceRows] = await sequelize.query(
      `
      SELECT 1
      FROM workpack_compliance
      WHERE workpack_id = :workpackId
        AND status != 'COMPLETED'
      LIMIT 1
      `,
      {
        replacements: { workpackId: workpackId },
        transaction,
      }
    );

    if (Array.isArray(blockingComplianceRows) && blockingComplianceRows.length > 0) {
      issues.push('Applicable compliance items are not COMPLETED.');
    }

    const blockingSnags = await WorkpackSnag.findAll({
      where: {
        workpack_id: workpackId,
        status: {
          [Op.ne]: 'CLOSED',
        },
      },
      attributes: ['id', 'status'],
      transaction,
    });

    if (blockingSnags.length > 0) {
      issues.push(...this.summarizeBlockingSnagStatuses(blockingSnags));
    }

    return issues;
  }

  static validateTransition(current: WorkpackStatusCode, target: WorkpackStatusCode) {
    if (!this.allowedTransitions[current]?.includes(target)) {
      throw new Error(`INVALID_WORKPACK_TRANSITION: ${current} \u2192 ${target}`);
    }
  }

  static async transition(
    pack: Workpack,
    target: WorkpackStatusCode,
    actorId: string | undefined,
    transaction: any
  ) {
    const currentStatus = await WorkpackStatus.findByPk(pack.status_id, { transaction });
    if (!currentStatus) throw new Error('STATUS_NOT_FOUND');

    this.validateTransition(currentStatus.code as WorkpackStatusCode, target);

    const targetStatus =
      target === 'CLOSED'
        ? await this.ensureClosedStatus(transaction)
        : await WorkpackStatus.findOne({
            where: { code: target },
            transaction
          });

    if (!targetStatus) throw new Error('TARGET_STATUS_NOT_FOUND');

    if (target === 'CERTIFIED') {
      const certifiedBy = (pack as any).certified_by;
      const certifiedAt = (pack as any).certified_at;

      if (!certifiedBy || !certifiedAt) {
        throw new Error('WORKPACK_CERTIFICATION_METADATA_MISSING');
      }
    }

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

  static async create(
    data: { work_order_number: string; aircraft_id: string },
    actorId: string | undefined,
    sequelize: any,
    requireAuth: (actorId?: string) => void
  ) {
    requireAuth(actorId);

    return sequelize.transaction(async (transaction: any) => {
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

      try {
        const compliance = await ComplianceService.getApplicableComplianceForAircraft(
          data.aircraft_id,
          transaction
        );

        const dueComplianceItems = compliance.items.filter(
          (item) =>
            item.aircraft_compliance.computed_status === 'DUE' ||
            item.aircraft_compliance.computed_status === 'OVERDUE'
        );

        for (const item of dueComplianceItems) {
          await sequelize.query(
            `
            INSERT INTO workpack_compliance
            (workpack_id, compliance_item_id, status, linked_at, created_at, updated_at)
            SELECT
              :workpackId,
              :complianceItemId,
              'PLANNED',
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            WHERE NOT EXISTS (
              SELECT 1
              FROM workpack_compliance
              WHERE workpack_id = :workpackId
                AND compliance_item_id = :complianceItemId
            )
            `,
            {
              replacements: {
                workpackId: pack.id,
                complianceItemId: item.compliance_item_id,
              },
              transaction,
            }
          );
        }

        const plannedComplianceRows = await sequelize.query(
          `
          SELECT
            wc.compliance_item_id,
            ci.code,
            ci.title,
            ci.description,
            wc.task_id,
            existing_task.existing_task_id
          FROM workpack_compliance wc
          JOIN compliance_items ci
            ON ci.id = wc.compliance_item_id
          LEFT JOIN LATERAL (
            SELECT tc.id AS existing_task_id
            FROM workpack_tasks wt
            JOIN task_cards tc
              ON tc.id = wt.task_id
            WHERE wt.workpack_id = wc.workpack_id
              AND tc.compliance_item_id = wc.compliance_item_id
            ORDER BY tc.id ASC
            LIMIT 1
          ) existing_task ON TRUE
          WHERE wc.workpack_id = :workpackId
            AND wc.status = 'PLANNED'
          ORDER BY ci.code ASC
          `,
          {
            replacements: {
              workpackId: pack.id,
            },
            type: QueryTypes.SELECT,
            transaction,
          }
        ) as Array<{
          compliance_item_id: string;
          code: string;
          title: string;
          description: string | null;
          task_id: string | null;
          existing_task_id: string | null;
        }>;

        for (const row of plannedComplianceRows) {
          const existingTaskId = row.task_id || row.existing_task_id || null;

          if (existingTaskId) {
            await sequelize.query(
              `
              UPDATE workpack_compliance
              SET task_id = :taskId,
                  updated_at = CURRENT_TIMESTAMP
              WHERE workpack_id = :workpackId
                AND compliance_item_id = :complianceItemId
                AND task_id IS DISTINCT FROM :taskId
              `,
              {
                replacements: {
                  workpackId: pack.id,
                  complianceItemId: row.compliance_item_id,
                  taskId: existingTaskId,
                },
                transaction,
              }
            );

            continue;
          }

          const task = await TaskCard.create(
            {
              task_card_number: row.code,
              title: `${row.code}: ${row.title}`,
              description: row.description || row.title,
              aircraft_id: data.aircraft_id,
              compliance_item_id: row.compliance_item_id,
              status: 'OPEN',
              component_id: null,
              version: 0,
            },
            { transaction }
          );

          await WorkpackTask.findOrCreate({
            where: {
              workpack_id: pack.id,
              task_id: task.id,
            },
            defaults: {
              workpack_id: pack.id,
              task_id: task.id,
            },
            transaction,
          });

          await sequelize.query(
            `
            UPDATE workpack_compliance
            SET task_id = :taskId,
                updated_at = CURRENT_TIMESTAMP
            WHERE workpack_id = :workpackId
              AND compliance_item_id = :complianceItemId
            `,
            {
              replacements: {
                workpackId: pack.id,
                complianceItemId: row.compliance_item_id,
                taskId: task.id,
              },
              transaction,
            }
          );
        }
      } catch (error) {
        const errorObject = error instanceof Error ? error : null;
        const databaseError = error as {
          original?: { message?: string };
          parent?: { message?: string; sql?: string };
          sql?: string;
        };

        console.warn('[WorkpackLifecycleService] compliance attachment skipped during workpack creation', {
          aircraft_id: data.aircraft_id,
          workpack_id: pack.id,
          error_name: errorObject?.name || null,
          error_message: errorObject?.message || String(error),
          error_stack: errorObject?.stack || null,
          db_error_message:
            databaseError?.original?.message ||
            databaseError?.parent?.message ||
            null,
          sql: databaseError?.sql || databaseError?.parent?.sql || null,
        });
      }

      await AuditService.log({
        table_name: 'workpacks',
        row_id: pack.id,
        action: 'CREATE',
        actor_id: actorId ?? null
      }, transaction);

      return pack;
    });
  }

  static async issue(
    id: string,
    actorId: string | undefined,
    sequelize: any,
    requireAuth: (actorId?: string) => void
  ) {
    requireAuth(actorId);

    return sequelize.transaction(async (transaction: any) => {
      const pack = await Workpack.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!pack) throw new Error('WORKPACK_NOT_FOUND');

      const currentStatus = await WorkpackStatus.findByPk(pack.status_id, { transaction });
      if (!currentStatus) throw new Error('STATUS_NOT_FOUND');

      if (currentStatus.code !== 'DRAFT') {
        throw new Error('MUTATION_BLOCKED');
      }

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

  static async startWork(
    id: string,
    actorId: string | undefined,
    sequelize: any,
    requireAuth: (actorId?: string) => void
  ) {
    requireAuth(actorId);

    return sequelize.transaction(async (transaction: any) => {
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

  static async getCertificationBlockingErrors(
    id: string,
    actorRoles: string[],
    sequelize: any
  ) {
    return sequelize.transaction(async (transaction: any) => {
      const pack = await Workpack.findByPk(id, {
        transaction,
      });

      if (!pack) {
        return ['Workpack was not found.'];
      }

      const currentStatus = await WorkpackStatus.findByPk(pack.status_id, { transaction });
      if (!currentStatus) {
        return ['Workpack status was not found.'];
      }

      return this.collectTerminalStateBlockingErrors({
        workpackId: id,
        currentStatusCode: String(currentStatus.code || '').trim(),
        pack,
        sequelize,
        transaction,
        mode: 'CERTIFY',
        actorRoles,
      });
    });
  }

  static async certify(
    id: string,
    actorId: string | undefined,
    actorRoles: string[],
    sequelize: any,
    requireAuth: (actorId?: string) => void
  ) {
    requireAuth(actorId);

    return sequelize.transaction(async (transaction: any) => {
      const pack = await Workpack.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!pack) throw new Error('WORKPACK_NOT_FOUND');

      const currentStatus = await WorkpackStatus.findByPk(pack.status_id, { transaction });
      if (!currentStatus) throw new Error('STATUS_NOT_FOUND');

      const blockingErrors = await this.collectTerminalStateBlockingErrors({
        workpackId: id,
        currentStatusCode: String(currentStatus.code || '').trim(),
        pack,
        sequelize,
        transaction,
        mode: 'CERTIFY',
        actorRoles,
      });

      if (blockingErrors.length > 0) {
        throw this.createBlockingError('WORKPACK_CERTIFY_BLOCKED', blockingErrors);
      }

      (pack as any).certified_by = actorId ?? null;
      (pack as any).certified_at = new Date();
      await pack.save({ transaction });

      await this.transition(pack, 'CERTIFIED', actorId, transaction);

      return pack;
    });
  }

  static async getCloseBlockingErrors(id: string, sequelize: any) {
    return sequelize.transaction(async (transaction: any) => {
      const pack = await Workpack.findByPk(id, {
        transaction,
      });

      if (!pack) {
        return ['Workpack was not found.'];
      }

      const currentStatus = await WorkpackStatus.findByPk(pack.status_id, { transaction });
      if (!currentStatus) {
        return ['Workpack status was not found.'];
      }

      return this.collectTerminalStateBlockingErrors({
        workpackId: id,
        currentStatusCode: String(currentStatus.code || '').trim(),
        pack,
        sequelize,
        transaction,
        mode: 'CLOSE',
      });
    });
  }

  static async close(
    id: string,
    actorId: string | undefined,
    sequelize: any,
    requireAuth: (actorId?: string) => void
  ) {
    requireAuth(actorId);

    return sequelize.transaction(async (transaction: any) => {
      const pack = await Workpack.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!pack) throw new Error('WORKPACK_NOT_FOUND');

      const currentStatus = await WorkpackStatus.findByPk(pack.status_id, { transaction });
      if (!currentStatus) throw new Error('STATUS_NOT_FOUND');

      const blockingErrors = await this.collectTerminalStateBlockingErrors({
        workpackId: id,
        currentStatusCode: String(currentStatus.code || '').trim(),
        pack,
        sequelize,
        transaction,
        mode: 'CLOSE',
      });

      if (blockingErrors.length > 0) {
        throw this.createBlockingError('WORKPACK_CLOSE_BLOCKED', blockingErrors);
      }

      await this.transition(pack, 'CLOSED', actorId, transaction);

      return pack;
    });
  }

  static async deleteDraft(
    workpackId: string,
    actorId: string | undefined,
    sequelize: any,
    requireAuth: (actorId?: string) => void
  ) {
    requireAuth(actorId);

    return sequelize.transaction(async (transaction: any) => {
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
}
