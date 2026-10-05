import { describe, expect, it, vi } from 'vitest';
import { enumerateMigrationFiles } from '../../scripts/migrationLedgerComparison.js';
import { PlatformAuthorityRepository } from './platform-authority.repository.js';

const input = {
  userId: '00000000-0000-4000-8000-000000000001',
  expectedEmail: 'owner@example.com',
  expectedDatabase: 'jupiter_test',
  confirmationToken: 'BOOTSTRAP:jupiter_test:00000000-0000-4000-8000-000000000001:owner@example.com',
  displayName: 'Owner',
};
const repositoryMigrations = [...enumerateMigrationFiles()];

function fake(options: { db?: string; ledger?: string[]; schema?: boolean; capabilitySet?: boolean; prior?: boolean; terminated?: boolean; owner?: boolean; active?: boolean } = {}) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('current_database')) return { rows: [{ name: options.db ?? 'jupiter_test' }], rowCount: 1 };
    if (sql.includes('SequelizeMeta')) return { rows: (options.ledger ?? repositoryMigrations).map(name => ({ name })), rowCount: 1 };
    if (sql.includes("to_regclass('public.platform_principals')")) {
      const ok = options.schema ?? true;
      return { rows: [{ principals: ok, capabilities: ok, grants: ok, audit: ok, capability_set: options.capabilitySet ?? ok, audit_trigger: ok }], rowCount: 1 };
    }
    if (sql.includes("action='SYSTEM_OWNER_BOOTSTRAPPED'")) return { rows: options.prior ? [{}] : [], rowCount: options.prior ? 1 : 0 };
    if (sql.includes("action='SYSTEM_OWNER_BOOTSTRAP_TERMINATED'")) return { rows: options.terminated ? [{id:'terminal'}] : [], rowCount: options.terminated ? 1 : 0 };
    if (sql.includes('pc.code=$1') && sql.includes('pg.revoked_at IS NULL')) return { rows: options.owner ? [{}] : [], rowCount: options.owner ? 1 : 0 };
    if (sql.includes('FROM users WHERE')) return { rows: [{ id: input.userId, email: input.expectedEmail, full_name: 'Owner', is_active: options.active ?? true }], rowCount: 1 };
    if (sql.includes('FROM platform_capabilities WHERE code=ANY')) return { rows: [{ id: 'c1', code: 'PLATFORM_AUTHORITY_MANAGE' }, { id: 'c2', code: 'PLATFORM_AUDIT_VIEW' }, { id: 'c3', code: 'TENANT_PROVISION' }, { id: 'c4', code: 'TENANT_ACTIVATE' }, { id: 'c5', code: 'TENANT_SUSPEND' }, { id: 'c6', code: 'TENANT_REINSTATE' }], rowCount: 6 };
    return { rows: [], rowCount: 1 };
  });
  const client = { query, release: vi.fn() };
  return { pool: { connect: vi.fn().mockResolvedValue(client) }, query };
}

async function expectLedgerRefusal(ledger: string[]) {
  const fixture = fake({ ledger });
  await expect(new PlatformAuthorityRepository(fixture.pool as any).bootstrap(input))
    .rejects.toThrow('BOOTSTRAP_MIGRATION_LEDGER_MISMATCH');
}

