import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { DashboardTenantRepository } from './dashboard-tenant.repository.js';

function authority() {
  return createTenantQueryAuthority({
    state: 'VALID_ACTIVE_TENANT',
    tenant: { id: 'tenant-a', publicId: 'public-a', code: 'A', displayName: 'A', status: 'ACTIVE' },
    membership: { id: 'membership-a', tenantId: 'tenant-a', userId: 'user-a', status: 'ACTIVE' },
    validatedAt: 1,
  });
}

describe('MT-4C5 dashboard tenant repository', () => {
  it('requires authentic authority and scopes every aggregate root', async () => {
    const aircraft = { count: vi.fn().mockResolvedValue(2) };
    const customer = { count: vi.fn().mockResolvedValue(3) };
    const serializedComponent = { count: vi.fn().mockResolvedValue(4) };
    const workpack = { count: vi.fn().mockResolvedValue(5) };
    const snag = { countOpenForTenant: vi.fn().mockResolvedValue(6) };
    const repository = new DashboardTenantRepository({ aircraft, customer, serializedComponent, workpack, snag });
    const auth = authority();

    expect(await repository.countAircraft(auth, 'ACTIVE')).toBe(2);
    expect(await repository.countCustomers(auth, 'ACTIVE')).toBe(3);
    expect(await repository.countSerializedComponents(auth)).toBe(4);
    expect(await repository.countWorkpacks(auth, 'status-a', 'EQUALS')).toBe(5);
    expect(await repository.countOpenSnags(auth)).toBe(6);

    expect(aircraft.count).toHaveBeenCalledWith({ where: { tenant_id: 'tenant-a', status: 'ACTIVE' } });
    expect(customer.count).toHaveBeenCalledWith({ where: { tenant_id: 'tenant-a', status: 'ACTIVE' } });
    expect(serializedComponent.count).toHaveBeenCalledWith({ where: { custodian_tenant_id: 'tenant-a' } });
    expect(workpack.count.mock.calls[0]?.[0]).toMatchObject({ where: { tenant_id: 'tenant-a', status_id: 'status-a' } });
    expect(snag.countOpenForTenant).toHaveBeenCalledWith('tenant-a');
  });

  it('rejects structural authority substitutes', async () => {
    const unavailable = { count: vi.fn() };
    const repository = new DashboardTenantRepository({
      aircraft: unavailable,
      customer: unavailable,
      serializedComponent: unavailable,
      workpack: unavailable,
      snag: { countOpenForTenant: vi.fn() },
    });
    await expect(repository.countAircraft({ tenantId: 'tenant-a' } as never))
      .rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
  });

  it('keeps protected model access out of the route and mounts only a route-local gate', () => {
    const route = readFileSync('src/routes/index.ts', 'utf8');
    const app = readFileSync('src/app.ts', 'utf8');
    expect(route).not.toMatch(/\b(?:Aircraft|Customer|SerializedComponent|Workpack|WorkpackSnag)\.(?:count|find)/);
    expect(route).toContain('assertTenantQueryAuthority(req.tenantAuthority)');
    expect(route).toContain("router.get('/', ensureAuthenticated, routePlatformAdministrator, requireValidActiveTenantContext");
    expect(app).toContain('const mainRoutes = createMainRouter(requireValidActiveTenantContext)');
    expect(app).not.toMatch(/app\.use\([^\n]*requireValidActiveTenantContext/);
  });
});
