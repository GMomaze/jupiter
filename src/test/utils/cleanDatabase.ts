import { pool } from '../../../src/config/database.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';

/**
 * Hard reset of relational test state.
 * Used ONLY in test environment.
 */
export async function cleanDatabase(): Promise<void> {
  await assertTestDatabaseSafety(pool);

  await pool.query(`
    TRUNCATE TABLE
      workpack_tasks,
      task_cards,
      workpacks,
      maintenance_requirements,
      aircraft_components,
      aircraft,
      component_models,
      manufacturers,
      rf_asset_type,
      rf_aircraft_category
    RESTART IDENTITY CASCADE;
  `);
}
