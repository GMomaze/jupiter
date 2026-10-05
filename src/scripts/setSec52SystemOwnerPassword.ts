import { pool } from '../config/database.js';
import { hashPassword } from '../modules/auth/password.util.js';

const OWNER_USER_ID = '95e16523-7db0-43b0-b76e-637c3a921e63';

async function main() {
  if (process.env.NODE_ENV !== 'test') throw new Error('SEC52_PASSWORD_REQUIRES_TEST_ENV');
  if (process.env.ALLOW_SEC52_SYSTEM_OWNER_PASSWORD !== 'YES') throw new Error('SEC52_PASSWORD_NOT_AUTHORIZED');
  const db = await pool.query(`SELECT current_database() name`);
  if (db.rows[0]?.name !== 'jupiter_test') throw new Error('SEC52_PASSWORD_DB_MISMATCH');

  const plaintext = process.env.SEC52_SYSTEM_OWNER_PASSWORD;
  if (!plaintext) throw new Error('SEC52_SYSTEM_OWNER_PASSWORD_REQUIRED');

  const existing = await pool.query(`SELECT id, email FROM users WHERE id=$1 AND is_active=true`, [OWNER_USER_ID]);
  if (!existing.rowCount) throw new Error('SEC52_PASSWORD_OWNER_USER_MISSING');

  const hash = await hashPassword(plaintext);
  await pool.query(`UPDATE users SET password_hash=$1 WHERE id=$2`, [hash, OWNER_USER_ID]);

  console.log(`SEC52 System Owner browser-login password established (Argon2id hash stored only).`);
  await pool.end();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : 'SEC52 password setup failed.');
  await pool.end();
  process.exitCode = 1;
});
