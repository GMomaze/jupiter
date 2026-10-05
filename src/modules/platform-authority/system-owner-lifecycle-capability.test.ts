import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { TENANT_LIFECYCLE_OPERATION_POLICY } from '../tenancy/tenant-lifecycle-policy.js';

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('System Owner lifecycle capability contract', () => {
  it('bootstraps the six explicit capabilities without wildcard or implicit expansion', () => {
    const s = read('src/modules/platform-authority/platform-authority.repository.ts');
    const constant = s.slice(s.indexOf('const SYSTEM_OWNER_CAPABILITIES'), s.indexOf('const repositoryIssuedAuthorities'));
    // Two foundation capabilities are imported identifiers; the four lifecycle
    // capabilities are explicit string literals (never derived from PLATFORM_AUTHORITY_MANAGE).
    expect(constant).toContain('PLATFORM_AUTHORITY_MANAGE');
    expect(constant).toContain('PLATFORM_AUDIT_VIEW');
    for (const code of ['TENANT_PROVISION', 'TENANT_ACTIVATE', 'TENANT_SUSPEND', 'TENANT_REINSTATE'])
      expect(constant).toContain(`"${code}"`);
    // No wildcard/ALL authority, and no lifecycle capability collapsed into PLATFORM_AUTHORITY_MANAGE.
    expect(constant).not.toMatch(/['"]\*['"]|['"]ALL['"]/);
    expect(constant).not.toContain('TENANT_ADMIN_RECOVER');
    expect(constant).not.toContain('TENANT_EXPORT');
  });

  it('keeps lifecycle capabilities granular and independent of PLATFORM_AUTHORITY_MANAGE', () => {
    // PLATFORM_AUTHORITY_MANAGE is NOT itself a lifecycle capability: the four
    // TENANT_* capabilities must remain individually checked by the policy.
    expect(Object.keys(TENANT_LIFECYCLE_OPERATION_POLICY)).not.toContain('PLATFORM_AUTHORITY_MANAGE');
    for (const capability of ['TENANT_PROVISION', 'TENANT_ACTIVATE', 'TENANT_SUSPEND', 'TENANT_REINSTATE']) {
      const policy = TENANT_LIFECYCLE_OPERATION_POLICY[capability as keyof typeof TENANT_LIFECYCLE_OPERATION_POLICY];
      expect(policy[0]).toBe(capability);
      expect(policy[1]).toEqual(['HUMAN']);
    }
  });

  it('keeps self-grant forbidden and provides no tenant-role fallback', () => {
    const s = read('src/modules/platform-authority/platform-authority.repository.ts');
    expect(s).toContain('PLATFORM_SELF_GRANT_FORBIDDEN');
    const policy = read('src/modules/tenancy/tenant-lifecycle-policy.ts');
    expect(policy).not.toMatch(/tenant_membership_roles|user_roles|rf_role|tenant.*role/i);
  });
});
