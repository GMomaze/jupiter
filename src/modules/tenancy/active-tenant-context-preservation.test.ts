import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.resolve(process.cwd(), relative), 'utf8');
const service = read('src/modules/tenancy/active-tenant-context.service.ts');
const types = read('src/modules/tenancy/active-tenant-context.types.ts');
const runtimeSources = [
  'src/app.ts',
  'src/modules/auth/auth.config.ts',
  'src/modules/auth/auth.routes.ts',
  'src/middleware/auth.middleware.ts',
  'src/middleware/rbac.middleware.ts',
  'src/modules/auth/staff.routes.ts',
  'src/modules/customer-auth/customer-auth.routes.ts',
  'src/modules/customer-portal/customer-portal.routes.ts',
].map(read).join('\n');

describe('MT-3 3A1 dormant preservation contract', () => {
  it('keeps the service isolated while allowing the approved resolver-only composition', () => {
    expect(service).not.toMatch(/database\.js|sequelize|from ['"]pg['"]|passport|express|SessionData|Request|Response|Router/);
    expect(runtimeSources).toMatch(/ActiveTenantContextService|active-tenant-context/);
    expect(runtimeSources).toMatch(/resolveTenantContext/);
    expect(runtimeSources).not.toMatch(/app\.use\([^\n]*requireValidActiveTenantContext/);
  });

  it('contains no role, permission, ADMIN, user_roles, or membership-role authority', () => {
    expect(service).not.toMatch(/\bADMIN\b|\brole(s)?\b|permission|user_roles|tenant_membership_roles/i);
    expect(types).not.toMatch(/\bADMIN\b|permission|user_roles|tenant_membership_roles/i);
    const sessionType = types.match(/interface ActiveTenantSessionContext \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(sessionType).not.toMatch(/role|permission|status|displayName|code|authority/i);
  });

  it('defines exactly the approved context states and no additional state', () => {
    const stateBlock = types.match(/TENANT_CONTEXT_STATES = \[([\s\S]*?)\] as const/)?.[1] ?? '';
    const states = [...stateBlock.matchAll(/'([A-Z_]+)'/g)].map(match => match[1]);
    expect(states).toEqual([
      'NO_TENANT_CONTEXT', 'VALID_ACTIVE_TENANT', 'STALE_MEMBERSHIP',
      'SUSPENDED_MEMBERSHIP', 'DISABLED_MEMBERSHIP', 'PROVISIONING_TENANT',
      'SUSPENDED_TENANT', 'ARCHIVED_TENANT',
    ]);
  });

  it('does not add runtime, operational, RLS, migration, or customer-portal behavior', () => {
    expect(service).not.toMatch(/req\.|res\.|redirect|middleware|customer|aircraft|component|workpack|compliance|library|governance/i);
    expect(`${service}\n${types}`).not.toMatch(/tenant_id|CREATE POLICY|ROW LEVEL SECURITY|migration/i);
  });
});
