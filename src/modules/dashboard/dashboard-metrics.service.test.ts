import { describe, expect, it, vi } from 'vitest';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { DashboardTenantRepository } from './dashboard-tenant.repository.js';
import { DASHBOARD_METRICS_WARNING, DashboardMetricsService } from './dashboard-metrics.service.js';

const authority = createTenantQueryAuthority({
  state: 'VALID_ACTIVE_TENANT',
  tenant: { id: 'tenant-a', publicId: 'public-a', code: 'A', displayName: 'A', status: 'ACTIVE' },
  membership: { id: 'membership-a', tenantId: 'tenant-a', userId: 'user-a', status: 'ACTIVE' },
  validatedAt: 1,
});

describe('MT-4C5 dashboard metrics behavior', () => {
  it('preserves partial results and warning text when one tenant aggregate fails', async () => {
    const repository = new DashboardTenantRepository({
      aircraft: { count: vi.fn() }, customer: { count: vi.fn() },
      serializedComponent: { count: vi.fn() }, workpack: { count: vi.fn() },
      snag: { countOpenForTenant: vi.fn() },
    });
    const statuses = { findIdByCode: vi.fn().mockResolvedValueOnce('closed').mockResolvedValueOnce('progress') };
    vi.spyOn(repository, 'countAircraft')
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(7);
    vi.spyOn(repository, 'countWorkpacks')
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    vi.spyOn(repository, 'countOpenSnags').mockRejectedValue(new Error('TENANT_QUERY_FAILED'));
    vi.spyOn(repository, 'countSerializedComponents').mockResolvedValue(4);
    vi.spyOn(repository, 'countCustomers').mockResolvedValue(3);

    const result = await new DashboardMetricsService(repository, statuses).load(authority);
    expect(result.metrics).toEqual({
      totalAircraft: 10,
      activeAircraft: 7,
      openWorkpacks: 2,
      awaitingCertification: 1,
      openSnags: null,
      serializedComponents: 4,
      activeCustomers: 3,
    });
    expect(result.metricsWarning).toBe(DASHBOARD_METRICS_WARNING);
  });
});
