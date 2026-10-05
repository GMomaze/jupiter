import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  Aircraft,
  AircraftCategory,
  AircraftComponent,
  AircraftComponentInstallation,
  AssetType,
  ComponentModel,
  Manufacturer,
  SerializedComponent,
  Tenant,
  User,
} from '../../models/index.js';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { AircraftComponentService } from './aircraft-component.service.js';

async function createContext(options: { required?: boolean; tbo?: number | null } = {}) {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  const owner = await User.create({
    email: `b62-${suffix}@example.test`, password_hash: 'test',
    full_name: `B6.2 Owner ${suffix}`, is_active: true,
  });
  const tenant = await Tenant.create({
    code: `B62_${suffix}`, display_name: `B6.2 Tenant ${suffix}`, status: 'ACTIVE',
    created_by_user_id: owner.id, updated_by_user_id: owner.id,
  });
  const authority = createTenantQueryAuthority({
    state: 'VALID_ACTIVE_TENANT',
    tenant: { id: tenant.id, publicId: tenant.public_id, code: tenant.code, displayName: tenant.display_name, status: 'ACTIVE' },
    membership: { id: randomUUID(), tenantId: tenant.id, userId: owner.id, status: 'ACTIVE' },
    validatedAt: Date.now(),
  });
  const manufacturer = await Manufacturer.create({ code: `B62M_${suffix}`, name: `B6.2 Manufacturer ${suffix}`, is_active: true });
  const assetType = await AssetType.create({
    code: `B62A_${suffix}`, label: `B6.2 Asset ${suffix}`,
    is_installable_on_aircraft: true, is_required_for_aircraft: options.required ?? false,
    required_quantity: options.required ? 1 : 0, is_active: true, system_locked: false,
  });
  const category = await AircraftCategory.create({ code: `B62C_${suffix}`, label: `B6.2 Category ${suffix}`, is_active: true, system_locked: false });
  const model = await ComponentModel.create({
    model_name: `B6.2 Model ${suffix}`, model_code: `B62MOD_${suffix}`,
    manufacturer_id: manufacturer.id, asset_type_id: assetType.id,
    default_tbo_hours: options.tbo ?? null, is_active: true,
  });
  const aircraft = await Aircraft.create({
    registration: `B62-${suffix}`, serial_number: `B62-SN-${suffix}`,
    model_id: model.id, category_id: category.id, status: 'ACTIVE',
    total_time_hours: 100, total_time_cycles: 10, version: 0, tenant_id: tenant.id,
  });
  return { tenant, authority, model, aircraft, owner };
}

async function installLegacy(
  context: Awaited<ReturnType<typeof createContext>>,
  serial: string,
  position = 'BAT-1',
) {
  await AircraftComponentService.installComponent(context.authority, {
    aircraft_id: context.aircraft.id,
    model_id: context.model.id,
    serial_number: serial,
    installation_date: '2026-09-05',
    position_code: position,
    tsn_at_install: 10,
    tso_at_install: 0,
  });
  return AircraftComponent.findOne({ where: { aircraft_id: context.aircraft.id, serial_number: serial } });
}

