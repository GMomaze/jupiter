import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../../config/database.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import { Aircraft, AircraftCategory, ComponentModel, Manufacturer, Tenant, User, sequelize } from '../../models/index.js';
import { createTenantQueryAuthority, type TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { withTenantTransaction } from '../tenancy/tenant-transaction.js';
import { uploadDeliveryRepository } from './upload-delivery.repository.live.js';
import {
  AIRCRAFT_UPLOAD_ROOT,
  MANUFACTURER_UPLOAD_ROOT,
  uploadDeliveryService,
} from './upload-delivery.service.js';

let authorityA: TenantQueryAuthority;
let authorityB: TenantQueryAuthority;
const createdIds: string[] = [];
const createdFiles: string[] = [];
const suffix = randomUUID().replace(/-/g, '').slice(0, 12).toLowerCase();
const names = {
  owned: `mt4c7b-${suffix}-owned.png`,
  foreign: `mt4c7b-${suffix}-foreign.png`,
  duplicate: `mt4c7b-${suffix}-duplicate.png`,
  orphan: `mt4c7b-${suffix}-orphan.png`,
  logo: `mt4c7b-${suffix}-logo.png`,
};

async function createIdentity(label: string) {
  const user = await User.create({
    email: `mt4c7b-${label}-${suffix}@example.test`, password_hash: 'test', full_name: `MT4C7B ${label}`, is_active: true,
  });
  const tenant = await Tenant.create({
    code: `MT4C7B_${label}_${suffix.toUpperCase()}`, display_name: `MT4C7B ${label}`, status: 'ACTIVE',
    created_by_user_id: user.id, updated_by_user_id: user.id,
  });
  createdIds.push(user.id, tenant.id);
  return {
    tenant,
    authority: createTenantQueryAuthority({
      state: 'VALID_ACTIVE_TENANT',
      tenant: { id: tenant.id, publicId: tenant.public_id, code: tenant.code, displayName: tenant.display_name, status: 'ACTIVE' },
      membership: { id: randomUUID(), tenantId: tenant.id, userId: user.id, status: 'ACTIVE' },
      validatedAt: Date.now(),
    }),
  };
}

async function createAircraft(authority: TenantQueryAuthority, label: string, filename: string, modelId: string, categoryId: string) {
  const aircraft = await withTenantTransaction(authority, (transaction) => Aircraft.create({
    tenant_id: authority.tenantId,
    registration: `U7-${label}-${suffix}`,
    serial_number: `U7-SN-${label}-${suffix}`,
    model_id: modelId,
    category_id: categoryId,
    status: 'ACTIVE',
    photo_url: `/uploads/aircraft/${filename}`,
  }, { transaction }));
  createdIds.push(aircraft.id);
}

beforeAll(async () => {
  await assertTestDatabaseSafety(pool);
  const model = await ComponentModel.findOne({ attributes: ['id'] });
  const category = await AircraftCategory.findOne({ attributes: ['id'] });
  if (!model || !category) throw new Error('MT4C7B_LIVE_REFERENCE_FIXTURES_REQUIRED');

  const a = await createIdentity('A');
  const b = await createIdentity('B');
  authorityA = a.authority;
  authorityB = b.authority;
  await createAircraft(a.authority, 'A1', names.owned, model.id, category.id);
  await createAircraft(b.authority, 'B1', names.foreign, model.id, category.id);
  await createAircraft(a.authority, 'A2', names.duplicate, model.id, category.id);
  await createAircraft(a.authority, 'A3', names.duplicate, model.id, category.id);
  const manufacturer = await Manufacturer.create({
    name: `MT4C7B ${suffix}`,
    code: `MT4C7B_${suffix.toUpperCase()}`,
    logo_url: `/uploads/manufacturers/${names.logo}`,
    is_active: true,
    is_operational: true,
  });
  createdIds.push(manufacturer.id);

  await Promise.all([
    fs.mkdir(AIRCRAFT_UPLOAD_ROOT, { recursive: true }),
    fs.mkdir(MANUFACTURER_UPLOAD_ROOT, { recursive: true }),
  ]);
  for (const filename of [names.owned, names.foreign, names.duplicate, names.orphan]) {
    const target = path.join(AIRCRAFT_UPLOAD_ROOT, filename);
    await fs.writeFile(target, 'MT-4C7B');
    createdFiles.push(target);
  }
  const logo = path.join(MANUFACTURER_UPLOAD_ROOT, names.logo);
  await fs.writeFile(logo, 'MT-4C7B');
  createdFiles.push(logo);

});

afterAll(async () => {
  if (createdIds.length > 0) {
    await withTenantTransaction(authorityA, () => sequelize.query('DELETE FROM aircraft WHERE id IN (:ids)', { replacements: { ids: createdIds } }));
    await withTenantTransaction(authorityB, () => sequelize.query('DELETE FROM aircraft WHERE id IN (:ids)', { replacements: { ids: createdIds } }));
    await sequelize.query('DELETE FROM manufacturers WHERE id IN (:ids)', { replacements: { ids: createdIds } });
  }
  await Promise.allSettled(createdFiles.map(file => fs.unlink(file)));
  for (const file of createdFiles) await expect(fs.access(file)).rejects.toThrow();
});

describe('MT-4C7B guarded two-tenant upload authority', () => {
  it('authorizes only the unique current-tenant Aircraft reference', async () => {
    await expect(uploadDeliveryRepository.authorizeAircraftPhoto(authorityA, `/uploads/aircraft/${names.owned}`)).resolves.toBe(true);
    await expect(uploadDeliveryRepository.authorizeAircraftPhoto(authorityB, `/uploads/aircraft/${names.owned}`)).resolves.toBe(false);
    await expect(uploadDeliveryRepository.authorizeAircraftPhoto(authorityA, `/uploads/aircraft/${names.foreign}`)).resolves.toBe(false);
    await expect(uploadDeliveryRepository.authorizeAircraftPhoto(authorityA, `/uploads/aircraft/${names.duplicate}`)).resolves.toBe(false);
    await expect(uploadDeliveryRepository.authorizeAircraftPhoto(authorityA, `/uploads/aircraft/${names.orphan}`)).resolves.toBe(false);
  });

  it('combines live database authority with physical-file safety', async () => {
    await expect(uploadDeliveryService.aircraftPhoto(authorityA, names.owned)).resolves.toEqual({ absolutePath: await fs.realpath(path.join(AIRCRAFT_UPLOAD_ROOT, names.owned)) });
    await expect(uploadDeliveryService.aircraftPhoto(authorityA, names.foreign)).resolves.toBeUndefined();
    await expect(uploadDeliveryService.aircraftPhoto(authorityA, names.duplicate)).resolves.toBeUndefined();
    await expect(uploadDeliveryService.aircraftPhoto(authorityA, names.orphan)).resolves.toBeUndefined();
  });

  it('serves only persisted shared Manufacturer references', async () => {
    await expect(uploadDeliveryService.manufacturerLogo(names.logo)).resolves.toEqual({ absolutePath: await fs.realpath(path.join(MANUFACTURER_UPLOAD_ROOT, names.logo)) });
    await expect(uploadDeliveryService.manufacturerLogo(names.orphan)).resolves.toBeUndefined();
  });
});
