import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';

export const aircraftComplianceTestAuthority = createTenantQueryAuthority({
  state: 'VALID_ACTIVE_TENANT',
  tenant: { id: 'tenant-a', publicId: 'tenant-public-a', code: 'TENANT_A', displayName: 'Tenant A', status: 'ACTIVE' },
  membership: { id: 'membership-a', tenantId: 'tenant-a', userId: 'user-a', status: 'ACTIVE' },
  validatedAt: 1,
});
