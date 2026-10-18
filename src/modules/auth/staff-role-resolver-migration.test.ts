import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/627_resolve_tenant_membership_roles_function.ts'),
  'utf8',
);

describe('migration 627 — tenant-scoped staff role resolver', () => {
  it('derives the tenant from the transaction-local session setting, not a caller-supplied id', () => {
    // The resolver must not accept a caller-supplied tenant UUID (which would let
    // jupiter_app request another tenant's assignments through the SECURITY DEFINER
    // function). It reads the transaction-local jupiter.tenant_id instead.
    expect(migration).toContain("current_setting('jupiter.tenant_id', true)");
    expect(migration).not.toMatch(/p_tenant_id/);
    expect(migration).toContain('${FUNCTION_NAME}()');
    expect(migration).not.toMatch(/\$\{FUNCTION_NAME\}\(uuid\)/);
  });

  it('is SECURITY DEFINER, owned by postgres, with a fixed safe search_path', () => {
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain("ALTER FUNCTION");
    expect(migration).toContain('OWNER TO');
    expect(migration).toContain("SET search_path = pg_catalog, public");
  });

  it('revokes PUBLIC and grants EXECUTE only to the runtime roles', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION');
    expect(migration).toContain('FROM PUBLIC');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION');
    expect(migration).toContain('jupiter_app');
    expect(migration).toContain('jupiter_test');
  });

  it('returns only the minimum required fields and no dynamic SQL', () => {
    expect(migration).toContain('membership_id');
    expect(migration).toContain('assignment_id');
    expect(migration).toContain('role_id');
    expect(migration).toContain('role_code');
    expect(migration).toContain("tm.status = 'ACTIVE'");
    expect(migration).not.toMatch(/EXECUTE\s*\(|format\(|sp_executesql/i);
  });

  it('makes jupiter_test optional without creating roles or weakening privileges', () => {
    // postgres (owner) and jupiter_app are mandatory; jupiter_test is optional.
    expect(migration).toContain('!roles?.owner || !roles.runtime_app');
    expect(migration).not.toMatch(/!roles\?\.runtime_test/);
    // jupiter_test EXECUTE is granted conditionally, only when the role exists.
    expect(migration).toContain('if (roles.runtime_test)');
    // No test-only role is created by the migration.
    expect(migration).not.toMatch(/CREATE\s+ROLE/i);
    // PUBLIC EXECUTE remains revoked and only the runtime roles are granted.
    expect(migration).toContain('REVOKE ALL ON FUNCTION');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION');
  });
});
