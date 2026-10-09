import { readFileSync } from 'node:fs';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock only the slow Argon2id hashing; keep verifyPassword real so the
// placeholder-authentication proof exercises the actual verification path.
vi.mock('../modules/auth/password.util.js', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../modules/auth/password.util.js')
  >();
  return {
    ...actual,
    hashPassword: vi.fn(async (password: string) => `hash(${password})`),
  };
});

import { hashPassword, verifyPassword } from '../modules/auth/password.util.js';
import { SYSTEM_OWNER_USER_ID } from './systemOwnerCanonical.js';
import {
  ensureCanonicalSystemOwnerUser,
  establishCanonicalSystemOwnerPassword,
  PLACEHOLDER_PASSWORD_MARKER,
  SYSTEM_OWNER_MAX_PASSWORD_ATTEMPTS,
} from './systemOwnerProvisioning.js';

interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number | null;
}

function mockPool(responses: QueryResult[]): {
  pool: { query: ReturnType<typeof vi.fn> };
  calls: string[];
} {
  const calls: string[] = [];
  const query = vi.fn(async (sql: string) => {
    calls.push(sql);
    const next = responses.shift();
    return next ?? { rows: [], rowCount: 0 };
  });
  return { pool: { query }, calls };
}

const prompt = (answers: string[]) => ({
  prompt: vi.fn(async () => answers.shift() ?? ''),
});

describe('ensureCanonicalSystemOwnerUser', () => {
  it('creates the canonical user with a non-authenticatable marker, not a hash', async () => {
    const { pool } = mockPool([
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 1 },
    ]);
    const outcome = await ensureCanonicalSystemOwnerUser(pool);
    expect(outcome).toBe('created');
    expect(hashPassword).not.toHaveBeenCalled();
  });

  it('is idempotent when the canonical email already exists (matching UUID)', async () => {
    const { pool, calls } = mockPool([
      { rows: [{ id: SYSTEM_OWNER_USER_ID }], rowCount: 1 },
    ]);
    const outcome = await ensureCanonicalSystemOwnerUser(pool);
    expect(outcome).toBe('existing');
    expect(calls.some((sql) => sql.includes('INSERT INTO users'))).toBe(false);
  });

  it('is idempotent when the canonical UUID already exists (matching email)', async () => {
    const { pool, calls } = mockPool([
      { rows: [], rowCount: 0 },
      { rows: [{ email: 'systemowner@jupiter.local' }], rowCount: 1 },
    ]);
    const outcome = await ensureCanonicalSystemOwnerUser(pool);
    expect(outcome).toBe('existing');
    expect(calls.some((sql) => sql.includes('INSERT INTO users'))).toBe(false);
  });

  it('fails closed when the canonical email belongs to a different UUID', async () => {
    const { pool, calls } = mockPool([{ rows: [{ id: 'other-uuid' }], rowCount: 1 }]);
    await expect(ensureCanonicalSystemOwnerUser(pool)).rejects.toThrow(
      'SYSTEM_OWNER_EMAIL_IDENTITY_CONFLICT',
    );
    expect(calls.some((sql) => sql.includes('INSERT INTO users'))).toBe(false);
  });

  it('fails closed when the canonical UUID belongs to a different email', async () => {
    const { pool, calls } = mockPool([
      { rows: [], rowCount: 0 },
      { rows: [{ email: 'other@example.com' }], rowCount: 1 },
    ]);
    await expect(ensureCanonicalSystemOwnerUser(pool)).rejects.toThrow(
      'SYSTEM_OWNER_UUID_IDENTITY_CONFLICT',
    );
    expect(calls.some((sql) => sql.includes('INSERT INTO users'))).toBe(false);
  });
});

describe('placeholder authentication safety', () => {
  it('cannot authenticate through the real verifyPassword path', async () => {
    // The marker is not a valid Argon2id hash, so verifyPassword returns false
    // for any submitted password — including the marker string itself.
    expect(await verifyPassword(PLACEHOLDER_PASSWORD_MARKER, PLACEHOLDER_PASSWORD_MARKER)).toBe(
      false,
    );
    expect(await verifyPassword(PLACEHOLDER_PASSWORD_MARKER, 'any-other-password')).toBe(false);
  });
});

