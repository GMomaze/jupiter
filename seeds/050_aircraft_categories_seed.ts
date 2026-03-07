import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {

console.log("🌱 Seeding 03 aircraft categories...");

await knex('rf_aircraft_category')
.insert([
{ code: 'GA', label: 'General Aviation' },
{ code: 'ROTARY', label: 'Rotary Wing' },
{ code: 'FIXED_WING', label: 'Fixed Wing' }
])
.onConflict('code')
.ignore();

console.log("✅ Aircraft categories seeded");
}
