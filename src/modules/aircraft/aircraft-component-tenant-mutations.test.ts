import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedModels = vi.hoisted(() => {
  const transaction = vi.fn();
  const model = () => ({ findOne: vi.fn(), findAll: vi.fn(), findByPk: vi.fn(), create: vi.fn(), update: vi.fn() });
  return { sequelize: { transaction }, Aircraft: model(), AircraftComponent: model(), AircraftComponentInstallation: model(), ComponentModel: model(), AssetType: model(), SerializedComponent: model(), SerializedComponentLifeState: model(), ComponentLifeLimit: model(), Manufacturer: model() };
});
vi.mock('../../models/index.js', () => mockedModels);
vi.mock('../tenancy/tenant-transaction.js', async () => {
  const { sequelize: mockedSequelize } = await import('../../models/index.js');
  return {
    withTenantTransaction: async (authority: unknown, work: (tx: any) => Promise<unknown>) => {
      const transaction = await mockedSequelize.transaction();
      try {
        const result = await work(transaction);
        await transaction.commit();
        return result;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    },
    withTenantClient: async (authority: unknown, pool: unknown, work: (client: any) => Promise<unknown>) =>
      work({}),
  };
});

import { sequelize } from '../../models/index.js';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { serializedComponentTenantRepository } from '../library/serialized-component-tenant.repository.live.js';
import { aircraftTenantRepository } from './aircraft-tenant.repository.live.js';
import { aircraftComponentInstallationTenantRepository } from './aircraft-component-installation-tenant.repository.live.js';
import { aircraftComponentTenantRepository } from './aircraft-component-tenant.repository.live.js';
import { AircraftComponentService } from './aircraft-component.service.js';

const authority = createTenantQueryAuthority({
  state: 'VALID_ACTIVE_TENANT',
  tenant: { id: 'tenant-a', publicId: 'public-a', code: 'TENANT_A', displayName: 'Tenant A', status: 'ACTIVE' },
  membership: { id: 'membership-a', tenantId: 'tenant-a', userId: 'user-a', status: 'ACTIVE' },
  validatedAt: 1,
});
const installData = { aircraft_id: 'aircraft-a', serialized_component_id: 'component-a', installed_at: '2026-08-01', tracking_basis: 'AIRCRAFT_HOURS' };
const removeData = { aircraft_id: 'aircraft-a', installation_id: 'installation-a', removed_at: '2026-08-02', resulting_status: 'AVAILABLE' };

function arrange() {
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, commit: vi.fn(), rollback: vi.fn() };
  const transactionSpy = vi.spyOn(sequelize, 'transaction').mockResolvedValue(transaction as never);
  const aircraft = vi.spyOn(aircraftTenantRepository, 'getForRootUpdate').mockResolvedValue({ id: 'aircraft-a', total_time_hours: 12, total_time_cycles: 3 } as never);
  const component = vi.spyOn(serializedComponentTenantRepository, 'getForUpdate').mockResolvedValue({ id: 'component-a', status: 'AVAILABLE' });
  const status = vi.spyOn(serializedComponentTenantRepository, 'updateInstallationStatus').mockResolvedValue({ outcome: 'CHANGED' });
  const active = vi.spyOn(aircraftComponentInstallationTenantRepository, 'getActiveForSerializedComponentUpdate').mockResolvedValue(undefined);
  const create = vi.spyOn(aircraftComponentInstallationTenantRepository, 'create').mockResolvedValue({ id: 'installation-a' });
  const getInstallation = vi.spyOn(aircraftComponentInstallationTenantRepository, 'getActiveForUpdate').mockResolvedValue({ id: 'installation-a', aircraft_id: 'aircraft-a', serialized_component_id: 'component-a', installed_at: '2026-08-01', notes: null });
  const remove = vi.spyOn(aircraftComponentInstallationTenantRepository, 'removeActiveById').mockResolvedValue({ outcome: 'CHANGED' });
  return { transaction, transactionSpy, aircraft, component, status, active, create, getInstallation, remove };
}

beforeEach(() => vi.restoreAllMocks());

