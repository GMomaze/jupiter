import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { pool } from '../../config/database.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import {
  Aircraft, AircraftCategory, AircraftComponent, AircraftComponentMovementHistory,
  AssetType, ComponentModel, Manufacturer, Tenant, User,
} from '../../models/index.js';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { AircraftComponentService } from '../aircraft/aircraft-component.service.js';

async function context(label: string) {
  await assertTestDatabaseSafety(pool);
  const suffix = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  const user = await User.create({ email: `b2-${label}-${suffix}@example.test`, password_hash: 'test', full_name: `B2 ${label}`, is_active: true });
  const tenant = await Tenant.create({ code: `B2${label}_${suffix}`, display_name: `B2 ${label}`, status: 'ACTIVE', created_by_user_id: user.id, updated_by_user_id: user.id });
  const authority = createTenantQueryAuthority({
    state: 'VALID_ACTIVE_TENANT',
    tenant: { id: tenant.id, publicId: tenant.public_id, code: tenant.code, displayName: tenant.display_name, status: 'ACTIVE' },
    membership: { id: randomUUID(), tenantId: tenant.id, userId: user.id, status: 'ACTIVE' },
    validatedAt: Date.now(),
  });
  const manufacturer = await Manufacturer.create({ code: `B2M${label}_${suffix}`, name: `B2 Manufacturer ${label} ${suffix}`, is_active: true });
  const assetType = await AssetType.create({ code: `B2A${label}_${suffix}`, label: `B2 Asset ${label}`, is_installable_on_aircraft: true, is_required_for_aircraft: false, required_quantity: 0, is_active: true, system_locked: false });
  const category = await AircraftCategory.create({ code: `B2C${label}_${suffix}`, label: `B2 Category ${label}`, is_active: true, system_locked: false });
  const model = await ComponentModel.create({ model_name: `B2 Model ${label} ${suffix}`, model_code: `B2MOD${label}_${suffix}`, manufacturer_id: manufacturer.id, asset_type_id: assetType.id, default_tbo_hours: 1000, is_active: true });
  const aircraft = await Aircraft.create({ tenant_id: tenant.id, registration: `B2-${label}-${suffix}`, serial_number: `B2-SN-${label}-${suffix}`, model_id: model.id, category_id: category.id, status: 'ACTIVE', total_time_hours: 150, total_time_cycles: 10, version: 0 });
  return { user, tenant, authority, model, category, aircraft };
}

async function componentFor(c: Awaited<ReturnType<typeof context>>, status: 'INSTALLED' | 'REMOVED' | 'QUARANTINED' = 'INSTALLED') {
  return AircraftComponent.create({
    custodian_tenant_id: c.tenant.id, aircraft_id: c.aircraft.id, model_id: c.model.id,
    serial_number: `B2-COMP-${randomUUID()}`, position_code: `P-${randomUUID().slice(0, 6)}`,
    installation_date: '2026-09-01', tsn_at_install: 20, tso_at_install: 10,
    install_af_hours: 100, current_status: status, removed_at: status === 'REMOVED' ? new Date() : null, version: 0,
  });
}

