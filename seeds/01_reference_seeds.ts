import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Clear existing to avoid duplicates
  const tables = [
    'rf_task_state', 'rf_workpack_status', 'rf_role', 
    'rf_component_condition', 'rf_aircraft_category'
  ];
  
  for (const table of tables) {
    await knex(table).del();
  }

  // 1. Task States
  await knex('rf_task_state').insert([
    { code: 'OPEN', label: 'Open', system_locked: true },
    { code: 'IN_PROGRESS', label: 'In Progress', system_locked: true },
    { code: 'PENDING_SIGNOFF', label: 'Pending Sign-off', system_locked: true },
    { code: 'CLOSED', label: 'Closed', system_locked: true }
  ]);

  // 2. Roles (Core Auth)
  await knex('rf_role').insert([
    { code: 'ADMIN', label: 'System Administrator', system_locked: true },
    { code: 'ENGINEER', label: 'Licensed Engineer', system_locked: true },
    { code: 'MECHANIC', label: 'Mechanic / Technician', system_locked: true },
    { code: 'PLANNER', label: 'Maintenance Planner', system_locked: true },    
    { code: 'VIEWER', label: 'Only viewing', system_locked: true }
  ]);

  // 3. Aircraft Categories
  await knex('rf_aircraft_category').insert([
    { code: 'ROTARY', label: 'Rotary Wing (Helicopter)', system_locked: true },
    { code: 'FIXED_WING', label: 'Fixed Wing (Airplane)', system_locked: true }
  ]);
}