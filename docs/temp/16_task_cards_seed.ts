import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {

console.log("🌱 Seeding task cards...");

const aircraft = await knex('aircraft')
.where({ registration: 'ZS-COE' })
.first();

if (!aircraft) {
throw new Error("Aircraft not found for task cards");
}

await knex('task_cards')
.insert([
{
id: knex.fn.uuid(),
aircraft_id: aircraft.id,
title: 'Engine Oil Filter',
description: 'Inspect and clean oil filter',
status: 'OPEN'
},
{
id: knex.fn.uuid(),
aircraft_id: aircraft.id,
title: 'Tire Pressure Check',
description: 'Check main landing gear pressure',
status: 'OPEN'
}
]);

console.log("✅ Task cards seeded");
}
