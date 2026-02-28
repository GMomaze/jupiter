import { pool } from '../src/config/database.js';

async function seed() {
  console.log('🌱 Seeding Work Pack Statuses...');
  try {
    await pool.query(`
      INSERT INTO rf_workpack_status (code, label) 
      VALUES 
        ('DRAFT', 'Draft - Planning'), 
        ('ISSUED', 'Issued - Ready for Hangar'), 
        ('IN_PROGRESS', 'In Progress - Maintenance Underway'), 
        ('CLOSED', 'Closed - Certified')
      ON CONFLICT (code) DO NOTHING;
    `);
    console.log('✅ Work Pack Statuses seeded.');
  } catch (err) {
    console.error('❌ Seeding Failed:', err);
  } finally {
    process.exit();
  }
}
seed();