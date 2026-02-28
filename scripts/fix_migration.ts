import { pool } from './src/config/database.js';

async function fix() {
  console.log('🧹 Clearing ghost migration entry for 006...');
  try {
    await pool.query("DELETE FROM knex_migrations WHERE name LIKE '%006%'");
    console.log('✅ Entry cleared.');
  } catch (err) {
    console.error('❌ Failed to clear log:', err);
  } finally {
    process.exit();
  }
}

fix();