import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/628_grant_staff_role_revocation_select.ts'),
  'utf8',
);

describe('migration 628 — narrow staff-role-revocation SELECT grant', () => {
  it('grants column-level SELECT on exactly id and revoked_at', () => {
    expect(migration).toContain("['id', 'revoked_at']");
    expect(migration).toContain('GRANT SELECT (');
    expect(migration).toContain("const TABLE = 'tenant_membership_roles'");
    expect(migration).toContain("const ROLE = 'jupiter_app'");
  });

  it('does not grant table-level SELECT or SELECT on protected columns', () => {
    expect(migration).not.toMatch(/GRANT SELECT\s+ON TABLE/i);
    expect(migration).toContain('has_table_privilege');
    expect(migration).toContain('table_select');
    expect(migration).toContain('unexpected_columns');
    expect(migration).toContain('column_name NOT IN');
  });

  it('reverts by revoking only the approved columns on down', () => {
    expect(migration).toContain('REVOKE SELECT (');
  });

  it('verifies the grant shape and fails closed', () => {
    expect(migration).toContain('MIGRATION_628_VERIFICATION_FAILED');
    expect(migration).toContain('MIGRATION_628_DOWN_VERIFICATION_FAILED');
    expect(migration).toContain('has_column_privilege');
  });
});
