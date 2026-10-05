import { describe, expect, it } from 'vitest';
import {
  DATABASE_PRIVILEGE_VERIFICATION_SQL,
  assertDatabasePrivilegeVerification,
  applyAndVerifyDatabasePrivilegeBaseline,
  buildDatabasePrivilegeBaselineSql,
  type DatabasePrivilegeVerification,
} from './databasePrivilegeBaseline.js';

const passing: DatabasePrivilegeVerification = {
  public_schema_create: false,
  app_schema_usage: true,
  app_schema_create: false,
  test_schema_usage: true,
  test_schema_create: false,
  governance_owner_schema_usage: true,
  governance_owner_schema_create: false,
  app_can_set_governance_owner: false,
  test_can_set_governance_owner: false,
  app_is_governance_owner_member: false,
  test_is_governance_owner_member: false,
  owner_rolcanlogin: false,
  owner_rolsuper: false,
  owner_rolcreatedb: false,
  owner_rolcreaterole: false,
  owner_rolinherit: false,
  owner_rolreplication: false,
  owner_rolbypassrls: false,
  migration_schema_create: true,
  runtime_gate_privilege_count: 0,
  runtime_missing_table_privilege_count: 0,
  runtime_unsafe_table_privilege_count: 0,
  runtime_missing_sequence_privilege_count: 0,
  runtime_unsafe_sequence_privilege_count: 0,
  runtime_missing_view_select_count: 0,
  runtime_owned_protected_object_count: 0,
  protected_function_exposure_count: 0,
};

describe('database privilege baseline', () => {
  const sql = buildDatabasePrivilegeBaselineSql();

  it('hardens public and grants schema usage without runtime create', () => {
    expect(sql).toContain('REVOKE ALL ON SCHEMA public FROM PUBLIC');
    expect(sql).toContain('GRANT USAGE ON SCHEMA public TO jupiter_app, jupiter_test, jupiter_governance_owner');
    expect(sql).not.toMatch(/GRANT CREATE ON SCHEMA public TO jupiter_(app|test)/);
  });

  it('grants only runtime DML and normal sequence access by default', () => {
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES');
    expect(sql).toContain('REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES');
    expect(sql).toContain('GRANT USAGE, SELECT ON SEQUENCES');
    expect(sql).toContain('REVOKE UPDATE ON SEQUENCES');
  });

  it('does not broadly grant function execution', () => {
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC');
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTIONS TO jupiter_(app|test)/);
  });

  it('excludes and explicitly revokes the governance transition gate', () => {
    expect(sql).toContain("c.relname <> 'component_life_limit_governance_transition_gate'");
    expect(sql).toContain('REVOKE ALL ON TABLE public.component_life_limit_governance_transition_gate');
  });

  it('defines a fail-closed read-only final-state contract', () => {
    expect(DATABASE_PRIVILEGE_VERIFICATION_SQL).toContain("pg_has_role('jupiter_app', 'jupiter_governance_owner', 'SET')");
    expect(DATABASE_PRIVILEGE_VERIFICATION_SQL).toContain("pg_has_role('jupiter_test', 'jupiter_governance_owner', 'SET')");
    expect(DATABASE_PRIVILEGE_VERIFICATION_SQL).toContain("pg_has_role('jupiter_app', 'jupiter_governance_owner', 'MEMBER')");
    expect(DATABASE_PRIVILEGE_VERIFICATION_SQL).toContain('owner_rolbypassrls');
    expect(DATABASE_PRIVILEGE_VERIFICATION_SQL).toContain('runtime_missing_table_privilege_count');
    expect(DATABASE_PRIVILEGE_VERIFICATION_SQL).toContain('fn_cllg_protect_operational_limit()');
    expect(() => assertDatabasePrivilegeVerification(passing)).not.toThrow();
  });

  it.each([
    ['public_schema_create', true],
    ['app_schema_create', true],
    ['test_schema_create', true],
    ['governance_owner_schema_create', true],
    ['app_can_set_governance_owner', true],
    ['test_can_set_governance_owner', true],
    ['app_is_governance_owner_member', true],
    ['test_is_governance_owner_member', true],
    ['owner_rolcanlogin', true],
    ['owner_rolsuper', true],
    ['owner_rolcreatedb', true],
    ['owner_rolcreaterole', true],
    ['owner_rolinherit', true],
    ['owner_rolreplication', true],
    ['owner_rolbypassrls', true],
    ['runtime_gate_privilege_count', 1],
    ['runtime_missing_table_privilege_count', 1],
    ['runtime_unsafe_table_privilege_count', 1],
    ['runtime_missing_sequence_privilege_count', 1],
    ['runtime_unsafe_sequence_privilege_count', 1],
    ['runtime_missing_view_select_count', 1],
    ['runtime_owned_protected_object_count', 1],
    ['protected_function_exposure_count', 1],
    ['migration_schema_create', false],
  ] as const)('rejects unsafe final state %s', (field, value) => {
    expect(() =>
      assertDatabasePrivilegeVerification({ ...passing, [field]: value })
    ).toThrow('verification failed');
  });
});

