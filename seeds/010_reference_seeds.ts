import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {

  // Clean dependent data first so reference rows can be reseeded safely.
  await knex('workpack_requirements').del();
  await knex('workpack_tasks').del();
  await knex('workpacks').del();
  await knex('task_cards').del();
  await knex('aircraft_components').del();
  await knex('maintenance_requirements').del();
  await knex('aircraft').del();
  await knex('component_models').del();
  await knex('user_roles').del();
  await knex('users').del();

  const tables = [
    'rf_signoff_role',
    'rf_task_state',
    'rf_workpack_status',
    'rf_role',
    'rf_component_condition',
    'rf_aircraft_category',
    'rf_asset_type'
  ];

  for (const table of tables) {
    await knex(table).del();
  }

  // ----------------------------------
  // INSERT DATA
  // ----------------------------------

  await knex('rf_task_state')
    .insert([
      { code: 'OPEN', label: 'Open', system_locked: true },
      { code: 'IN_PROGRESS', label: 'In Progress', system_locked: true },
      {
        code: 'COMPLETED_BY_MECHANIC',
        label: 'Completed By Mechanic',
        description: 'Task execution recorded by mechanic',
        system_locked: true
      },
      {
        code: 'CERTIFIED_BY_ENGINEER',
        label: 'Certified By Engineer',
        description: 'Task legally certified by engineer',
        system_locked: true
      }
    ])
    .onConflict('code')
    .ignore();

  await knex('rf_workpack_status')
    .insert([
      { code: 'DRAFT', label: 'Draft', system_locked: true },
      { code: 'ISSUED', label: 'Issued', system_locked: true },
      { code: 'IN_PROGRESS', label: 'In Progress', system_locked: true },
      {
        code: 'CERTIFIED',
        label: 'Certified',
        description: 'Technically certified by engineer',
        system_locked: true
      },
      {
        code: 'QA_REVIEW',
        label: 'QA Review',
        description: 'Awaiting optional QA review',
        system_locked: true
      },
      {
        code: 'RELEASED',
        label: 'Released',
        description: 'Release certificate issued and aircraft returned to service',
        system_locked: true
      }
    ])
    .onConflict('code')
    .ignore();

  await knex('rf_role')
    .insert([
      { code: 'ADMIN', label: 'System Administrator', system_locked: true },
      { code: 'ENGINEER', label: 'Licensed Engineer', system_locked: true },
      { code: 'MECHANIC', label: 'Mechanic', system_locked: true },
      { code: 'SUPERVISOR', label: 'Supervisor', system_locked: true },
      { code: 'QA', label: 'Quality Assurance', system_locked: true },
      { code: 'PLANNER', label: 'Planner', system_locked: true },
      { code: 'VIEWER', label: 'Viewer', system_locked: true }
    ])
    .onConflict('code')
    .ignore();

  await knex('rf_signoff_role')
    .insert([
      {
        code: 'MECHANIC',
        label: 'Mechanic Completion',
        description: 'Records that maintenance task execution was completed',
        system_locked: true
      },
      {
        code: 'ENGINEER',
        label: 'Engineer Certification',
        description: 'Legal certification of completed maintenance work',
        system_locked: true
      },
      {
        code: 'QA',
        label: 'QA Acceptance',
        description: 'Optional quality assurance acceptance',
        system_locked: true
      }
    ])
    .onConflict('code')
    .ignore();

  await knex('rf_component_condition')
    .insert([
      { code: 'SERVICEABLE', label: 'Serviceable', system_locked: true },
      { code: 'QUARANTINED', label: 'Quarantined', system_locked: true },
      { code: 'UNSERVICEABLE', label: 'Unserviceable', system_locked: true }
    ])
    .onConflict('code')
    .ignore();

  await knex('rf_aircraft_category')
    .insert([
      { code: 'ROTARY', label: 'Helicopter', system_locked: true },
      { code: 'FIXED_WING', label: 'Airplane', system_locked: true }
    ])
    .onConflict('code')
    .ignore();

  await knex('rf_asset_type')
    .insert([
      {
        code: 'ENGINE',
        label: 'Engine',
        is_installable_on_aircraft: true,
        is_required_for_aircraft: true,
        required_quantity: 1,
        system_locked: true
      },
      {
        code: 'PROPELLER',
        label: 'Propeller',
        is_installable_on_aircraft: true,
        is_required_for_aircraft: true,
        required_quantity: 1,
        system_locked: true
      },
      {
        code: 'AIRFRAME',
        label: 'Airframe',
        is_installable_on_aircraft: false,
        is_required_for_aircraft: false,
        required_quantity: 0,
        system_locked: true
      }
    ])
    .onConflict('code')
    .ignore();

}
