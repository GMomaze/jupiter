import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {

  console.log("🌱 Seeding 02 asset types...");

  await knex('rf_asset_type')
    .insert([
      { code: 'AIRCRAFT', label: 'Aircraft' },
      { code: 'ENGINE', label: 'Engine' },
      { code: 'PROPELLER', label: 'Propeller' }
    ])
    .onConflict('code')
    .ignore();

  console.log("✅ Asset types seeded");

}