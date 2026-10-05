import { describe, expect, it, vi } from 'vitest';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { FleetProjectionRepository } from './projection.repository.js';
import { FleetProjectionService } from './projection.service.js';

const authority = createTenantQueryAuthority({
  state: 'VALID_ACTIVE_TENANT',
  tenant: { id: 'tenant-a', publicId: 'public-a', code: 'A', displayName: 'A', status: 'ACTIVE' },
  membership: { id: 'membership-a', tenantId: 'tenant-a', userId: 'user-a', status: 'ACTIVE' },
  validatedAt: 1,
});

const component = (
  id: string,
  aircraftId: string,
  currentStatus: 'INSTALLED' | 'REMOVED',
  maintenanceStatus: 'NORMAL' | 'CRITICAL' | 'EXPIRED' | 'UNKNOWN',
) => ({
  id,
  aircraft_id: aircraftId,
  model_name: 'Model',
  category_name: 'Category',
  serial_number: id,
  install_hours_airframe: 10,
  current_actual_tso: 20,
  tbo_hours: maintenanceStatus === 'UNKNOWN' ? null : 100,
  hours_remaining: maintenanceStatus === 'UNKNOWN' ? null : 80,
  maintenance_status: maintenanceStatus,
  current_status: currentStatus,
  tso_at_install: 10,
});

describe('MT-4C6B3 FleetProjectionService', () => {
  it('groups only installed components beneath owned aircraft and exposes removed custody separately', async () => {
    const repository = new FleetProjectionRepository({
      listAircraft: vi.fn().mockResolvedValue([
        { id: 'aircraft-a', registration: 'ZS-A', serial_number: 'AC-A', total_time_hours: 100 },
      ]),
      listComponents: vi.fn().mockResolvedValue([
        component('installed', 'aircraft-a', 'INSTALLED', 'NORMAL'),
        component('removed', 'aircraft-old', 'REMOVED', 'UNKNOWN'),
      ]),
    });
    const result = await new FleetProjectionService(repository).loadFleetHealth(authority);

    expect(result.aircraft).toEqual([
      expect.objectContaining({
        id: 'aircraft-a',
        total_hours: 100,
        components: [expect.objectContaining({ id: 'installed' })],
      }),
    ]);
    expect(result.uninstalled).toEqual([expect.objectContaining({ id: 'removed' })]);
  });

  it('uses the same component projection to count every truthful status including UNKNOWN', async () => {
    const listComponents = vi.fn().mockResolvedValue([
      component('normal', 'a', 'INSTALLED', 'NORMAL'),
      component('critical', 'a', 'INSTALLED', 'CRITICAL'),
      component('expired', 'a', 'INSTALLED', 'EXPIRED'),
      component('unknown', 'old', 'REMOVED', 'UNKNOWN'),
    ]);
    const service = new FleetProjectionService(new FleetProjectionRepository({
      listAircraft: vi.fn().mockResolvedValue([]),
      listComponents,
    }));

    expect(await service.loadSummary(authority)).toEqual([
      { maintenance_status: 'NORMAL', count: 1 },
      { maintenance_status: 'CRITICAL', count: 1 },
      { maintenance_status: 'EXPIRED', count: 1 },
      { maintenance_status: 'UNKNOWN', count: 1 },
    ]);
    expect(listComponents).toHaveBeenCalledWith('tenant-a');
  });

  it('rejects structural tenant substitutes before repository access', async () => {
    const listAircraft = vi.fn();
    const repository = new FleetProjectionRepository({ listAircraft, listComponents: vi.fn() });
    await expect(repository.listAircraft({ tenantId: 'tenant-a' } as never))
      .rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    expect(listAircraft).not.toHaveBeenCalled();
  });
});
