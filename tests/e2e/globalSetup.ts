import { pool } from '../../src/config/database.js';
import { assertTestDatabaseSafety } from '../../src/config/testDatabaseSafety.js';

export default async function globalSetup(): Promise<void> {
  await assertTestDatabaseSafety(pool);
  await pool.end();
}
