import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { Transaction } from 'sequelize';
import { pool } from '../../config/database.js';
import { requireDatabaseTestExecutionApproval } from '../../config/databaseTestExecutionSafety.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import {
  Aircraft, AircraftCategory, AssetType, ComplianceItem, ComponentModel, Customer,
  CustomerAircraftLink, CustomerUser, Manufacturer, Tenant, User, Workpack,
  WorkpackStatus, sequelize,
} from '../../models/index.js';
import { createCustomerPortalQueryAuthority } from './customer-portal-query-authority.js';
import { customerPortalRepository } from './customer-portal.repository.live.js';
import { customerPortalService } from './customer-portal.service.js';

let transaction: Transaction;
let querySpy: MockInstance;
const createdIds: string[] = [];
const suffix = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
let authorityA: ReturnType<typeof createCustomerPortalQueryAuthority>;
let aircraftAId: string;
let aircraftBId: string;
let workpackAId: string;
let workpackBId: string;
let conflictWorkpackId: string;
let complianceAId: string;
let complianceBId: string;
let safetyBefore: { migrations: string[]; triggers: unknown[] };

function remember<T extends { id: string }>(row: T): T {
  createdIds.push(row.id);
  return row;
}

async function safetySnapshot() {
  const migrations = await sequelize.query<{ name: string }>(
    'SELECT name FROM "SequelizeMeta" ORDER BY name', { type: 'SELECT' as never },
  );
  const triggers = await sequelize.query<{ name: string; enabled: string; definition: string }>(`
    SELECT tg.tgname AS name, tg.tgenabled AS enabled,
           pg_get_triggerdef(tg.oid, true) AS definition
    FROM pg_trigger tg
    JOIN pg_class cls ON cls.oid = tg.tgrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    WHERE ns.nspname = 'public' AND NOT tg.tgisinternal
    ORDER BY cls.relname, tg.tgname
  `, { type: 'SELECT' as never });
  return { migrations: migrations.map((row) => row.name), triggers };
}

