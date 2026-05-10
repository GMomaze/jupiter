import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../models/index.js';

type CrmaPackRow = {
  workpack_id: string;
  work_order_number: string;
  opened_at: Date | string | null;
  certified_at: Date | string | null;
  registration: string | null;
  serial_number: string | null;
  aircraft_model: string | null;
};

type CrmaTaskRow = {
  task_id: string;
  task_card_number: string | null;
  title: string;
  work_performed: string | null;
  status: string;
  engineer_name: string | null;
  engineer_email: string | null;
  certified_at: Date | string | null;
};

export class CrmaDataService {
  private static cleanText(value: string | null | undefined) {
    return String(value || '')
      .replace(/\[Captured Values\][\s\S]*?\[\/Captured Values\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static toDate(value: Date | string | null | undefined) {
    if (!value) {
      return null;
    }

    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  static async getCrmaDataForWorkpack(workpackId: string, selectedTaskIds: string[] = []) {
    const workpackRows = await sequelize.query<CrmaPackRow>(
      `
      SELECT
        w.id AS workpack_id,
        w.work_order_number,
        w.created_at AS opened_at,
        w.certified_at,
        a.registration,
        a.serial_number,
        cm.model_name AS aircraft_model
      FROM workpacks w
      JOIN aircraft a
        ON a.id = w.aircraft_id
      LEFT JOIN component_models cm
        ON cm.id = a.model_id
      WHERE w.id = :workpackId
      LIMIT 1
      `,
      {
        replacements: { workpackId },
        type: QueryTypes.SELECT,
      }
    );

    const workpack = workpackRows[0];

    if (!workpack) {
      throw new Error('WORKPACK_NOT_FOUND');
    }

    const replacements: Record<string, unknown> = { workpackId };
    const taskScopeClause =
      selectedTaskIds.length > 0
        ? 'AND t.id IN (:selectedTaskIds)'
        : '';

    if (selectedTaskIds.length > 0) {
      replacements.selectedTaskIds = selectedTaskIds;
    }

    const taskRows = await sequelize.query<CrmaTaskRow>(
      `
      SELECT
        t.id AS task_id,
        t.task_card_number,
        t.title,
        t.work_performed,
        t.status,
        engineer.full_name AS engineer_name,
        engineer.email AS engineer_email,
        t.engineer_certified_at AS certified_at
      FROM task_cards t
      JOIN workpack_tasks wt
        ON wt.task_id = t.id
      LEFT JOIN users engineer
        ON engineer.id = t.engineer_certified_by
      WHERE wt.workpack_id = :workpackId
        ${taskScopeClause}
      ORDER BY t.task_card_number ASC NULLS LAST, t.created_at ASC
      `,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    );

    const selectedSet = new Set(selectedTaskIds);
    const foundSet = new Set(taskRows.map((row) => row.task_id));
    const missing_task_ids =
      selectedTaskIds.length > 0
        ? selectedTaskIds.filter((taskId) => !foundSet.has(taskId))
        : [];

    const normalizedTasks = taskRows.map((row) => ({
      task_id: row.task_id,
      task_card_number: row.task_card_number,
      title: row.title,
      work_performed: this.cleanText(row.work_performed),
      status: row.status,
      engineer_name: row.engineer_name,
      engineer_email: row.engineer_email,
      certified_at: this.toDate(row.certified_at),
    }));

    const certifiedTasks = normalizedTasks.filter((row) =>
      ['CERTIFIED_BY_ENGINEER', 'LOCKED'].includes(String(row.status || '').trim())
    );
    const ineligible_task_ids =
      selectedTaskIds.length > 0
        ? normalizedTasks
            .filter((row) => !['CERTIFIED_BY_ENGINEER', 'LOCKED'].includes(String(row.status || '').trim()))
            .map((row) => row.task_id)
        : [];

    const uniqueEngineers = Array.from(
      new Set(certifiedTasks.map((task) => String(task.engineer_name || '').trim()).filter(Boolean))
    );

    const latestCertifiedAt = certifiedTasks
      .map((task) => task.certified_at)
      .filter((value): value is Date => value instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0] || null;

    return {
      aircraft: {
        registration: workpack.registration,
        serial_number: workpack.serial_number,
        model: workpack.aircraft_model,
      },
      workpack: {
        id: workpack.workpack_id,
        work_order_number: workpack.work_order_number,
        opened_at: this.toDate(workpack.opened_at),
        certified_at: this.toDate(workpack.certified_at),
      },
      selected_task_ids: Array.from(selectedSet),
      missing_task_ids,
      ineligible_task_ids,
      tasks: certifiedTasks,
      certification: {
        engineer_names: uniqueEngineers,
        latest_certified_at: latestCertifiedAt,
      },
    };
  }
}
