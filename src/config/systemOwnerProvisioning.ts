import { Readable, Writable } from 'node:stream';
import type { Pool } from 'pg';
import { hashPassword } from '../modules/auth/password.util.js';
import {
  SYSTEM_OWNER_USER_ID,
  SYSTEM_OWNER_EMAIL,
  SYSTEM_OWNER_DISPLAY_NAME,
} from './systemOwnerCanonical.js';

/**
 * Production-safe System Owner provisioning internals. These reuse the existing
 * canonical identity, Argon2id hashing (password.util.ts) and the masked-prompt
 * pattern already proven by the development-only scripts, but are independent of
 * any NODE_ENV gate so a production entry point can authorise them explicitly.
 *
 * The placeholder is a non-Argon2id marker string (never a hash of a known
 * value). It cannot authenticate through the normal login route — `verifyPassword`
 * returns false for any submitted password against it — and it is detectable by
 * simple string equality, so an interrupted setup (user created but password not
 * yet established) is safely recognisable and never duplicates the user or
 * silently overwrites an already-established real password.
 */

export const PLACEHOLDER_PASSWORD_MARKER =
  '__JUPITER_INITIAL_SYSTEM_OWNER_PASSWORD_NOT_ESTABLISHED__';

export const SYSTEM_OWNER_MIN_PASSWORD_LENGTH = 12;
export const SYSTEM_OWNER_MAX_PASSWORD_ATTEMPTS = 3;

export interface SystemOwnerProvisioningQueryable {
  query(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
}

export interface SystemOwnerPasswordPrompt {
  prompt(question: string): Promise<string>;
}

/**
 * Masked, non-echoing password prompt. Reused from the development-only
 * `setDevelopmentSystemOwnerPassword` script; streams are injectable for tests.
 */
export async function promptMaskedPassword(
  question: string,
  input: Readable = process.stdin,
  output: Writable = process.stdout,
): Promise<string> {
  const stdin = input as unknown as NodeJS.ReadStream & {
    setRawMode?: (enabled: boolean) => void;
    resume?: () => void;
    pause?: () => void;
    setEncoding?: (encoding: string) => void;
    on?: (event: string, listener: (chunk: string) => void) => void;
    off?: (event: string, listener: (chunk: string) => void) => void;
  };
  output.write(question);
  if (typeof stdin.setRawMode === 'function') stdin.setRawMode(true);
  stdin.resume?.();
  stdin.setEncoding?.('utf8');
  return new Promise<string>((resolve) => {
    let value = '';
    const handler = (char: string) => {
      switch (char) {
        case '\r':
        case '\n':
          if (typeof stdin.setRawMode === 'function') stdin.setRawMode(false);
          stdin.pause?.();
          stdin.off?.('data', handler);
          output.write('\n');
          resolve(value);
          break;
        case '\u0003':
          if (typeof stdin.setRawMode === 'function') stdin.setRawMode(false);
          process.exit(130);
          break;
        case '\u0008':
        case '\u007f':
          value = value.slice(0, -1);
          output.write('\b \b');
          break;
        default:
          value += char;
          output.write('*');
      }
    };
    stdin.on?.('data', handler);
  });
}

/**
 * Idempotently creates the canonical initial System Owner user with a detectable
 * placeholder password hash. Returns 'created' or 'existing' so an interrupted
 * setup can be safely resumed without creating a duplicate.
 */
export async function ensureCanonicalSystemOwnerUser(
  pool: SystemOwnerProvisioningQueryable,
): Promise<'created' | 'existing'> {
  const existingEmail = await pool.query(
    'SELECT id FROM users WHERE lower(email)=lower($1)',
    [SYSTEM_OWNER_EMAIL],
  );
  if (existingEmail.rowCount) {
    const row = existingEmail.rows[0] as { id: string };
    if (row.id !== SYSTEM_OWNER_USER_ID) {
      throw new Error('SYSTEM_OWNER_EMAIL_IDENTITY_CONFLICT');
    }
    return 'existing';
  }

  const existingId = await pool.query('SELECT email FROM users WHERE id=$1', [
    SYSTEM_OWNER_USER_ID,
  ]);
  if (existingId.rowCount) {
    const row = existingId.rows[0] as { email: string };
    if (row.email.toLowerCase() !== SYSTEM_OWNER_EMAIL.toLowerCase()) {
      throw new Error('SYSTEM_OWNER_UUID_IDENTITY_CONFLICT');
    }
    return 'existing';
  }

  await pool.query(
    `INSERT INTO users(id,email,password_hash,full_name,is_active,created_at,updated_at)
     VALUES($1,$2,$3,$4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [SYSTEM_OWNER_USER_ID, SYSTEM_OWNER_EMAIL, PLACEHOLDER_PASSWORD_MARKER, SYSTEM_OWNER_DISPLAY_NAME],
  );
  return 'created';
}

/**
 * Establishes the System Owner browser-login password through a masked prompt,
 * reusing the existing Argon2id hashing and the 12-character minimum policy.
 * Refuses to overwrite an already-established (non-placeholder) password so a
 * re-run cannot silently change a real credential.
 */
export async function establishCanonicalSystemOwnerPassword(
  pool: SystemOwnerProvisioningQueryable,
  prompt: SystemOwnerPasswordPrompt,
): Promise<void> {
  const user = await pool.query(
    'SELECT id, password_hash FROM users WHERE lower(email)=lower($1) AND is_active=true AND retired_at IS NULL',
    [SYSTEM_OWNER_EMAIL],
  );
  if (user.rowCount !== 1) throw new Error('SYSTEM_OWNER_PASSWORD_USER_MISSING');
  const row = user.rows[0] as { id: string; password_hash: string };

  if (row.password_hash !== PLACEHOLDER_PASSWORD_MARKER) {
    throw new Error('SYSTEM_OWNER_PASSWORD_ALREADY_ESTABLISHED');
  }

  let passwordHash: string | null = null;
  for (let attempt = 1; attempt <= SYSTEM_OWNER_MAX_PASSWORD_ATTEMPTS; attempt++) {
    const password = await prompt.prompt('Enter System Owner password (masked): ');
    if (password.length < SYSTEM_OWNER_MIN_PASSWORD_LENGTH) {
      throw new Error('SYSTEM_OWNER_PASSWORD_TOO_SHORT');
    }
    const confirm = await prompt.prompt('Confirm password (masked): ');
    if (password !== confirm) {
      if (attempt < SYSTEM_OWNER_MAX_PASSWORD_ATTEMPTS) continue;
      throw new Error('SYSTEM_OWNER_PASSWORD_MISMATCH');
    }
    passwordHash = await hashPassword(password);
    break;
  }
  if (!passwordHash) throw new Error('SYSTEM_OWNER_PASSWORD_MISMATCH');

  await pool.query(
    'UPDATE users SET password_hash=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
    [passwordHash, row.id],
  );
}
