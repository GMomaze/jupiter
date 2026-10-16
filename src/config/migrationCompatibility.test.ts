import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  prepareMigrationCompatibility,
  finalizeMigrationCompatibility,
  resolveRuntimeRolesForPrivilegeBaseline,
  runMigrationWithCleanup,
  type MigrationCompatibilityQueryable,
} from './migrationCompatibility.js';

const MARKER = 'jupiter_migration_compatibility_temporary_role';

function lockedRole(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    comment: MARKER,
    can_login: false,
    is_superuser: false,
    can_create_db: false,
    can_create_role: false,
    can_replicate: false,
    bypass_rls: false,
    inherit: false,
    ...overrides,
  };
}

function mockClient(queries: { sql: RegExp; rows: Record<string, unknown>[] }[]): MigrationCompatibilityQueryable {
  const calls: string[] = [];
  const client: MigrationCompatibilityQueryable = {
    query: vi.fn(async (sql: string) => {
      calls.push(sql);
      const match = queries.find(({ sql: pattern }) => pattern.test(sql));
      if (!match) return { rows: [] };
      return { rows: match.rows };
    }),
  };
  return Object.assign(client, { calls });
}

describe('migration compatibility (temporary jupiter_test)', () => {
  it('creates a marked temporary role when jupiter_test is absent (non-test target)', async () => {
    const client = mockClient([
      { sql: /pg_shdescription/, rows: [] }, // absent
    ]) as MigrationCompatibilityQueryable & { calls: string[] };
    const state = await prepareMigrationCompatibility(client, 'production');
    expect(state.created).toBe(true);
    expect(client.calls.some((sql) => sql.includes('CREATE ROLE jupiter_test'))).toBe(true);
    expect(client.calls.some((sql) => sql.includes(`'${MARKER}'`))).toBe(true);
  });

  it('reuses a leftover marked temporary role on interruption (non-test target)', async () => {
    const client = mockClient([
      { sql: /pg_shdescription/, rows: [lockedRole()] },
    ]) as MigrationCompatibilityQueryable & { calls: string[] };
    const state = await prepareMigrationCompatibility(client, 'production');
    expect(state.created).toBe(false);
    expect(client.calls.some((sql) => sql.includes('CREATE ROLE'))).toBe(false);
  });

  it('fails closed on an unexpected unmarked pre-existing jupiter_test', async () => {
    const client = mockClient([
      { sql: /pg_shdescription/, rows: [lockedRole({ comment: null, can_login: true })] },
    ]);
    await expect(prepareMigrationCompatibility(client, 'production')).rejects.toThrow(
      /unexpected pre-existing jupiter_test/,
    );
  });

  it('is a no-op for the test target (real guarded jupiter_test untouched)', async () => {
    const client = mockClient([]);
    const state = await prepareMigrationCompatibility(client, 'test');
    expect(state.created).toBe(false);
    await finalizeMigrationCompatibility(client, 'test');
  });

  it('revokes known grants and drops the temporary role with no residue', async () => {
    const client = mockClient([
      { sql: /pg_shdescription/, rows: [lockedRole()] },
      { sql: /owns_database/, rows: [{ owns_database: false, owns_schema: false, owns_relation: false, owns_function: false, has_membership: false, history_privilege: false, resolver_execute: false, role_resolver_execute: false }] },
      { sql: /still_exists/, rows: [{ still_exists: false }] },
    ]) as MigrationCompatibilityQueryable & { calls: string[] };
    await finalizeMigrationCompatibility(client, 'production');
    expect(client.calls.some((sql) => sql.includes('REVOKE SELECT, INSERT'))).toBe(true);
    expect(client.calls.some((sql) => sql.includes('REVOKE EXECUTE'))).toBe(true);
    expect(client.calls.some((sql) => sql.includes('DROP ROLE jupiter_test'))).toBe(true);
  });

  it('revokes the migration-625 role resolver EXECUTE grant during cleanup', async () => {
    const client = mockClient([
      { sql: /pg_shdescription/, rows: [lockedRole()] },
      { sql: /owns_database/, rows: [{ owns_database: false, owns_schema: false, owns_relation: false, owns_function: false, has_membership: false, history_privilege: false, resolver_execute: false, role_resolver_execute: false }] },
      { sql: /still_exists/, rows: [{ still_exists: false }] },
    ]) as MigrationCompatibilityQueryable & { calls: string[] };
    await finalizeMigrationCompatibility(client, 'production');
    expect(
      client.calls.some((sql) => sql.includes('resolve_authenticated_membership_roles') && sql.includes('REVOKE EXECUTE')),
    ).toBe(true);
    expect(
      client.calls.some((sql) => sql.includes('resolve_authenticated_membership_roles') && sql.includes('role_resolver_execute')),
    ).toBe(true);
  });

  it('fails closed and refuses to drop when residue remains', async () => {
    const client = mockClient([
      { sql: /pg_shdescription/, rows: [lockedRole()] },
      { sql: /owns_database/, rows: [{ owns_database: false, owns_schema: false, owns_relation: true, owns_function: false, has_membership: false, history_privilege: false, resolver_execute: false, role_resolver_execute: false }] },
    ]) as MigrationCompatibilityQueryable & { calls: string[] };
    await expect(finalizeMigrationCompatibility(client, 'production')).rejects.toThrow(
      /residue detected/,
    );
    expect(client.calls.some((sql) => sql.includes('DROP ROLE'))).toBe(false);
  });

  it('fails closed when the migration-625 role resolver EXECUTE grant residue remains', async () => {
    const client = mockClient([
      { sql: /pg_shdescription/, rows: [lockedRole()] },
      { sql: /owns_database/, rows: [{ owns_database: false, owns_schema: false, owns_relation: false, owns_function: false, has_membership: false, history_privilege: false, resolver_execute: false, role_resolver_execute: true }] },
    ]) as MigrationCompatibilityQueryable & { calls: string[] };
    await expect(finalizeMigrationCompatibility(client, 'production')).rejects.toThrow(
      /residue detected/,
    );
    expect(client.calls.some((sql) => sql.includes('DROP ROLE'))).toBe(false);
  });

  it('fails closed when the marked role attributes are not locked', async () => {
    const client = mockClient([
      { sql: /pg_shdescription/, rows: [lockedRole({ is_superuser: true })] },
    ]);
    await expect(prepareMigrationCompatibility(client, 'production')).rejects.toThrow(
      /attributes are not locked/,
    );
  });

  it('treats a permanent unmarked jupiter_test role as satisfied for development (no-op)', async () => {
    const client = mockClient([
      { sql: /pg_shdescription/, rows: [lockedRole({ comment: null, can_login: true })] },
    ]) as MigrationCompatibilityQueryable & { calls: string[] };
    const state = await prepareMigrationCompatibility(client, 'development');
    expect(state.created).toBe(false);
    expect(client.calls.some((sql) => sql.includes('CREATE ROLE'))).toBe(false);
  });

  it('leaves a permanent unmarked jupiter_test role in place on finalize for development', async () => {
    const client = mockClient([
      { sql: /pg_shdescription/, rows: [lockedRole({ comment: null, can_login: true })] },
    ]) as MigrationCompatibilityQueryable & { calls: string[] };
    await finalizeMigrationCompatibility(client, 'development');
    expect(client.calls.some((sql) => sql.includes('DROP ROLE'))).toBe(false);
  });

  it('resolves the privilege baseline to jupiter_app only when jupiter_test is absent', async () => {
    const client = mockClient([{ sql: /present/, rows: [{ present: false }] }]);
    const roles = await resolveRuntimeRolesForPrivilegeBaseline(client);
    expect(roles).toEqual(['jupiter_app']);
  });

  it('includes jupiter_test in the privilege baseline when it already exists', async () => {
    const client = mockClient([{ sql: /present/, rows: [{ present: true }] }]);
    const roles = await resolveRuntimeRolesForPrivilegeBaseline(client);
    expect(roles).toEqual(['jupiter_app', 'jupiter_test']);
  });
});

