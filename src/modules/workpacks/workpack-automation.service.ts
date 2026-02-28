import { sequelize } from '../../models/index.js';
import {
  Workpack,
  MaintenanceRequirement,
  AircraftComponent
} from '../../models/index.js';
import { QueryTypes } from 'sequelize';

export class WorkpackAutomationService {

  /**
   * Attach MaintenanceRequirement to Aircraft DRAFT Workpack
   * Also generates executable TaskCard
   */
  static async attachRequirementToAircraft(
    aircraft_id: string,
    requirement: MaintenanceRequirement,
    transaction: any
  ) {

    // 🔥 Get DRAFT workpack status
    const draftStatus = await sequelize.query(
      `SELECT id FROM rf_workpack_status WHERE code = 'DRAFT' LIMIT 1`,
      { type: QueryTypes.SELECT, transaction }
    ) as any[];

    if (!draftStatus.length) {
      throw new Error('DRAFT_WORKPACK_STATUS_NOT_FOUND');
    }

    const draftStatusId = draftStatus[0].id;

    // 🔥 Find existing DRAFT workpack
    let workpack = await Workpack.findOne({
      where: {
        aircraft_id,
        status_id: draftStatusId
      },
      transaction
    });

    // 🔥 Create workpack if none exists
    if (!workpack) {

      const workOrderNumber = `WP-${Date.now()}`;

      workpack = await Workpack.create(
        {
          aircraft_id,
          status_id: draftStatusId,
          work_order_number: workOrderNumber
        },
        { transaction }
      );
    }

    // 🔥 Prevent duplicate requirement attachment
    const existingLink = await sequelize.query(
      `
      SELECT id FROM workpack_requirements
      WHERE workpack_id = :workpack_id
      AND maintenance_requirement_id = :requirement_id
      LIMIT 1
      `,
      {
        replacements: {
          workpack_id: workpack.id,
          requirement_id: requirement.id
        },
        type: QueryTypes.SELECT,
        transaction
      }
    ) as any[];

    if (!existingLink.length) {

      await sequelize.query(
        `
        INSERT INTO workpack_requirements
        (workpack_id, maintenance_requirement_id, status)
        VALUES (:workpack_id, :requirement_id, 'OPEN')
        `,
        {
          replacements: {
            workpack_id: workpack.id,
            requirement_id: requirement.id
          },
          transaction
        }
      );
    }

    // 🔥 Create executable TaskCard (if not exists)
    const existingTask = await sequelize.query(
      `
      SELECT tc.id
      FROM task_cards tc
      JOIN workpack_tasks wt ON wt.task_id = tc.id
      WHERE wt.workpack_id = :workpack_id
      AND tc.title = :title
      LIMIT 1
      `,
      {
        replacements: {
          workpack_id: workpack.id,
          title: requirement.title
        },
        type: QueryTypes.SELECT,
        transaction
      }
    ) as any[];

    if (!existingTask.length) {

      // Find related aircraft_component by serial in title
      const serialMatch = requirement.title.replace('TBO WARNING - ', '');

      const aircraftComponent = await AircraftComponent.findOne({
        where: {
          aircraft_id,
          serial_number: serialMatch
        },
        transaction
      });

      const taskCard = await sequelize.query(
        `
        INSERT INTO task_cards
        (title, description, aircraft_id, component_id)
        VALUES (:title, :description, :aircraft_id, :component_id)
        RETURNING id
        `,
        {
          replacements: {
            title: requirement.title,
            description: requirement.description,
            aircraft_id,
            component_id: aircraftComponent?.id || null
          },
          type: QueryTypes.INSERT,
          transaction
        }
      ) as any[];

      const taskId = taskCard[0][0].id;

      await sequelize.query(
        `
        INSERT INTO workpack_tasks
        (workpack_id, task_id)
        VALUES (:workpack_id, :task_id)
        `,
        {
          replacements: {
            workpack_id: workpack.id,
            task_id: taskId
          },
          transaction
        }
      );
    }

    return workpack;
  }
}
