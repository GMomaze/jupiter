import { pool } from '../src/config/database.js';

async function seed() {
  console.log('🌱 Seeding Reference Data (Code & Label)...');
  try {
    // Seed Component Conditions
    await pool.query(`
      INSERT INTO rf_component_condition (code, label) 
      VALUES 
        ('SERVICEABLE', 'Serviceable'), 
        ('UNSERVICEABLE', 'Unserviceable'), 
        ('QUARANTINED', 'Quarantined')
      ON CONFLICT (code) DO NOTHING;
    `);

    // Seed Aircraft Categories
    await pool.query(`
      INSERT INTO rf_aircraft_category (code, label) 
      VALUES 
        ('COMMERCIAL', 'Commercial'), 
        ('PRIVATE', 'Private'), 
        ('MILITARY', 'Military')
      ON CONFLICT (code) DO NOTHING;
    `);

    console.log('✅ Seeding Complete.');
  } catch (err) {
    console.error('❌ Seeding Failed:', err);
  } finally {
    process.exit();
  }
}

seed();