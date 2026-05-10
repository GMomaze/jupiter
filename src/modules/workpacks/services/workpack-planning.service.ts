import { QueryTypes } from 'sequelize';
import {
  Aircraft,
  TaskCard,
  TaskTemplate,
  Workpack,
  WorkpackStatus,
  WorkpackTask,
} from '../../../models/index.js';
import { AuditService } from '../../audit/audit.service.js';

export class WorkpackPlanningService {
  private static canManageTemplatesForStatus(statusCode: string) {
    return ['DRAFT', 'ISSUED'].includes(String(statusCode || '').trim());
  }

  static async getCompatibleTemplatesForWorkpack(
    pack: Workpack,
    aircraft: Aircraft | null,
    sequelize: any,
    transaction?: any
  ) {
    if (!pack || !aircraft) {
      return [];
    }

    const existingTemplateTaskLinks = await WorkpackTask.findAll({
      where: { workpack_id: pack.id },
      transaction,
    });

    const existingTemplateTaskIds = existingTemplateTaskLinks.map((link) => link.task_id);
    const existingTemplateSourceIds = new Set<string>();

    if (existingTemplateTaskIds.length > 0) {
      const existingTemplateTasks = await TaskCard.findAll({
        attributes: ['template_source_id'],
        where: { id: existingTemplateTaskIds },
        transaction,
      });

      existingTemplateTasks.forEach((task) => {
        const templateSourceId = String((task as any).template_source_id || '').trim();
        if (templateSourceId) {
          existingTemplateSourceIds.add(templateSourceId);
        }
      });
    }

    const taskTemplateRows = await TaskTemplate.findAll({
      attributes: [
        'id',
        'scope',
        'task_card_number',
        'sort_order',
        'title',
        'description',
        'aircraft_model_id',
        'aircraft_id',
        'is_active',
        'is_required_for_wood',
        'is_required_for_fabric',
        'is_required_for_bungees',
        'is_required_for_woodprop',
        'is_required_for_retractable',
      ],
      where: { is_active: true },
      order: [['sort_order', 'ASC']],
      raw: true,
      transaction,
    });

    return taskTemplateRows.filter((template: any) => {
      const normalizedScope = String(template.scope || '').trim().toUpperCase();
      if (existingTemplateSourceIds.has(String(template.id || '').trim())) {
        return false;
      }

      if (normalizedScope === 'GLOBAL' || normalizedScope === 'MPI') {
        return true;
      }

      if (normalizedScope === 'MODEL') {
        return String(aircraft.model_id || '').trim() === String(template.aircraft_model_id || '').trim();
      }

      if (normalizedScope === 'AIRCRAFT') {
        return String(aircraft.id || '').trim() === String(template.aircraft_id || '').trim();
      }

      return false;
    });
  }

  private static async hasExecutionStarted(
    workpackId: string,
    sequelize: any,
    transaction?: any
  ) {
    const [result] = await sequelize.query(
      `
      SELECT (
        EXISTS (
          SELECT 1
          FROM workpack_tasks wt
          JOIN task_cards tc ON tc.id = wt.task_id
          WHERE wt.workpack_id = :workpackId
            AND (
              tc.status IN ('IN_PROGRESS', 'COMPLETED_BY_MECHANIC', 'CERTIFIED_BY_ENGINEER', 'LOCKED')
              OR NULLIF(BTRIM(COALESCE(tc.work_performed, '')), '') IS NOT NULL
              OR tc.engineer_certified_by IS NOT NULL
              OR tc.engineer_certified_at IS NOT NULL
            )
        )
        OR EXISTS (
          SELECT 1
          FROM workpack_executions we
          WHERE we.workpack_id = :workpackId
            AND (
              we.status <> 'OPEN'
              OR we.started_by IS NOT NULL
              OR we.started_at IS NOT NULL
              OR we.completed_by IS NOT NULL
              OR we.completed_at IS NOT NULL
              OR we.certified_by IS NOT NULL
              OR we.certified_at IS NOT NULL
            )
        )
        OR EXISTS (
          SELECT 1
          FROM workpack_measurements wm
          JOIN workpack_executions we ON we.id = wm.execution_id
          WHERE we.workpack_id = :workpackId
        )
        OR EXISTS (
          SELECT 1
          FROM workpack_signatures ws
          JOIN workpack_executions we ON we.id = ws.execution_id
          WHERE we.workpack_id = :workpackId
        )
      ) AS started
      `,
      {
        replacements: { workpackId },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    return Boolean((result as any)?.started);
  }

  static async canEditWorkpack(
    workpackId: string,
    statusCode: string,
    sequelize: any,
    transaction?: any
  ) {
    if (statusCode === 'DRAFT') {
      return true;
    }

    if (statusCode !== 'ISSUED') {
      return false;
    }

    const executionStarted = await this.hasExecutionStarted(
      workpackId,
      sequelize,
      transaction
    );

    return !executionStarted;
  }

  private static async ensurePackEditable(
    workpackId: string,
    statusCode: string,
    sequelize: any,
    transaction?: any
  ) {
    const canEdit = await this.canEditWorkpack(
      workpackId,
      statusCode,
      sequelize,
      transaction
    );

    if (!canEdit) {
      throw new Error('WORKPACK_EDIT_LOCKED');
    }
  }

  static async addTask(
    workpackId: string,
    taskId: string,
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

      await this.ensurePackEditable(workpackId, status.code, sequelize, transaction);

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

  static async removeTask(
    workpackId: string,
    taskId: string,
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

      await this.ensurePackEditable(workpackId, status.code, sequelize, transaction);

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

  static async addTaskFromTemplate(
    workpackId: string,
    templateId: string,
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

      if (!this.canManageTemplatesForStatus(String(status.code || '').trim())) {
        throw new Error('WORKPACK_TEMPLATE_ADD_BLOCKED');
      }

      await this.ensurePackEditable(workpackId, status.code, sequelize, transaction);

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
}
