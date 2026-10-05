import { describe, expect, it, vi } from 'vitest';

vi.mock('../../models/index.js', () => ({ AuditLog: {}, User: {} }));
vi.mock('./audit-tenant.repository.live.js', () => ({ auditTenantRepository: {} }));

import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { AuditService } from './audit.service.js';
import { AuditTenantRepository } from './audit-tenant.repository.js';

const authority = createTenantQueryAuthority({
  state: 'VALID_ACTIVE_TENANT',
  tenant: { id: 'tenant-a', publicId: 'public-a', code: 'A', displayName: 'A', status: 'ACTIVE' },
  membership: { id: 'membership-a', tenantId: 'tenant-a', userId: 'user-a', status: 'ACTIVE' },
  validatedAt: 1,
});

describe('MT-4C7A tenant-authorized audit service', () => {
  it('passes authentic tenant authority and a normalized allowlisted filter', async () => {
    const listAuthorized = vi.fn().mockResolvedValue([{ id: 'audit-a' }]);
    const repository = new AuditTenantRepository({ listAuthorized });

    expect(await AuditService.getLogs(
      authority,
      { table_name: '  AIRCRAFT  ' },
      repository,
    )).toEqual([{ id: 'audit-a' }]);
    expect(listAuthorized).toHaveBeenCalledWith('tenant-a', { tableName: 'aircraft' });
  });

  it('default-denies unknown, shared, and platform source filters without querying', async () => {
    for (const table_name of ['migration_batches', 'component_models', 'unknown_source']) {
      const listAuthorized = vi.fn();
      const repository = new AuditTenantRepository({ listAuthorized });
      expect(await AuditService.getLogs(authority, { table_name }, repository)).toEqual([]);
      expect(listAuthorized).not.toHaveBeenCalled();
    }
  });

  it('rejects structural authority substitutes in service and repository', async () => {
    const listAuthorized = vi.fn();
    const repository = new AuditTenantRepository({ listAuthorized });
    await expect(AuditService.getLogs({ tenantId: 'tenant-a' } as never, {}, repository))
      .rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    await expect(repository.listAuthorized({ tenantId: 'tenant-a' } as never))
      .rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    expect(listAuthorized).not.toHaveBeenCalled();
  });
});
