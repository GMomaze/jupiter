import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg, { type PoolClient } from 'pg';
import { pool } from '../../config/database.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import sequelize from '../../config/database.js';
import { QueryTypes } from 'sequelize';
import { AircraftCategory, AssetType, ComponentModel, Manufacturer, MaintenanceTemplate, Tenant, User, WorkpackStatus } from '../../models/index.js';

const GUC = 'jupiter.tenant_id';
const OWNER = 'jupiter_tenant_owner';
const SUFFIX = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();

const TABLES: ReadonlyArray<{ table: string; column: string }> = [
  { table: 'aircraft', column: 'tenant_id' },
  { table: 'customers', column: 'tenant_id' },
  { table: 'planning_sessions', column: 'tenant_id' },
  { table: 'workpacks', column: 'tenant_id' },
  { table: 'migration_batches', column: 'tenant_id' },
  { table: 'aircraft_component_movement_history', column: 'tenant_id' },
  { table: 'serialized_components', column: 'custodian_tenant_id' },
  { table: 'aircraft_components', column: 'custodian_tenant_id' },
];

const FIXTURED_TABLES = TABLES.filter((t) => t.table !== 'aircraft_component_movement_history');

async function withOwner<T>(work: (c: pg.Client) => Promise<T>): Promise<T> {
  const { config } = await import('dotenv');
  config({ path: '.env.test', override: true, quiet: true });
  const c = new pg.Client({
    host: process.env.DB_MIGRATION_HOST,
    port: Number(process.env.DB_MIGRATION_PORT ?? '5432'),
    database: process.env.DB_MIGRATION_NAME,
    user: process.env.DB_MIGRATION_USER,
    password: process.env.DB_MIGRATION_PASSWORD,
  });
  await c.connect();
  try {
    return await work(c);
  } finally {
    await c.end();
  }
}

