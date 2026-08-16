import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import repair from '../../migrations/584_repair_component_life_limit_governance_activation_gate_write.js';

const source = readFileSync(resolve(process.cwd(), 'migrations/584_repair_component_life_limit_governance_activation_gate_write.ts'), 'utf8');
const approved = {
  database_approved: true, migration_authorized: true, owner_exists: true, owner_safe: true,
  runtime_can_set_owner: false, migration_583_applied: true, migration_583_count: 1,
  gate_exists: true, gate_owner: 'jupiter_governance_owner', owner_select: true, owner_insert: true,
  owner_delete: true, owner_update: false, owner_truncate: false, owner_references: false,
  owner_trigger: false, public_gate: false, app_gate: false, test_gate: false,
  activation_count: 1, activation_owner: 'jupiter_governance_owner', activation_safe: true,
  owner_usage: true, owner_create: false,
};
const verified = {
  activation_count: 1, overload_count: 1, activation_owner: 'jupiter_governance_owner', activation_safe: true,
  public_execute: false, app_execute: true, test_execute: false, runtime_trigger_execute: false,
  public_trigger_execute: false, owner_select: true, owner_insert: true, owner_delete: true,
  owner_update: false, owner_broad: false, owner_usage: true, owner_create: false,
};

function mock(preflight = approved, verification = verified) {
  const statements: string[] = []; let rolledBack = false;
  const sequelize = {
    async transaction(callback: (transaction: object) => Promise<void>) {
      try { await callback({}); } catch (error) { rolledBack = true; throw error; }
    },
    async query(sql: string) {
      statements.push(sql);
      if (sql.includes('migration_583_applied')) return [preflight];
      if (sql.includes('overload_count')) return [verification];
      return [];
    },
  };
  return { value: { sequelize } as never, statements, rolledBack: () => rolledBack };
}

describe('migration 584 activation gate write repair', () => {
  it('uses DELETE then INSERT and never broadens gate privileges', () => {
    const body = source.slice(source.indexOf('CREATE OR REPLACE FUNCTION'), source.indexOf('ALTER FUNCTION ${ACTIVATION} OWNER'));
    expect(body.indexOf('DELETE FROM public.component_life_limit_governance_transition_gate')).toBeLessThan(body.indexOf('INSERT INTO public.component_life_limit_governance_transition_gate'));
    expect(source).not.toMatch(/ON\s+CONFLICT\s+DO\s+UPDATE/i);
    expect(source).not.toMatch(/GRANT\s+ALL/i);
    expect(source).not.toMatch(/GRANT\s+UPDATE/i);
    expect(source).not.toMatch(/(?:CREATE|ALTER|DROP)\s+ROLE/i);
  });

  it('preserves owner, SECURITY DEFINER, search path and narrow execution ACL', () => {
    for (const fragment of ['ALTER FUNCTION ${ACTIVATION} OWNER TO ${OWNER}',
      'ALTER FUNCTION ${ACTIVATION} SECURITY DEFINER',
      'ALTER FUNCTION ${ACTIVATION} SET search_path = pg_catalog, public',
      'REVOKE ALL ON FUNCTION ${ACTIVATION} FROM PUBLIC',
      'GRANT EXECUTE ON FUNCTION ${ACTIVATION} TO ${APP}']) expect(source).toContain(fragment);
  });

  it.each([
    [{ migration_authorized: false }, 'MIGRATION_AUTHORITY_REQUIRED'],
    [{ owner_exists: false }, 'GOVERNANCE_OWNER_MISSING'],
    [{ owner_safe: false }, 'GOVERNANCE_OWNER_UNSAFE'],
    [{ migration_583_count: 0 }, 'MIGRATION_583_REQUIRED'],
    [{ migration_583_count: 2 }, 'MIGRATION_583_REQUIRED'],
    [{ gate_owner: 'jupiter_test' }, 'GATE_BOUNDARY_INVALID'],
    [{ owner_update: true }, 'GATE_ACL_INVALID'],
    [{ activation_owner: 'jupiter_test' }, 'ACTIVATION_FUNCTION_BOUNDARY_INVALID'],
  ])('fails before replacement for %j', async (override, message) => {
    const subject = mock({ ...approved, ...override });
    await expect(repair.up(subject.value)).rejects.toThrow(message);
    expect(subject.statements.some(sql => sql.includes('CREATE OR REPLACE FUNCTION'))).toBe(false);
    expect(subject.rolledBack()).toBe(true);
  });

  it('replaces and verifies transactionally', async () => {
    const subject = mock(); await repair.up(subject.value);
    expect(subject.statements.some(sql => sql.includes('CREATE OR REPLACE FUNCTION'))).toBe(true);
  });

  it('rolls back controlled verification failure', async () => {
    const subject = mock(approved, { ...verified, owner_update: true });
    await expect(repair.up(subject.value)).rejects.toThrow('ACTIVATION_GATE_WRITE_VERIFICATION_FAILED');
    expect(subject.rolledBack()).toBe(true);
  });

  it('refuses destructive rollback', async () => {
    const subject = mock();
    await expect(repair.down(subject.value)).rejects.toThrow('ACTIVATION_GATE_WRITE_ROLLBACK_REFUSED');
  });
});
