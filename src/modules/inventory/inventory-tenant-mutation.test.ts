import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedModels = vi.hoisted(() => {
  const model = () => ({ findOne: vi.fn(), findAll: vi.fn(), create: vi.fn(), update: vi.fn() });
  return {
    sequelize: { transaction: vi.fn() },
    Aircraft: model(), AircraftComponent: model(), AircraftComponentInstallation: model(),
    AircraftComponentMovementHistory: model(), ComponentModel: model(), AssetType: model(),
    SerializedComponent: model(), SerializedComponentLifeState: model(), ComponentLifeLimit: model(), Manufacturer: model(),
  };
});
vi.mock('../../models/index.js', () => mockedModels);

import { sequelize } from '../../models/index.js';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { aircraftTenantRepository } from '../aircraft/aircraft-tenant.repository.live.js';
import { aircraftComponentTenantRepository } from '../aircraft/aircraft-component-tenant.repository.live.js';
import { aircraftComponentMovementHistoryRepository } from './aircraft-component-movement-history.repository.live.js';
import { AircraftComponentService } from '../aircraft/aircraft-component.service.js';

const authority = createTenantQueryAuthority({
  state: 'VALID_ACTIVE_TENANT',
  tenant: { id: 'tenant-a', publicId: 'public-a', code: 'A', displayName: 'A', status: 'ACTIVE' },
  membership: { id: 'membership-a', tenantId: 'tenant-a', userId: 'actor-a', status: 'ACTIVE' },
  validatedAt: 1,
});

