'use strict';

import { QueryInterface } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface) {
    // ----------------------------------
    // CLEAN (order matters)
    // ----------------------------------
    await queryInterface.bulkDelete('workpack_requirements', {}, {});
    await queryInterface.bulkDelete('workpack_tasks', {}, {});
    await queryInterface.bulkDelete('workpacks', {}, {});
    await queryInterface.bulkDelete('task_cards', {}, {});
    await queryInterface.bulkDelete('task_templates', {}, {});
    await queryInterface.bulkDelete('aircraft_components', {}, {});
    await queryInterface.bulkDelete('aircraft_sb_compliance', {}, {});
    await queryInterface.bulkDelete('service_bulletins', {}, {});
    await queryInterface.bulkDelete('maintenance_requirements', {}, {});
    await queryInterface.bulkDelete('aircraft', {}, {});
    await queryInterface.bulkDelete('component_models', {}, {});
    await queryInterface.bulkDelete('user_roles', {}, {});
    await queryInterface.bulkDelete('users', {}, {});

    const tables = [
      'rf_signoff_role',
      'rf_task_state',
      'rf_workpack_status',
      'rf_role',
      'rf_component_condition',
      'rf_aircraft_category',
      'rf_asset_type',
    ];

    for (const table of tables) {
      await queryInterface.bulkDelete(table, {}, {});
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
      {}
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
      {}
    );

    await queryInterface.bulkInsert(
      'rf_role',
      [
        { code: 'ADMIN', label: 'System Administrator', system_locked: true },
        { code: 'ENGINEER', label: 'Licensed Engineer', system_locked: true },
        { code: 'MECHANIC', label: 'Mechanic', system_locked: true },
        { code: 'SUPERVISOR', label: 'Supervisor', system_locked: true },
        { code: 'QA', label: 'Quality Assurance', system_locked: true },
        { code: 'PLANNER', label: 'Planner', system_locked: true },
        { code: 'VIEWER', label: 'Viewer', system_locked: true },
      ],
      {}
    );

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
          description:
            'Legal certification of completed maintenance work',
          system_locked: true,
        },
        {
          code: 'QA',
          label: 'QA Acceptance',
          description: 'Optional quality assurance acceptance',
          system_locked: true,
        },
      ],
      {}
    );

    await queryInterface.bulkInsert(
      'rf_component_condition',
      [
        { code: 'SERVICEABLE', label: 'Serviceable', system_locked: true },
        { code: 'QUARANTINED', label: 'Quarantined', system_locked: true },
        { code: 'UNSERVICEABLE', label: 'Unserviceable', system_locked: true },
      ],
      {}
    );

    await queryInterface.bulkInsert(
      'rf_aircraft_category',
      [
        { code: 'ROTARY', label: 'Helicopter', system_locked: true },
        { code: 'FIXED_WING', label: 'Airplane', system_locked: true },
      ],
      {}
    );

    await queryInterface.bulkInsert(
      'rf_asset_type',
      [
        {
          code: 'ENGINE',
          label: 'Engine',
          is_installable_on_aircraft: true,
          is_required_for_aircraft: true,
          required_quantity: 1,
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
        {
          code: 'AIRFRAME',
          label: 'Airframe',
          is_installable_on_aircraft: false,
          is_required_for_aircraft: false,
          required_quantity: 0,
          system_locked: true,
        },
      ],
      {}
    );
  },

  async down(queryInterface: QueryInterface) {
    const tables = [
      'rf_signoff_role',
      'rf_task_state',
      'rf_workpack_status',
      'rf_role',
      'rf_component_condition',
      'rf_aircraft_category',
      'rf_asset_type',
    ];

    for (const table of tables) {
      await queryInterface.bulkDelete(table, {}, {});
    }
  },
};