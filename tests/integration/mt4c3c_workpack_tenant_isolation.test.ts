import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Transaction } from 'sequelize';
import {
  Aircraft, AircraftCategory, ComponentModel, Manufacturer, AssetType, TaskCard,
  Tenant, User, Workpack, WorkpackSnag, WorkpackSnagAuditLog, WorkpackStatus,
  WorkpackTask, sequelize,
} from '../../src/models/index.js';
import { createTenantQueryAuthority } from '../../src/modules/tenancy/tenant-query-authority.js';
import { workpackTenantRepository } from '../../src/modules/workpacks/workpack-tenant.repository.js';
import { WorkpackAuditService } from '../../src/modules/workpacks/services/workpack-audit.service.js';

function authority(tenantId: string, userId: string) {
  return createTenantQueryAuthority({
    state: 'VALID_ACTIVE_TENANT',
    tenant: { id: tenantId, publicId: randomUUID(), code: 'LIVE', displayName: 'Live', status: 'ACTIVE' },
    membership: { id: randomUUID(), tenantId, userId, status: 'ACTIVE' },
    validatedAt: Date.now(),
  });
}

describe('MT-4C3C Workpack aggregate live isolation', () => {
  let transaction: Transaction;
  let tenantA: Tenant;
  let tenantB: Tenant;
  let user: User;
  let aircraftA: Aircraft;
  let aircraftB: Aircraft;
  let workpackA: Workpack;
  let workpackB: Workpack;

  beforeEach(async () => {
    transaction = await sequelize.transaction();
    const suffix = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
    user = await User.create({ id: randomUUID(), email: `${suffix}@test.local`, password_hash: 'hash', full_name: '4C3C', is_active: true }, { transaction });
    tenantA = await Tenant.create({ id: randomUUID(), public_id: randomUUID(), code: `A_${suffix}`, display_name: 'Tenant A', status: 'ACTIVE', created_by_user_id: user.id, updated_by_user_id: user.id }, { transaction });
    tenantB = await Tenant.create({ id: randomUUID(), public_id: randomUUID(), code: `B_${suffix}`, display_name: 'Tenant B', status: 'ACTIVE', created_by_user_id: user.id, updated_by_user_id: user.id }, { transaction });
    const manufacturer = await Manufacturer.create({ id: randomUUID(), code: `M${suffix}`, name: `M ${suffix}`, is_active: true }, { transaction });
    const assetType = await AssetType.create({ id: randomUUID(), code: `T${suffix}`, label: `T ${suffix}` }, { transaction });
    const model = await ComponentModel.create({ id: randomUUID(), model_name: `Model ${suffix}`, model_code: `M${suffix}`, manufacturer_id: manufacturer.id, asset_type_id: assetType.id, is_active: true }, { transaction });
    const category = await AircraftCategory.create({ id: randomUUID(), code: `C${suffix}`, label: `C ${suffix}`, is_active: true }, { transaction });
    aircraftA = await Aircraft.create({ id: randomUUID(), tenant_id: tenantA.id, registration: `A-${suffix}`, serial_number: `A-${suffix}`, model_id: model.id, category_id: category.id, status: 'REGISTERED' }, { transaction });
    aircraftB = await Aircraft.create({ id: randomUUID(), tenant_id: tenantB.id, registration: `B-${suffix}`, serial_number: `B-${suffix}`, model_id: model.id, category_id: category.id, status: 'REGISTERED' }, { transaction });
    const status = await WorkpackStatus.create({ id: randomUUID(), code: `D${suffix}`, label: 'Draft' }, { transaction });
    workpackA = await Workpack.create({ id: randomUUID(), tenant_id: tenantA.id, work_order_number: `A-${suffix}`, aircraft_id: aircraftA.id, status_id: status.id }, { transaction });
    workpackB = await Workpack.create({ id: randomUUID(), tenant_id: tenantB.id, work_order_number: `B-${suffix}`, aircraft_id: aircraftB.id, status_id: status.id }, { transaction });
  });

  afterEach(async () => transaction.rollback());

  it('keeps Workpack and standalone/linked snag roots neutral across tenants', async () => {
    const authorityA = authority(tenantA.id, user.id);
    const standaloneA = await WorkpackSnag.create({ id: randomUUID(), workpack_id: null, aircraft_id: aircraftA.id, snag_no: 1, defect_text: 'A', description: 'A', status: 'OPEN', created_by: user.id }, { transaction });
    const linkedB = await WorkpackSnag.create({ id: randomUUID(), workpack_id: workpackB.id, aircraft_id: aircraftB.id, snag_no: 1, defect_text: 'B', description: 'B', status: 'OPEN', created_by: user.id }, { transaction });

    expect(await workpackTenantRepository.getById(authorityA, workpackA.id, { transaction })).toBeDefined();
    expect(await workpackTenantRepository.getById(authorityA, workpackB.id, { transaction })).toBeUndefined();
    expect(await workpackTenantRepository.getSnagById(authorityA, standaloneA.id, { transaction })).toBeDefined();
    expect(await workpackTenantRepository.getSnagById(authorityA, linkedB.id, { transaction })).toBeUndefined();
  });

  it('retains standalone snag audit history with a null workpack relationship', async () => {
    const snag = await WorkpackSnag.create({ id: randomUUID(), workpack_id: null, aircraft_id: aircraftA.id, snag_no: 2, defect_text: 'standalone', description: 'standalone', status: 'OPEN', created_by: user.id }, { transaction });
    const audit = await WorkpackSnagAuditLog.create({ snag_id: snag.id, workpack_id: null, user_id: user.id, action: 'SNAG_CREATED', old_value: {}, new_value: {}, metadata: {}, previous_hash: '', hash: randomUUID(), sequence: 1 }, { transaction });
    expect(audit.workpack_id).toBeNull();
    expect(await WorkpackAuditService.getSnagAuditEntries(
      authority(tenantA.id, user.id), snag.id, transaction
    )).toHaveLength(1);
    expect(await WorkpackAuditService.getSnagAuditEntries(
      authority(tenantB.id, user.id), snag.id, transaction
    )).toEqual([]);
  });

  it('makes cross-tenant ambiguous TaskCards unavailable to every tenant', async () => {
    const task = await TaskCard.create({ id: randomUUID(), task_card_number: `TC-${randomUUID()}`, title: 'Ambiguous', description: 'Ambiguous', aircraft_id: aircraftA.id, status: 'OPEN' }, { transaction });
    await WorkpackTask.bulkCreate([{ workpack_id: workpackA.id, task_id: task.id }, { workpack_id: workpackB.id, task_id: task.id }], { transaction });
    expect(await workpackTenantRepository.getTaskCardById(authority(tenantA.id, user.id), task.id, { transaction })).toBeUndefined();
    expect(await workpackTenantRepository.getTaskCardById(authority(tenantB.id, user.id), task.id, { transaction })).toBeUndefined();
  });
});
