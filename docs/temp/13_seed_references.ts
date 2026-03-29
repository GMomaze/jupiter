import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  console.log('🌱 Seeding Reference Data (Code & Label)...');

  // Seed Component Conditions
  await knex.raw(`
    INSERT INTO rf_component_condition (code, label) 
    VALUES 
      ('SERVICEABLE', 'Serviceable'), 
      ('UNSERVICEABLE', 'Unserviceable'), 
      ('QUARANTINED', 'Quarantined')
    ON CONFLICT (code) DO NOTHING;
  `);

  // Seed Aircraft Categories
  await knex.raw(`
    INSERT INTO rf_aircraft_category (code, label) 
    VALUES 
      ('COMMERCIAL', 'Commercial'), 
      ('PRIVATE', 'Private'), 
      ('MILITARY', 'Military')
    ON CONFLICT (code) DO NOTHING;
  `);

  console.log('✅ Seeding Complete.');
}