describe('MT-4C3B6.2 guarded legacy AircraftComponent mutations', () => {
  it('installs and removes an owned component with versioned state changes', async () => {
    const context = await createContext();
    const component = await installLegacy(context, `OWN-${randomUUID()}`);
    expect(component).toMatchObject({ current_status: 'INSTALLED', version: 0 });

    await AircraftComponentService.removeComponent(context.authority, component!.id, context.owner.id);
    await component!.reload();
    expect(component).toMatchObject({ current_status: 'REMOVED', version: 1 });
    expect(component!.removed_at).toBeInstanceOf(Date);
  });

  it('quarantines an owned required component and grounds its aircraft', async () => {
    const context = await createContext({ required: true });
    const component = await installLegacy(context, `QUAR-${randomUUID()}`);
    await AircraftComponentService.quarantineComponent(context.authority, component!.id);
    await Promise.all([component!.reload(), context.aircraft.reload()]);
    expect(component).toMatchObject({ current_status: 'QUARANTINED', version: 1 });
    expect(context.aircraft.status).toBe('GROUNDED');
  });

  it('restores an owned quarantined component and preserves the TBO gate', async () => {
    const context = await createContext({ tbo: 500 });
    const component = await installLegacy(context, `REST-${randomUUID()}`);
    await AircraftComponentService.quarantineComponent(context.authority, component!.id);
    await AircraftComponentService.restoreComponent(context.authority, component!.id);
    await component!.reload();
    expect(component).toMatchObject({ current_status: 'INSTALLED', version: 2, removed_at: null });

    const limited = await createContext({ tbo: 50 });
    const limitedComponent = await AircraftComponent.create({
      custodian_tenant_id: limited.tenant.id,
      aircraft_id: limited.aircraft.id, model_id: limited.model.id,
      serial_number: `TBO-${randomUUID()}`, position_code: 'TBO-1',
      installation_date: '2026-09-05', tsn_at_install: 0, tso_at_install: 0,
      install_af_hours: 0, current_status: 'QUARANTINED', removed_at: null, version: 0,
    });
    await expect(AircraftComponentService.restoreComponent(limited.authority, limitedComponent.id))
      .rejects.toThrow('CANNOT_RESTORE_TBO_EXCEEDED');
    await limitedComponent.reload();
    expect(limitedComponent).toMatchObject({ current_status: 'QUARANTINED', version: 0 });
  });

  it('makes foreign and nonexistent child IDs identically unavailable without mutation', async () => {
    const owner = await createContext();
    const foreign = await createContext();
    const component = await installLegacy(foreign, `FOREIGN-${randomUUID()}`);

    for (const aircraftId of [foreign.aircraft.id, randomUUID()]) {
      await expect(AircraftComponentService.installComponent(owner.authority, {
        aircraft_id: aircraftId,
        model_id: owner.model.id,
        serial_number: `DENIED-${randomUUID()}`,
        installation_date: '2026-09-05',
        position_code: 'DENIED-1',
        tsn_at_install: 0,
        tso_at_install: 0,
      })).rejects.toThrow('TENANT_RESOURCE_UNAVAILABLE');
    }

    for (const operation of [
      (authority: typeof owner.authority, id: string) => AircraftComponentService.removeComponent(authority, id, owner.owner.id),
      AircraftComponentService.quarantineComponent,
      AircraftComponentService.restoreComponent,
    ]) {
      await expect(operation(owner.authority, component!.id)).rejects.toThrow('TENANT_RESOURCE_UNAVAILABLE');
      await expect(operation(owner.authority, randomUUID())).rejects.toThrow('TENANT_RESOURCE_UNAVAILABLE');
    }
    await component!.reload();
    expect(component).toMatchObject({ current_status: 'INSTALLED', version: 0 });
  });

  it('keeps installed serial conflicts tenant-local and rolls back rejected installs', async () => {
    const owner = await createContext();
    const foreign = await createContext();
    const serial = `SERIAL-${randomUUID()}`;
    await installLegacy(foreign, serial, 'FOREIGN-1');
    await expect(installLegacy(owner, serial, 'OWNER-1')).resolves.toBeTruthy();
    await expect(installLegacy(owner, serial, 'OWNER-2')).rejects.toThrow('SERIAL_ALREADY_INSTALLED_ON_ANOTHER_AIRCRAFT');
    expect(await AircraftComponent.count({ where: { aircraft_id: owner.aircraft.id, serial_number: serial } })).toBe(1);
  });

  it('enforces tenant-local legacy and both-root serialized position conflicts', async () => {
    const owner = await createContext();
    const foreign = await createContext();
    await AircraftComponent.create({
      custodian_tenant_id: foreign.tenant.id,
      aircraft_id: foreign.aircraft.id, model_id: owner.model.id,
      serial_number: `FOREIGN-POS-${randomUUID()}`, position_code: 'POS-1',
      installation_date: '2026-09-05', tsn_at_install: 0, tso_at_install: 0,
      install_af_hours: 0, current_status: 'INSTALLED', removed_at: null, version: 0,
    });
    await expect(installLegacy(owner, `OWNER-POS-${randomUUID()}`, 'POS-1')).resolves.toBeTruthy();
    await expect(installLegacy(owner, `OWNER-BLOCK-${randomUUID()}`, 'POS-1')).rejects.toThrow('POSITION_OCCUPIED');

    const serialized = await SerializedComponent.create({
      component_model_id: owner.model.id, serial_number: `SC-${randomUUID()}`,
      status: 'INSTALLED', custodian_tenant_id: owner.tenant.id,
    });
    await AircraftComponentInstallation.create({
      aircraft_id: owner.aircraft.id, serialized_component_id: serialized.id,
      installation_context: 'MAINTENANCE_INSTALL', installed_at: '2026-09-05',
      removed_at: null, position: 'POS-2', tracking_basis: 'AIRCRAFT_HOURS',
    });
    await expect(installLegacy(owner, `SC-BLOCK-${randomUUID()}`, 'POS-2')).rejects.toThrow('POSITION_OCCUPIED');
  });
});
