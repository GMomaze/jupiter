import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { TENANT_LIFECYCLE_OPERATION_POLICY } from '../tenancy/tenant-lifecycle-policy.js';
import { SYSTEM_OWNER_CAPABILITY_CODES } from '../../config/systemOwnerCanonical.js';

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('System Owner full capability contract', () => {
  it('bootstraps the full twenty-three capability set without wildcard or implicit expansion', () => {
    const s = read('src/modules/platform-authority/platform-authority.repository.ts');
    // The owner set is the same frozen twenty-three capability list that bootstrap
    // verifies, never a wildcard/ALL authority and never an implicit superuser.
    expect(s).toContain(
      'const SYSTEM_OWNER_CAPABILITIES = BOOTSTRAP_CAPABILITIES;',
    );
    const bootstrap = s.slice(
      s.indexOf('const BOOTSTRAP_CAPABILITIES'),
      s.indexOf('const SYSTEM_OWNER_CAPABILITIES'),
    );
    expect(SYSTEM_OWNER_CAPABILITY_CODES).toHaveLength(23);
    for (const code of SYSTEM_OWNER_CAPABILITY_CODES)
      expect(bootstrap).toContain(`"${code}"`);
    expect(SYSTEM_OWNER_CAPABILITY_CODES).not.toContain('*');
    expect(SYSTEM_OWNER_CAPABILITY_CODES).not.toContain('ALL');
  });

  it('keeps lifecycle capabilities granular and independent of PLATFORM_AUTHORITY_MANAGE', () => {
    expect(Object.keys(TENANT_LIFECYCLE_OPERATION_POLICY)).not.toContain(
      'PLATFORM_AUTHORITY_MANAGE',
    );
    for (const capability of [
      'TENANT_PROVISION',
      'TENANT_ACTIVATE',
      'TENANT_SUSPEND',
      'TENANT_REINSTATE',
    ]) {
      const policy =
        TENANT_LIFECYCLE_OPERATION_POLICY[
          capability as keyof typeof TENANT_LIFECYCLE_OPERATION_POLICY
        ];
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
