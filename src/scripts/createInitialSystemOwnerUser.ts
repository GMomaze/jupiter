import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { hashPassword } from '../modules/auth/password.util.js';
import {
  SYSTEM_OWNER_USER_ID,
  SYSTEM_OWNER_EMAIL,
  SYSTEM_OWNER_DISPLAY_NAME,
} from '../config/systemOwnerCanonical.js';

// Direct development connection (avoids importing config/database.js, whose
// NO_DATABASE_TEST_BOUNDARY guard must not gate the guarded development rebuild).
const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

/**
 * DEVELOPMENT-only: create the single canonical initial System Owner user
 * identity (placeholder hash only — the real browser-login password is
 * established separately via a masked local prompt). The canonical UUID/email/
 * name are fixed constants; this is not an operator-nominated identity. The
 * guarded bootstrap (platform:bootstrap:preflight / :execute) then creates the
 * HUMAN principal and the six canonical grants for this already-active user.
 */
async function main(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('CREATE_SYSTEM_OWNER_USER_REQUIRES_DEVELOPMENT');
  }
  if (process.env.ALLOW_CREATE_SYSTEM_OWNER_USER !== 'YES') {
    throw new Error('CREATE_SYSTEM_OWNER_USER_NOT_AUTHORIZED');
  }
  const email = SYSTEM_OWNER_EMAIL;
  const fullName = SYSTEM_OWNER_DISPLAY_NAME;
  const userId = SYSTEM_OWNER_USER_ID;
  const db = await pool.query(`SELECT current_database() name`);
  if (db.rows[0]?.name !== 'jupiter_db') {
    throw new Error('CREATE_SYSTEM_OWNER_USER_DB_MISMATCH');
  }
  const existingEmail = await pool.query(
    `SELECT id FROM users WHERE lower(email)=lower($1)`,
    [email],
  );
  if (existingEmail.rowCount) {
    throw new Error('CREATE_SYSTEM_OWNER_USER_ALREADY_EXISTS');
  }
  const existingId = await pool.query(`SELECT id FROM users WHERE id=$1`, [
    userId,
  ]);
  if (existingId.rowCount) {
    throw new Error('CREATE_SYSTEM_OWNER_USER_ID_CONFLICT');
  }
  // Non-reusable placeholder: a valid Argon2id hash of a random value whose
  // plaintext is immediately discarded.
  const placeholderHash = await hashPassword(randomUUID());
  await pool.query(
    `INSERT INTO users(id,email,password_hash,full_name,is_active,created_at,updated_at)
     VALUES($1,$2,$3,$4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [userId, email, placeholderHash, fullName],
  );
  console.log(JSON.stringify({ outcome: 'CREATED', userId, email, fullName }));
  await pool.end();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : 'CREATE_SYSTEM_OWNER_USER failed');
  await pool.end().catch(() => undefined);
  process.exitCode = 1;
});

