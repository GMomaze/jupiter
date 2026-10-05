'use strict';

import { QueryInterface, Transaction } from 'sequelize';

export const OPERATIONAL_ROLES = [
  { code: 'ADMIN', label: 'System Administrator' },
  { code: 'ENGINEER', label: 'Licensed Engineer' },
  { code: 'MECHANIC', label: 'Mechanic' },
  { code: 'SUPERVISOR', label: 'Supervisor' },
  { code: 'QA', label: 'Quality Assurance' },
  { code: 'PLANNER', label: 'Planner' },
  { code: 'VIEWER', label: 'Viewer' },
] as const;

export async function seedOperationalRoles(
  queryInterface: QueryInterface,
  transaction: Transaction
): Promise<void> {
  for (const role of OPERATIONAL_ROLES) {
    await queryInterface.sequelize.query(
      `
      INSERT INTO rf_role (code, label, system_locked)
      VALUES (:code, :label, true)
      ON CONFLICT (code) DO NOTHING;
      `,
      {
        replacements: role,
        transaction,
      }
    );
  }
}

export default {
  async up(queryInterface: QueryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // ----------------------------------
      // CLEAN (order matters)
      // ----------------------------------
      await queryInterface.bulkDelete(
        'workpack_requirements',
        {},
        { transaction }
      );
      await queryInterface.bulkDelete('workpack_tasks', {}, { transaction });
      await queryInterface.bulkDelete('workpacks', {}, { transaction });
      await queryInterface.bulkDelete('task_cards', {}, { transaction });
      await queryInterface.bulkDelete('task_templates', {}, { transaction });
      await queryInterface.bulkDelete(
        'aircraft_components',
        {},
        { transaction }
      );
      await queryInterface.bulkDelete(
        'aircraft_sb_compliance',
        {},
        { transaction }
      );
      await queryInterface.bulkDelete('service_bulletins', {}, { transaction });
      await queryInterface.bulkDelete(
        'maintenance_requirements',
        {},
        { transaction }
      );
      await queryInterface.bulkDelete('aircraft', {}, { transaction });
      await queryInterface.bulkDelete('component_models', {}, { transaction });

      const tables = [
        'rf_signoff_role',
        'rf_task_state',
        'rf_workpack_status',
        'rf_component_condition',
        'rf_aircraft_category',
        'rf_asset_type',
      ];

      for (const table of tables) {
        await queryInterface.bulkDelete(table, {}, { transaction });
      }

      // ----------------------------------
      // INSERT DATA
      // ----------------------------------

      await queryInterface.bulkInsert(
        'rf_task_state',
        [
          { code: 'OPEN', label: 'Open', system_locked: true },
          { code: 'IN_PROGRESS', label: 'In Progress', system_locked: true },
          {
            code: 'COMPLETED_BY_MECHANIC',
            label: 'Completed By Mechanic',
            description: 'Task execution recorded by mechanic',
            system_locked: true,
          },
          {
            code: 'CERTIFIED_BY_ENGINEER',
            label: 'Certified By Engineer',
            description: 'Task legally certified by engineer',
            system_locked: true,
          },
        ],
        { transaction }
      );

      await queryInterface.bulkInsert(
        'rf_workpack_status',
        [
          { code: 'DRAFT', label: 'Draft', system_locked: true },
          { code: 'ISSUED', label: 'Issued', system_locked: true },
          { code: 'IN_PROGRESS', label: 'In Progress', system_locked: true },
          {
            code: 'CERTIFIED',
            label: 'Certified',
            description: 'Technically certified by engineer',
            system_locked: true,
          },
          {
            code: 'QA_REVIEW',
            label: 'QA Review',
            description: 'Awaiting optional QA review',
            system_locked: true,
          },
          {
            code: 'RELEASED',
            label: 'Released',
            description:
              'Release certificate issued and aircraft returned to service',
            system_locked: true,
          },
        ],
        { transaction }
      );

      await seedOperationalRoles(queryInterface, transaction);

      await queryInterface.bulkInsert(
        'rf_signoff_role',
        [
          {
            code: 'MECHANIC',
            label: 'Mechanic Completion',
            description:
              'Records that maintenance task execution was completed',
            system_locked: true,
          },
          {
            code: 'ENGINEER',
            label: 'Engineer Certification',
            description: 'Legal certification of completed maintenance work',
            system_locked: true,
          },
          {
            code: 'QA',
            label: 'QA Acceptance',
            description: 'Optional quality assurance acceptance',
            system_locked: true,
          },
        ],
        { transaction }
      );

      await queryInterface.bulkInsert(
        'rf_component_condition',
        [
          { code: 'SERVICEABLE', label: 'Serviceable', system_locked: true },
          { code: 'QUARANTINED', label: 'Quarantined', system_locked: true },
          {
            code: 'UNSERVICEABLE',
            label: 'Unserviceable',
            system_locked: true,
          },
        ],
        { transaction }
      );

      await queryInterface.bulkInsert(
        'rf_aircraft_category',
        [
          { code: 'ROTARY', label: 'Helicopter', system_locked: true },
          { code: 'FIXED_WING', label: 'Airplane', system_locked: true },
        ],
        { transaction }
      );

      await queryInterface.bulkInsert(
        'rf_asset_type',
        [
          {
            code: 'AIRFRAME',
            label: 'Airframe',
            is_installable_on_aircraft: false,
            is_required_for_aircraft: false,
            required_quantity: 1,
            system_locked: true,
          },
          {
            code: 'CARBURETOR',
            label: 'Carburetors',
            is_installable_on_aircraft: true,
            is_required_for_aircraft: true,
            required_quantity: 1,
            system_locked: true,
          },
          {
            code: 'ENGINE',
            label: 'Engine',
            is_installable_on_aircraft: true,
            is_required_for_aircraft: true,
            required_quantity: 1,
            system_locked: true,
          },
          {
            code: 'MAGNETO',
            label: 'Magnetos',
            is_installable_on_aircraft: true,
            is_required_for_aircraft: true,
            required_quantity: 2,
            system_locked: true,
          },
          {
            code: 'PROPELLER',
            label: 'Propeller',
            is_installable_on_aircraft: true,
            is_required_for_aircraft: true,
            required_quantity: 1,
            system_locked: true,
          },
        ],
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface: QueryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    const tables = [
      'rf_signoff_role',
      'rf_task_state',
      'rf_workpack_status',
      'rf_component_condition',
      'rf_aircraft_category',
      'rf_asset_type',
    ];

    try {
      for (const table of tables) {
        await queryInterface.bulkDelete(table, {}, { transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
