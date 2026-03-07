import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {

console.log("🌱 Seeding 05 aircraft...");

const category = await knex('rf_aircraft_category')
.where({ code: 'GA' })
.first();

const model = await knex('component_models')
.where({ model_name: '172A' })
.first();

if (!category || !model) {
throw new Error("Aircraft dependencies missing");
}

const aircraftId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

await knex('aircraft')
.insert({
id: aircraftId,
registration: 'ZS-COE',
serial_number: '2108-9934',
category_id: category.id,
model_id: model.id,
status: 'REGISTERED',
version: 0
})
.onConflict('registration')
.ignore();

console.log("✅ Aircraft seeded");
}