describe('MT-4C6B2 guarded legacy inventory mutation', () => {
  it('removes and same-tenant reinstalls with carried life, custody, versions, and correct events', async () => {
    const c = await context('A');
    const target = await Aircraft.create({ tenant_id: c.tenant.id, registration: `B2-T-${randomUUID()}`, serial_number: `B2-TSN-${randomUUID()}`, model_id: c.model.id, category_id: c.category.id, status: 'ACTIVE', total_time_hours: 300, total_time_cycles: 1, version: 0 });
    const component = await componentFor(c);

    await AircraftComponentService.removeComponent(c.authority, component.id, c.user.id, ' remove ');
    await component.reload();
    expect(component).toMatchObject({ custodian_tenant_id: c.tenant.id, aircraft_id: c.aircraft.id, current_status: 'REMOVED', version: 1 });
    expect(Number(component.tsn_at_install)).toBe(70);
    expect(Number(component.tso_at_install)).toBe(60);
    const removal = await AircraftComponentMovementHistory.findOne({ where: { aircraft_component_id: component.id, action_type: 'REMOVAL' } });
    expect(removal).toMatchObject({ tenant_id: c.tenant.id, source_aircraft_id: c.aircraft.id, target_aircraft_id: null, actor_id: c.user.id, remarks: 'remove' });
    expect(Number(removal!.aircraft_hours)).toBe(150);

    await AircraftComponentService.reinstallComponent(c.authority, component.id, target.id, c.user.id, ' reinstall ');
    await component.reload();
    expect(component).toMatchObject({ custodian_tenant_id: c.tenant.id, aircraft_id: target.id, current_status: 'INSTALLED', removed_at: null, version: 2 });
    expect(Number(component.install_af_hours)).toBe(300);
    expect(Number(component.tsn_at_install)).toBe(70);
    expect(Number(component.tso_at_install)).toBe(60);
    const installation = await AircraftComponentMovementHistory.findOne({ where: { aircraft_component_id: component.id, action_type: 'INSTALLATION' } });
    expect(installation).toMatchObject({ tenant_id: c.tenant.id, source_aircraft_id: null, target_aircraft_id: target.id, actor_id: c.user.id, remarks: 'reinstall' });
    expect(Number(installation!.aircraft_hours)).toBe(300);
    expect(removal!.occurred_at).toBeInstanceOf(Date);
    expect(installation!.occurred_at).toBeInstanceOf(Date);
  });

  it('denies foreign/nonexistent components and foreign targets neutrally without disclosure or mutation', async () => {
    const owner = await context('OWNER');
    const foreign = await context('FOREIGN');
    const installed = await componentFor(foreign);
    const removed = await componentFor(foreign, 'REMOVED');
    for (const id of [installed.id, randomUUID()]) {
      await expect(AircraftComponentService.removeComponent(owner.authority, id, owner.user.id)).rejects.toThrow('TENANT_RESOURCE_UNAVAILABLE');
    }
    for (const id of [removed.id, randomUUID()]) {
      await expect(AircraftComponentService.reinstallComponent(owner.authority, id, owner.aircraft.id, owner.user.id)).rejects.toThrow('TENANT_RESOURCE_UNAVAILABLE');
    }
    const ownedRemoved = await componentFor(owner, 'REMOVED');
    await expect(AircraftComponentService.reinstallComponent(owner.authority, ownedRemoved.id, foreign.aircraft.id, owner.user.id)).rejects.toThrow('TENANT_RESOURCE_UNAVAILABLE');
    await expect(AircraftComponentService.reinstallComponent(owner.authority, ownedRemoved.id, randomUUID(), owner.user.id)).rejects.toThrow('TENANT_RESOURCE_UNAVAILABLE');
    await Promise.all([installed.reload(), removed.reload(), ownedRemoved.reload()]);
    expect(installed.current_status).toBe('INSTALLED');
    expect(removed.current_status).toBe('REMOVED');
    expect(ownedRemoved.current_status).toBe('REMOVED');
  });

  it('rolls back component state when movement history insertion fails', async () => {
    const c = await context('ROLLBACK');
    const component = await componentFor(c);
    await expect(AircraftComponentService.removeComponent(c.authority, component.id, randomUUID())).rejects.toThrow('MOVEMENT_HISTORY_APPEND_FAILED');
    await component.reload();
    expect(component).toMatchObject({ current_status: 'INSTALLED', version: 0, aircraft_id: c.aircraft.id, custodian_tenant_id: c.tenant.id });
    expect(await AircraftComponentMovementHistory.count({ where: { aircraft_component_id: component.id } })).toBe(0);
  });

  it('preserves quarantine/restore and rejects forbidden B2 transitions', async () => {
    const c = await context('STATE');
    const installed = await componentFor(c);
    await AircraftComponentService.quarantineComponent(c.authority, installed.id);
    await expect(AircraftComponentService.removeComponent(c.authority, installed.id, c.user.id)).rejects.toThrow('ONLY_INSTALLED_COMPONENTS_CAN_BE_REMOVED');
    await expect(AircraftComponentService.reinstallComponent(c.authority, installed.id, c.aircraft.id, c.user.id)).rejects.toThrow('ONLY_REMOVED_COMPONENTS_CAN_BE_REINSTALLED');
    await AircraftComponentService.restoreComponent(c.authority, installed.id);
    await installed.reload();
    expect(installed.current_status).toBe('INSTALLED');

    const removed = await componentFor(c, 'REMOVED');
    await expect(AircraftComponentService.removeComponent(c.authority, removed.id, c.user.id)).rejects.toThrow('ONLY_INSTALLED_COMPONENTS_CAN_BE_REMOVED');
  });
});
