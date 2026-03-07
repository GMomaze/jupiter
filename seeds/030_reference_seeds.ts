import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {

console.log("🌱 Seeding 01 reference tables...");

await knex('rf_task_state')
.insert([
{ code: 'OPEN', label: 'Open', system_locked: true },
{ code: 'IN_PROGRESS', label: 'In Progress', system_locked: true },
{ code: 'PENDING_SIGNOFF', label: 'Pending Sign-off', system_locked: true },
{ code: 'CLOSED', label: 'Closed', system_locked: true }
])
.onConflict('code')
.ignore();

await knex('rf_role')
.insert([
{ code: 'ADMIN', label: 'System Administrator', system_locked: true },
{ code: 'ENGINEER', label: 'Licensed Engineer', system_locked: true },
{ code: 'MECHANIC', label: 'Mechanic / Technician', system_locked: true },
{ code: 'PLANNER', label: 'Maintenance Planner', system_locked: true },
{ code: 'VIEWER', label: 'Read Only', system_locked: true }
])
.onConflict('code')
.ignore();

await knex('rf_component_condition')
.insert([
{ code: 'SERVICEABLE', label: 'Serviceable' },
{ code: 'UNSERVICEABLE', label: 'Unserviceable' },
{ code: 'QUARANTINED', label: 'Quarantined' }
])
.onConflict('code')
.ignore();

await knex('rf_workpack_status')
.insert([
{ code: 'DRAFT', label: 'Draft' },
{ code: 'ISSUED', label: 'Issued' },
{ code: 'IN_PROGRESS', label: 'In Progress' },
{ code: 'CLOSED', label: 'Closed' }
])
.onConflict('code')
.ignore();

console.log("✅ Reference tables seeded");
}
