import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { OrganisationProvisioningRepository } from './organisation-provisioning.repository.js';

describe('superseded first-organisation provisioning boundary', () => {
  it('fails closed before transaction or database work', async () => {
    const database = { transaction: vi.fn() };
    const repository = new OrganisationProvisioningRepository({ database, ids: vi.fn(), clock: vi.fn() });
    await expect(repository.provision({
      actorUserId: 'actor', initialUserId: 'user', code: 'OLD', displayName: 'Old',
    })).rejects.toThrow('LEVEL3_PLATFORM_AUTHORITY_REQUIRED');
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('contains no tenant writer or role-derived authority fallback', () => {
    const source = fs.readFileSync('src/modules/tenancy/organisation-provisioning.repository.ts', 'utf8');
    expect(source).not.toMatch(/INSERT INTO\s+(?:public\.)?(?:tenants|tenant_memberships|audit_log)/i);
    expect(source).not.toMatch(/user_roles|requireRole|activeTenantContext/);
    expect(source).toContain('LEVEL3_PLATFORM_AUTHORITY_REQUIRED');
  });
});
