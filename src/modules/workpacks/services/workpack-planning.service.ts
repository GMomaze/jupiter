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
