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
  | 'CERTIFIED';

export class WorkpackLifecycleService {
  private static allowedTransitions: Record<WorkpackStatusCode, WorkpackStatusCode[]> = {
    DRAFT: ['ISSUED'],
    ISSUED: ['IN_PROGRESS'],
    IN_PROGRESS: ['CERTIFIED'],
    CERTIFIED: [],
  };

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

    const targetStatus = await WorkpackStatus.findOne({
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

        const plannedComplianceRows = await sequelize.query<{
          compliance_item_id: string;
          code: string;
          title: string;
          description: string | null;
          task_id: string | null;
          existing_task_id: string | null;
        }>(
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
        );

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

      const [blockingComplianceRows] = await sequelize.query(
        `
        SELECT 1
        FROM workpack_compliance
        WHERE workpack_id = :workpackId
          AND status != 'COMPLETED'
        LIMIT 1
        `,
        {
          replacements: {
            workpackId: id,
          },
          transaction,
        }
      );

      if (Array.isArray(blockingComplianceRows) && blockingComplianceRows.length > 0) {
        throw new Error('WORKPACK_CLOSE_BLOCKED_BY_COMPLIANCE');
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
      await pack.save({ transaction });

      await this.transition(pack, 'CERTIFIED', actorId, transaction);
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
