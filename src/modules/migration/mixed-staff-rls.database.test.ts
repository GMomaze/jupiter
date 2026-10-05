import { randomBytes, randomUUID } from 'node:crypto';
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
const P = `455-${SUFFIX}`;

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

let tenantA: string; let tenantB: string;
const f: Record<string, string> = {};

beforeAll(async () => {
  await assertTestDatabaseSafety(pool);
  const userA = await User.create({ email: `${P}a@example.test`, password_hash: 'x', full_name: '4.5.5 A' });
  const userB = await User.create({ email: `${P}b@example.test`, password_hash: 'x', full_name: '4.5.5 B' });
  const { Manufacturer, AssetType, AircraftCategory, ComponentModel } = await import('../../models/index.js');
  const mfg = await Manufacturer.create({ code: `${P}M`, name: `${P} Mfg`, is_active: true });
  const at = await AssetType.create({ code: `${P}T`, label: `${P} Type`, is_active: true });
  const cat = await AircraftCategory.create({ code: `${P}C`, label: `${P} Cat`, is_active: true });
  const model = await ComponentModel.create({ model_name: `${P} Model`, model_code: `${P}MOD`, manufacturer_id: mfg.id, asset_type_id: at.id, is_active: true });
  const ta = await Tenant.create({ code: `POC455A_${SUFFIX}`, display_name: '4.5.5 A', status: 'ACTIVE', created_by_user_id: userA.id, updated_by_user_id: userA.id });
  const tb = await Tenant.create({ code: `POC455B_${SUFFIX}`, display_name: '4.5.5 B', status: 'ACTIVE', created_by_user_id: userB.id, updated_by_user_id: userB.id });
  tenantA = ta.id; tenantB = tb.id;

  await withOwner(async (c) => {
    const acA = (await c.query(`INSERT INTO public.aircraft (id, tenant_id, registration, serial_number, model_id, category_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`, [tenantA, `${P}AA`, `${P}SNA`, model.id, cat.id])).rows[0].id;
    const acB = (await c.query(`INSERT INTO public.aircraft (id, tenant_id, registration, serial_number, model_id, category_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`, [tenantB, `${P}AB`, `${P}SNB`, model.id, cat.id])).rows[0].id;
    const ci = (await c.query(`INSERT INTO public.compliance_items (item_type, code, title, source_id, source_type) VALUES ('AD', $1, 'CI', gen_random_uuid(), 'AD') RETURNING id`, [`${P}CI`])).rows[0].id;

    const ttA = (await c.query(`INSERT INTO public.task_templates (id, scope, task_card_number, sort_order, title, description, aircraft_id) VALUES (gen_random_uuid(), 'AIRCRAFT', $1, 1, 'A', 'd', $2) RETURNING id`, [`${P}TTA`, acA])).rows[0].id;
    const ttB = (await c.query(`INSERT INTO public.task_templates (id, scope, task_card_number, sort_order, title, description, aircraft_id) VALUES (gen_random_uuid(), 'AIRCRAFT', $1, 2, 'B', 'd', $2) RETURNING id`, [`${P}TTB`, acB])).rows[0].id;
    const ttModel = (await c.query(`INSERT INTO public.task_templates (id, scope, task_card_number, sort_order, title, description, aircraft_model_id) VALUES (gen_random_uuid(), 'MODEL', $1, 3, 'M', 'd', $2) RETURNING id`, [`${P}TTM`, model.id])).rows[0].id;
    const ttGlobal = (await c.query(`INSERT INTO public.task_templates (id, scope, task_card_number, sort_order, title, description) VALUES (gen_random_uuid(), 'GLOBAL', $1, 4, 'G', 'd') RETURNING id`, [`${P}TTG`])).rows[0].id;
    const ttMpi = (await c.query(`INSERT INTO public.task_templates (id, scope, task_card_number, sort_order, title, description) VALUES (gen_random_uuid(), 'MPI', $1, 5, 'P', 'd') RETURNING id`, [`${P}TTMPI`])).rows[0].id;

    const caA = (await c.query(`INSERT INTO public.compliance_assignments (id, compliance_item_id, assignment_type, aircraft_id) VALUES (gen_random_uuid(), $1, 'AIRCRAFT', $2) RETURNING id`, [ci, acA])).rows[0].id;
    const caB = (await c.query(`INSERT INTO public.compliance_assignments (id, compliance_item_id, assignment_type, aircraft_id) VALUES (gen_random_uuid(), $1, 'AIRCRAFT', $2) RETURNING id`, [ci, acB])).rows[0].id;
    const caModel = (await c.query(`INSERT INTO public.compliance_assignments (id, compliance_item_id, assignment_type, model_id) VALUES (gen_random_uuid(), $1, 'MODEL', $2) RETURNING id`, [ci, model.id])).rows[0].id;

    const memA = (await c.query(`INSERT INTO public.tenant_memberships (id, tenant_id, user_id, status, joined_at, created_by_user_id, updated_by_user_id) VALUES (gen_random_uuid(), $1, $2, 'ACTIVE', CURRENT_TIMESTAMP, $2, $2) RETURNING id`, [tenantA, userA.id])).rows[0].id;
    const memB = (await c.query(`INSERT INTO public.tenant_memberships (id, tenant_id, user_id, status, joined_at, created_by_user_id, updated_by_user_id) VALUES (gen_random_uuid(), $1, $2, 'ACTIVE', CURRENT_TIMESTAMP, $2, $2) RETURNING id`, [tenantB, userB.id])).rows[0].id;
    const siA = (await c.query(`INSERT INTO public.staff_invitations (id, tenant_id, membership_id, user_id, normalized_email, token_hash, expires_at, invited_by_user_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW() + interval '1 day', $3) RETURNING id`, [tenantA, memA, userA.id, `${P.toLowerCase()}ia@example.test`, randomBytes(32).toString('hex')])).rows[0].id;
    const siB = (await c.query(`INSERT INTO public.staff_invitations (id, tenant_id, membership_id, user_id, normalized_email, token_hash, expires_at, invited_by_user_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW() + interval '1 day', $3) RETURNING id`, [tenantB, memB, userB.id, `${P.toLowerCase()}ib@example.test`, randomBytes(32).toString('hex')])).rows[0].id;

    Object.assign(f, { acA, acB, ttA, ttB, ttModel, ttGlobal, ttMpi, caA, caB, caModel, siA, siB, memA, memB });
  });
});
afterAll(async () => {
  await withOwner(async (c) => {
    await c.query(`DELETE FROM public.staff_invitations WHERE id = ANY($1::uuid[])`, [[f.siA, f.siB]]);
    await c.query(`DELETE FROM public.tenant_memberships WHERE id = ANY($1::uuid[])`, [[f.memA, f.memB]]);
    await c.query(`DELETE FROM public.compliance_assignments WHERE id = ANY($1::uuid[])`, [[f.caA, f.caB, f.caModel]]);
    await c.query(`DELETE FROM public.task_templates WHERE task_card_number LIKE $1`, [`${P}%`]);
    await c.query(`DELETE FROM public.aircraft WHERE id = ANY($1::uuid[])`, [[f.acA, f.acB]]);
    await c.query(`DELETE FROM public.compliance_items WHERE code = $1`, [`${P}CI`]);
    await c.query(`DELETE FROM public.component_models WHERE model_code = $1`, [`${P}MOD`]);
    await c.query(`DELETE FROM public.rf_aircraft_category WHERE code = $1`, [`${P}C`]);
    await c.query(`DELETE FROM public.manufacturers WHERE code = $1`, [`${P}M`]);
    await c.query(`DELETE FROM public.rf_asset_type WHERE code = $1`, [`${P}T`]);
  });
  await Tenant.destroy({ where: { id: [tenantA, tenantB] } }).catch(() => undefined);
  await User.destroy({ where: { email: [`${P}a@example.test`, `${P}b@example.test`] } }).catch(() => undefined);
});

