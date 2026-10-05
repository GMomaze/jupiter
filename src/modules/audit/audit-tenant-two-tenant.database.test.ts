import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { Transaction } from 'sequelize';
import { pool } from '../../config/database.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import {
  Aircraft,
  AircraftCategory,
  AssetType,
  AuditLog,
  ComponentModel,
  ComplianceItem,
  Customer,
  CustomerAircraftLink,
  Manufacturer,
  TaskCard,
  Tenant,
  User,
  UtilisationEvent,
  Workpack,
  WorkpackSnag,
  WorkpackStatus,
  WorkpackTask,
  sequelize,
} from '../../models/index.js';
import { createTenantQueryAuthority, type TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { AuditService } from './audit.service.js';
import { auditTenantRepository } from './audit-tenant.repository.live.js';

type Context = {
  authority: TenantQueryAuthority;
  userId: string;
  tenantId: string;
  aircraftId: string;
  customerId: string;
  workpackId: string;
  taskId: string;
  linkedSnagId: string;
  standaloneSnagId: string;
  complianceId: string;
  utilisationId: string;
  customerAircraftLinkId: string;
};

const createdIds = new Set<string>();
const auditIds = new Set<string>();
let tenantA: Context;
let tenantB: Context;
let ambiguousTaskId: string;
let missingRootAuditId: string;
let unknownSourceAuditId: string;
let fixtureTransaction: Transaction;
let querySpy: MockInstance;

function remember<T extends { id: string }>(record: T): T {
  createdIds.add(record.id);
  return record;
}

async function createContext(label: string, workpackStatusId: string): Promise<Context> {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  const user = remember(await User.create({
    email: `c7a-${label}-${suffix}@example.test`,
    password_hash: 'test',
    full_name: `C7A ${label}`,
    is_active: true,
  }));
  const tenant = remember(await Tenant.create({
    code: `C7A_${label}_${suffix}`,
    display_name: `C7A ${label}`,
    status: 'ACTIVE',
    created_by_user_id: user.id,
    updated_by_user_id: user.id,
  }));
  const manufacturer = remember(await Manufacturer.create({
    code: `C7AM_${label}_${suffix}`,
    name: `C7A Manufacturer ${label} ${suffix}`,
    is_active: true,
  }));
  const assetType = remember(await AssetType.create({
    code: `C7AT_${label}_${suffix}`,
    label: `C7A Type ${label}`,
    is_active: true,
  }));
  const category = remember(await AircraftCategory.create({
    code: `C7AC_${label}_${suffix}`,
    label: `C7A Category ${label}`,
    is_active: true,
  }));
  const model = remember(await ComponentModel.create({
    model_name: `C7A Model ${label}`,
    model_code: `C7AMOD_${label}_${suffix}`,
    manufacturer_id: manufacturer.id,
    asset_type_id: assetType.id,
    is_active: true,
  }));
  const aircraft = remember(await Aircraft.create({
    tenant_id: tenant.id,
    registration: `C7-${label}-${suffix}`,
    serial_number: `C7-SN-${label}-${suffix}`,
    model_id: model.id,
    category_id: category.id,
    status: 'ACTIVE',
  }));
  const customer = remember(await Customer.create({
    tenant_id: tenant.id,
    name: `C7A Customer ${label}`,
    contact_person: 'C7A',
    email: `c7a-customer-${label}-${suffix}@example.test`,
    phone: '1',
    status: 'ACTIVE',
  }));
  const workpack = remember(await Workpack.create({
    tenant_id: tenant.id,
    work_order_number: `C7A-WP-${label}-${suffix}`,
    aircraft_id: aircraft.id,
    status_id: workpackStatusId,
  }));
  const task = remember(await TaskCard.create({
    task_card_number: `C7A-TASK-${label}-${suffix}`,
    title: `C7A Task ${label}`,
    description: 'tenant audit fixture',
    status: 'OPEN',
    aircraft_id: aircraft.id,
  }));
  await WorkpackTask.create({ workpack_id: workpack.id, task_id: task.id });
  const linkedSnag = remember(await WorkpackSnag.create({
    workpack_id: workpack.id,
    aircraft_id: aircraft.id,
    snag_no: 1,
    defect_text: `C7A linked ${label}`,
    description: `C7A linked ${label}`,
    status: 'OPEN',
  }));
  const standaloneSnag = remember(await WorkpackSnag.create({
    workpack_id: null,
    aircraft_id: aircraft.id,
    snag_no: 2,
    defect_text: `C7A standalone ${label}`,
    description: `C7A standalone ${label}`,
    status: 'OPEN',
  }));
  const complianceItem = remember(await ComplianceItem.create({
    item_type: 'AD',
    code: `C7A-AD-${label}-${suffix}`,
    title: `C7A compliance ${label}`,
    source_type: 'AD',
    source_id: randomUUID(),
    compliance_basis: 'MANUAL',
    status: 'ACTIVE',
  }));
  const complianceId = randomUUID();
  createdIds.add(complianceId);
  await sequelize.query(
    `INSERT INTO aircraft_compliance (id, aircraft_id, compliance_item_id, status)
     VALUES (:id, :aircraftId, :complianceItemId, 'DUE')`,
    { replacements: { id: complianceId, aircraftId: aircraft.id, complianceItemId: complianceItem.id } },
  );
  const utilisation = remember(await UtilisationEvent.create({
    aircraft_id: aircraft.id,
    source_type: 'MANUAL',
    source_reference: null,
    effective_date: '2026-09-07',
    previous_total_time_hours: 0,
    new_total_time_hours: 1,
    delta_hours: 1,
    previous_total_time_cycles: 0,
    new_total_time_cycles: 1,
    delta_cycles: 1,
    reason: 'C7A fixture',
    correction_of_event_id: null,
    actor_id: user.id,
  }));
  const link = remember(await CustomerAircraftLink.create({
    customer_id: customer.id,
    aircraft_id: aircraft.id,
    relationship_type: 'OWNER',
    is_current: true,
    start_date: '2026-09-07',
    end_date: null,
    notes: 'C7A fixture',
  }));
  const authority = createTenantQueryAuthority({
    state: 'VALID_ACTIVE_TENANT',
    tenant: { id: tenant.id, publicId: tenant.public_id, code: tenant.code, displayName: tenant.display_name, status: 'ACTIVE' },
    membership: { id: randomUUID(), tenantId: tenant.id, userId: user.id, status: 'ACTIVE' },
    validatedAt: Date.now(),
  });
  return {
    authority,
    userId: user.id,
    tenantId: tenant.id,
    aircraftId: aircraft.id,
    customerId: customer.id,
    workpackId: workpack.id,
    taskId: task.id,
    linkedSnagId: linkedSnag.id,
    standaloneSnagId: standaloneSnag.id,
    complianceId,
    utilisationId: utilisation.id,
    customerAircraftLinkId: link.id,
  };
}

async function createAudit(table_name: string, row_id: string, label: string, payloadTenantId: string) {
  const audit = remember(await AuditLog.create({
    table_name,
    row_id,
    action: `MT4C7A_${label}`,
    old_values: { tenant_id: payloadTenantId },
    new_values: { tenant_id: payloadTenantId },
  }));
  auditIds.add(audit.id);
  return audit.id;
}

beforeAll(async () => {
  await assertTestDatabaseSafety(pool);
  fixtureTransaction = await sequelize.transaction();
  const originalQuery = sequelize.query.bind(sequelize);
  querySpy = vi.spyOn(sequelize, 'query').mockImplementation(
    ((sql: unknown, options: Record<string, unknown> = {}) =>
      originalQuery(sql as never, { ...options, transaction: fixtureTransaction } as never)) as typeof sequelize.query,
  );
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  const status = remember(await WorkpackStatus.create({ code: `C7AS_${suffix}`, label: 'C7A status' }));
  tenantA = await createContext('A', status.id);
  tenantB = await createContext('B', status.id);

  const roots = (context: Context) => [
    ['aircraft', context.aircraftId],
    ['customers', context.customerId],
    ['workpacks', context.workpackId],
    ['task_cards', context.taskId],
    ['workpack_snags', context.linkedSnagId],
    ['workpack_snags', context.standaloneSnagId],
    ['aircraft_compliance', context.complianceId],
    ['utilisation_events', context.utilisationId],
    ['customer_aircraft_links', context.customerAircraftLinkId],
  ] as const;
  for (const [table, id] of roots(tenantA)) await createAudit(table, id, `A_${table}_${id}`, tenantB.tenantId);
  for (const [table, id] of roots(tenantB)) await createAudit(table, id, `B_${table}_${id}`, tenantA.tenantId);

  const ambiguousTask = remember(await TaskCard.create({
    task_card_number: `C7A-AMB-${suffix}`,
    title: 'C7A ambiguous task',
    description: 'schema-permitted mixed Workpack links',
    status: 'OPEN',
    aircraft_id: tenantA.aircraftId,
  }));
  ambiguousTaskId = ambiguousTask.id;
  await WorkpackTask.bulkCreate([
    { workpack_id: tenantA.workpackId, task_id: ambiguousTask.id },
    { workpack_id: tenantB.workpackId, task_id: ambiguousTask.id },
  ]);
  await createAudit('task_cards', ambiguousTask.id, 'AMBIGUOUS', tenantA.tenantId);
  missingRootAuditId = await createAudit('aircraft', randomUUID(), 'MISSING', tenantA.tenantId);
  unknownSourceAuditId = await createAudit('migration_batches', tenantA.aircraftId, 'UNKNOWN', tenantA.tenantId);
});

afterAll(async () => {
  querySpy?.mockRestore();
  if (fixtureTransaction) await fixtureTransaction.rollback();
});

describe('MT-4C7A guarded two-tenant audit reads', () => {
  it('shows all eight supported mappings for the active tenant and none for the foreign tenant', async () => {
    const rows = await auditTenantRepository.listAuthorized(tenantA.authority);
    const ids = new Set(rows.map(row => row.id));
    const expectedA = [...auditIds].filter(id => {
      const row = rows.find(candidate => candidate.id === id);
      return row?.action.startsWith('MT4C7A_A_');
    });
    expect(expectedA).toHaveLength(9);
    expect(rows.filter(row => row.action.startsWith('MT4C7A_B_'))).toHaveLength(0);
    expect(ids.has(missingRootAuditId)).toBe(false);
    expect(ids.has(unknownSourceAuditId)).toBe(false);
    expect(rows.some(row => row.row_id === ambiguousTaskId)).toBe(false);
  });

  it('keeps list and export populations equivalent for an allowlisted filter', async () => {
    const listRows = await AuditService.getLogs(tenantA.authority, { table_name: 'aircraft' });
    const exportRows = await AuditService.getLogs(tenantA.authority, { table_name: 'aircraft' });
    expect(exportRows.map(row => row.id)).toEqual(listRows.map(row => row.id));
    expect(listRows.some(row => row.action.startsWith('MT4C7A_A_aircraft_'))).toBe(true);
    expect(listRows.some(row => row.action.startsWith('MT4C7A_B_aircraft_'))).toBe(false);
  });

  it('default-denies unsupported and adversarial source filters', async () => {
    expect(await AuditService.getLogs(tenantA.authority, { table_name: 'migration_batches' })).toEqual([]);
    expect(await AuditService.getLogs(tenantA.authority, { table_name: 'AIRCRAFT; --' })).toEqual([]);
    const foreignAircraft = await AuditService.getLogs(tenantA.authority, { table_name: 'aircraft' });
    expect(foreignAircraft.some(row => row.action.startsWith('MT4C7A_B_'))).toBe(false);
  });
});
