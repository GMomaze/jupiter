import { describe, expect, it } from 'vitest';
import {
  assertDatabasePrivilegeVerification,
  applyAndVerifyDatabasePrivilegeBaseline,
  buildDatabasePrivilegeBaselineSql,
  buildDatabasePrivilegeVerificationSql,
  RESTRICTED_RUNTIME_TABLE_PRIVILEGES,
  type DatabasePrivilegeVerification,
} from './databasePrivilegeBaseline.js';

const roleChecks = {
  jupiter_app_schema_usage: true,
  jupiter_app_schema_create: false,
  jupiter_app_can_set_governance_owner: false,
  jupiter_app_is_governance_owner_member: false,
  jupiter_test_schema_usage: true,
  jupiter_test_schema_create: false,
  jupiter_test_can_set_governance_owner: false,
  jupiter_test_is_governance_owner_member: false,
};

const passing: DatabasePrivilegeVerification = {
  public_schema_create: false,
  governance_owner_schema_usage: true,
  governance_owner_schema_create: false,
  ...roleChecks,
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
  runtime_restricted_table_privilege_violation_count: 0,
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
    expect(sql).toContain("c.relname <> ALL(ARRAY['component_life_limit_governance_transition_gate'");
    expect(sql).toContain('REVOKE ALL ON TABLE public.component_life_limit_governance_transition_gate');
  });

  it('excludes restricted runtime tables from the blanket full-CRUD grant', () => {
    for (const [table] of RESTRICTED_RUNTIME_TABLE_PRIVILEGES) {
      expect(sql).toContain(`'${table}'`);
    }
  });

  it('defines a fail-closed read-only final-state contract', () => {
    const verificationSql = buildDatabasePrivilegeVerificationSql();
    expect(verificationSql).toContain("pg_has_role('jupiter_app', 'jupiter_governance_owner', 'SET')");
    expect(verificationSql).toContain("pg_has_role('jupiter_test', 'jupiter_governance_owner', 'SET')");
    expect(verificationSql).toContain("pg_has_role('jupiter_app', 'jupiter_governance_owner', 'MEMBER')");
    expect(verificationSql).toContain('owner_rolbypassrls');
    expect(verificationSql).toContain('runtime_missing_table_privilege_count');
    expect(verificationSql).toContain('runtime_restricted_table_privilege_violation_count');
    expect(verificationSql).toContain('fn_cllg_protect_operational_limit()');
    expect(() => assertDatabasePrivilegeVerification(passing)).not.toThrow();
  });

  it.each([
    ['public_schema_create', true],
    ['governance_owner_schema_create', true],
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
    ['runtime_restricted_table_privilege_violation_count', 1],
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

  it.each([
    ['jupiter_app_schema_usage', false],
    ['jupiter_app_schema_create', true],
    ['jupiter_app_can_set_governance_owner', true],
    ['jupiter_app_is_governance_owner_member', true],
  ] as const)('rejects unsafe per-role state %s', (field, value) => {
    expect(() =>
      assertDatabasePrivilegeVerification({ ...passing, [field]: value })
    ).toThrow('verification failed');
  });
});

describe('production runtime role parameterization', () => {
  it('grants schema usage and DML only to jupiter_app when configured', () => {
    const sql = buildDatabasePrivilegeBaselineSql(['jupiter_app']);
    expect(sql).toContain('GRANT USAGE ON SCHEMA public TO jupiter_app, jupiter_governance_owner');
    expect(sql).not.toContain('jupiter_test');
  });

  it('does not reference jupiter_test in production verification', () => {
    const sql = buildDatabasePrivilegeVerificationSql(['jupiter_app']);
    expect(sql).not.toContain('jupiter_test');
    expect(sql).toContain("pg_has_role('jupiter_app', 'jupiter_governance_owner', 'SET')");
  });

  it('passes production verification without a jupiter_test role', () => {
    const production = {
      ...passing,
      jupiter_app_schema_usage: true,
      jupiter_app_schema_create: false,
      jupiter_app_can_set_governance_owner: false,
      jupiter_app_is_governance_owner_member: false,
    } as DatabasePrivilegeVerification;
    delete (production as Record<string, unknown>).jupiter_test_schema_usage;
    delete (production as Record<string, unknown>).jupiter_test_schema_create;
    delete (production as Record<string, unknown>).jupiter_test_can_set_governance_owner;
    delete (production as Record<string, unknown>).jupiter_test_is_governance_owner_member;
    expect(() => assertDatabasePrivilegeVerification(production, ['jupiter_app'])).not.toThrow();
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
          if (sql === buildDatabasePrivilegeVerificationSql()) {
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
      buildDatabasePrivilegeVerificationSql(),
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
