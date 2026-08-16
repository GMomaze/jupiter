import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import gateAclRepair from '../../migrations/583_repair_component_life_limit_governance_gate_acl.js';

const source = readFileSync(resolve(process.cwd(),
  'migrations/583_repair_component_life_limit_governance_gate_acl.ts'), 'utf8');

const approvedPreflight = {
  database_approved: true,
  migration_authorized: true,
  owner_exists: true,
  owner_safe: true,
  runtime_can_set_owner: false,
  test_can_set_owner: false,
  gate_exists: true,
  gate_owner: 'jupiter_governance_owner',
  migration_582_applied: true,
  function_count: 7,
  owned_function_count: 7,
  safe_function_count: 7,
  owner_schema_usage: true,
  owner_schema_create: false,
};

const approvedVerification = {
  owner_select: true,
  owner_insert: true,
  owner_delete: true,
  owner_update: false,
  owner_truncate: false,
  owner_references: false,
  owner_trigger: false,
  public_access: false,
  runtime_access: false,
  test_access: false,
  owner_schema_usage: true,
  owner_schema_create: false,
  owned_function_count: 7,
  safe_function_count: 7,
  public_execute: false,
  runtime_entries: true,
  runtime_triggers: false,
};

function queryInterface(
  preflight = approvedPreflight,
  verification = approvedVerification
) {
  const statements: string[] = [];
  let rolledBack = false;
  const sequelize = {
    async transaction(callback: (transaction: object) => Promise<void>) {
      try {
        await callback({});
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    },
    async query(sql: string) {
      statements.push(sql);
      if (sql.includes('WITH governed AS (') && sql.includes('database_approved')) return [preflight];
      if (sql.includes('WITH gate AS (')) return [verification];
      return [];
    },
  };
  return {
    value: { sequelize } as never,
    statements,
    rolledBack: () => rolledBack,
  };
}

describe('migration 583 governance transition-gate ACL repair', () => {
  it('contains only the exact narrow owner grant and explicit denials', () => {
    expect(source).toContain('GRANT SELECT, INSERT, DELETE');
    expect(source).toContain('TO ${GOVERNANCE_OWNER}');
    expect(source).not.toMatch(/GRANT\s+ALL/i);
    expect(source).not.toMatch(/GRANT\s+[^;]*UPDATE[^;]*TO\s+\$\{GOVERNANCE_OWNER\}/is);
    expect(source).toContain('REVOKE UPDATE, TRUNCATE, REFERENCES, TRIGGER');
    expect(source).toContain('FROM PUBLIC');
    expect(source).toContain('FROM ${RUNTIME_ROLE}');
    expect(source).toContain('FROM ${TEST_ROLE}');
    expect(source).not.toMatch(/(?:CREATE|ALTER|DROP)\s+ROLE/i);
    expect(source).not.toContain('GRANT CREATE ON SCHEMA');
  });

  it.each([
    [{ owner_exists: false }, 'COMPONENT_LIFE_LIMIT_GOVERNANCE_OWNER_MISSING'],
    [{ owner_safe: false }, 'COMPONENT_LIFE_LIMIT_GOVERNANCE_OWNER_UNSAFE'],
    [{ runtime_can_set_owner: true }, 'COMPONENT_LIFE_LIMIT_GOVERNANCE_OWNER_UNSAFE'],
    [{ migration_authorized: false }, 'COMPONENT_LIFE_LIMIT_GATE_ACL_MIGRATION_AUTHORITY_REQUIRED'],
    [{ gate_owner: 'jupiter_app' }, 'COMPONENT_LIFE_LIMIT_GOVERNANCE_GATE_OWNER_INVALID'],
    [{ migration_582_applied: false }, 'COMPONENT_LIFE_LIMIT_GOVERNANCE_MIGRATION_582_REQUIRED'],
  ])('fails closed before ACL mutation for %j', async (override, message) => {
    const mock = queryInterface({ ...approvedPreflight, ...override });
    await expect(gateAclRepair.up(mock.value)).rejects.toThrow(message);
    expect(mock.statements.some(sql => sql.includes('GRANT SELECT, INSERT, DELETE'))).toBe(false);
    expect(mock.rolledBack()).toBe(true);
  });

  it('applies the exact ACL statement when every preflight passes', async () => {
    const mock = queryInterface();
    await gateAclRepair.up(mock.value);
    const acl = mock.statements.find(sql => sql.includes('GRANT SELECT, INSERT, DELETE'));
    expect(acl).toBeDefined();
    expect(acl).not.toContain('GRANT ALL');
    expect(mock.rolledBack()).toBe(false);
  });

  it('rolls the transaction back when controlled verification fails', async () => {
    const mock = queryInterface(approvedPreflight, {
      ...approvedVerification,
      owner_update: true,
    });
    await expect(gateAclRepair.up(mock.value)).rejects.toThrow(
      'COMPONENT_LIFE_LIMIT_GOVERNANCE_GATE_ACL_VERIFICATION_FAILED'
    );
    expect(mock.statements.some(sql => sql.includes('GRANT SELECT, INSERT, DELETE'))).toBe(true);
    expect(mock.rolledBack()).toBe(true);
  });

  it('refuses destructive rollback', async () => {
    const mock = queryInterface();
    await expect(gateAclRepair.down(mock.value)).rejects.toThrow(
      'COMPONENT_LIFE_LIMIT_GOVERNANCE_GATE_ACL_ROLLBACK_REFUSED'
    );
    expect(mock.rolledBack()).toBe(true);
  });
});
