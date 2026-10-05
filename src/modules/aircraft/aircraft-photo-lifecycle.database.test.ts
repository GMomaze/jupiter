import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { Transaction } from 'sequelize';
import { pool } from '../../config/database.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import { requireDatabaseTestExecutionApproval } from '../../config/databaseTestExecutionSafety.js';
import { Aircraft, AircraftCategory, ComponentModel, Tenant, User, sequelize } from '../../models/index.js';
import { createTenantQueryAuthority, type TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { AIRCRAFT_UPLOAD_ROOT } from '../uploads/upload-delivery.service.js';
import { AircraftService } from './aircraft.service.js';
import { createAircraftPhotoLifecycle } from './aircraft-photo-lifecycle.middleware.js';

let transaction: Transaction;
let transactionSpy: MockInstance;
let authorityA: TenantQueryAuthority;
let authorityB: TenantQueryAuthority;
let modelId: string;
let categoryId: string;
let aircraftA: Aircraft;
let aircraftB: Aircraft;
let beforeSnapshot: unknown;
const files = new Set<string>();
const suffix = randomUUID().slice(0, 8);

async function snapshot() {
  const [rows] = await sequelize.query(`SELECT
    current_database() database, current_user db_user,
    (SELECT count(*)::int FROM aircraft) aircraft,
    (SELECT count(*)::int FROM migration_batches) batches,
    (SELECT count(*)::int FROM migration_batch_rows) batch_rows,
    (SELECT count(*)::int FROM audit_log WHERE table_name = 'aircraft') aircraft_audits,
    (SELECT count(*)::int FROM pg_trigger WHERE NOT tgisinternal AND tgenabled <> 'D') enabled_triggers`);
  return rows[0];
}

function authority(tenant: Tenant, user: User) {
  return createTenantQueryAuthority({
    state: 'VALID_ACTIVE_TENANT',
    tenant: { id: tenant.id, publicId: tenant.public_id, code: tenant.code, displayName: tenant.display_name, status: 'ACTIVE' },
    membership: { id: randomUUID(), tenantId: tenant.id, userId: user.id, status: 'ACTIVE' },
    validatedAt: Date.now(),
  });
}

async function upload(label: string) {
  const filename = `${randomUUID()}-${label}.png`;
  const target = path.join(AIRCRAFT_UPLOAD_ROOT, filename);
  await fs.writeFile(target, label);
  files.add(target);
  const lifecycle = createAircraftPhotoLifecycle({ fileSystem: fs, uploadRoot: AIRCRAFT_UPLOAD_ROOT });
  const req: any = { file: { filename, destination: AIRCRAFT_UPLOAD_ROOT, path: target } };
  const res: any = new EventEmitter();
  lifecycle.begin(req, res, vi.fn());
  lifecycle.track(req, res, vi.fn());
  return { filename, target, reference: `/uploads/aircraft/${filename}`, lifecycle, req, res };
}

async function expectRemoved(target: string) {
  await vi.waitFor(async () => expect(fs.access(target)).rejects.toThrow());
  files.delete(target);
}

beforeAll(async () => {
  requireDatabaseTestExecutionApproval(process.env);
  await assertTestDatabaseSafety(pool);
  beforeSnapshot = await snapshot();
  transaction = await sequelize.transaction();
  const model = await ComponentModel.findOne({ attributes: ['id'], transaction });
  const category = await AircraftCategory.findOne({ attributes: ['id'], transaction });
  if (!model || !category) throw new Error('AIRCRAFT_PHOTO_REFERENCE_FIXTURES_REQUIRED');
  modelId = model.id;
  categoryId = category.id;
  const user = await User.create({ email: `photo-${suffix}@example.test`, password_hash: 'test', full_name: 'Photo Test', is_active: true }, { transaction });
  const tenantA = await Tenant.create({ code: `PHOTO_A_${suffix}`, display_name: 'Photo A', status: 'ACTIVE', created_by_user_id: user.id, updated_by_user_id: user.id }, { transaction });
  const tenantB = await Tenant.create({ code: `PHOTO_B_${suffix}`, display_name: 'Photo B', status: 'ACTIVE', created_by_user_id: user.id, updated_by_user_id: user.id }, { transaction });
  authorityA = authority(tenantA, user);
  authorityB = authority(tenantB, user);
  transactionSpy = vi.spyOn(sequelize, 'transaction').mockImplementation((async (callback: any) => callback(transaction)) as any);
  aircraftB = await Aircraft.create({ tenant_id: tenantB.id, registration: `PB-${suffix}`, serial_number: `PBS-${suffix}`, model_id: modelId, category_id: categoryId, status: 'ACTIVE', photo_url: null }, { transaction });
});

afterAll(async () => {
  transactionSpy?.mockRestore();
  if (transaction) await transaction.rollback();
  await Promise.allSettled([...files].map(file => fs.unlink(file)));
  expect(await snapshot()).toEqual(beforeSnapshot);
  for (const file of files) await expect(fs.access(file)).rejects.toThrow();
});

describe('Level 1 guarded Aircraft photo persistence lifecycle', () => {
  it('retains successful Tenant A create and update photos with matching references', async () => {
    const created = await upload('create');
    aircraftA = await AircraftService.create(authorityA, {
      registration: `PA-${suffix}`, serial_number: `PAS-${suffix}`, model_id: modelId, category_id: categoryId, photo_url: created.reference,
    }) as Aircraft;
    created.lifecycle.commit(created.req);
    created.res.emit('finish');
    await expect(fs.access(created.target)).resolves.toBeUndefined();
    expect(aircraftA.photo_url).toBe(created.reference);

    const updated = await upload('update');
    await AircraftService.updateDetails(authorityA, aircraftA.id, {
      registration: aircraftA.registration, serial_number: aircraftA.serial_number,
      model_id: modelId, category_id: categoryId, photo_url: updated.reference, version: aircraftA.version,
    });
    updated.lifecycle.commit(updated.req);
    updated.res.emit('close');
    expect((await Aircraft.findByPk(aircraftA.id, { transaction }))?.photo_url).toBe(updated.reference);
    await expect(fs.access(created.target)).resolves.toBeUndefined();
    await expect(fs.access(updated.target)).resolves.toBeUndefined();
  });

  it('cleans foreign and nonexistent replacement attempts without affecting Tenant B', async () => {
    const originalReference = aircraftB.photo_url;
    for (const id of [aircraftB.id, randomUUID()]) {
      const attempted = await upload('foreign');
      await expect(AircraftService.updateDetails(authorityA, id, {
        registration: 'DENIED', serial_number: 'DENIED', model_id: modelId, category_id: categoryId,
        photo_url: attempted.reference, version: 0,
      })).rejects.toThrow('AIRCRAFT_NOT_FOUND');
      attempted.res.emit('finish');
      await expectRemoved(attempted.target);
    }
    expect((await Aircraft.findByPk(aircraftB.id, { transaction }))?.photo_url).toBe(originalReference);
  });

  it('cleans validation and stale-version failures while preserving the current photo', async () => {
    const current = (await Aircraft.findByPk(aircraftA.id, { transaction }))!.photo_url;
    const invalid = await upload('invalid');
    await expect(AircraftService.updateDetails(authorityA, aircraftA.id, {
      registration: '', serial_number: aircraftA.serial_number, model_id: modelId, category_id: categoryId, photo_url: invalid.reference,
    })).rejects.toThrow('REGISTRATION_REQUIRED');
    invalid.res.emit('finish');
    await expectRemoved(invalid.target);

    const stale = await upload('stale');
    await expect(AircraftService.updateDetails(authorityA, aircraftA.id, {
      registration: aircraftA.registration, serial_number: aircraftA.serial_number,
      model_id: modelId, category_id: categoryId, photo_url: stale.reference, version: 999999,
    })).rejects.toThrow('STALE_AIRCRAFT_RECORD');
    stale.res.emit('close');
    await expectRemoved(stale.target);
    expect((await Aircraft.findByPk(aircraftA.id, { transaction }))?.photo_url).toBe(current);
  });

  it('cleans an injected transactional failure and leaves no new database reference', async () => {
    const attempted = await upload('transaction');
    transactionSpy.mockImplementationOnce(async () => { throw new Error('INJECTED_TRANSACTION_FAILURE'); });
    await expect(AircraftService.create(authorityA, {
      registration: `PF-${suffix}`, serial_number: `PFS-${suffix}`,
      model_id: modelId, category_id: categoryId, photo_url: attempted.reference,
    })).rejects.toThrow('INJECTED_TRANSACTION_FAILURE');
    attempted.res.emit('finish');
    await expectRemoved(attempted.target);
    expect(await Aircraft.count({ where: { photo_url: attempted.reference }, transaction })).toBe(0);
  });
});
