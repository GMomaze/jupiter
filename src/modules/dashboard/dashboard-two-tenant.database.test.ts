import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import { pool } from '../../config/database.js';
import {
  Aircraft,
  AircraftCategory,
  AssetType,
  ComponentModel,
  Customer,
  Manufacturer,
  SerializedComponent,
  Tenant,
  User,
  Workpack,
  WorkpackSnag,
  WorkpackStatus,
} from '../../models/index.js';
import { createTenantQueryAuthority, type TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { dashboardTenantRepository } from './dashboard-tenant.repository.live.js';

type Fixture = { authority: TenantQueryAuthority; aircraft: Aircraft; workpack: Workpack };
let tenantA: Fixture;
let tenantB: Fixture;
let statusId: string;

async function createFixture(label: string): Promise<Fixture> {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  const user = await User.create({ email: `c5-${label}-${suffix}@example.test`, password_hash: 'test', full_name: `C5 ${label}`, is_active: true });
  const tenant = await Tenant.create({ code: `C5_${label}_${suffix}`, display_name: `C5 ${label}`, status: 'ACTIVE', created_by_user_id: user.id, updated_by_user_id: user.id });
  const authority = createTenantQueryAuthority({
    state: 'VALID_ACTIVE_TENANT',
    tenant: { id: tenant.id, publicId: tenant.public_id, code: tenant.code, displayName: tenant.display_name, status: 'ACTIVE' },
    membership: { id: randomUUID(), tenantId: tenant.id, userId: user.id, status: 'ACTIVE' },
    validatedAt: Date.now(),
  });
  const manufacturer = await Manufacturer.create({ code: `C5M_${label}_${suffix}`, name: `C5 Manufacturer ${label} ${suffix}`, is_active: true });
  const assetType = await AssetType.create({ code: `C5T_${label}_${suffix}`, label: `C5 Type ${label}`, is_active: true });
  const category = await AircraftCategory.create({ code: `C5C_${label}_${suffix}`, label: `C5 Category ${label}`, is_active: true });
  const model = await ComponentModel.create({ model_name: `C5 Model ${label}`, model_code: `C5MOD_${label}_${suffix}`, manufacturer_id: manufacturer.id, asset_type_id: assetType.id, is_active: true });
  const aircraft = await Aircraft.create({ registration: `C5-${label}-${suffix}`, serial_number: `C5-${label}-${suffix}`, model_id: model.id, category_id: category.id, status: 'ACTIVE', tenant_id: tenant.id });
  await Customer.create({ tenant_id: tenant.id, name: `C5 Customer ${label}`, contact_person: 'C5', email: `customer-${suffix}@example.test`, phone: '1', status: 'ACTIVE' });
  await SerializedComponent.create({ custodian_tenant_id: tenant.id, component_model_id: model.id, serial_number: `C5-SC-${label}-${suffix}`, status: 'AVAILABLE' });
  const workpack = await Workpack.create({ tenant_id: tenant.id, work_order_number: `C5-WP-${label}-${suffix}`, aircraft_id: aircraft.id, status_id: statusId });
  return { authority, aircraft, workpack };
}

beforeAll(async () => {
  await assertTestDatabaseSafety(pool);
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  statusId = (await WorkpackStatus.create({ code: `C5S_${suffix}`, label: 'C5 status' })).id;
  tenantA = await createFixture('A');
  tenantB = await createFixture('B');
  await WorkpackSnag.create({ workpack_id: tenantA.workpack.id, aircraft_id: tenantA.aircraft.id, snag_no: 1, defect_text: 'linked A', description: 'linked A', status: 'OPEN' });
  await WorkpackSnag.create({ workpack_id: tenantB.workpack.id, aircraft_id: tenantB.aircraft.id, snag_no: 1, defect_text: 'linked B', description: 'linked B', status: 'OPEN' });
  await WorkpackSnag.create({ workpack_id: null, aircraft_id: tenantA.aircraft.id, snag_no: 2, defect_text: 'standalone A', description: 'standalone A', status: 'OPEN' });
  await WorkpackSnag.create({ workpack_id: null, aircraft_id: tenantB.aircraft.id, snag_no: 2, defect_text: 'standalone B', description: 'standalone B', status: 'OPEN' });
});

describe('MT-4C5 guarded two-tenant dashboard aggregates', () => {
  it('counts every protected root for only the active tenant', async () => {
    await expect(Promise.all([
      dashboardTenantRepository.countAircraft(tenantA.authority, 'ACTIVE'),
      dashboardTenantRepository.countCustomers(tenantA.authority, 'ACTIVE'),
      dashboardTenantRepository.countSerializedComponents(tenantA.authority),
      dashboardTenantRepository.countWorkpacks(tenantA.authority, statusId, 'EQUALS'),
    ])).resolves.toEqual([1, 1, 1, 1]);
    await expect(Promise.all([
      dashboardTenantRepository.countAircraft(tenantB.authority, 'ACTIVE'),
      dashboardTenantRepository.countCustomers(tenantB.authority, 'ACTIVE'),
      dashboardTenantRepository.countSerializedComponents(tenantB.authority),
      dashboardTenantRepository.countWorkpacks(tenantB.authority, statusId, 'EQUALS'),
    ])).resolves.toEqual([1, 1, 1, 1]);
  });

  it('counts linked and standalone snags through their respective owned roots', async () => {
    expect(await dashboardTenantRepository.countOpenSnags(tenantA.authority)).toBe(2);
    expect(await dashboardTenantRepository.countOpenSnags(tenantB.authority)).toBe(2);
  });

  it('rejects non-authentic authority without querying tenant data', async () => {
    await expect(dashboardTenantRepository.countAircraft({ tenantId: tenantA.authority.tenantId } as never))
      .rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
  });
});
