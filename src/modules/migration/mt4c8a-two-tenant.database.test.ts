import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { Transaction } from 'sequelize';
import { pool } from '../../config/database.js';
import { requireDatabaseTestExecutionApproval } from '../../config/databaseTestExecutionSafety.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import {
  Aircraft, AircraftCategory, AircraftComponent, AircraftComponentInstallation, AssetType, ComponentModel,
  Manufacturer, MigrationBatch, SerializedComponent, Tenant, User, sequelize,
} from '../../models/index.js';
import { createTenantQueryAuthority, type TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { MigrationDryRunService } from './migration-dry-run.service.js';
import { MigrationLedgerService } from './migration-ledger.service.js';

let transaction: Transaction;
let querySpy: MockInstance;
let transactionSpy: MockInstance;
let authorityA: TenantQueryAuthority;
let authorityB: TenantQueryAuthority;
let legacyA: string;
let registrationB: string;
let safetyBefore: unknown;
const suffix = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();

async function snapshot() {
  const [identity] = await sequelize.query('SELECT current_database() AS database, current_user AS user');
  const [totals] = await sequelize.query(`SELECT
    (SELECT count(*)::int FROM migration_batches) AS batches,
    (SELECT count(*)::int FROM migration_batch_rows) AS rows,
    (SELECT count(*)::int FROM audit_log WHERE table_name = 'migration_batches') AS audits`);
  return { identity: identity[0], totals: totals[0] };
}

async function tenantContext(label: string, modelId: string, categoryId: string) {
  const user = await User.create({ email: `c8a-${label}-${suffix}@example.test`, password_hash: 'test', full_name: `C8A ${label}`, is_active: true }, { transaction });
  const tenant = await Tenant.create({ code: `C8A_${label}_${suffix}`, display_name: `C8A ${label}`, status: 'ACTIVE', created_by_user_id: user.id, updated_by_user_id: user.id }, { transaction });
  const aircraft = await Aircraft.create({ tenant_id: tenant.id, registration: `C8A-${label}-${suffix}`, serial_number: `C8A-SN-${label}-${suffix}`, model_id: modelId, category_id: categoryId, status: 'ACTIVE' }, { transaction });
  const authority = createTenantQueryAuthority({ state: 'VALID_ACTIVE_TENANT', tenant: { id: tenant.id, publicId: tenant.public_id, code: tenant.code, displayName: tenant.display_name, status: 'ACTIVE' }, membership: { id: randomUUID(), tenantId: tenant.id, userId: user.id, status: 'ACTIVE' }, validatedAt: Date.now() });
  return { user, tenant, aircraft, authority };
}

beforeAll(async () => {
  requireDatabaseTestExecutionApproval(process.env);
  await assertTestDatabaseSafety(pool);
  safetyBefore = await snapshot();
  transaction = await sequelize.transaction();
  const manufacturer = await Manufacturer.create({ code: `C8AM_${suffix}`, name: `C8A Manufacturer ${suffix}`, is_active: true }, { transaction });
  const assetType = await AssetType.create({ code: `C8AT_${suffix}`, label: `C8A Asset ${suffix}`, is_active: true, is_installable_on_aircraft: true }, { transaction });
  const category = await AircraftCategory.create({ code: `C8AC_${suffix}`, label: `C8A Category ${suffix}`, is_active: true }, { transaction });
  const model = await ComponentModel.create({ model_name: `C8A Model ${suffix}`, model_code: `C8AMOD_${suffix}`, manufacturer_id: manufacturer.id, asset_type_id: assetType.id, is_active: true }, { transaction });
  const a = await tenantContext('A', model.id, category.id);
  const b = await tenantContext('B', model.id, category.id);
  authorityA = a.authority;
  authorityB = b.authority;
  registrationB = b.aircraft.registration;
  const componentA = await AircraftComponent.create({ custodian_tenant_id: a.tenant.id, aircraft_id: a.aircraft.id, model_id: model.id, serial_number: `A-${suffix}`, installation_date: '2026-09-09', current_status: 'INSTALLED' }, { transaction });
  legacyA = componentA.id;
  await AircraftComponent.create({ custodian_tenant_id: b.tenant.id, aircraft_id: b.aircraft.id, model_id: model.id, serial_number: `B-${suffix}`, installation_date: '2026-09-09', current_status: 'INSTALLED' }, { transaction });
  await SerializedComponent.create({ custodian_tenant_id: a.tenant.id, component_model_id: model.id, serial_number: `UNINST-A-${suffix}`, status: 'AVAILABLE' }, { transaction });
  await SerializedComponent.create({ custodian_tenant_id: b.tenant.id, component_model_id: model.id, serial_number: `A-${suffix}`, status: 'AVAILABLE' }, { transaction });
  const crossRoot = await SerializedComponent.create({ custodian_tenant_id: a.tenant.id, component_model_id: model.id, serial_number: `CROSS-A-${suffix}`, status: 'INSTALLED' }, { transaction });
  await AircraftComponentInstallation.create({ aircraft_id: b.aircraft.id, serialized_component_id: crossRoot.id, installation_context: 'MAINTENANCE_INSTALL', installed_at: '2026-09-09', position: 'FOREIGN' }, { transaction });
  const originalQuery = sequelize.query.bind(sequelize);
  querySpy = vi.spyOn(sequelize, 'query').mockImplementation(((sql: unknown, options: Record<string, unknown> = {}) => originalQuery(sql as never, { ...options, transaction } as never)) as typeof sequelize.query);
  transactionSpy = vi.spyOn(sequelize, 'transaction').mockImplementation((async (callback: any) => callback(transaction)) as any);
});

afterAll(async () => {
  transactionSpy?.mockRestore();
  querySpy?.mockRestore();
  if (transaction) await transaction.rollback();
  expect(await snapshot()).toEqual(safetyBefore);
});

describe('MT-4C8A guarded two-tenant workflow', () => {
  it('keeps preview inputs, proposals, conflicts, and counts tenant-local', async () => {
    const report = await MigrationDryRunService.previewLegacyAircraftComponentMigration(authorityA);
    expect(report.summary.source_rows_evaluated).toBe(1);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]?.source.id).toBe(legacyA);
    expect(JSON.stringify(report)).not.toContain(registrationB);
    expect(JSON.stringify(report)).not.toContain(`B-${suffix}`);
    expect(JSON.stringify(report)).not.toContain(`CROSS-A-${suffix}`);
  });

  it('saves authoritative ownership and prevents cross-tenant batch IDOR', async () => {
    const report = await MigrationDryRunService.previewLegacyAircraftComponentMigration(authorityA);
    const batch = await MigrationLedgerService.saveLegacyAircraftComponentDryRun(authorityA, { report, actor_id: null });
    expect(batch.tenant_id).toBe(authorityA.tenantId);
    const own = await MigrationLedgerService.getSavedDryRunBatch(authorityA, batch.id);
    expect(own?.Rows).toHaveLength(1);
    expect(await MigrationLedgerService.getSavedDryRunBatch(authorityB, batch.id)).toBeNull();
    expect(await MigrationLedgerService.getSavedDryRunBatch(authorityA, 'malformed')).toBeNull();
  });

  it('rejects fabricated authority and immutable ownership changes', async () => {
    await expect(MigrationDryRunService.previewLegacyAircraftComponentMigration({ tenantId: authorityA.tenantId } as any)).rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    const batch = await MigrationBatch.findOne({ where: { tenant_id: authorityA.tenantId }, transaction });
    await expect(batch!.update({ tenant_id: authorityB.tenantId }, { transaction })).rejects.toThrow(/MIGRATION_BATCH_TENANT_IMMUTABLE/);
  });
});
