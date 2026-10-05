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

const TABLES = [
  'workpack_tasks', 'workpack_executions', 'workpack_measurements', 'workpack_signatures',
  'workpack_sources', 'workpack_audit_log', 'workpack_snag_audit_log', 'workpack_snags',
  'workpack_compliance', 'workpack_requirements', 'task_cards',
] as const;

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
let userId: string;
const ids: Record<string, { a: string; b: string }> = {};
let linkedSnagA: string;
let standaloneSnagA: string;
let linkedSnagB: string;
let standaloneSnagB: string;

const parents: Record<string, { a: string; b: string }> = {};

beforeAll(async () => {
  await assertTestDatabaseSafety(pool);
  const user = await User.create({ email: `453-${SUFFIX}@example.test`, password_hash: 'x', full_name: '4.5.3 Fixture' });
  userId = user.id;
  const { Manufacturer, AssetType, AircraftCategory, ComponentModel } = await import('../../models/index.js');
  const manufacturer = await Manufacturer.create({ code: `453M_${SUFFIX}`, name: '4.5.3 Mfg', is_active: true });
  const assetType = await AssetType.create({ code: `453T_${SUFFIX}`, label: '4.5.3 Type', is_active: true });
  const category = await AircraftCategory.create({ code: `453C_${SUFFIX}`, label: '4.5.3 Cat', is_active: true });
  const model = await ComponentModel.create({ model_name: '4.5.3 Model', model_code: `453MOD_${SUFFIX}`, manufacturer_id: manufacturer.id, asset_type_id: assetType.id, is_active: true });
  const ta = await Tenant.create({ code: `POC453A_${SUFFIX}`, display_name: '4.5.3 A', status: 'ACTIVE', created_by_user_id: userId, updated_by_user_id: userId });
  const tb = await Tenant.create({ code: `POC453B_${SUFFIX}`, display_name: '4.5.3 B', status: 'ACTIVE', created_by_user_id: userId, updated_by_user_id: userId });
  tenantA = ta.id;
  tenantB = tb.id;

  await withOwner(async (c) => {
    const status = await c.query(`INSERT INTO public.rf_workpack_status (id, code, label) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [`453S_${SUFFIX}`, '4.5.3 Status']);
    const statusId = status.rows[0].id;
    const req = await c.query(`INSERT INTO public.maintenance_requirements (id, model_id, title) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [model.id, '4.5.3 Req']);
    const reqId = req.rows[0].id;
    const ci = await c.query(`INSERT INTO public.compliance_items (id, item_type, code, title, source_id, source_type) VALUES (gen_random_uuid(), 'SB', $1, $2, gen_random_uuid(), 'SB') RETURNING id`, [`453CI-${SUFFIX}`, '4.5.3 CI']);
    const ciId = ci.rows[0].id;

    for (const [label, tenantId] of [['a', tenantA], ['b', tenantB]] as const) {
      const aircraft = await c.query(`INSERT INTO public.aircraft (id, tenant_id, registration, serial_number, model_id, category_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`, [tenantId, `453-${label}-${SUFFIX}`, `453SN-${label}-${SUFFIX}`, model.id, category.id]);
      const aircraftId = aircraft.rows[0].id;
      const workpack = await c.query(`INSERT INTO public.workpacks (id, tenant_id, work_order_number, aircraft_id, status_id) VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id`, [tenantId, `453W-${label}-${SUFFIX}`, aircraftId, statusId]);
      const workpackId = workpack.rows[0].id;
      parents.aircraft = { ...parents.aircraft, [label]: aircraftId };
      parents.workpacks = { ...parents.workpacks, [label]: workpackId };

      const taskCard = await c.query(`INSERT INTO public.task_cards (id, aircraft_id, tenant_id, task_card_number, title, description) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`, [aircraftId, tenantId, `453T-${label}-${SUFFIX}`, '4.5.3 Task', 'desc']);
      const taskId = taskCard.rows[0].id;
      ids.task_cards = { ...ids.task_cards, [label]: taskId };
      await c.query(`INSERT INTO public.workpack_tasks (workpack_id, task_id) VALUES ($1, $2)`, [workpackId, taskId]);
      ids.workpack_tasks = { ...ids.workpack_tasks, [label]: taskId };

      const exec = await c.query(`INSERT INTO public.workpack_executions (id, workpack_id, task_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [workpackId, taskId]);
      const execId = exec.rows[0].id;
      ids.workpack_executions = { ...ids.workpack_executions, [label]: execId };

      ids.workpack_measurements = { ...ids.workpack_measurements, [label]: (await c.query(`INSERT INTO public.workpack_measurements (id, execution_id, field_key, field_label, position) VALUES (gen_random_uuid(), $1, 'k', 'l', 0) RETURNING id`, [execId])).rows[0].id };
      ids.workpack_signatures = { ...ids.workpack_signatures, [label]: (await c.query(`INSERT INTO public.workpack_signatures (id, execution_id, role, user_id) VALUES (gen_random_uuid(), $1, 'MECHANIC', $2) RETURNING id`, [execId, userId])).rows[0].id };
      ids.workpack_sources = { ...ids.workpack_sources, [label]: (await c.query(`INSERT INTO public.workpack_sources (id, execution_id, source_type, reference) VALUES (gen_random_uuid(), $1, 'AD', 'ref') RETURNING id`, [execId])).rows[0].id };
      ids.workpack_audit_log = { ...ids.workpack_audit_log, [label]: (await c.query(`INSERT INTO public.workpack_audit_log (id, execution_id, workpack_id, task_id, action, old_value, new_value, hash, sequence) VALUES (gen_random_uuid(), $1, $2, $3, 'EXEC', '{}', '{}', 'h-${label}', 1) RETURNING id`, [execId, workpackId, taskId])).rows[0].id };
      ids.workpack_compliance = { ...ids.workpack_compliance, [label]: (await c.query(`INSERT INTO public.workpack_compliance (id, workpack_id, compliance_item_id, status, linked_at) VALUES (gen_random_uuid(), $1, $2, 'PLANNED', now()) RETURNING id`, [workpackId, ciId])).rows[0].id };
      ids.workpack_requirements = { ...ids.workpack_requirements, [label]: (await c.query(`INSERT INTO public.workpack_requirements (workpack_id, maintenance_requirement_id, status) VALUES ($1, $2, 'OPEN') RETURNING workpack_id`, [workpackId, reqId])).rows[0].workpack_id };

      const linkedSnag = await c.query(`INSERT INTO public.workpack_snags (id, workpack_id, aircraft_id, snag_no, defect_text, description) VALUES (gen_random_uuid(), $1, $2, 1, 'def', 'desc') RETURNING id`, [workpackId, aircraftId]);
      const linkedSnagId = linkedSnag.rows[0].id;
      const standaloneSnag = await c.query(`INSERT INTO public.workpack_snags (id, workpack_id, aircraft_id, snag_no, defect_text, description) VALUES (gen_random_uuid(), NULL, $1, 2, 'def', 'desc') RETURNING id`, [aircraftId]);
      const standaloneSnagId = standaloneSnag.rows[0].id;
      ids.workpack_snags = { ...ids.workpack_snags, [label]: linkedSnagId };
      const snagAudit = await c.query(`INSERT INTO public.workpack_snag_audit_log (id, snag_id, workpack_id, action, metadata, hash, previous_hash, sequence) VALUES (gen_random_uuid(), $1, $2, 'SNAG', '{}', 'h-${label}', '', 1) RETURNING id`, [linkedSnagId, workpackId]);
      ids.workpack_snag_audit_log = { ...ids.workpack_snag_audit_log, [label]: snagAudit.rows[0].id };

      if (label === 'a') { linkedSnagA = linkedSnagId; standaloneSnagA = standaloneSnagId; }
      else { linkedSnagB = linkedSnagId; standaloneSnagB = standaloneSnagId; }
    }
  });
});

afterAll(async () => {
  await withOwner(async (c) => {
    const wps = [parents.workpacks.a, parents.workpacks.b];
    const acs = [parents.aircraft.a, parents.aircraft.b];
    await c.query(`DELETE FROM public.workpack_snag_audit_log WHERE snag_id IN (SELECT id FROM workpack_snags WHERE aircraft_id = ANY($1::uuid[]))`, [acs]);
    await c.query(`DELETE FROM public.workpack_snags WHERE aircraft_id = ANY($1::uuid[])`, [acs]);
    await c.query(`DELETE FROM public.workpack_audit_log WHERE workpack_id = ANY($1::uuid[])`, [wps]);
    await c.query(`DELETE FROM public.workpack_sources WHERE execution_id IN (SELECT id FROM workpack_executions WHERE workpack_id = ANY($1::uuid[]))`, [wps]);
    await c.query(`DELETE FROM public.workpack_signatures WHERE execution_id IN (SELECT id FROM workpack_executions WHERE workpack_id = ANY($1::uuid[]))`, [wps]);
    await c.query(`DELETE FROM public.workpack_measurements WHERE execution_id IN (SELECT id FROM workpack_executions WHERE workpack_id = ANY($1::uuid[]))`, [wps]);
    await c.query(`DELETE FROM public.workpack_compliance WHERE workpack_id = ANY($1::uuid[])`, [wps]);
    await c.query(`DELETE FROM public.workpack_requirements WHERE workpack_id = ANY($1::uuid[])`, [wps]);
    await c.query(`DELETE FROM public.workpack_executions WHERE workpack_id = ANY($1::uuid[])`, [wps]);
    await c.query(`DELETE FROM public.workpack_tasks WHERE workpack_id = ANY($1::uuid[])`, [wps]);
    await c.query(`DELETE FROM public.task_cards WHERE aircraft_id = ANY($1::uuid[])`, [acs]);
    await c.query(`DELETE FROM public.workpacks WHERE tenant_id = ANY($1::uuid[])`, [[tenantA, tenantB]]);
    await c.query(`DELETE FROM public.aircraft WHERE tenant_id = ANY($1::uuid[])`, [[tenantA, tenantB]]);
    await c.query(`DELETE FROM public.maintenance_requirements WHERE title = '4.5.3 Req'`);
    await c.query(`DELETE FROM public.compliance_items WHERE code = $1`, [`453CI-${SUFFIX}`]);
    await c.query(`DELETE FROM public.rf_workpack_status WHERE code = $1`, [`453S_${SUFFIX}`]);
    await c.query(`DELETE FROM public.component_models WHERE model_name = '4.5.3 Model'`);
    await c.query(`DELETE FROM public.rf_aircraft_category WHERE code = $1`, [`453C_${SUFFIX}`]);
    await c.query(`DELETE FROM public.manufacturers WHERE code = $1`, [`453M_${SUFFIX}`]);
    await c.query(`DELETE FROM public.rf_asset_type WHERE code = $1`, [`453T_${SUFFIX}`]);
  });
  await Tenant.destroy({ where: { id: [tenantA, tenantB] } }).catch(() => undefined);
});

describe('4.5-3 workpack children + historical workpack RLS', () => {
  it('all eleven tables owned by jupiter_tenant_owner with FORCE RLS and tenant_rls policies', async () => {
    const rows = await sequelize.query<{ relname: string; owner: string; relrowsecurity: boolean; relforcerowsecurity: boolean; policies: number }>(
      `SELECT c.relname, r.rolname AS owner, c.relrowsecurity, c.relforcerowsecurity,
              (SELECT count(*)::int FROM pg_policies p WHERE p.tablename = c.relname AND p.policyname LIKE '%_tenant_rls%') AS policies
       FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
       WHERE c.relname = ANY(ARRAY[:tables]) ORDER BY c.relname`,
      { replacements: { tables: TABLES }, type: QueryTypes.SELECT },
    );
    expect(rows).toHaveLength(11);
    for (const r of rows) {
      expect(r.owner).toBe(OWNER);
      expect(r.relrowsecurity).toBe(true);
      expect(r.relforcerowsecurity).toBe(true);
      expect(r.policies).toBe(r.relname === 'task_cards' ? 4 : 1);
    }
  });

  it('missing context fails closed (SELECT) across all tables', async () => {
    await noContext(async (c) => {
      for (const table of TABLES) {
        expect((await c.query(`SELECT * FROM public.${table}`)).rowCount).toBe(0);
      }
    });
  });

  it('own-tenant SELECT succeeds across all tables', async () => {
    await withContext(tenantA, async (c) => {
      for (const table of TABLES) {
        const col = table === 'workpack_tasks' || table === 'workpack_requirements' ? 'workpack_id' : 'id';
        const id = col === 'id' ? ids[table].a : parents.workpacks.a;
        expect((await c.query(`SELECT * FROM public.${table} WHERE ${col} = $1`, [id])).rowCount).toBeGreaterThanOrEqual(1);
      }
    });
  });

  it('cross-tenant SELECT denied across all tables', async () => {
    await withContext(tenantA, async (c) => {
      for (const table of TABLES) {
        const r = await c.query(`SELECT * FROM public.${table}`);
        expect(r.rows.map((x: any) => x.id ?? x.workpack_id)).not.toContain(ids[table].b ?? parents.workpacks.b);
      }
    });
  });

  it('cross-tenant UPDATE and DELETE denied (representative workpack child)', async () => {
    await withContext(tenantA, async (c) => {
      expect((await c.query(`UPDATE public.workpack_executions SET status = 'X' WHERE id = $1`, [ids.workpack_executions.b])).rowCount).toBe(0);
      expect((await c.query(`DELETE FROM public.workpack_measurements WHERE id = $1`, [ids.workpack_measurements.b])).rowCount).toBe(0);
      expect((await c.query(`DELETE FROM public.workpack_compliance WHERE id = $1`, [ids.workpack_compliance.b])).rowCount).toBe(0);
    });
  });

  it('cross-tenant INSERT denied (representative workpack child)', async () => {
    await withContext(tenantA, async (c) => {
      await expect(
        c.query(`INSERT INTO public.workpack_executions (id, workpack_id, task_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [parents.workpacks.b, ids.task_cards.a]),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it('own-tenant INSERT/UPDATE/DELETE succeed (representative workpack child)', async () => {
    await withContext(tenantA, async (c) => {
      const ins = await c.query(`INSERT INTO public.workpack_executions (id, workpack_id, task_id, attempt_no) VALUES (gen_random_uuid(), $1, $2, 2) RETURNING id`, [parents.workpacks.a, ids.task_cards.a]);
      expect(ins.rowCount).toBe(1);
      const id = ins.rows[0].id;
      expect((await c.query(`UPDATE public.workpack_executions SET status = 'IN_PROGRESS' WHERE id = $1`, [id])).rowCount).toBe(1);
      expect((await c.query(`DELETE FROM public.workpack_executions WHERE id = $1`, [id])).rowCount).toBe(1);
    });
  });

  it('workpack_snags preserve linked vs standalone branch semantics', async () => {
    await withContext(tenantA, async (c) => {
      // linked snag A (workpack A + aircraft A) visible to A
      expect((await c.query(`SELECT id FROM public.workpack_snags WHERE id = $1`, [linkedSnagA])).rowCount).toBe(1);
      // standalone snag A (aircraft A) visible to A
      expect((await c.query(`SELECT id FROM public.workpack_snags WHERE id = $1`, [standaloneSnagA])).rowCount).toBe(1);
      // linked snag B not visible to A
      expect((await c.query(`SELECT id FROM public.workpack_snags WHERE id = $1`, [linkedSnagB])).rowCount).toBe(0);
      // standalone snag B not visible to A
      expect((await c.query(`SELECT id FROM public.workpack_snags WHERE id = $1`, [standaloneSnagB])).rowCount).toBe(0);
    });
  });

  it('task_cards resolve through direct tenant_id (pinned to aircraft)', async () => {
    await withContext(tenantA, async (c) => {
      expect((await c.query(`SELECT id FROM public.task_cards WHERE id = $1`, [ids.task_cards.a])).rowCount).toBe(1);
      expect((await c.query(`SELECT id FROM public.task_cards WHERE id = $1`, [ids.task_cards.b])).rowCount).toBe(0);
    });
  });

  it('transaction-local context does not leak across pooled connections', async () => {
    await withContext(tenantA, async (c) => {
      expect((await c.query(`SELECT count(*)::int AS n FROM public.workpack_executions`)).rows[0].n).toBeGreaterThanOrEqual(1);
    });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      expect((await client.query(`SELECT * FROM public.workpack_executions`)).rowCount).toBe(0);
      await client.query(`SELECT set_config('${GUC}', $1, true)`, [tenantB]);
      const b = await client.query(`SELECT id FROM public.workpack_executions`);
      expect(b.rows.map((r: any) => r.id)).toContain(ids.workpack_executions.b);
      expect(b.rows.map((r: any) => r.id)).not.toContain(ids.workpack_executions.a);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });
});



