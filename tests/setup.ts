import { pool } from '../src/config/database.js';
import { assertTestDatabaseSafety } from '../src/config/testDatabaseSafety.js';

await assertTestDatabaseSafety(pool);
