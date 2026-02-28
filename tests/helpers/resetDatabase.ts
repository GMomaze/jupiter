import { pool } from '../../src/config/database.js';

/**
 * HARD RESET FOR TEST DATABASE
 * Safely truncates all domain tables with CASCADE
 * Ensures deterministic clean state before tests
 */

export async function resetDatabase() {
  await pool.query(`
    TRUNCATE TABLE
      audit_log,
      tasks,
      workpack_tasks,
      workpacks,
      components,
      aircraft,
      component_models,
      manufacturers,
      rf_asset_type,
      rf_aircraft_category,
      users
    RESTART IDENTITY CASCADE;
  `);
}