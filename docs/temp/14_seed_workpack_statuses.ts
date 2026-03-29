import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  console.log('🌱 Seeding Work Pack Statuses...');

  await knex.raw(`
    INSERT INTO rf_workpack_status (code, label) 
    VALUES 
      ('DRAFT', 'Draft - Planning'), 
      ('ISSUED', 'Issued - Ready for Hangar'), 
      ('IN_PROGRESS', 'In Progress - Maintenance Underway'), 
      ('CLOSED', 'Closed - Certified')
    ON CONFLICT (code) DO NOTHING;
  `);

  console.log('✅ Work Pack Statuses seeded.');
}