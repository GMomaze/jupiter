import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg, { type PoolClient } from 'pg';
import { pool } from '../../config/database.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import {
  AircraftCategory, AssetType, ComponentModel, Manufacturer, TaskCard, Tenant, User, Workpack, WorkpackTask, sequelize,
} from '../../models/index.js';
import { createTenantQueryAuthority, type TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { withTenantTransaction } from '../tenancy/tenant-transaction.js';

const GUC = 'jupiter.tenant_id';
const SUFFIX = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();

async function withOwner<T>(work: (c: pg.Client) => Promise<T>): Promise<T> {
  const { config } = await import('dotenv');
  config({ path: '.env.test', override: true, quiet: true });
  const c = new pg.Client({ host: process.env.DB_MIGRATION_HOST, port: Number(process.env.DB_MIGRATION_PORT ?? '5432'), database: process.env.DB_MIGRATION_NAME, user: process.env.DB_MIGRATION_USER, password: process.env.DB_MIGRATION_PASSWORD });
  await c.connect();
  try { return await work(c); } finally { await c.end(); }
}

async function run(client: PoolClient, tenantId: string | null, work: (c: PoolClient) => Promise<unknown>) {
  await client.query('BEGIN');
  try {
    if (tenantId !== null) await client.query(`SELECT set_config('${GUC}', $1, true)`, [tenantId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (e) { await client.query('ROLLBACK'); throw e; }
}

async function withContext<T>(tenantId: string, work: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { return (await run(client, tenantId, work as any)) as T; } finally { client.release(); }
}

async function noContext<T>(work: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { return (await run(client, null, work as any)) as T; } finally { client.release(); }
}

let tenantA: string;
let tenantB: string;
let authorityA: TenantQueryAuthority;
let aircraftA: string;
let aircraftB: string;
let statusId: string;
let linkedTaskA: string;

beforeAll(async () => {
  await assertTestDatabaseSafety(pool);
  const user = await User.create({ email: `614-${SUFFIX}@example.test`, password_hash: 'x', full_name: '4.5.6 614' });
  const mfg = await Manufacturer.create({ code: `614M_${SUFFIX}`, name: '614 Mfg', is_active: true });
  const at = await AssetType.create({ code: `614T_${SUFFIX}`, label: '614 Type', is_active: true });
  const cat = await AircraftCategory.create({ code: `614C_${SUFFIX}`, label: '614 Cat', is_active: true });
  const model = await ComponentModel.create({ model_name: '614 Model', model_code: `614MOD_${SUFFIX}`, manufacturer_id: mfg.id, asset_type_id: at.id, is_active: true });
  const ta = await Tenant.create({ code: `POC614A_${SUFFIX}`, display_name: '614 A', status: 'ACTIVE', created_by_user_id: user.id, updated_by_user_id: user.id });
  const tb = await Tenant.create({ code: `POC614B_${SUFFIX}`, display_name: '614 B', status: 'ACTIVE', created_by_user_id: user.id, updated_by_user_id: user.id });
  tenantA = ta.id;
  tenantB = tb.id;
  authorityA = createTenantQueryAuthority({
    state: 'VALID_ACTIVE_TENANT',
    tenant: { id: ta.id, publicId: ta.public_id, code: ta.code, displayName: ta.display_name, status: 'ACTIVE' },
    membership: { id: randomUUID(), tenantId: ta.id, userId: user.id, status: 'ACTIVE' },
    validatedAt: Date.now(),
  });

  await withOwner(async (c) => {
    statusId = (await c.query(`INSERT INTO public.rf_workpack_status (id, code, label) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [`614S_${SUFFIX}`, '614 Status'])).rows[0].id;
    const acA = (await c.query(`INSERT INTO public.aircraft (id, tenant_id, registration, serial_number, model_id, category_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`, [tenantA, `614-A-${SUFFIX}`, `614SN-A-${SUFFIX}`, model.id, cat.id])).rows[0].id;
    aircraftA = acA;
    aircraftB = (await c.query(`INSERT INTO public.aircraft (id, tenant_id, registration, serial_number, model_id, category_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`, [tenantB, `614-B-${SUFFIX}`, `614SN-B-${SUFFIX}`, model.id, cat.id])).rows[0].id;
  });
});

afterAll(async () => {
  await withOwner(async (c) => {
    for (const [table, col] of [['task_cards', 'task_card_number'], ['workpacks', 'work_order_number']] as const) {
      await c.query(`DELETE FROM public.${table} WHERE ${col} LIKE $1`, [`614-%-${SUFFIX}`]).catch(() => undefined);
    }
    await c.query(`DELETE FROM public.aircraft WHERE registration LIKE $1`, [`614-%-${SUFFIX}`]).catch(() => undefined);
    await c.query(`DELETE FROM public.rf_workpack_status WHERE code = $1`, [`614S_${SUFFIX}`]).catch(() => undefined);
  });
});
describe('MT-4.5.6 task_card INSERT RLS repair (614)', () => {
  it('creates a task card through the canonical Workpack → TaskCard → WorkpackTask sequence', async () => {
    const result = await withTenantTransaction(authorityA, async (tx) => {
      const workpack = await Workpack.create({
        tenant_id: tenantA, aircraft_id: aircraftA, status_id: statusId, work_order_number: `614-WO-${SUFFIX}`, version: 0,
      }, { transaction: tx });
      const taskCard = await TaskCard.create({
        task_card_number: `614T-${SUFFIX}`, title: '614 Task', description: 'desc', aircraft_id: aircraftA, tenant_id: tenantA, version: 0,
      }, { transaction: tx });
      await WorkpackTask.create({ workpack_id: workpack.id, task_id: taskCard.id }, { transaction: tx });
      return TaskCard.findByPk(taskCard.id, { transaction: tx });
    });
    expect(result).not.toBeNull();
    linkedTaskA = result!.id;
  });

  it('exposes a task card to its own tenant immediately (direct tenant_id) and keeps it visible after linking', async () => {
    await withContext(tenantA, async (c) => {
      const wp = (await c.query(`INSERT INTO public.workpacks (id, tenant_id, work_order_number, aircraft_id, status_id, version) VALUES (gen_random_uuid(), $1, $2, $3, $4, 0) RETURNING id`, [tenantA, `614-WO-T-${SUFFIX}`, aircraftA, statusId])).rows[0].id;
      const tc = (await c.query(`INSERT INTO public.task_cards (id, task_card_number, title, description, aircraft_id, tenant_id, version) VALUES (gen_random_uuid(), $1, $2, 'desc', $3, $4, 0) RETURNING id`, [`614T-T-${SUFFIX}`, '614 Transient', aircraftA, tenantA])).rows[0].id;
      const before = await c.query(`SELECT id FROM public.task_cards WHERE id = $1`, [tc]);
      expect(before.rowCount).toBe(1);
      await c.query(`INSERT INTO public.workpack_tasks (workpack_id, task_id) VALUES ($1, $2)`, [wp, tc]);
      const after = await c.query(`SELECT id FROM public.task_cards WHERE id = $1`, [tc]);
      expect(after.rowCount).toBe(1);
    });
  });

  it('rejects foreign-aircraft and missing-context task card INSERT', async () => {
    await expect(withContext(tenantA, async (c) => {
      await c.query(`INSERT INTO public.task_cards (id, task_card_number, title, description, aircraft_id, tenant_id, version) VALUES (gen_random_uuid(), $1, 'x', 'd', $2, $3, 0)`, [`614F-${SUFFIX}`, aircraftB, tenantA]);
    })).rejects.toThrow(/foreign key/i);

    await expect(noContext(async (c) => {
      await c.query(`INSERT INTO public.task_cards (id, task_card_number, title, description, aircraft_id, tenant_id, version) VALUES (gen_random_uuid(), $1, 'x', 'd', $2, $3, 0)`, [`614N-${SUFFIX}`, aircraftA, tenantA]);
    })).rejects.toThrow(/row-level security/i);
  });

  it('enforces hybrid workpack+aircraft SELECT/UPDATE/DELETE across tenants', async () => {
    await withContext(tenantA, async (c) => {
      expect((await c.query(`SELECT id FROM public.task_cards WHERE id = $1`, [linkedTaskA])).rowCount).toBe(1);
    });
    await withContext(tenantB, async (c) => {
      expect((await c.query(`SELECT id FROM public.task_cards WHERE id = $1`, [linkedTaskA])).rowCount).toBe(0);
      expect((await c.query(`UPDATE public.task_cards SET title = 'hijack' WHERE id = $1`, [linkedTaskA])).rowCount).toBe(0);
      expect((await c.query(`DELETE FROM public.task_cards WHERE id = $1`, [linkedTaskA])).rowCount).toBe(0);
    });
  });

  it('preserves aircraft consistency: foreign-aircraft task card is invisible even when linked', async () => {
    await withOwner(async (oc) => {
      const wp = (await oc.query(`INSERT INTO public.workpacks (id, tenant_id, work_order_number, aircraft_id, status_id, version) VALUES (gen_random_uuid(), $1, $2, $3, $4, 0) RETURNING id`, [tenantA, `614-WO-C-${SUFFIX}`, aircraftA, statusId])).rows[0].id;
      const tc = (await oc.query(`INSERT INTO public.task_cards (id, task_card_number, title, description, aircraft_id, tenant_id, version) VALUES (gen_random_uuid(), $1, 'x', 'd', $2, $3, 0) RETURNING id`, [`614C-${SUFFIX}`, aircraftB, tenantB])).rows[0].id;
      await oc.query(`INSERT INTO public.workpack_tasks (workpack_id, task_id) VALUES ($1, $2)`, [wp, tc]);
    });
    await withContext(tenantA, async (c) => {
      expect((await c.query(`SELECT id FROM public.task_cards WHERE task_card_number = $1`, [`614C-${SUFFIX}`])).rowCount).toBe(0);
    });
  });
});