async function run(client: PoolClient, tenantId: string | null, work: (c: PoolClient) => Promise<unknown>) {
  await client.query('BEGIN');
  try {
    if (tenantId !== null) await client.query(`SELECT set_config('${GUC}', $1, true)`, [tenantId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

async function withContext<T>(tenantId: string, work: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return (await run(client, tenantId, work as (c: PoolClient) => Promise<unknown>)) as T;
  } finally {
    client.release();
  }
}

async function noContext<T>(work: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return (await run(client, null, work as (c: PoolClient) => Promise<unknown>)) as T;
  } finally {
    client.release();
  }
}

let tenantA: string;
let tenantB: string;
let userId: string;
let modelId: string;
let categoryId: string;
let statusId: string;
let templateId: string;
let manufacturerId: string;
let assetTypeId: string;

const ids: Record<string, { a: string; b: string }> = {};

beforeAll(async () => {
  await assertTestDatabaseSafety(pool);

  const user = await User.create({ email: `451-${SUFFIX}@example.test`, password_hash: 'x', full_name: '4.5.1 Fixture' });
  userId = user.id;
  const manufacturer = await Manufacturer.create({ code: `451M_${SUFFIX}`, name: '4.5.1 Mfg', is_active: true });
  manufacturerId = manufacturer.id;
  const assetType = await AssetType.create({ code: `451T_${SUFFIX}`, label: '4.5.1 Type', is_active: true });
  assetTypeId = assetType.id;
  const category = await AircraftCategory.create({ code: `451C_${SUFFIX}`, label: '4.5.1 Cat', is_active: true });
  categoryId = category.id;
  const model = await ComponentModel.create({ model_name: '4.5.1 Model', model_code: `451MOD_${SUFFIX}`, manufacturer_id: manufacturer.id, asset_type_id: assetType.id, is_active: true });
  modelId = model.id;
  const status = await WorkpackStatus.create({ code: `451S_${SUFFIX}`, label: '4.5.1 Status' });
  statusId = status.id;
  const template = await MaintenanceTemplate.create({ name: `451TPL_${SUFFIX}`, template_type: 'CUSTOM', model_id: modelId, is_active: true });
  templateId = template.id;

  const ta = await Tenant.create({ code: `POC451A_${SUFFIX}`, display_name: '4.5.1 A', status: 'ACTIVE', created_by_user_id: userId, updated_by_user_id: userId });
  const tb = await Tenant.create({ code: `POC451B_${SUFFIX}`, display_name: '4.5.1 B', status: 'ACTIVE', created_by_user_id: userId, updated_by_user_id: userId });
  tenantA = ta.id;
  tenantB = tb.id;

  // RLS-protected fixtures via the migration owner (superuser, bypasses RLS).
  await withOwner(async (c) => {
    for (const [label, tenantId] of [['a', tenantA], ['b', tenantB]] as const) {
      const aircraft = await c.query(
        `INSERT INTO public.aircraft (id, tenant_id, registration, serial_number, model_id, category_id)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`,
        [tenantId, `45-${label}-${SUFFIX}`, `45SN-${label}-${SUFFIX}`, modelId, categoryId]
      );
      ids.aircraft = { ...ids.aircraft, [label]: aircraft.rows[0].id };

      const customer = await c.query(
        `INSERT INTO public.customers (id, tenant_id, name, contact_person, email, phone)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`,
        [tenantId, `45C-${label}-${SUFFIX}`, 'C', `45c-${label}-${SUFFIX}@example.test`, '1']
      );
      ids.customers = { ...ids.customers, [label]: customer.rows[0].id };

      const planning = await c.query(
        `INSERT INTO public.planning_sessions (id, tenant_id, user_id, aircraft_id, template_id, maintenance_type)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'CUSTOM') RETURNING id`,
        [tenantId, userId, aircraft.rows[0].id, templateId]
      );
      ids.planning_sessions = { ...ids.planning_sessions, [label]: planning.rows[0].id };

      const workpack = await c.query(
        `INSERT INTO public.workpacks (id, tenant_id, work_order_number, aircraft_id, status_id)
         VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id`,
        [tenantId, `45W-${label}-${SUFFIX}`, aircraft.rows[0].id, statusId]
      );
      ids.workpacks = { ...ids.workpacks, [label]: workpack.rows[0].id };

      const batch = await c.query(
        `INSERT INTO public.migration_batches (id, tenant_id, migration_type)
         VALUES (gen_random_uuid(), $1, 'DRAFT') RETURNING id`,
        [tenantId]
      );
      ids.migration_batches = { ...ids.migration_batches, [label]: batch.rows[0].id };

      const serial = await c.query(
        `INSERT INTO public.serialized_components (id, custodian_tenant_id, component_model_id, serial_number)
         VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id`,
        [tenantId, modelId, `45S-${label}-${SUFFIX}`]
      );
      ids.serialized_components = { ...ids.serialized_components, [label]: serial.rows[0].id };

      const component = await c.query(
        `INSERT INTO public.aircraft_components (id, custodian_tenant_id, aircraft_id, model_id, serial_number, installation_date)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, CURRENT_DATE) RETURNING id`,
        [tenantId, aircraft.rows[0].id, modelId, `45AC-${label}-${SUFFIX}`]
      );
      ids.aircraft_components = { ...ids.aircraft_components, [label]: component.rows[0].id };
    }
  });
});

afterAll(async () => {
  await withOwner(async (c) => {
    // FK-safe delete order (children before parents).
    const t = (tenantA: string, tenantB: string) => [tenantA, tenantB] as const;
    await c.query(`DELETE FROM public.workpacks WHERE tenant_id = ANY($1::uuid[])`, [t(tenantA, tenantB)]);
    await c.query(`DELETE FROM public.planning_sessions WHERE tenant_id = ANY($1::uuid[])`, [t(tenantA, tenantB)]);
    await c.query(`DELETE FROM public.aircraft_components WHERE custodian_tenant_id = ANY($1::uuid[])`, [t(tenantA, tenantB)]);
    await c.query(`DELETE FROM public.serialized_components WHERE custodian_tenant_id = ANY($1::uuid[])`, [t(tenantA, tenantB)]);
    await c.query(`DELETE FROM public.customers WHERE tenant_id = ANY($1::uuid[])`, [t(tenantA, tenantB)]);
    await c.query(`DELETE FROM public.migration_batches WHERE tenant_id = ANY($1::uuid[])`, [t(tenantA, tenantB)]);
    await c.query(`DELETE FROM public.aircraft WHERE tenant_id = ANY($1::uuid[])`, [t(tenantA, tenantB)]);

    await c.query(`DELETE FROM public.maintenance_templates WHERE id = $1`, [templateId]);
    await c.query(`DELETE FROM public.component_models WHERE id = $1`, [modelId]);
    await c.query(`DELETE FROM public.rf_aircraft_category WHERE id = $1`, [categoryId]);
    await c.query(`DELETE FROM public.rf_workpack_status WHERE id = $1`, [statusId]);
    await c.query(`DELETE FROM public.manufacturers WHERE id = $1`, [manufacturerId]);
    await c.query(`DELETE FROM public.rf_asset_type WHERE id = $1`, [assetTypeId]);
  });
  // Tenants (and the shared user referenced by their created_by_user_id) are
  // intentionally left in place: tenant deletion is DB-prohibited.
  await Tenant.destroy({ where: { id: [tenantA, tenantB] } }).catch(() => undefined);
});

describe('4.5-1 direct + custody roots RLS', () => {
  it('all eight tables owned by jupiter_tenant_owner with FORCE RLS and one policy', async () => {
    const rows = await sequelize.query<{ relname: string; owner: string; relrowsecurity: boolean; relforcerowsecurity: boolean; policies: number }>(
      `SELECT c.relname, r.rolname AS owner, c.relrowsecurity, c.relforcerowsecurity,
              (SELECT count(*)::int FROM pg_policies p WHERE p.tablename = c.relname AND p.policyname LIKE '%_tenant_rls') AS policies
       FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
       WHERE c.relname = ANY(ARRAY[:tables]) ORDER BY c.relname`,
      { replacements: { tables: TABLES.map((t) => t.table) }, type: QueryTypes.SELECT },
    );
    expect(rows).toHaveLength(8);
    for (const r of rows) {
      expect(r.owner).toBe(OWNER);
      expect(r.relrowsecurity).toBe(true);
      expect(r.relforcerowsecurity).toBe(true);
      expect(r.policies).toBe(1);
    }
  });

  it('runtime cannot SET ROLE to the owner role', async () => {
    const [r] = await sequelize.query<{ test_can_set: boolean; app_can_set: boolean }>(
      `SELECT pg_has_role('jupiter_test', :owner, 'SET') AS test_can_set,
              pg_has_role('jupiter_app', :owner, 'SET') AS app_can_set`,
      { replacements: { owner: OWNER }, type: QueryTypes.SELECT },
    );
    expect(r).toMatchObject({ test_can_set: false, app_can_set: false });
  });

  it('missing context fails closed (SELECT) across all tables', async () => {
    await noContext(async (c) => {
      for (const { table } of TABLES) {
        expect((await c.query(`SELECT id FROM public.${table}`)).rowCount).toBe(0);
      }
    });
  });

  it('own-tenant SELECT succeeds across all tables', async () => {
    await withContext(tenantA, async (c) => {
      for (const { table } of FIXTURED_TABLES) {
        const r = await c.query(`SELECT id FROM public.${table} WHERE id = $1`, [ids[table].a]);
        expect(r.rowCount).toBe(1);
      }
    });
  });

  it('cross-tenant SELECT denied across all tables', async () => {
    await withContext(tenantA, async (c) => {
      for (const { table } of FIXTURED_TABLES) {
        const r = await c.query(`SELECT id FROM public.${table}`);
        expect(r.rows.map((x: any) => x.id)).not.toContain(ids[table].b);
        expect(r.rows.map((x: any) => x.id)).toContain(ids[table].a);
      }
    });
  });

  it('cross-tenant UPDATE and DELETE denied across all tables', async () => {
    await withContext(tenantA, async (c) => {
      for (const { table } of FIXTURED_TABLES) {
        expect((await c.query(`UPDATE public.${table} SET id = id WHERE id = $1`, [ids[table].b])).rowCount).toBe(0);
        expect((await c.query(`DELETE FROM public.${table} WHERE id = $1`, [ids[table].b])).rowCount).toBe(0);
      }
    });
  });

  it('cross-tenant INSERT denied (representative direct + custody)', async () => {
    await withContext(tenantA, async (c) => {
      await expect(
        c.query(`INSERT INTO public.customers (id, tenant_id, name, contact_person, email, phone) VALUES (gen_random_uuid(), $1, 'X', 'X', 'x@example.test', '1') RETURNING id`, [tenantB]),
      ).rejects.toThrow(/row-level security/);
    });
    await withContext(tenantA, async (c) => {
      await expect(
        c.query(`INSERT INTO public.serialized_components (id, custodian_tenant_id, component_model_id, serial_number) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id`, [tenantB, modelId, `XC-${SUFFIX}`]),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it('own-tenant INSERT/UPDATE/DELETE succeed for a representative direct + custody pair', async () => {
    await withContext(tenantA, async (c) => {
      const cIns = await c.query(
        `INSERT INTO public.customers (id, tenant_id, name, contact_person, email, phone)
         VALUES (gen_random_uuid(), $1, $2, 'W', $3, '1') RETURNING id`,
        [tenantA, `WI-${SUFFIX}`, `wi-${SUFFIX}@example.test`],
      );
      expect(cIns.rowCount).toBe(1);
      const cid = cIns.rows[0].id;
      expect((await c.query(`UPDATE public.customers SET name = $1 WHERE id = $2`, [`WU-${SUFFIX}`, cid])).rowCount).toBe(1);
      expect((await c.query(`DELETE FROM public.customers WHERE id = $1`, [cid])).rowCount).toBe(1);

      const sIns = await c.query(
        `INSERT INTO public.serialized_components (id, custodian_tenant_id, component_model_id, serial_number)
         VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id`,
        [tenantA, modelId, `WS-${SUFFIX}`],
      );
      expect(sIns.rowCount).toBe(1);
      const sid = sIns.rows[0].id;
      expect((await c.query(`UPDATE public.serialized_components SET serial_number = $1 WHERE id = $2`, [`WU-${SUFFIX}`, sid])).rowCount).toBe(1);
      expect((await c.query(`DELETE FROM public.serialized_components WHERE id = $1`, [sid])).rowCount).toBe(1);
    });
  });

  it('aircraft_component_movement_history preserves event-time immutability', async () => {
    const [trig] = await sequelize.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'tr_aircraft_component_movement_immutable' AND tgenabled <> 'D'`,
      { type: QueryTypes.SELECT },
    );
    expect(trig.n).toBe(1);
  });

  it('transaction-local context does not leak across pooled connections', async () => {
    await withContext(tenantA, async (c) => {
      expect((await c.query(`SELECT count(*)::int AS n FROM public.customers`)).rows[0].n).toBeGreaterThanOrEqual(1);
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      expect((await client.query(`SELECT id FROM public.customers`)).rowCount).toBe(0);
      await client.query(`SELECT set_config('${GUC}', $1, true)`, [tenantB]);
      const b = await client.query(`SELECT id FROM public.customers`);
      expect(b.rows.map((r: any) => r.id)).toContain(ids.customers.b);
      expect(b.rows.map((r: any) => r.id)).not.toContain(ids.customers.a);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });

  it('existing runtime ACL restrictions remain unchanged', async () => {
    const [r] = await sequelize.query<{ movement_delete: boolean; movement_update: boolean }>(
      `SELECT has_table_privilege('jupiter_test', 'public.aircraft_component_movement_history', 'DELETE') AS movement_delete,
              has_table_privilege('jupiter_test', 'public.aircraft_component_movement_history', 'UPDATE') AS movement_update`,
      { type: QueryTypes.SELECT },
    );
    expect(r.movement_delete).toBe(false);
    expect(r.movement_update).toBe(false);
  });
});


