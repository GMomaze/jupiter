import { pool } from './src/config/database.js';

async function force() {
  console.log('🏗️ Manually building components table...');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS components (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        part_number TEXT NOT NULL,
        serial_number TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'SERVICEABLE',
        aircraft_id UUID REFERENCES aircraft(id) ON DELETE SET NULL,
        condition_id UUID REFERENCES rf_component_condition(id) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TRIGGER tr_audit_components 
      AFTER INSERT OR UPDATE ON components 
      FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
    `);
    console.log('✅ Components table and trigger created.');
  } catch (err) {
    console.error('❌ Failed:', err);
  } finally {
    process.exit();
  }
}

force();