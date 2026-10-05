import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { pool } from '../../config/database.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import sequelize from '../../config/database.js';
import { QueryTypes } from 'sequelize';
import { Tenant, User } from '../../models/index.js';
import { createTenantQueryAuthority, type TenantQueryAuthority } from './tenant-query-authority.js';
import { withTenantTransaction, withTenantClient } from './tenant-transaction.js';
import { uploadDeliveryRepository } from '../uploads/upload-delivery.repository.live.js';

async function withOwner<T>(work: (c: pg.Client) => Promise<T>): Promise<T> {
  const { config } = await import('dotenv');
  config({ path: '.env.test', override: true, quiet: true });
  const c = new pg.Client({ host: process.env.DB_MIGRATION_HOST, port: Number(process.env.DB_MIGRATION_PORT ?? '5432'), database: process.env.DB_MIGRATION_NAME, user: process.env.DB_MIGRATION_USER, password: process.env.DB_MIGRATION_PASSWORD });
  await c.connect();
  try { return await work(c); } finally { await c.end(); }
}

let authorityA: TenantQueryAuthority;
let authorityB: TenantQueryAuthority;
let tenantA: string;
let tenantB: string;
let aircraftA: string;
let aircraftB: string;
const SUFFIX = randomUUID().replace(/-/g, '').toUpperCase();

beforeAll(async () => {
  await assertTestDatabaseSafety(pool);
  const user = await User.create({ email: `tt-${SUFFIX}@example.test`, password_hash: 'x', full_name: 'tt' });
  const { Manufacturer, AssetType, AircraftCategory, ComponentModel } = await import('../../models/index.js');
  const mfg = await Manufacturer.create({ code: `TTM_${SUFFIX}`, name: 'tt mfg', is_active: true });
  const at = await AssetType.create({ code: `TTT_${SUFFIX}`, label: 'tt type', is_active: true });
  const cat = await AircraftCategory.create({ code: `TTC_${SUFFIX}`, label: 'tt cat', is_active: true });
  const model = await ComponentModel.create({ model_name: 'tt model', model_code: `TTMOD_${SUFFIX}`, manufacturer_id: mfg.id, asset_type_id: at.id, is_active: true });
  const ta = await Tenant.create({ code: `TTA_${SUFFIX}`, display_name: 'tt A', status: 'ACTIVE', created_by_user_id: user.id, updated_by_user_id: user.id });
  const tb = await Tenant.create({ code: `TTB_${SUFFIX}`, display_name: 'tt B', status: 'ACTIVE', created_by_user_id: user.id, updated_by_user_id: user.id });
  tenantA = ta.id; tenantB = tb.id;
  const context = (id: string, code: string) => ({ state: 'VALID_ACTIVE_TENANT' as const, validatedAt: Date.now(), tenant: { id, publicId: id, code, displayName: code, status: 'ACTIVE' as const }, membership: { id: randomUUID(), tenantId: id, userId: user.id, status: 'ACTIVE' as const } });
  authorityA = createTenantQueryAuthority(context(ta.id, 'A'));
  authorityB = createTenantQueryAuthority(context(tb.id, 'B'));

  await withOwner(async (c) => {
    aircraftA = (await c.query(`INSERT INTO public.aircraft (id, tenant_id, registration, serial_number, model_id, category_id, photo_url) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6) RETURNING id`, [tenantA, `TTA_${SUFFIX}`, `TTSA_${SUFFIX}`, model.id, cat.id, `/uploads/aircraft/tt-${SUFFIX}.png`])).rows[0].id;
    aircraftB = (await c.query(`INSERT INTO public.aircraft (id, tenant_id, registration, serial_number, model_id, category_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`, [tenantB, `TTB_${SUFFIX}`, `TTSB_${SUFFIX}`, model.id, cat.id])).rows[0].id;
  });
});

afterAll(async () => {
  await withOwner(async (c) => {
    await c.query(`DELETE FROM public.aircraft WHERE registration LIKE $1`, [`TT%_${SUFFIX}`]);
    await c.query(`DELETE FROM public.component_models WHERE model_code=$1`, [`TTMOD_${SUFFIX}`]);
    await c.query(`DELETE FROM public.rf_aircraft_category WHERE code=$1`, [`TTC_${SUFFIX}`]);
    await c.query(`DELETE FROM public.manufacturers WHERE code=$1`, [`TTM_${SUFFIX}`]);
    await c.query(`DELETE FROM public.rf_asset_type WHERE code=$1`, [`TTT_${SUFFIX}`]);
  });
  await Tenant.destroy({ where: { id: [tenantA, tenantB] } }).catch(() => undefined);
  await User.destroy({ where: { email: `tt-${SUFFIX}@example.test` } }).catch(() => undefined);
});

describe('4.5-6 canonical tenant transaction context', () => {
  it('withTenantTransaction: own visible, foreign invisible (Sequelize)', async () => {
    await withTenantTransaction(authorityA, async (transaction) => {
      const own = await sequelize.query(`SELECT id FROM public.aircraft WHERE id=:id`, { replacements: { id: aircraftA }, type: QueryTypes.SELECT, transaction });
      expect(own.length).toBe(1);
      const foreign = await sequelize.query(`SELECT id FROM public.aircraft WHERE id=:id`, { replacements: { id: aircraftB }, type: QueryTypes.SELECT, transaction });
      expect(foreign.length).toBe(0);
    });
  });

  it('withTenantClient: own visible, foreign invisible (raw pg)', async () => {
    await withTenantClient(authorityB, pool, async (client) => {
      expect((await client.query(`SELECT id FROM public.aircraft WHERE id=$1`, [aircraftB])).rowCount).toBe(1);
      expect((await client.query(`SELECT id FROM public.aircraft WHERE id=$1`, [aircraftA])).rowCount).toBe(0);
    });
  });

  it('aircraft-photo authorizeAircraftPhoto resolves through context-bound aircraft', async () => {
    await expect(uploadDeliveryRepository.authorizeAircraftPhoto(authorityA, `/uploads/aircraft/tt-${SUFFIX}.png`)).resolves.toBe(true);
    await expect(uploadDeliveryRepository.authorizeAircraftPhoto(authorityB, `/uploads/aircraft/tt-${SUFFIX}.png`)).resolves.toBe(false);
  });

  it('fabricated / missing / raw-UUID authority is rejected', async () => {
    const fake = { tenantId: tenantA } as any;
    await expect(withTenantTransaction(fake, async () => {})).rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    await expect(withTenantClient(undefined as any, pool, async () => {})).rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    await expect(withTenantTransaction(tenantA as any, async () => {})).rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
  });

  it('context does not leak after COMMIT or ROLLBACK', async () => {
    await withTenantTransaction(authorityA, async () => {});
    const c1 = await pool.connect();
    try { expect(Number((await c1.query(`SELECT count(*)::int n FROM public.aircraft`)).rows[0].n)).toBe(0); } finally { c1.release(); }

    await expect(withTenantTransaction(authorityA, async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    const c2 = await pool.connect();
    try { expect(Number((await c2.query(`SELECT count(*)::int n FROM public.aircraft`)).rows[0].n)).toBe(0); } finally { c2.release(); }
  });
});