describe('MT-4C6B2 mounted legacy inventory authority', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('removes through custody and Aircraft locks, versioned mutation, and atomic history', async () => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' }, commit: vi.fn(), rollback: vi.fn() };
    vi.spyOn(sequelize, 'transaction').mockResolvedValue(transaction as never);
    vi.spyOn(aircraftComponentTenantRepository, 'getCustodyForUpdate').mockResolvedValue({
      id: 'component-a', aircraft_id: 'aircraft-a', current_status: 'INSTALLED', version: 2,
      install_af_hours: 100, tsn_at_install: 20, tso_at_install: 10,
    });
    vi.spyOn(aircraftTenantRepository, 'getForRootUpdate').mockResolvedValue({ id: 'aircraft-a', total_time_hours: 125 } as never);
    const update = vi.spyOn(aircraftComponentTenantRepository, 'updateCustodyByVersion').mockResolvedValue({ outcome: 'CHANGED' });
    const append = vi.spyOn(aircraftComponentMovementHistoryRepository, 'append').mockResolvedValue({});

    await AircraftComponentService.removeComponent(authority, 'component-a', 'actor-a', '  reason  ');

    expect(update).toHaveBeenCalledWith(authority, 'component-a', 2, expect.objectContaining({
      current_status: 'REMOVED', tsn_at_install: 45, tso_at_install: 35, version: 3,
    }), { transaction });
    expect(append).toHaveBeenCalledWith(authority, expect.objectContaining({
      action_type: 'REMOVAL', source_aircraft_id: 'aircraft-a', target_aircraft_id: null,
      actor_id: 'actor-a', aircraft_hours: 125, remarks: 'reason',
    }), { transaction });
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(append.mock.invocationCallOrder[0]);
    expect(transaction.commit).toHaveBeenCalledOnce();
  });

  it('rolls back when history append fails and on optimistic conflict', async () => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' }, commit: vi.fn(), rollback: vi.fn() };
    vi.spyOn(sequelize, 'transaction').mockResolvedValue(transaction as never);
    vi.spyOn(aircraftComponentTenantRepository, 'getCustodyForUpdate').mockResolvedValue({
      id: 'component-a', aircraft_id: 'aircraft-a', current_status: 'INSTALLED', version: 2,
      install_af_hours: 100, tsn_at_install: 20, tso_at_install: 10,
    });
    vi.spyOn(aircraftTenantRepository, 'getForRootUpdate').mockResolvedValue({ id: 'aircraft-a', total_time_hours: 125 } as never);
    vi.spyOn(aircraftComponentTenantRepository, 'updateCustodyByVersion').mockResolvedValue({ outcome: 'CHANGED' });
    vi.spyOn(aircraftComponentMovementHistoryRepository, 'append').mockRejectedValue(new Error('MOVEMENT_HISTORY_APPEND_FAILED'));
    await expect(AircraftComponentService.removeComponent(authority, 'component-a', 'actor-a')).rejects.toThrow('MOVEMENT_HISTORY_APPEND_FAILED');
    expect(transaction.rollback).toHaveBeenCalledOnce();
    expect(transaction.commit).not.toHaveBeenCalled();

    vi.restoreAllMocks();
    const conflictTransaction = { LOCK: { UPDATE: 'UPDATE' }, commit: vi.fn(), rollback: vi.fn() };
    vi.spyOn(sequelize, 'transaction').mockResolvedValue(conflictTransaction as never);
    vi.spyOn(aircraftComponentTenantRepository, 'getCustodyForUpdate').mockResolvedValue({
      id: 'component-a', aircraft_id: 'aircraft-a', current_status: 'INSTALLED', version: 2,
      install_af_hours: 100, tsn_at_install: 20, tso_at_install: 10,
    });
    vi.spyOn(aircraftTenantRepository, 'getForRootUpdate').mockResolvedValue({ id: 'aircraft-a', total_time_hours: 125 } as never);
    vi.spyOn(aircraftComponentTenantRepository, 'updateCustodyByVersion').mockResolvedValue({ outcome: 'UNAVAILABLE' });
    const noHistory = vi.spyOn(aircraftComponentMovementHistoryRepository, 'append');
    await expect(AircraftComponentService.removeComponent(authority, 'component-a', 'actor-a')).rejects.toThrow('CONFLICT');
    expect(noHistory).not.toHaveBeenCalled();
    expect(conflictTransaction.rollback).toHaveBeenCalledOnce();
  });

  it('requires exact lifecycle states and authentic actor authority', async () => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' }, commit: vi.fn(), rollback: vi.fn() };
    vi.spyOn(sequelize, 'transaction').mockResolvedValue(transaction as never);
    vi.spyOn(aircraftComponentTenantRepository, 'getCustodyForUpdate').mockResolvedValue({ current_status: 'QUARANTINED' });
    await expect(AircraftComponentService.removeComponent(authority, 'component-a', 'actor-a')).rejects.toThrow('ONLY_INSTALLED_COMPONENTS_CAN_BE_REMOVED');
    await expect(AircraftComponentService.reinstallComponent(authority, 'component-a', 'aircraft-a', 'actor-a')).rejects.toThrow('ONLY_REMOVED_COMPONENTS_CAN_BE_REINSTALLED');
    await expect(AircraftComponentService.removeComponent(authority, 'component-a', '')).rejects.toThrow('AUTHENTICATED_ACTOR_REQUIRED');
  });

  it('keeps the mounted chain canonical and contains no stale tables, status, or actor fallback', () => {
    const controller = fs.readFileSync(path.resolve('src/modules/inventory/inventory.controller.ts'), 'utf8');
    const service = fs.readFileSync(path.resolve('src/modules/inventory/inventory.service.ts'), 'utf8');
    const routes = fs.readFileSync(path.resolve('src/modules/inventory/inventory.routes.ts'), 'utf8');
    expect(routes).toContain("'/remove/:componentId'");
    expect(routes).toContain("'/install/:componentId'");
    expect(controller).toContain('assertTenantQueryAuthority(req.tenantAuthority)');
    expect(controller).toContain('AUTHENTICATED_ACTOR_REQUIRED');
    expect(controller + service).not.toMatch(/inventory_movements|\bcomponents\b|SERVICEABLE|00000000-0000-0000-0000-000000000001/);
    expect(service).toContain('AircraftComponentService.reinstallComponent');
  });

  it('exposes append-only movement history runtime authority', () => {
    const repository = fs.readFileSync(path.resolve('src/modules/inventory/aircraft-component-movement-history.repository.ts'), 'utf8');
    expect(repository).toContain('async append(');
    expect(repository).toContain('async listForComponent(');
    expect(repository).not.toMatch(/async\s+(update|delete|destroy)\s*\(/);
    expect(repository).toContain('tenant_id: authority.tenantId');
  });
});