async function visible(tenantId: string, table: string, id: string): Promise<boolean> {
  return withContext(tenantId, async (c) => (await c.query(`SELECT id FROM public.${table} WHERE id = $1`, [id])).rowCount === 1);
}
async function visibleNoContext(table: string, id: string): Promise<boolean> {
  return noContext(async (c) => (await c.query(`SELECT id FROM public.${table} WHERE id = $1`, [id])).rowCount === 1);
}

describe('4.5-5 mixed + staff tenant RLS', () => {
  it('AIRCRAFT-scoped task_templates isolated through aircraft', async () => {
    expect(await visible(tenantA, 'task_templates', f.ttA)).toBe(true);
    expect(await visible(tenantB, 'task_templates', f.ttA)).toBe(false);
    expect(await visible(tenantB, 'task_templates', f.ttB)).toBe(true);
    expect(await visible(tenantA, 'task_templates', f.ttB)).toBe(false);
  });

  it('MODEL/GLOBAL/MPI task_templates remain shared (visible to all tenants)', async () => {
    for (const t of [tenantA, tenantB]) {
      expect(await visible(t, 'task_templates', f.ttModel)).toBe(true);
      expect(await visible(t, 'task_templates', f.ttGlobal)).toBe(true);
      expect(await visible(t, 'task_templates', f.ttMpi)).toBe(true);
    }
  });

  it('AIRCRAFT task_templates fail closed with no context; shared remain visible', async () => {
    expect(await visibleNoContext('task_templates', f.ttA)).toBe(false);
    expect(await visibleNoContext('task_templates', f.ttGlobal)).toBe(true);
  });

  it('AIRCRAFT compliance_assignments isolated; MODEL shared', async () => {
    expect(await visible(tenantA, 'compliance_assignments', f.caA)).toBe(true);
    expect(await visible(tenantB, 'compliance_assignments', f.caA)).toBe(false);
    expect(await visible(tenantB, 'compliance_assignments', f.caB)).toBe(true);
    expect(await visible(tenantA, 'compliance_assignments', f.caB)).toBe(false);
    expect(await visible(tenantA, 'compliance_assignments', f.caModel)).toBe(true);
    expect(await visible(tenantB, 'compliance_assignments', f.caModel)).toBe(true);
  });

  it('staff_invitations isolated by tenant_id', async () => {
    expect(await visible(tenantA, 'staff_invitations', f.siA)).toBe(true);
    expect(await visible(tenantB, 'staff_invitations', f.siA)).toBe(false);
    expect(await visible(tenantB, 'staff_invitations', f.siB)).toBe(true);
    expect(await visible(tenantA, 'staff_invitations', f.siB)).toBe(false);
    expect(await visibleNoContext('staff_invitations', f.siA)).toBe(false);
  });

  it('tenant cannot INSERT foreign AIRCRAFT template or a shared-scope template', async () => {
    await expect(withContext(tenantA, async (c) => {
      await c.query(`INSERT INTO public.task_templates (scope, task_card_number, sort_order, title, description, aircraft_id) VALUES ('AIRCRAFT', $1, 9, 'x', 'd', $2)`, [`${P}X`, f.acB]);
    })).rejects.toThrow();
    await expect(withContext(tenantA, async (c) => {
      await c.query(`INSERT INTO public.task_templates (scope, task_card_number, sort_order, title, description) VALUES ('GLOBAL', $1, 9, 'x', 'd')`, [`${P}Y`]);
    })).rejects.toThrow();
  });

  it('platform (no context) can write shared-scope template; tenant cannot transition AIRCRAFT to shared', async () => {
    // platform/no-context INSERT of a GLOBAL template succeeds
    const inserted = await noContext(async (c) => (await c.query(`INSERT INTO public.task_templates (scope, task_card_number, sort_order, title, description) VALUES ('GLOBAL', $1, 9, 'p', 'd') RETURNING id`, [`${P}Z`])).rows[0].id as string);
    f.platformTemplate = inserted;
    // tenant A cannot convert their AIRCRAFT template to GLOBAL
    await expect(withContext(tenantA, async (c) => {
      await c.query(`UPDATE public.task_templates SET scope='GLOBAL', aircraft_id=NULL WHERE id = $1`, [f.ttA]);
    })).rejects.toThrow();
  });

  it('cross-tenant UPDATE/DELETE affect zero rows (RLS filters)', async () => {
    await withContext(tenantA, async (c) => {
      const upd = await c.query(`UPDATE public.task_templates SET title='x' WHERE id = $1`, [f.ttB]);
      expect(upd.rowCount).toBe(0);
      const del = await c.query(`DELETE FROM public.task_templates WHERE id = $1`, [f.ttB]);
      expect(del.rowCount).toBe(0);
      const delInv = await c.query(`DELETE FROM public.staff_invitations WHERE id = $1`, [f.siB]);
      expect(delInv.rowCount).toBe(0);
    });
    // foreign rows remain intact
    expect(await visible(tenantB, 'task_templates', f.ttB)).toBe(true);
    expect(await visible(tenantB, 'staff_invitations', f.siB)).toBe(true);
  });

  it('no BYPASSRLS role and runtime cannot SET ROLE to owner', async () => {
    const [bypass] = await sequelize.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_roles WHERE rolname IN ('jupiter_tenant_owner','jupiter_app','jupiter_test','jupiter_admin') AND rolbypassrls`,
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

