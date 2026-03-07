import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {

console.log("🌱 Seeding 07 workpacks...");

const aircraft = await knex('aircraft')
.where({ registration: 'ZS-COE' })
.first();

const status = await knex('rf_workpack_status')
.where({ code: 'DRAFT' })
.first();

if (!aircraft || !status) {
throw new Error("Workpack dependencies missing");
}

const [workpack] = await knex('workpacks')
.insert({
id: knex.raw('gen_random_uuid()'),
aircraft_id: aircraft.id,
status_id: status.id,
work_order_number: 'ZSCOE 0234',
version: 0
})
.returning('id');

const tasks = await knex('task_cards')
.where({ aircraft_id: aircraft.id });

for (const task of tasks) {
await knex('workpack_tasks').insert({
id: knex.raw('gen_random_uuid()'),
workpack_id: workpack.id,
task_card_id: task.id
});
}

console.log("✅ Workpacks seeded");

}