describe('transactional database privilege hardening', () => {
  function mockAdmin(options: {
    verification?: DatabasePrivilegeVerification;
    failOn?: 'baseline' | 'verification' | 'rollback';
  } = {}) {
    const calls: string[] = [];
    return {
      calls,
      admin: {
        query: async <Row extends Record<string, unknown>>(sql: string) => {
          calls.push(sql);
          if (sql === 'ROLLBACK' && options.failOn === 'rollback') {
            throw new Error('rollback failed');
          }
          if (sql === DATABASE_PRIVILEGE_VERIFICATION_SQL) {
            if (options.failOn === 'verification') {
              throw new Error('verification query failed');
            }
            return {
              rows: [(options.verification ?? passing) as unknown as Row],
            };
          }
          if (sql === buildDatabasePrivilegeBaselineSql() && options.failOn === 'baseline') {
            throw new Error('baseline query failed');
          }
          return { rows: [] as Row[] };
        },
      },
    };
  }

  it('applies, verifies, and commits in one transaction', async () => {
    const { admin, calls } = mockAdmin();
    await applyAndVerifyDatabasePrivilegeBaseline(admin);
    expect(calls).toEqual([
      'BEGIN',
      buildDatabasePrivilegeBaselineSql(),
      DATABASE_PRIVILEGE_VERIFICATION_SQL,
      'COMMIT',
    ]);
  });

  it('rolls back and prevents commit when the assertion fails', async () => {
    const { admin, calls } = mockAdmin({
      verification: { ...passing, owner_rolcanlogin: true },
    });
    await expect(applyAndVerifyDatabasePrivilegeBaseline(admin)).rejects.toThrow(
      'verification failed'
    );
    expect(calls.at(-1)).toBe('ROLLBACK');
    expect(calls).not.toContain('COMMIT');
  });

  it.each(['baseline', 'verification'] as const)(
    'rolls back after a %s query failure',
    async failOn => {
      const { admin, calls } = mockAdmin({ failOn });
      await expect(applyAndVerifyDatabasePrivilegeBaseline(admin)).rejects.toThrow(
        `${failOn} query failed`
      );
      expect(calls.at(-1)).toBe('ROLLBACK');
      expect(calls).not.toContain('COMMIT');
    }
  );

  it('does not hide the original error when rollback also fails', async () => {
    const { admin, calls } = mockAdmin({
      verification: { ...passing, owner_rolsuper: true },
      failOn: 'rollback',
    });
    await expect(applyAndVerifyDatabasePrivilegeBaseline(admin)).rejects.toThrow(
      'verification failed'
    );
    expect(calls.at(-1)).toBe('ROLLBACK');
  });
});
