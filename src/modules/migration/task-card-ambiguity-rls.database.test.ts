import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg, { type PoolClient } from 'pg';
import { pool } from '../../config/database.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import sequelize from '../../config/database.js';
import { QueryTypes } from 'sequelize';
import { Tenant, User } from '../../models/index.js';

const GUC = 'jupiter.tenant_id';
const OWNER = 'jupiter_tenant_owner';
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
let ambiguousTask: string;
let normalTaskA: string;
let normalTaskB: string;

beforeAll(async () => {
  await assertTestDatabaseSafety(pool);
  const user = await User.create({ email: `459-${SUFFIX}@example.test`, password_hash: 'x', full_name: '4.5.3 repair' });
  const { Manufacturer, AssetType, AircraftCategory, ComponentModel } = await import('../../models/index.js');
  const mfg = await Manufacturer.create({ code: `459M_${SUFFIX}`, name: '4.5.3r Mfg', is_active: true });
  const at = await AssetType.create({ code: `459T_${SUFFIX}`, label: '4.5.3r Type', is_active: true });
  const cat = await AircraftCategory.create({ code: `459C_${SUFFIX}`, label: '4.5.3r Cat', is_active: true });
  const model = await ComponentModel.create({ model_name: '4.5.3r Model', model_code: `459MOD_${SUFFIX}`, manufacturer_id: mfg.id, asset_type_id: at.id, is_active: true });
  const ta = await Tenant.create({ code: `POC459A_${SUFFIX}`, display_name: '4.5.3r A', status: 'ACTIVE', created_by_user_id: user.id, updated_by_user_id: user.id });
  const tb = await Tenant.create({ code: `POC459B_${SUFFIX}`, display_name: '4.5.3r B', status: 'ACTIVE', created_by_user_id: user.id, updated_by_user_id: user.id });
  tenantA = ta.id;
  tenantB = tb.id;

  await withOwner(async (c) => {
    const st = (await c.query(`INSERT INTO public.rf_workpack_status (id, code, label) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [`459S_${SUFFIX}`, 'S'])).rows[0].id;
    const acA = (await c.query(`INSERT INTO public.aircraft (id, tenant_id, registration, serial_number, model_id, category_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`, [tenantA, `459-A-${SUFFIX}`, `459SN-A-${SUFFIX}`, model.id, cat.id])).rows[0].id;
    const acB = (await c.query(`INSERT INTO public.aircraft (id, tenant_id, registration, serial_number, model_id, category_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`, [tenantB, `459-B-${SUFFIX}`, `459SN-B-${SUFFIX}`, model.id, cat.id])).rows[0].id;
    const wpA = (await c.query(`INSERT INTO public.workpacks (id, tenant_id, work_order_number, aircraft_id, status_id) VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id`, [tenantA, `459W-A-${SUFFIX}`, acA, st])).rows[0].id;
    const wpB = (await c.query(`INSERT INTO public.workpacks (id, tenant_id, work_order_number, aircraft_id, status_id) VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id`, [tenantB, `459W-B-${SUFFIX}`, acB, st])).rows[0].id;

    ambiguousTask = (await c.query(`INSERT INTO public.task_cards (id, aircraft_id, tenant_id, task_card_number, title, description) VALUES (gen_random_uuid(), $1, $2, $3, 'Amb', 'd') RETURNING id`, [acA, tenantA, `459-AMB-${SUFFIX}`])).rows[0].id;
    await c.query(`INSERT INTO public.workpack_tasks (workpack_id, task_id) VALUES ($1, $2), ($3, $2)`, [wpA, ambiguousTask, wpB]);

    normalTaskA = (await c.query(`INSERT INTO public.task_cards (id, aircraft_id, tenant_id, task_card_number, title, description) VALUES (gen_random_uuid(), $1, $2, $3, 'NA', 'd') RETURNING id`, [acA, tenantA, `459-NA-${SUFFIX}`])).rows[0].id;
    await c.query(`INSERT INTO public.workpack_tasks (workpack_id, task_id) VALUES ($1, $2)`, [wpA, normalTaskA]);

    normalTaskB = (await c.query(`INSERT INTO public.task_cards (id, aircraft_id, tenant_id, task_card_number, title, description) VALUES (gen_random_uuid(), $1, $2, $3, 'NB', 'd') RETURNING id`, [acB, tenantB, `459-NB-${SUFFIX}`])).rows[0].id;
    await c.query(`INSERT INTO public.workpack_tasks (workpack_id, task_id) VALUES ($1, $2)`, [wpB, normalTaskB]);
  });
});

afterAll(async () => {
  await withOwner(async (c) => {
    await c.query(`DELETE FROM public.workpack_tasks WHERE task_id IN (SELECT id FROM task_cards WHERE task_card_number LIKE '459-%')`);
    await c.query(`DELETE FROM public.task_cards WHERE task_card_number LIKE '459-%'`);
    await c.query(`DELETE FROM public.workpacks WHERE work_order_number LIKE '459W-%'`);
    await c.query(`DELETE FROM public.aircraft WHERE registration LIKE '459-%'`);
    await c.query(`DELETE FROM public.rf_workpack_status WHERE code LIKE '459S_%'`);
    await c.query(`DELETE FROM public.component_models WHERE model_name = '4.5.3r Model'`);
    await c.query(`DELETE FROM public.rf_aircraft_category WHERE code LIKE '459C_%'`);
    await c.query(`DELETE FROM public.manufacturers WHERE code LIKE '459M_%'`);
    await c.query(`DELETE FROM public.rf_asset_type WHERE code LIKE '459T_%'`);
  });
  await Tenant.destroy({ where: { id: [tenantA, tenantB] } }).catch(() => undefined);
});

describe('4.5-3 TaskCard ambiguity repair (direct tenant_id predicate)', () => {
  it('ambiguous TaskCard visible to its Aircraft tenant (A) at RLS layer', async () => {
    await withContext(tenantA, async (c) => {
      expect((await c.query(`SELECT id FROM public.task_cards WHERE id = $1`, [ambiguousTask])).rowCount).toBe(1);
    });
  });

  it('ambiguous TaskCard NOT visible to the foreign workpack tenant (B)', async () => {
    await withContext(tenantB, async (c) => {
      expect((await c.query(`SELECT id FROM public.task_cards WHERE id = $1`, [ambiguousTask])).rowCount).toBe(0);
    });
  });

  it('normal unambiguous TaskCards remain tenant-local', async () => {
    await withContext(tenantA, async (c) => {
      expect((await c.query(`SELECT id FROM public.task_cards WHERE id = $1`, [normalTaskA])).rowCount).toBe(1);
      expect((await c.query(`SELECT id FROM public.task_cards WHERE id = $1`, [normalTaskB])).rowCount).toBe(0);
    });
    await withContext(tenantB, async (c) => {
      expect((await c.query(`SELECT id FROM public.task_cards WHERE id = $1`, [normalTaskB])).rowCount).toBe(1);
      expect((await c.query(`SELECT id FROM public.task_cards WHERE id = $1`, [normalTaskA])).rowCount).toBe(0);
    });
  });

  it('missing tenant context sees no TaskCards', async () => {
    await noContext(async (c) => {
      expect((await c.query(`SELECT id FROM public.task_cards`)).rowCount).toBe(0);
    });
  });

  it('no BYPASSRLS role and runtime cannot SET ROLE to owner', async () => {
    const [bypass] = await sequelize.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_roles WHERE rolname IN ('jupiter_tenant_owner','jupiter_app','jupiter_test') AND rolbypassrls`,
      { type: QueryTypes.SELECT },
    );
    expect(bypass.n).toBe(0);
    const [setRole] = await sequelize.query<{ test_can_set: boolean }>(
      `SELECT pg_has_role('jupiter_test', :owner, 'SET') AS test_can_set`,
      { replacements: { owner: OWNER }, type: QueryTypes.SELECT },
    );
    expect(setRole.test_can_set).toBe(false);
  });
});

