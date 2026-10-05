import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { Transaction } from 'sequelize';
import { pool } from '../../config/database.js';
import { requireDatabaseTestExecutionApproval } from '../../config/databaseTestExecutionSafety.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import {
  Aircraft, AircraftCategory, AircraftComponent, AircraftComponentInstallation,
  AssetType, ComponentModel, Manufacturer, SerializedComponent,
  SerializedComponentLifeState, Tenant, User, sequelize,
} from '../../models/index.js';
import { createTenantQueryAuthority, type TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { serializedComponentReconciliationService } from './serialized-component-reconciliation.service.live.js';

let transaction: Transaction;
let querySpy: MockInstance;
let authorityA: TenantQueryAuthority;
let authorityB: TenantQueryAuthority;
let registrationA: string;
let registrationB: string;
let normalLegacyA: string;
let normalSerializedA: string;
let uninstalledA: string;
let crossSerializedA: string;
let localConflictSerializedA: string;
let safetyBefore: Awaited<ReturnType<typeof safetySnapshot>>;
const suffix = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();

async function safetySnapshot() {
  const migrations = await sequelize.query<{ name: string }>('SELECT name FROM "SequelizeMeta" ORDER BY name', { type: 'SELECT' as never });
  const triggers = await sequelize.query<{ table_name: string; name: string; enabled: string; definition: string }>(`
    SELECT cls.relname AS table_name, tg.tgname AS name, tg.tgenabled AS enabled,
           pg_get_triggerdef(tg.oid, true) AS definition
      FROM pg_trigger tg JOIN pg_class cls ON cls.oid = tg.tgrelid
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
     WHERE ns.nspname = 'public' AND NOT tg.tgisinternal
     ORDER BY cls.relname, tg.tgname`, { type: 'SELECT' as never });
  const totals = await sequelize.query<Record<string, number>>(`SELECT
    (SELECT count(*)::int FROM tenants) AS tenants,
    (SELECT count(*)::int FROM aircraft) AS aircraft,
    (SELECT count(*)::int FROM aircraft_components) AS legacy_components,
    (SELECT count(*)::int FROM serialized_components) AS serialized_components,
    (SELECT count(*)::int FROM aircraft_component_installations) AS installations`, { type: 'SELECT' as never });
  return { migrations: migrations.map(row => row.name), triggers, totals: totals[0] };
}

async function createTenantContext(label: string, modelId: string, categoryId: string) {
  const user = await User.create({ email: `c7d-${label}-${suffix}@example.test`, password_hash: 'test', full_name: `C7D ${label}`, is_active: true }, { transaction });
  const tenant = await Tenant.create({ code: `C7D_${label}_${suffix}`, display_name: `C7D ${label}`, status: 'ACTIVE', created_by_user_id: user.id, updated_by_user_id: user.id }, { transaction });
  const aircraft = await Aircraft.create({ tenant_id: tenant.id, registration: `C7D-${label}-${suffix}`, serial_number: `C7D-SN-${label}-${suffix}`, model_id: modelId, category_id: categoryId, status: 'ACTIVE' }, { transaction });
  const authority = createTenantQueryAuthority({
    state: 'VALID_ACTIVE_TENANT',
    tenant: { id: tenant.id, publicId: tenant.public_id, code: tenant.code, displayName: tenant.display_name, status: 'ACTIVE' },
    membership: { id: randomUUID(), tenantId: tenant.id, userId: user.id, status: 'ACTIVE' },
    validatedAt: Date.now(),
  });
  return { tenant, aircraft, authority };
}

async function createSerialized(tenantId: string, modelId: string, serial: string) {
  return SerializedComponent.create({ custodian_tenant_id: tenantId, component_model_id: modelId, serial_number: serial, status: 'INSTALLED' }, { transaction });
}

beforeAll(async () => {
  requireDatabaseTestExecutionApproval(process.env);
  await assertTestDatabaseSafety(pool);
  safetyBefore = await safetySnapshot();
  transaction = await sequelize.transaction();
  const manufacturer = await Manufacturer.create({ code: `C7DM_${suffix}`, name: `C7D Manufacturer ${suffix}`, is_active: true }, { transaction });
  const assetType = await AssetType.create({ code: `C7DAT_${suffix}`, label: `C7D Asset ${suffix}`, is_active: true }, { transaction });
  const category = await AircraftCategory.create({ code: `C7DAC_${suffix}`, label: `C7D Category ${suffix}`, is_active: true }, { transaction });
  const model = await ComponentModel.create({ model_name: `C7D Model ${suffix}`, model_code: `C7DMOD_${suffix}`, manufacturer_id: manufacturer.id, asset_type_id: assetType.id, is_active: true }, { transaction });
  const a = await createTenantContext('A', model.id, category.id);
  const b = await createTenantContext('B', model.id, category.id);
  authorityA = a.authority;
  authorityB = b.authority;
  registrationA = a.aircraft.registration;
  registrationB = b.aircraft.registration;

  const legacyA = await AircraftComponent.create({ custodian_tenant_id: a.tenant.id, aircraft_id: a.aircraft.id, model_id: model.id, serial_number: `MATCH-A-${suffix}`, installation_date: '2026-09-08', current_status: 'INSTALLED' }, { transaction });
  normalLegacyA = legacyA.id;
  await AircraftComponent.create({ custodian_tenant_id: b.tenant.id, aircraft_id: b.aircraft.id, model_id: model.id, serial_number: `MATCH-B-${suffix}`, installation_date: '2026-09-08', current_status: 'INSTALLED' }, { transaction });

  const serializedA = await createSerialized(a.tenant.id, model.id, `MATCH-A-${suffix}`);
  normalSerializedA = serializedA.id;
  await SerializedComponentLifeState.create({ serialized_component_id: serializedA.id }, { transaction });
  await AircraftComponentInstallation.create({ aircraft_id: a.aircraft.id, serialized_component_id: serializedA.id, installation_context: 'MAINTENANCE_INSTALL', installed_at: '2026-09-08', position: 'ENGINE' }, { transaction });
  const serializedB = await createSerialized(b.tenant.id, model.id, `MATCH-B-${suffix}`);
  await SerializedComponentLifeState.create({ serialized_component_id: serializedB.id }, { transaction });
  await AircraftComponentInstallation.create({ aircraft_id: b.aircraft.id, serialized_component_id: serializedB.id, installation_context: 'MAINTENANCE_INSTALL', installed_at: '2026-09-08', position: 'ENGINE' }, { transaction });

  const uninstalled = await createSerialized(a.tenant.id, model.id, `UNINST-A-${suffix}`);
  uninstalledA = uninstalled.id;
  const crossA = await createSerialized(a.tenant.id, model.id, `CROSS-A-${suffix}`);
  crossSerializedA = crossA.id;
  await AircraftComponentInstallation.create({ aircraft_id: b.aircraft.id, serialized_component_id: crossA.id, installation_context: 'MAINTENANCE_INSTALL', installed_at: '2026-09-08', position: 'FOREIGN-A' }, { transaction });
  const crossB = await createSerialized(b.tenant.id, model.id, `CROSS-B-${suffix}`);
  await AircraftComponentInstallation.create({ aircraft_id: a.aircraft.id, serialized_component_id: crossB.id, installation_context: 'MAINTENANCE_INSTALL', installed_at: '2026-09-08', position: 'FOREIGN-B' }, { transaction });

  const localConflict = await createSerialized(a.tenant.id, model.id, `LOCAL-CONFLICT-${suffix}`);
  localConflictSerializedA = localConflict.id;
  await AircraftComponentInstallation.bulkCreate([
    { aircraft_id: a.aircraft.id, serialized_component_id: localConflict.id, installation_context: 'MAINTENANCE_INSTALL', installed_at: '2026-09-08', position: 'LOCAL-1' },
    { aircraft_id: a.aircraft.id, serialized_component_id: localConflict.id, installation_context: 'MAINTENANCE_INSTALL', installed_at: '2026-09-08', position: 'LOCAL-2' },
  ], { transaction });

  const originalQuery = sequelize.query.bind(sequelize);
  querySpy = vi.spyOn(sequelize, 'query').mockImplementation(((sql: unknown, options: Record<string, unknown> = {}) =>
    originalQuery(sql as never, { ...options, transaction } as never)) as typeof sequelize.query);
});

afterAll(async () => {
  querySpy?.mockRestore();
  if (transaction) await transaction.rollback();
  expect(await safetySnapshot()).toEqual(safetyBefore);
});

describe('MT-4C7D guarded two-tenant reconciliation', () => {
  it('shows only Tenant A authorized roots, counts, and local conflicts', async () => {
    const report = await serializedComponentReconciliationService.getReport(authorityA);
    expect(report.summary).toMatchObject({ total_legacy_rows: 1, active_legacy_rows: 1, total_serialized_components: 4, active_serialized_installations: 3 });
    expect(report.details.some(row => row.legacy_component_id === normalLegacyA && row.serialized_component_id === normalSerializedA)).toBe(true);
    expect(report.details.some(row => row.serialized_component_id === uninstalledA)).toBe(false);
    expect(report.details.some(row => row.serialized_component_id === crossSerializedA)).toBe(false);
    expect(report.details.some(row => row.aircraft_registration === registrationB)).toBe(false);
    expect(report.details.filter(row => row.serialized_component_id === localConflictSerializedA).every(row => row.bucket === 'INSTALLATION_CONFLICT')).toBe(true);
  });

  it('keeps foreign and cross-root data from influencing Tenant A buckets', async () => {
    const report = await serializedComponentReconciliationService.getReport(authorityA);
    expect(report.details).toHaveLength(4);
    expect(report.bucket_counts.MATCHED).toBe(1);
    expect(report.bucket_counts.INSTALLATION_CONFLICT).toBe(2);
    expect(report.bucket_counts.SERIALIZED_ONLY).toBe(1);
    expect(JSON.stringify(report)).not.toContain(registrationB);
    expect(JSON.stringify(report)).not.toContain(crossSerializedA);
  });

  it('mirrors isolation for Tenant B', async () => {
    const report = await serializedComponentReconciliationService.getReport(authorityB);
    expect(report.summary.total_legacy_rows).toBe(1);
    expect(report.summary.active_legacy_rows).toBe(1);
    expect(report.summary.total_serialized_components).toBe(2);
    expect(report.summary.active_serialized_installations).toBe(1);
    expect(JSON.stringify(report)).toContain(registrationB);
    expect(JSON.stringify(report)).not.toContain(registrationA);
  });
});