async function createContext(label: string, statusId: string) {
  const user = remember(await User.create({
    email: `mt4c7c-${label}-${suffix}@example.test`, password_hash: 'test',
    full_name: `MT4C7C ${label}`, is_active: true,
  }, { transaction }));
  const tenant = remember(await Tenant.create({
    code: `MT4C7C_${label}_${suffix}`, display_name: `MT4C7C ${label}`, status: 'ACTIVE',
    created_by_user_id: user.id, updated_by_user_id: user.id,
  }, { transaction }));
  const manufacturer = remember(await Manufacturer.create({
    code: `MT4C7CM_${label}_${suffix}`, name: `MT4C7C Manufacturer ${label}`,
    is_active: true,
  }, { transaction }));
  const assetType = remember(await AssetType.create({
    code: `MT4C7CAT_${label}_${suffix}`, label: `MT4C7C Asset ${label}`, is_active: true,
  }, { transaction }));
  const category = remember(await AircraftCategory.create({
    code: `MT4C7CAC_${label}_${suffix}`, label: `MT4C7C Category ${label}`, is_active: true,
  }, { transaction }));
  const model = remember(await ComponentModel.create({
    model_name: `MT4C7C Model ${label}`, model_code: `MT4C7CMOD_${label}_${suffix}`,
    manufacturer_id: manufacturer.id, asset_type_id: assetType.id, is_active: true,
  }, { transaction }));
  const aircraft = remember(await Aircraft.create({
    tenant_id: tenant.id, registration: `C7C-${label}-${suffix}`,
    serial_number: `C7C-SN-${label}-${suffix}`, model_id: model.id,
    category_id: category.id, status: 'ACTIVE',
  }, { transaction }));
  const customer = remember(await Customer.create({
    tenant_id: tenant.id, name: `MT4C7C Customer ${label}`, contact_person: label,
    email: `mt4c7c-customer-${label}-${suffix}@example.test`, phone: '1', status: 'ACTIVE',
  }, { transaction }));
  const customerUser = remember(await CustomerUser.create({
    customer_id: customer.id, email: `mt4c7c-portal-${label}-${suffix}@example.test`,
    display_name: `Portal ${label}`, password_hash: 'test', status: 'ACTIVE',
  }, { transaction }));
  const workpack = remember(await Workpack.create({
    tenant_id: tenant.id, work_order_number: `C7C-WP-${label}-${suffix}`,
    aircraft_id: aircraft.id, status_id: statusId, released_at: new Date(),
  }, { transaction }));
  const item = remember(await ComplianceItem.create({
    item_type: 'AD', code: `C7C-AD-${label}-${suffix}`, title: `Compliance ${label}`,
    source_type: 'AD', source_id: randomUUID(), compliance_basis: 'MANUAL', status: 'ACTIVE',
  }, { transaction }));
  const workpackComplianceId = randomUUID();
  createdIds.push(workpackComplianceId);
  await sequelize.query(`
    INSERT INTO workpack_compliance
      (id, workpack_id, compliance_item_id, status, completed_at, created_at, updated_at)
    VALUES (:id, :workpackId, :itemId, 'COMPLETED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, { replacements: { id: workpackComplianceId, workpackId: workpack.id, itemId: item.id }, transaction });
  return { tenant, aircraft, customer, customerUser, workpack, item };
}

beforeAll(async () => {
  requireDatabaseTestExecutionApproval(process.env);
  await assertTestDatabaseSafety(pool);
  safetyBefore = await safetySnapshot();
  transaction = await sequelize.transaction();
  const status = remember(await WorkpackStatus.create({
    code: `C7CS_${suffix}`, label: 'MT4C7C status',
  }, { transaction }));
  const a = await createContext('A', status.id);
  const b = await createContext('B', status.id);
  aircraftAId = a.aircraft.id;
  aircraftBId = b.aircraft.id;
  workpackAId = a.workpack.id;
  workpackBId = b.workpack.id;
  complianceAId = a.item.id;
  complianceBId = b.item.id;
  authorityA = createCustomerPortalQueryAuthority({
    customerUserId: a.customerUser.id, customerId: a.customer.id, tenantId: a.tenant.id,
  });
  remember(await CustomerAircraftLink.create({
    customer_id: a.customer.id, aircraft_id: a.aircraft.id, relationship_type: 'OWNER',
    is_current: true, start_date: '2026-09-08',
  }, { transaction }));
  remember(await CustomerAircraftLink.create({
    customer_id: b.customer.id, aircraft_id: b.aircraft.id, relationship_type: 'OWNER',
    is_current: true, start_date: '2026-09-08',
  }, { transaction }));
  remember(await CustomerAircraftLink.create({
    customer_id: a.customer.id, aircraft_id: b.aircraft.id, relationship_type: 'OPERATOR',
    is_current: true, start_date: '2026-09-08', notes: 'deliberate cross-tenant fixture',
  }, { transaction }));
  const conflict = remember(await Workpack.create({
    tenant_id: b.tenant.id, work_order_number: `C7C-CONFLICT-${suffix}`,
    aircraft_id: a.aircraft.id, status_id: status.id, released_at: new Date(),
  }, { transaction }));
  conflictWorkpackId = conflict.id;

  const originalQuery = sequelize.query.bind(sequelize);
  querySpy = vi.spyOn(sequelize, 'query').mockImplementation(
    ((sql: unknown, options: Record<string, unknown> = {}) =>
      originalQuery(sql as never, { ...options, transaction } as never)) as typeof sequelize.query,
  );
});

afterAll(async () => {
  querySpy?.mockRestore();
  if (transaction) await transaction.rollback();
  const [residue] = await sequelize.query<{ count: number }>(`
    SELECT (
      (SELECT count(*) FROM users WHERE id IN (:ids)) +
      (SELECT count(*) FROM tenants WHERE id IN (:ids)) +
      (SELECT count(*) FROM customers WHERE id IN (:ids)) +
      (SELECT count(*) FROM customer_users WHERE id IN (:ids)) +
      (SELECT count(*) FROM aircraft WHERE id IN (:ids)) +
      (SELECT count(*) FROM customer_aircraft_links WHERE id IN (:ids)) +
      (SELECT count(*) FROM workpacks WHERE id IN (:ids)) +
      (SELECT count(*) FROM workpack_compliance WHERE id IN (:ids))
    )::int AS count
  `, { replacements: { ids: createdIds } });
  expect(Number(residue?.count ?? 0)).toBe(0);
  expect(await safetySnapshot()).toEqual(safetyBefore);
});

describe('MT-4C7C guarded Customer Portal tenant isolation', () => {
  it('re-resolves the active persisted identity and rejects missing roots', async () => {
    const identity = await customerPortalRepository.resolveIdentity(authorityA.customerUserId);
    expect(identity).toMatchObject({ customerId: authorityA.customerId, tenantId: authorityA.tenantId });
    expect(await customerPortalRepository.resolveIdentity(randomUUID())).toBeUndefined();
    expect(await customerPortalService.getIdentity(authorityA)).toMatchObject({ customerId: authorityA.customerId });
  });

  it('shows same-tenant Aircraft and excludes the malformed foreign link', async () => {
    const aircraft = await customerPortalService.listAircraft(authorityA);
    expect(aircraft.map((row) => row.id)).toContain(aircraftAId);
    expect(aircraft.map((row) => row.id)).not.toContain(aircraftBId);
  });

  it('keeps Workpack, document, and compliance projections on identical roots', async () => {
    const workpacks = await customerPortalService.listWorkpacks(authorityA);
    const documents = await customerPortalService.listReleasedDocuments(authorityA);
    const compliance = await customerPortalService.listCompletedCompliance(authorityA);
    expect(workpacks.map((row) => row.id)).toContain(workpackAId);
    expect(workpacks.map((row) => row.id)).not.toContain(workpackBId);
    expect(workpacks.map((row) => row.id)).not.toContain(conflictWorkpackId);
    expect(documents.map((row) => row.id)).toContain(`release-summary:${workpackAId}`);
    expect(documents.map((row) => row.id)).not.toContain(`release-summary:${workpackBId}`);
    expect(compliance.some((row) => row.id === `${workpackAId}:${complianceAId}`)).toBe(true);
    expect(compliance.some((row) => row.id === `${workpackBId}:${complianceBId}`)).toBe(false);
  });
});