describe('runMigrationWithCleanup (error aggregation)', () => {
  it('resolves when both migration and cleanup succeed', async () => {
    const migrate = vi.fn(async () => undefined);
    const cleanup = vi.fn(async () => undefined);
    await expect(runMigrationWithCleanup('CTX', migrate, cleanup)).resolves.toBeUndefined();
    expect(migrate).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('propagates the migration error when migration fails but cleanup succeeds', async () => {
    const migrationError = new Error('migration failed');
    await expect(
      runMigrationWithCleanup(
        'CTX',
        async () => {
          throw migrationError;
        },
        async () => undefined,
      ),
    ).rejects.toBe(migrationError);
  });

  it('propagates the cleanup error when migration succeeds but cleanup fails', async () => {
    const cleanupError = new Error('cleanup failed');
    await expect(
      runMigrationWithCleanup(
        'CTX',
        async () => undefined,
        async () => {
          throw cleanupError;
        },
      ),
    ).rejects.toBe(cleanupError);
  });

  it('throws an AggregateError preserving both original errors when both fail', async () => {
    const migrationError = new Error('migration failed');
    const cleanupError = new Error('cleanup failed');
    let caught: unknown;
    try {
      await runMigrationWithCleanup(
        'CTX',
        async () => {
          throw migrationError;
        },
        async () => {
          throw cleanupError;
        },
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AggregateError);
    const aggregate = caught as AggregateError;
    expect(aggregate.errors).toEqual([migrationError, cleanupError]);
    expect(aggregate.message).toContain('CTX');
  });
});

describe('historical migration integrity', () => {
  it('proves the immutable jupiter_test-referencing migrations are unchanged', () => {
    const checks: [string, RegExp][] = [
      ['migrations/583_repair_component_life_limit_governance_gate_acl.ts', /const TEST_ROLE = 'jupiter_test'/],
      ['migrations/584_repair_component_life_limit_governance_activation_gate_write.ts', /const TEST = 'jupiter_test'/],
      ['migrations/595_add_legacy_component_custody_and_movement_history.ts', /TO jupiter_app, jupiter_test/],
      ['migrations/596_restrict_legacy_component_history_runtime_privileges.ts', /FROM jupiter_app, jupiter_test/],
      ['migrations/620_create_membership_resolver_function.ts', /RUNTIME_ROLES = \['jupiter_app', 'jupiter_test'\]/],
      ['migrations/625_create_membership_role_resolver_function.ts', /RUNTIME_ROLES = \['jupiter_app', 'jupiter_test'\]/],
    ];
    for (const [file, pattern] of checks) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source).toMatch(pattern);
    }
  });
});