describe('MT-4C3B4 serialized installation mutations', () => {
  it.each([
    ['install', AircraftComponentService.installSerializedComponent, installData],
    ['baseline', AircraftComponentService.baselineCaptureSerializedComponent, installData],
    ['remove', AircraftComponentService.removeSerializedComponent, removeData],
  ])('rejects missing and structural authority before transaction or repository access: %s', async (_name, operation, data) => {
    const transactionSpy = vi.spyOn(sequelize, 'transaction');
    const aircraftSpy = vi.spyOn(aircraftTenantRepository, 'getForRootUpdate');
    await expect(operation(undefined as never, data)).rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    await expect(operation(Object.freeze({ tenantId: 'tenant-a' }) as never, data)).rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    expect(transactionSpy).not.toHaveBeenCalled();
    expect(aircraftSpy).not.toHaveBeenCalled();
  });

  it('installs atomically through both tenant roots and preserves status/baselines', async () => {
    const mock = arrange();
    await AircraftComponentService.installSerializedComponent(authority, installData);
    expect(mock.aircraft).toHaveBeenCalledWith(authority, 'aircraft-a', expect.objectContaining({ lock: 'UPDATE' }));
    expect(mock.component).toHaveBeenCalledWith(authority, 'component-a', expect.objectContaining({ lock: 'UPDATE' }));
    expect(mock.create).toHaveBeenCalledWith(authority, expect.objectContaining({ installation_context: 'MAINTENANCE_INSTALL', install_aircraft_hours: 12, install_aircraft_cycles: 3 }), expect.anything());
    expect(mock.status).toHaveBeenCalledWith(authority, 'component-a', 'INSTALLED', expect.anything());
    expect(mock.transaction.commit).toHaveBeenCalledOnce();
  });

  it('preserves baseline-capture context and atomic status transition', async () => {
    const mock = arrange();
    await AircraftComponentService.baselineCaptureSerializedComponent(authority, { ...installData, uncertainty_notes: 'Inherited evidence' });
    expect(mock.create).toHaveBeenCalledWith(authority, expect.objectContaining({ installation_context: 'BASELINE_CAPTURE', notes: expect.stringContaining('Inherited evidence') }), expect.anything());
    expect(mock.status).toHaveBeenCalledWith(authority, 'component-a', 'INSTALLED', expect.anything());
    expect(mock.transaction.commit).toHaveBeenCalledOnce();
  });

  it.each([
    ['foreign/nonexistent aircraft', true, false],
    ['foreign/nonexistent component', false, true],
    ['both foreign/nonexistent roots', true, true],
  ])('rejects cross-tenant/unavailable install neutrally: %s', async (_name, noAircraft, noComponent) => {
    const mock = arrange();
    if (noAircraft) mock.aircraft.mockResolvedValue(undefined);
    if (noComponent) mock.component.mockResolvedValue(undefined);
    await expect(AircraftComponentService.installSerializedComponent(authority, installData)).rejects.toThrow('TENANT_RESOURCE_UNAVAILABLE');
    expect(mock.transaction.rollback).toHaveBeenCalledOnce();
    expect(mock.create).not.toHaveBeenCalled();
  });

  it('removes only a both-root-scoped active installation and preserves removal/status data', async () => {
    const mock = arrange();
    mock.component.mockResolvedValue({ id: 'component-a', status: 'INSTALLED' });
    await AircraftComponentService.removeSerializedComponent(authority, removeData);
    expect(mock.getInstallation).toHaveBeenCalledWith(authority, 'installation-a', 'aircraft-a', expect.objectContaining({ lock: 'UPDATE' }));
    expect(mock.remove).toHaveBeenCalledWith(authority, 'installation-a', 'aircraft-a', expect.objectContaining({ removed_at: '2026-08-02', removal_aircraft_hours: 12, removal_aircraft_cycles: 3 }), expect.anything());
    expect(mock.status).toHaveBeenCalledWith(authority, 'component-a', 'AVAILABLE', expect.anything());
    expect(mock.transaction.commit).toHaveBeenCalledOnce();
  });

  it('treats foreign and nonexistent direct installation IDs neutrally', async () => {
    const mock = arrange();
    mock.getInstallation.mockResolvedValue(undefined);
    await expect(AircraftComponentService.removeSerializedComponent(authority, removeData)).rejects.toThrow('TENANT_RESOURCE_UNAVAILABLE');
    expect(mock.remove).not.toHaveBeenCalled();
    expect(mock.transaction.rollback).toHaveBeenCalledOnce();
  });

  it('controllers pass req.tenantAuthority and converted service paths contain no association mixins', () => {
    const controller = fs.readFileSync(path.resolve('src/modules/aircraft/aircraft.controller.ts'), 'utf8');
    const service = fs.readFileSync(path.resolve('src/modules/aircraft/aircraft-component.service.ts'), 'utf8');
    expect(controller.match(/AircraftComponentService\.(installSerializedComponent|baselineCaptureSerializedComponent|removeSerializedComponent)\(AircraftController\.requireTenantAuthority\(req\)/g)).toHaveLength(3);
    const converted = service.slice(service.indexOf('static async installSerializedComponent'));
    expect(converted).not.toMatch(/\b(aircraft|serializedComponent|installation)\.(get|set|add|remove|create)[A-Z][A-Za-z]+\(/);
  });
});

describe('MT-4C3B6.1 component workflow reads', () => {
  it.each([
    ['available serialized components', () => AircraftComponentService.getAvailableSerializedComponents(undefined as never)],
    ['active installations', () => AircraftComponentService.getActiveSerializedInstallationsForAircraft(Object.freeze({ tenantId: 'tenant-a' }) as never, 'aircraft-a')],
    ['installation history', () => AircraftComponentService.getSerializedInstallationHistoryForComponents(undefined as never, ['component-a'])],
    ['legacy installed components', () => AircraftComponentService.getTechnicalStatusInstallableLegacyComponentsForAircraft(Object.freeze({ tenantId: 'tenant-a' }) as never, 'aircraft-a')],
  ])('rejects missing or structural authority before repository access: %s', async (_name, operation) => {
    await expect(operation()).rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
  });

  it('routes serialized availability, active installation, history, and legacy reads through scoped repositories', async () => {
    const available = vi.spyOn(serializedComponentTenantRepository, 'listAvailable').mockResolvedValue([]);
    const active = vi.spyOn(aircraftComponentInstallationTenantRepository, 'listActiveWorkflowForAircraft').mockResolvedValue([]);
    const history = vi.spyOn(aircraftComponentInstallationTenantRepository, 'listWorkflowHistoryForSerializedComponents').mockResolvedValue([]);
    const legacy = vi.spyOn(aircraftComponentTenantRepository, 'listInstalledForAircraft').mockResolvedValue([]);

    await AircraftComponentService.getAvailableSerializedComponents(authority);
    await AircraftComponentService.getActiveSerializedInstallationsForAircraft(authority, 'aircraft-a');
    await AircraftComponentService.getSerializedInstallationHistoryForComponents(authority, ['component-a', 'component-a']);
    await AircraftComponentService.getTechnicalStatusInstallableLegacyComponentsForAircraft(authority, 'aircraft-a');

    expect(available).toHaveBeenCalledWith(authority, expect.objectContaining({ transaction: expect.anything() }));
    expect(active).toHaveBeenCalledWith(authority, 'aircraft-a', expect.objectContaining({ transaction: expect.anything() }));
    expect(history).toHaveBeenCalledWith(authority, ['component-a'], expect.objectContaining({ transaction: expect.anything() }));
    expect(legacy).toHaveBeenCalledWith(authority, 'aircraft-a', expect.objectContaining({ transaction: expect.anything() }));
  });
});

describe('MT-4C3B6.2 legacy AircraftComponent mutations', () => {
  it.each([
    ['install', () => AircraftComponentService.installComponent(undefined as never, {})],
    ['remove', () => AircraftComponentService.removeComponent(Object.freeze({ tenantId: 'tenant-a' }) as never, 'child-a')],
    ['quarantine', () => AircraftComponentService.quarantineComponent(undefined as never, 'child-a')],
    ['restore', () => AircraftComponentService.restoreComponent(Object.freeze({ tenantId: 'tenant-a' }) as never, 'child-a')],
  ])('rejects missing or structural authority before opening a transaction: %s', async (_name, operation) => {
    const transactionSpy = vi.spyOn(sequelize, 'transaction');
    transactionSpy.mockClear();
    await expect(operation()).rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    expect(transactionSpy).not.toHaveBeenCalled();
  });

  it('installs under a locked owned Aircraft and tenant-scoped legacy/serialized conflict checks', async () => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' }, commit: vi.fn(), rollback: vi.fn() };
    vi.spyOn(sequelize, 'transaction').mockResolvedValue(transaction as never);
    const aircraft = vi.spyOn(aircraftTenantRepository, 'getForRootUpdate').mockResolvedValue({ id: 'aircraft-a', status: 'ACTIVE', total_time_hours: 12 } as never);
    mockedModels.ComponentModel.findByPk.mockResolvedValue({ id: 'model-a', asset_type_id: 'type-a', model_name: 'Model A', default_tbo_hours: 100, AssetType: { is_installable_on_aircraft: true } });
    const serial = vi.spyOn(aircraftComponentTenantRepository, 'hasInstalledSerialConflict').mockResolvedValue(false);
    const legacyPosition = vi.spyOn(aircraftComponentTenantRepository, 'hasActivePositionConflict').mockResolvedValue(false);
    const serializedPosition = vi.spyOn(aircraftComponentInstallationTenantRepository, 'hasActivePositionConflict').mockResolvedValue(false);
    const create = vi.spyOn(aircraftComponentTenantRepository, 'create').mockResolvedValue({ id: 'child-a' });

    await AircraftComponentService.installComponent(authority, {
      aircraft_id: 'aircraft-a', model_id: 'model-a', serial_number: ' SERIAL-A ',
      installation_date: '2026-09-05', position_code: ' bat-1 ', tsn_at_install: 10,
    });

    expect(aircraft).toHaveBeenCalledWith(authority, 'aircraft-a', expect.objectContaining({ lock: 'UPDATE' }));
    expect(serial).toHaveBeenCalledWith(authority, 'SERIAL-A', expect.objectContaining({ lock: 'UPDATE' }));
    expect(legacyPosition).toHaveBeenCalledWith(authority, 'aircraft-a', 'type-a', 'BAT-1', expect.anything());
    expect(serializedPosition).toHaveBeenCalledWith(authority, 'aircraft-a', 'type-a', 'BAT-1', expect.anything());
    expect(create).toHaveBeenCalledWith(authority, expect.objectContaining({ aircraft_id: 'aircraft-a', serial_number: 'SERIAL-A', position_code: 'BAT-1' }), { transaction });
    expect(transaction.commit).toHaveBeenCalledOnce();
  });

  it.each(['foreign', 'nonexistent'])('treats %s legacy child IDs as neutrally unavailable', async () => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' }, commit: vi.fn(), rollback: vi.fn() };
    vi.spyOn(sequelize, 'transaction').mockResolvedValue(transaction as never);
    vi.spyOn(aircraftComponentTenantRepository, 'getForUpdate').mockResolvedValue(undefined);
    await expect(AircraftComponentService.removeComponent(authority, 'child-a', 'actor-a')).rejects.toThrow('TENANT_RESOURCE_UNAVAILABLE');
    expect(transaction.rollback).toHaveBeenCalledOnce();
  });

  it('preserves locked versioned removal and required-component grounding', async () => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' }, commit: vi.fn(), rollback: vi.fn() };
    vi.spyOn(sequelize, 'transaction').mockResolvedValue(transaction as never);
    vi.spyOn(aircraftComponentTenantRepository, 'getForUpdate').mockResolvedValue({ id: 'child-a', aircraft_id: 'aircraft-a', current_status: 'INSTALLED', version: 2 });
    vi.spyOn(aircraftComponentTenantRepository, 'getOperationalContext').mockResolvedValue({ id: 'child-a', ComponentModel: { AssetType: { is_required_for_aircraft: true } } });
    const update = vi.spyOn(aircraftComponentTenantRepository, 'updateByVersion').mockResolvedValue({ outcome: 'CHANGED' });
    const save = vi.fn();
    vi.spyOn(aircraftTenantRepository, 'getForRootUpdate').mockResolvedValue({ id: 'aircraft-a', status: 'ACTIVE', save } as never);

    await AircraftComponentService.quarantineComponent(authority, 'child-a');

    expect(update).toHaveBeenCalledWith(authority, 'child-a', 'aircraft-a', 2, expect.objectContaining({ current_status: 'QUARANTINED', version: 3 }), { transaction });
    expect(save).toHaveBeenCalledWith({ transaction });
    expect(transaction.commit).toHaveBeenCalledOnce();
  });

  it('controller supplies request authority and the four converted methods contain no direct tenant-owned model access', () => {
    const controller = fs.readFileSync(path.resolve('src/modules/aircraft/aircraft.controller.ts'), 'utf8');
    const service = fs.readFileSync(path.resolve('src/modules/aircraft/aircraft-component.service.ts'), 'utf8');
    expect(controller).toMatch(/AircraftComponentService\.installComponent\(\s*AircraftController\.requireTenantAuthority\(req\),/);
    for (const operation of ['installComponent', 'removeComponent', 'quarantineComponent', 'restoreComponent']) {
      expect(service).toMatch(new RegExp(`static async ${operation}\\(\\s*authority: TenantQueryAuthority`));
    }
    const converted = service.slice(service.indexOf('static async installComponent'), service.indexOf('static async installSerializedComponent'));
    expect(converted).not.toMatch(/\b(Aircraft|AircraftComponent|AircraftComponentInstallation|SerializedComponent)\.(find|create|update)/);
    expect(converted).not.toMatch(/authority\?\.tenantId|\{\s*tenantId:/);
  });
});
