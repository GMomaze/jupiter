import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationName = '594_grant_tenant_login_provisioning_access.ts';
const source = fs.readFileSync(path.resolve('migrations', migrationName), 'utf8');

describe('migration 594 tenant runtime least privilege', () => {
  it('is the single migration 594 and follows 593', () => {
    const migrations = fs.readdirSync(path.resolve('migrations')).sort();
    expect(migrations.filter(name => name.startsWith('594_'))).toEqual([migrationName]);
    expect(migrations.slice(-2)).toEqual([
      '593_enforce_standalone_snag_nullability.ts',
      migrationName,
    ]);
  });

  it('grants only runtime reads on tenant roots', () => {
    expect(source).toContain('GRANT SELECT ON TABLE public.tenants TO jupiter_app');
    expect(source).toContain('GRANT SELECT ON TABLE public.tenant_memberships TO jupiter_app');
    expect(source).not.toMatch(/GRANT[^;]*(INSERT|UPDATE|DELETE)[^;]*public\.(tenants|tenant_memberships)/i);
  });

  it('grants only the writes used by tenant-switch persistence', () => {
    expect(source).toContain(
      'GRANT INSERT, UPDATE ON TABLE public.tenant_context_switch_attempts TO jupiter_app',
    );
    expect(source).not.toMatch(/GRANT\s+(ALL|DELETE|TRUNCATE|REFERENCES|TRIGGER)/i);
  });

  it('checks prerequisites and reverses only its grants transactionally', () => {
    expect(source).toContain("'tenant_context_switch_attempts'");
    expect(source).toContain("to_regclass('public.${table}')");
    expect(source).toContain('sequelize.transaction');
    expect(source).toContain('REVOKE INSERT, UPDATE ON TABLE public.tenant_context_switch_attempts');
    expect(source).toContain('REVOKE SELECT ON TABLE public.tenant_memberships');
    expect(source).toContain('REVOKE SELECT ON TABLE public.tenants');
  });
});
