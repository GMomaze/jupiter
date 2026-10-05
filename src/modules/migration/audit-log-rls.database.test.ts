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
const P = `460-${SUFFIX}`;

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
async function withContextRollback<T>(tenantId: string, work: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      await client.query(`SELECT set_config('${GUC}', $1, true)`, [tenantId]);
      return (await work(client)) as T;
    } finally {
      await client.query('ROLLBACK');
    }
  } finally { client.release(); }
}

let tenantA: string; let tenantB: string;
const f: Record<string, string> = {};
const auditIds: string[] = [];

async function visible(tenantId: string, id: string): Promise<boolean> {
  return withContext(tenantId, async (c) => {
    const r = await c.query(`SELECT id FROM public.audit_log WHERE id = $1`, [id]);
    return r.rowCount === 1;
  });
}
beforeAll(async () => {
  await assertTestDatabaseSafety(pool);
  const user = await User.create({ email: `${P}@example.test`, password_hash: 'x', full_name: '4.5.4' });
  const { Manufacturer, AssetType, AircraftCategory, ComponentModel } = await import('../../models/index.js');
  const mfg = await Manufacturer.create({ code: `${P}M`, name: `${P} Mfg`, is_active: true });
  const at = await AssetType.create({ code: `${P}T`, label: `${P} Type`, is_active: true });
  const cat = await AircraftCategory.create({ code: `${P}C`, label: `${P} Cat`, is_active: true });
  const model = await ComponentModel.create({ model_name: `${P} Model`, model_code: `${P}MOD`, manufacturer_id: mfg.id, asset_type_id: at.id, is_active: true });
  const ta = await Tenant.create({ code: `POC460A_${SUFFIX}`, display_name: '4.5.4 A', status: 'ACTIVE', created_by_user_id: user.id, updated_by_user_id: user.id });
  const tb = await Tenant.create({ code: `POC460B_${SUFFIX}`, display_name: '4.5.4 B', status: 'ACTIVE', created_by_user_id: user.id, updated_by_user_id: user.id });
  tenantA = ta.id; tenantB = tb.id;

  await withOwner(async (c) => {
    const st = (await c.query(`INSERT INTO public.rf_workpack_status (id, code, label) VALUES (gen_random_uuid(), $1, 'S') RETURNING id`, [`${P}S`])).rows[0].id;
    const ci = (await c.query(`INSERT INTO public.compliance_items (item_type, code, title, source_id, source_type) VALUES ('AD', $1, 'CI', gen_random_uuid(), 'AD') RETURNING id`, [`${P}CI`])).rows[0].id;

    const acA = (await c.query(`INSERT INTO public.aircraft (id, tenant_id, registration, serial_number, model_id, category_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`, [tenantA, `${P}AA`, `${P}SNA`, model.id, cat.id])).rows[0].id;
    const acB = (await c.query(`INSERT INTO public.aircraft (id, tenant_id, registration, serial_number, model_id, category_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`, [tenantB, `${P}AB`, `${P}SNB`, model.id, cat.id])).rows[0].id;

    const cuA = (await c.query(`INSERT INTO public.customers (id, tenant_id, name, contact_person, email, phone) VALUES (gen_random_uuid(), $1, 'CA', 'P', 'ca@x', '1') RETURNING id`, [tenantA])).rows[0].id;
    const cuB = (await c.query(`INSERT INTO public.customers (id, tenant_id, name, contact_person, email, phone) VALUES (gen_random_uuid(), $1, 'CB', 'P', 'cb@x', '2') RETURNING id`, [tenantB])).rows[0].id;

    const wpA = (await c.query(`INSERT INTO public.workpacks (id, tenant_id, work_order_number, status_id, aircraft_id) VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id`, [tenantA, `${P}WA`, st, acA])).rows[0].id;
    const wpB = (await c.query(`INSERT INTO public.workpacks (id, tenant_id, work_order_number, status_id, aircraft_id) VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id`, [tenantB, `${P}WB`, st, acB])).rows[0].id;

    const tcA = (await c.query(`INSERT INTO public.task_cards (id, aircraft_id, tenant_id, task_card_number, title, description) VALUES (gen_random_uuid(), $1, $2, $3, 'TA', 'd') RETURNING id`, [acA, tenantA, `${P}TA`])).rows[0].id;
    const tcB = (await c.query(`INSERT INTO public.task_cards (id, aircraft_id, tenant_id, task_card_number, title, description) VALUES (gen_random_uuid(), $1, $2, $3, 'TB', 'd') RETURNING id`, [acB, tenantB, `${P}TB`])).rows[0].id;
    const tcAmb = (await c.query(`INSERT INTO public.task_cards (id, aircraft_id, tenant_id, task_card_number, title, description) VALUES (gen_random_uuid(), $1, $2, $3, 'AMB', 'd') RETURNING id`, [acA, tenantA, `${P}AMB`])).rows[0].id;
    await c.query(`INSERT INTO public.workpack_tasks (workpack_id, task_id) VALUES ($1, $2), ($3, $4), ($1, $5), ($3, $5)`, [wpA, tcA, wpB, tcB, tcAmb]);

    const snA = (await c.query(`INSERT INTO public.workpack_snags (id, workpack_id, aircraft_id, description, snag_no, defect_text) VALUES (gen_random_uuid(), $1, $2, 'd', 1, 'd') RETURNING id`, [wpA, acA])).rows[0].id;
    const snB = (await c.query(`INSERT INTO public.workpack_snags (id, workpack_id, aircraft_id, description, snag_no, defect_text) VALUES (gen_random_uuid(), $1, $2, 'd', 2, 'd') RETURNING id`, [wpB, acB])).rows[0].id;
    const snStand = (await c.query(`INSERT INTO public.workpack_snags (id, workpack_id, aircraft_id, description, snag_no, defect_text) VALUES (gen_random_uuid(), NULL, $1, 'd', 3, 'd') RETURNING id`, [acA])).rows[0].id;

    const cmpA = (await c.query(`INSERT INTO public.aircraft_compliance (id, aircraft_id, compliance_item_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [acA, ci])).rows[0].id;
    const cmpB = (await c.query(`INSERT INTO public.aircraft_compliance (id, aircraft_id, compliance_item_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [acB, ci])).rows[0].id;

    const calA = (await c.query(`INSERT INTO public.customer_aircraft_links (id, customer_id, aircraft_id, relationship_type, start_date) VALUES (gen_random_uuid(), $1, $2, 'OWNER', NOW()) RETURNING id`, [cuA, acA])).rows[0].id;
    const calB = (await c.query(`INSERT INTO public.customer_aircraft_links (id, customer_id, aircraft_id, relationship_type, start_date) VALUES (gen_random_uuid(), $1, $2, 'OWNER', NOW()) RETURNING id`, [cuB, acB])).rows[0].id;

    Object.assign(f, { acA, acB, cuA, cuB, wpA, wpB, tcA, tcB, tcAmb, snA, snB, snStand, cmpA, cmpB, calA, calB });

    const audit = async (table_name: string, row_id: string | null, action: string) => {
      const r = await c.query(`INSERT INTO public.audit_log (table_name, row_id, action) VALUES ($1, $2, $3) RETURNING id`, [table_name, row_id, action]);
      auditIds.push(r.rows[0].id);
    };
    await audit('aircraft', acA, 'CREATE');
    await audit('aircraft', acB, 'CREATE');
    await audit('customers', cuA, 'CREATE');
    await audit('customers', cuB, 'CREATE');
    await audit('workpacks', wpA, 'CREATE');
    await audit('workpacks', wpB, 'CREATE');
    await audit('task_cards', tcA, 'CREATE');
    await audit('task_cards', tcB, 'CREATE');
    await audit('task_cards', tcAmb, 'CREATE');
    await audit('workpack_snags', snA, 'CREATE');
    await audit('workpack_snags', snB, 'CREATE');
    await audit('workpack_snags', snStand, 'CREATE');
    await audit('aircraft_compliance', cmpA, 'CREATE');
    await audit('aircraft_compliance', cmpB, 'CREATE');
    await audit('customer_aircraft_links', calA, 'CREATE');
    await audit('customer_aircraft_links', calB, 'CREATE');
    await audit('unknown_thing', randomUUID(), 'CREATE');
    await audit('aircraft', randomUUID(), 'CREATE');
  });
});



afterAll(async () => {
  await withOwner(async (c) => {
    await c.query(`DELETE FROM public.audit_log WHERE id = ANY($1::uuid[])`, [auditIds]);
    await c.query(`DELETE FROM public.workpack_tasks WHERE task_id IN (SELECT id FROM task_cards WHERE task_card_number LIKE $1)`, [`${P}%`]);
    await c.query(`DELETE FROM public.task_cards WHERE task_card_number LIKE $1`, [`${P}%`]);
    await c.query(`DELETE FROM public.workpack_snags WHERE id = ANY($1::uuid[])`, [[f.snA, f.snB, f.snStand]]);
    await c.query(`DELETE FROM public.aircraft_compliance WHERE id = ANY($1::uuid[])`, [[f.cmpA, f.cmpB]]);
    await c.query(`DELETE FROM public.customer_aircraft_links WHERE id = ANY($1::uuid[])`, [[f.calA, f.calB]]);
    await c.query(`DELETE FROM public.workpacks WHERE id = ANY($1::uuid[])`, [[f.wpA, f.wpB]]);
    await c.query(`DELETE FROM public.customers WHERE id = ANY($1::uuid[])`, [[f.cuA, f.cuB]]);
    await c.query(`DELETE FROM public.aircraft WHERE id = ANY($1::uuid[])`, [[f.acA, f.acB]]);
    await c.query(`DELETE FROM public.compliance_items WHERE code = $1`, [`${P}CI`]);
    await c.query(`DELETE FROM public.rf_workpack_status WHERE code = $1`, [`${P}S`]);
    await c.query(`DELETE FROM public.component_models WHERE model_code = $1`, [`${P}MOD`]);
    await c.query(`DELETE FROM public.rf_aircraft_category WHERE code = $1`, [`${P}C`]);
    await c.query(`DELETE FROM public.manufacturers WHERE code = $1`, [`${P}M`]);
    await c.query(`DELETE FROM public.rf_asset_type WHERE code = $1`, [`${P}T`]);
  });
  await Tenant.destroy({ where: { id: [tenantA, tenantB] } }).catch(() => undefined);
});


async function auditId(table_name: string, row_id: string | null): Promise<string> {
  return withOwner(async (c) => {
    const r = await c.query(`SELECT id FROM public.audit_log WHERE table_name=$1 AND row_id IS NOT DISTINCT FROM $2`, [table_name, row_id]);
    return r.rows[0]?.id as string;
  });
}

describe('4.5-4 audit_log tenant RLS (event-time provenance)', () => {
  it('each supported root: own-tenant visible, foreign denied', async () => {
    const roots: Array<{ table: string; a: string; b: string }> = [
      { table: 'aircraft', a: f.acA, b: f.acB },
      { table: 'customers', a: f.cuA, b: f.cuB },
      { table: 'workpacks', a: f.wpA, b: f.wpB },
      { table: 'task_cards', a: f.tcA, b: f.tcB },
      { table: 'workpack_snags', a: f.snA, b: f.snB },
      { table: 'aircraft_compliance', a: f.cmpA, b: f.cmpB },
      { table: 'customer_aircraft_links', a: f.calA, b: f.calB },
    ];
    for (const r of roots) {
      const aId = await auditId(r.table, r.a);
      const bId = await auditId(r.table, r.b);
      expect(await visible(tenantA, aId)).toBe(true);
      expect(await visible(tenantB, aId)).toBe(false);
      expect(await visible(tenantB, bId)).toBe(true);
      expect(await visible(tenantA, bId)).toBe(false);
    }
  });

  it('standalone workpack_snag resolves through aircraft tenant', async () => {
    const id = await auditId('workpack_snags', f.snStand);
    expect(await visible(tenantA, id)).toBe(true);
    expect(await visible(tenantB, id)).toBe(false);
  });

  it('utilisation_events provenance (immutable table, rolled-back fixture)', async () => {
    await withContextRollback(tenantA, async (c) => {
      const util = (await c.query(`INSERT INTO public.utilisation_events (id, aircraft_id, source_type, effective_date, previous_total_time_hours, new_total_time_hours, delta_hours, previous_total_time_cycles, new_total_time_cycles, delta_cycles, reason) VALUES (gen_random_uuid(), $1, 'S', NOW(), 0, 1, 1, 0, 1, 1, 'r') RETURNING id`, [f.acA])).rows[0].id;
      const audit = (await c.query(`INSERT INTO public.audit_log (table_name, row_id, action) VALUES ('utilisation_events', $1, 'CREATE') RETURNING id`, [util])).rows[0].id;
      // own-tenant visible (context A)
      expect((await c.query(`SELECT id FROM public.audit_log WHERE id = $1`, [audit])).rowCount).toBe(1);
      // switch context to B: foreign denied
      await c.query(`SELECT set_config('${GUC}', $1, true)`, [tenantB]);
      expect((await c.query(`SELECT id FROM public.audit_log WHERE id = $1`, [audit])).rowCount).toBe(0);
    });
  });

  it('ambiguous task_card audit visible to aircraft tenant (A), not foreign (B)', async () => {
    const id = await auditId('task_cards', f.tcAmb);
    expect(await visible(tenantA, id)).toBe(true);
    expect(await visible(tenantB, id)).toBe(false);
  });

  it('unknown table name fails closed', async () => {
    const id = await withOwner(async (c) => (await c.query(`SELECT id FROM public.audit_log WHERE table_name='unknown_thing'`)).rows[0].id);
    expect(await visible(tenantA, id)).toBe(false);
    expect(await visible(tenantB, id)).toBe(false);
  });

  it('unresolvable (nonexistent) row_id fails closed', async () => {
    const id = await withOwner(async (c) => (await c.query(`SELECT id FROM public.audit_log WHERE table_name='aircraft' AND row_id NOT IN (SELECT id FROM aircraft)`)).rows[0].id);
    expect(await visible(tenantA, id)).toBe(false);
  });

  it('missing tenant context sees no audit rows', async () => {
    await noContext(async (c) => {
      const r = await c.query(`SELECT id FROM public.audit_log WHERE id = ANY($1::uuid[])`, [auditIds]);
      expect(r.rowCount).toBe(0);
    });
  });

  it('app can INSERT own-tenant audit row, rejected for foreign row', async () => {
    const inserted = await withContext(tenantA, async (c) => {
      const r = await c.query(`INSERT INTO public.audit_log (table_name, row_id, action) VALUES ('aircraft', $1, 'CREATE') RETURNING id`, [f.acA]);
      return r.rows[0].id as string;
    });
    auditIds.push(inserted);
    await expect(
      withContext(tenantA, async (c) => {
        await c.query(`INSERT INTO public.audit_log (table_name, row_id, action) VALUES ('aircraft', $1, 'CREATE')`, [f.acB]);
      })
    ).rejects.toThrow();
  });

  it('pooled-context isolation: no cross-session leakage', async () => {
    const [aIds, bIds] = await Promise.all([
      withContext(tenantA, async (c) => (await c.query(`SELECT id FROM public.audit_log WHERE table_name='aircraft'`)).rows.map((r: any) => r.id)),
      withContext(tenantB, async (c) => (await c.query(`SELECT id FROM public.audit_log WHERE table_name='aircraft'`)).rows.map((r: any) => r.id)),
    ]);
    const aRow = await auditId('aircraft', f.acA);
    const bRow = await auditId('aircraft', f.acB);
    expect(aIds).toContain(aRow);
    expect(aIds).not.toContain(bRow);
    expect(bIds).toContain(bRow);
    expect(bIds).not.toContain(aRow);
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

  it('audit_log owned + FORCE RLS; platform_global_audit_log NOT tenant RLS', async () => {
    const [auditState] = await sequelize.query<{ owned: boolean; rls: boolean; forced: boolean; policies: number }>(
      `SELECT
         (SELECT count(*)::int FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner WHERE c.relname='audit_log' AND r.rolname=:owner) > 0 AS owned,
         (SELECT relrowsecurity FROM pg_class WHERE relname='audit_log') AS rls,
         (SELECT relforcerowsecurity FROM pg_class WHERE relname='audit_log') AS forced,
         (SELECT count(*)::int FROM pg_policies WHERE tablename='audit_log' AND policyname='audit_log_tenant_rls') AS policies`,
      { replacements: { owner: OWNER }, type: QueryTypes.SELECT },
    );
    expect(auditState.owned).toBe(true);
    expect(auditState.rls).toBe(true);
    expect(auditState.forced).toBe(true);
    expect(auditState.policies).toBe(1);

    const [platform] = await sequelize.query<{ rls: boolean; policies: number }>(
      `SELECT relrowsecurity AS rls, (SELECT count(*)::int FROM pg_policies WHERE tablename='platform_global_audit_log') AS policies FROM pg_class WHERE relname='platform_global_audit_log'`,
      { type: QueryTypes.SELECT },
    );
    expect(platform.rls).toBe(false);
    expect(platform.policies).toBe(0);
  });
});