describe('guarded initial System Owner bootstrap', () => {
  it('preflights the exact guarded state without writing bootstrap evidence', async () => {
    const fixture = fake();
    await expect(new PlatformAuthorityRepository(fixture.pool as any).preflightBootstrap(input)).resolves.toEqual({
      database: 'jupiter_test', userId: input.userId,
      ledgerHead: repositoryMigrations[repositoryMigrations.length - 1], capabilityCount: 23,
    });
    expect(fixture.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false);
  });
  it('accepts only the exact authoritative repository ledger', async () => {
    const fixture = fake();
    await expect(new PlatformAuthorityRepository(fixture.pool as any).bootstrap(input)).resolves.toEqual(expect.any(String));
    expect(fixture.query.mock.calls.some(([sql]) => String(sql).includes('SYSTEM_OWNER_BOOTSTRAPPED'))).toBe(true);
  });
  it('bootstraps exactly the six canonical System Owner capabilities with no wildcard', async () => {
    const fixture = fake();
    await new PlatformAuthorityRepository(fixture.pool as any).bootstrap(input);
    const capCall = fixture.query.mock.calls.find(([sql]) => String(sql).includes('FROM platform_capabilities WHERE code=ANY'));
    expect(capCall).toBeTruthy();
    const codes = (capCall as any)[1][0] as string[];
    expect([...codes].sort()).toEqual(['PLATFORM_AUTHORITY_MANAGE', 'PLATFORM_AUDIT_VIEW', 'TENANT_PROVISION', 'TENANT_ACTIVATE', 'TENANT_SUSPEND', 'TENANT_REINSTATE'].sort());
    expect(codes).not.toContain('*');
    expect(codes).not.toContain('TENANT_ADMIN_RECOVER');
    expect(codes).not.toContain('TENANT_EXPORT');
    const grantInserts = fixture.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO platform_capability_grants'));
    expect(grantInserts).toHaveLength(6);
  });
  it('refuses a ledger containing only 598', () => expectLedgerRefusal(['598_create_platform_authority_foundation.ts']));
  it('refuses a missing earlier migration', () => expectLedgerRefusal(repositoryMigrations.filter((_, index) => index !== 1)));
  it('refuses an unexpected extra migration', () => expectLedgerRefusal([...repositoryMigrations, '599_unapproved.ts']));
  it('refuses duplicate migration identities', () => expectLedgerRefusal([...repositoryMigrations, repositoryMigrations[0]!]));
  it('refuses a pending repository migration', () => expectLedgerRefusal(repositoryMigrations.slice(0, -1)));
  it('refuses a mismatched repository head', () => expectLedgerRefusal([...repositoryMigrations.slice(0, -1), '600_wrong_repository_head.ts']));
  it('refuses malformed or inconsistently ordered ledger state', async () => {
    await expectLedgerRefusal([...repositoryMigrations].reverse());
    await expectLedgerRefusal([...repositoryMigrations, 'malformed-ledger-entry']);
  });
  it('refuses wrong database', async () => {
    const fixture = fake({ db: 'jupiter_db' });
    await expect(new PlatformAuthorityRepository(fixture.pool as any).bootstrap(input)).rejects.toThrow('BOOTSTRAP_DATABASE_MISMATCH');
  });
  it('refuses missing 598', () => expectLedgerRefusal(repositoryMigrations.filter(name => !name.startsWith('598_'))));
  it('refuses invalid schema state', async () => {
    const fixture = fake({ schema: false });
    await expect(new PlatformAuthorityRepository(fixture.pool as any).bootstrap(input)).rejects.toThrow('BOOTSTRAP_SCHEMA_STATE_MISMATCH');
  });
  it('refuses a missing or unexpected canonical capability set', async () => {
    const fixture = fake({ capabilitySet: false });
    await expect(new PlatformAuthorityRepository(fixture.pool as any).bootstrap(input)).rejects.toThrow('BOOTSTRAP_SCHEMA_STATE_MISMATCH');
  });
  it.each(['revoked grant history', 'deactivated principal history', 'ordinary prior bootstrap'])('durably refuses replay after %s', async () => {
    const fixture = fake({ prior: true });
    await expect(new PlatformAuthorityRepository(fixture.pool as any).bootstrap(input)).rejects.toThrow('SYSTEM_OWNER_BOOTSTRAP_ALREADY_COMPLETED');
  });
  it('refuses active owner even without marker', async () => {
    const fixture = fake({ owner: true });
    await expect(new PlatformAuthorityRepository(fixture.pool as any).bootstrap(input)).rejects.toThrow('SYSTEM_OWNER_ALREADY_EXISTS');
  });
  it('allows replay only for the exact test-only terminal state and normal bootstrap token', async () => {
    process.env.ALLOW_TERMINATED_SYSTEM_OWNER_REBOOTSTRAP='YES';
    try {
      const fixture=fake({prior:true,terminated:true});
      await expect(new PlatformAuthorityRepository(fixture.pool as any).preflightBootstrap(input)).resolves.toMatchObject({database:'jupiter_test'});
    } finally { delete process.env.ALLOW_TERMINATED_SYSTEM_OWNER_REBOOTSTRAP; }
  });
  it('refuses invalid or inactive user', async () => {
    const fixture = fake({ active: false });
    await expect(new PlatformAuthorityRepository(fixture.pool as any).bootstrap(input)).rejects.toThrow('BOOTSTRAP_USER_MISMATCH');
  });
  it('refuses incomplete confirmation', async () => {
    const fixture = fake();
    await expect(new PlatformAuthorityRepository(fixture.pool as any).bootstrap({ ...input, confirmationToken: '' })).rejects.toThrow('BOOTSTRAP_CONFIRMATION_MISMATCH');
  });
});