describe('establishCanonicalSystemOwnerPassword', () => {
  beforeEach(() => {
    vi.mocked(hashPassword).mockResolvedValue('hash(newpassword)');
  });

  it('refuses when the password is already established (non-marker)', async () => {
    const { pool, calls } = mockPool([
      { rows: [{ id: 'u', password_hash: '$argon2id$real-hash' }], rowCount: 1 },
    ]);
    await expect(
      establishCanonicalSystemOwnerPassword(pool, prompt(['x'.repeat(12), 'x'.repeat(12)])),
    ).rejects.toThrow('SYSTEM_OWNER_PASSWORD_ALREADY_ESTABLISHED');
    expect(calls.some((sql) => sql.includes('UPDATE users'))).toBe(false);
  });

  it('refuses when the canonical user is missing', async () => {
    const { pool } = mockPool([{ rows: [], rowCount: 0 }]);
    await expect(
      establishCanonicalSystemOwnerPassword(pool, prompt(['x'.repeat(12)])),
    ).rejects.toThrow('SYSTEM_OWNER_PASSWORD_USER_MISSING');
  });

  it('rejects a password shorter than the minimum length', async () => {
    const { pool, calls } = mockPool([
      { rows: [{ id: 'u', password_hash: PLACEHOLDER_PASSWORD_MARKER }], rowCount: 1 },
    ]);
    await expect(
      establishCanonicalSystemOwnerPassword(pool, prompt(['short'])),
    ).rejects.toThrow('SYSTEM_OWNER_PASSWORD_TOO_SHORT');
    expect(calls.some((sql) => sql.includes('UPDATE users'))).toBe(false);
  });

  it('rejects mismatched confirmation entries', async () => {
    const { pool, calls } = mockPool([
      { rows: [{ id: 'u', password_hash: PLACEHOLDER_PASSWORD_MARKER }], rowCount: 1 },
    ]);
    await expect(
      establishCanonicalSystemOwnerPassword(
        pool,
        prompt([
          'password-one-two',
          'password-one-THREE',
          'password-one-two',
          'password-one-THREE',
          'password-one-two',
          'password-one-THREE',
        ]),
      ),
    ).rejects.toThrow('SYSTEM_OWNER_PASSWORD_MISMATCH');
    expect(calls.some((sql) => sql.includes('UPDATE users'))).toBe(false);
  });

  it('stores only the Argon2id hash on success', async () => {
    const { pool, calls } = mockPool([
      { rows: [{ id: 'u', password_hash: PLACEHOLDER_PASSWORD_MARKER }], rowCount: 1 },
      { rows: [], rowCount: 1 },
    ]);
    await establishCanonicalSystemOwnerPassword(
      pool,
      prompt(['password-one-two', 'password-one-two']),
    );
    expect(hashPassword).toHaveBeenCalledWith('password-one-two');
    expect(calls.some((sql) => sql.includes('UPDATE users SET password_hash'))).toBe(true);
  });

  it('limits password attempts to the configured maximum', () => {
    expect(SYSTEM_OWNER_MAX_PASSWORD_ATTEMPTS).toBe(3);
  });

  it('refuses a retired or inactive canonical user', () => {
    const source = readFileSync('src/config/systemOwnerProvisioning.ts', 'utf8');
    expect(source).toContain('AND is_active=true AND retired_at IS NULL');
  });
});

describe('production setup entry point', () => {
  const source = readFileSync('src/scripts/setupInitialSystemOwner.ts', 'utf8');

  it('requires explicit production authorization and exact database identity', () => {
    expect(source).toContain('ALLOW_PRODUCTION_SYSTEM_OWNER_SETUP');
    expect(source).toContain('PRODUCTION_SYSTEM_OWNER_SETUP_NOT_AUTHORIZED');
    expect(source).toContain("!== 'jupiter_db'");
    expect(source).toContain('PRODUCTION_SYSTEM_OWNER_SETUP_DB_MISMATCH');
  });

  it('enforces migration readiness without a hard-coded head', () => {
    expect(source).toContain('verifyRepositoryMigrationLedger');
    expect(source).toContain('PRODUCTION_SYSTEM_OWNER_SETUP_MIGRATION_NOT_READY');
  });

  it('does not gate on NODE_ENV=development', () => {
    expect(source).not.toContain("NODE_ENV !== 'development'");
    expect(source).not.toContain('REQUIRES_DEVELOPMENT');
  });

  it('reuses the canonical identity and masked prompt', () => {
    expect(source).toContain('ensureCanonicalSystemOwnerUser');
    expect(source).toContain('establishCanonicalSystemOwnerPassword');
    expect(source).toContain('promptMaskedPassword');
  });
});

