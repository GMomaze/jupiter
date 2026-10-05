import 'dotenv/config';
import pg from 'pg';
import { hashPassword } from '../modules/auth/password.util.js';

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

/**
 * DEVELOPMENT-only: establish the System Owner browser-login password via a
 * masked, non-echoing local prompt. The plaintext is never printed, logged, or
 * persisted — only the Argon2id hash is stored. This is the clean DEVELOPMENT
 * equivalent of the test-only SEC52 script and never reuses SEC52 identity/data.
 */
async function promptMasked(question: string): Promise<string> {
  process.stdout.write(question);
  const stdin = process.stdin;
  if (typeof stdin.setRawMode === 'function') stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise<string>((resolve) => {
    let value = '';
    const handler = (char: string) => {
      switch (char) {
        case '\r':
        case '\n':
          if (typeof stdin.setRawMode === 'function') stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', handler);
          process.stdout.write('\n');
          resolve(value);
          break;
        case '\u0003':
          if (typeof stdin.setRawMode === 'function') stdin.setRawMode(false);
          process.exit(130);
          break;
        case '\u0008':
        case '\u007f':
          value = value.slice(0, -1);
          process.stdout.write('\b \b');
          break;
        default:
          value += char;
          process.stdout.write('*');
      }
    };
    stdin.on('data', handler);
  });
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('SET_SYSTEM_OWNER_PASSWORD_REQUIRES_DEVELOPMENT');
  }
  if (process.env.ALLOW_SET_SYSTEM_OWNER_PASSWORD !== 'YES') {
    throw new Error('SET_SYSTEM_OWNER_PASSWORD_NOT_AUTHORIZED');
  }
  const email = process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error('SET_SYSTEM_OWNER_PASSWORD_EMAIL_REQUIRED');
  const db = await pool.query(`SELECT current_database() name`);
  if (db.rows[0]?.name !== 'jupiter_db') {
    throw new Error('SET_SYSTEM_OWNER_PASSWORD_DB_MISMATCH');
  }
  const user = await pool.query(
    `SELECT id FROM users WHERE lower(email)=lower($1) AND is_active=true`,
    [email],
  );
  if (user.rowCount !== 1) {
    throw new Error('SET_SYSTEM_OWNER_PASSWORD_USER_MISSING');
  }
  const MAX_ATTEMPTS = 3;
  let passwordHash: string | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const password = await promptMasked('Enter System Owner password (masked): ');
    if (password.length < 12) {
      throw new Error('SET_SYSTEM_OWNER_PASSWORD_TOO_SHORT');
    }
    const confirm = await promptMasked('Confirm password (masked): ');
    if (password !== confirm) {
      if (attempt < MAX_ATTEMPTS) {
        console.error(
          `FAIL: SET_SYSTEM_OWNER_PASSWORD_MISMATCH — entries did not match (attempt ${attempt} of ${MAX_ATTEMPTS}). Please try again.`,
        );
        continue;
      }
      throw new Error('SET_SYSTEM_OWNER_PASSWORD_MISMATCH');
    }
    passwordHash = await hashPassword(password);
    break;
  }
  if (!passwordHash) {
    throw new Error('SET_SYSTEM_OWNER_PASSWORD_MISMATCH');
  }
  await pool.query(
    `UPDATE users SET password_hash=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2`,
    [passwordHash, user.rows[0].id],
  );
  console.log('PASS');
  await pool.end();
}

main().catch(async (error) => {
  console.error(`FAIL: ${error instanceof Error ? error.message : 'error'}`);
  await pool.end().catch(() => undefined);
  process.exitCode = 1;
});
