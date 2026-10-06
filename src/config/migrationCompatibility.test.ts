import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  prepareMigrationCompatibility,
  finalizeMigrationCompatibility,
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
      { sql: /owns_database/, rows: [{ owns_database: false, owns_schema: false, owns_relation: false, owns_function: false, has_membership: false, history_privilege: false, resolver_execute: false }] },
      { sql: /still_exists/, rows: [{ still_exists: false }] },
    ]) as MigrationCompatibilityQueryable & { calls: string[] };
    await finalizeMigrationCompatibility(client, 'production');
    expect(client.calls.some((sql) => sql.includes('REVOKE SELECT, INSERT'))).toBe(true);
    expect(client.calls.some((sql) => sql.includes('REVOKE EXECUTE'))).toBe(true);
    expect(client.calls.some((sql) => sql.includes('DROP ROLE jupiter_test'))).toBe(true);
  });

  it('fails closed and refuses to drop when residue remains', async () => {
    const client = mockClient([
      { sql: /pg_shdescription/, rows: [lockedRole()] },
      { sql: /owns_database/, rows: [{ owns_database: false, owns_schema: false, owns_relation: true, owns_function: false, has_membership: false, history_privilege: false, resolver_execute: false }] },
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
});

describe('historical migration integrity', () => {
  it('proves the immutable jupiter_test-referencing migrations are unchanged', () => {
    const checks: [string, RegExp][] = [
      ['migrations/583_repair_component_life_limit_governance_gate_acl.ts', /const TEST_ROLE = 'jupiter_test'/],
      ['migrations/584_repair_component_life_limit_governance_activation_gate_write.ts', /const TEST = 'jupiter_test'/],
      ['migrations/595_add_legacy_component_custody_and_movement_history.ts', /TO jupiter_app, jupiter_test/],
      ['migrations/596_restrict_legacy_component_history_runtime_privileges.ts', /FROM jupiter_app, jupiter_test/],
      ['migrations/620_create_membership_resolver_function.ts', /RUNTIME_ROLES = \['jupiter_app', 'jupiter_test'\]/],
    ];
    for (const [file, pattern] of checks) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source).toMatch(pattern);
    }
  });
});
