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
  'utilisation_events',
  'aircraft_sb_compliance',
  'aircraft_compliance',
  'aircraft_sid_status',
  'customer_users',
  'customer_aircraft_links',
  'serialized_component_life_states',
  'serialized_component_maintenance_events',
  'aircraft_component_installations',
] as const;

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
let manufacturerId: string;
let assetTypeId: string;
let categoryId: string;
const ids: Record<string, { a: string; b: string }> = {};
let crossLinkId: string; // customer A + aircraft B (mismatched dual root)
let crossInstallId: string; // aircraft A + serialized B (mismatched dual root)

const parents: Record<string, { a: string; b: string }> = {};

beforeAll(async () => {
  await assertTestDatabaseSafety(pool);

  const user = await User.create({ email: `452-${SUFFIX}@example.test`, password_hash: 'x', full_name: '4.5.2 Fixture' });
  userId = user.id;
  const { Manufacturer, AssetType, AircraftCategory, ComponentModel } = await import('../../models/index.js');
  const manufacturer = await Manufacturer.create({ code: `452M_${SUFFIX}`, name: '4.5.2 Mfg', is_active: true });
  manufacturerId = manufacturer.id;
  const assetType = await AssetType.create({ code: `452T_${SUFFIX}`, label: '4.5.2 Type', is_active: true });
  assetTypeId = assetType.id;
  const category = await AircraftCategory.create({ code: `452C_${SUFFIX}`, label: '4.5.2 Cat', is_active: true });
  categoryId = category.id;
  const model = await ComponentModel.create({ model_name: '4.5.2 Model', model_code: `452MOD_${SUFFIX}`, manufacturer_id: manufacturer.id, asset_type_id: assetType.id, is_active: true });
  modelId = model.id;
  const ta = await Tenant.create({ code: `POC452A_${SUFFIX}`, display_name: '4.5.2 A', status: 'ACTIVE', created_by_user_id: userId, updated_by_user_id: userId });
  const tb = await Tenant.create({ code: `POC452B_${SUFFIX}`, display_name: '4.5.2 B', status: 'ACTIVE', created_by_user_id: userId, updated_by_user_id: userId });
  tenantA = ta.id;
  tenantB = tb.id;

  await withOwner(async (c) => {
    const sb = await c.query(`INSERT INTO public.service_bulletins (id, sb_number, title, reference) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id`, [`452SB-${SUFFIX}`, '4.5.2 SB', 'REF']);
    const ci = await c.query(`INSERT INTO public.compliance_items (id, item_type, code, title, source_id, source_type) VALUES (gen_random_uuid(), 'SB', $1, $2, gen_random_uuid(), 'SB') RETURNING id`, [`452CI-${SUFFIX}`, '4.5.2 CI']);
    const sid = await c.query(`INSERT INTO public.cessna_sids (id, sid_number, title) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [`452SID-${SUFFIX}`, '4.5.2 SID']);

    for (const [label, tenantId] of [['a', tenantA], ['b', tenantB]] as const) {
      const aircraft = await c.query(`INSERT INTO public.aircraft (id, tenant_id, registration, serial_number, model_id, category_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`, [tenantId, `452-${label}-${SUFFIX}`, `452SN-${label}-${SUFFIX}`, model.id, category.id]);
      const customer = await c.query(`INSERT INTO public.customers (id, tenant_id, name, contact_person, email, phone) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`, [tenantId, `452C-${label}-${SUFFIX}`, 'C', `452c-${label}-${SUFFIX}@example.test`, '1']);
      const serial = await c.query(`INSERT INTO public.serialized_components (id, custodian_tenant_id, component_model_id, serial_number) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id`, [tenantId, model.id, `452S-${label}-${SUFFIX}`]);
      const aircraftId = aircraft.rows[0].id;
      const customerId = customer.rows[0].id;
      const serialId = serial.rows[0].id;
      parents.aircraft = { ...parents.aircraft, [label]: aircraftId };
      parents.customers = { ...parents.customers, [label]: customerId };
      parents.serialized_components = { ...parents.serialized_components, [label]: serialId };

      ids.utilisation_events = { ...ids.utilisation_events, [label]: (await c.query(`INSERT INTO public.utilisation_events (id, aircraft_id, source_type, effective_date, previous_total_time_hours, new_total_time_hours, delta_hours, previous_total_time_cycles, new_total_time_cycles, delta_cycles, reason) VALUES (gen_random_uuid(), $1, 'FLIGHT', CURRENT_DATE, 0, 1, 1, 0, 0, 0, 'test') RETURNING id`, [aircraftId])).rows[0].id };
      ids.aircraft_sb_compliance = { ...ids.aircraft_sb_compliance, [label]: (await c.query(`INSERT INTO public.aircraft_sb_compliance (id, aircraft_id, service_bulletin_id, status) VALUES (gen_random_uuid(), $1, $2, 'PENDING') RETURNING id`, [aircraftId, sb.rows[0].id])).rows[0].id };
      ids.aircraft_compliance = { ...ids.aircraft_compliance, [label]: (await c.query(`INSERT INTO public.aircraft_compliance (id, aircraft_id, compliance_item_id, status) VALUES (gen_random_uuid(), $1, $2, 'DUE') RETURNING id`, [aircraftId, ci.rows[0].id])).rows[0].id };
      ids.aircraft_sid_status = { ...ids.aircraft_sid_status, [label]: (await c.query(`INSERT INTO public.aircraft_sid_status (id, aircraft_id, sid_id, status) VALUES (gen_random_uuid(), $1, $2, 'OPEN') RETURNING id`, [aircraftId, sid.rows[0].id])).rows[0].id };
      ids.customer_users = { ...ids.customer_users, [label]: (await c.query(`INSERT INTO public.customer_users (id, customer_id, email, display_name) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id`, [customerId, `452u-${label}-${SUFFIX}@example.test`, `U${label.toUpperCase()}`])).rows[0].id };
      ids.customer_aircraft_links = { ...ids.customer_aircraft_links, [label]: (await c.query(`INSERT INTO public.customer_aircraft_links (id, customer_id, aircraft_id, relationship_type, is_current, start_date) VALUES (gen_random_uuid(), $1, $2, 'OWNER', true, CURRENT_DATE) RETURNING id`, [customerId, aircraftId])).rows[0].id };
      ids.serialized_component_life_states = { ...ids.serialized_component_life_states, [label]: (await c.query(`INSERT INTO public.serialized_component_life_states (id, serialized_component_id) VALUES (gen_random_uuid(), $1) RETURNING id`, [serialId])).rows[0].id };
      ids.serialized_component_maintenance_events = { ...ids.serialized_component_maintenance_events, [label]: (await c.query(`INSERT INTO public.serialized_component_maintenance_events (id, serialized_component_id, event_type) VALUES (gen_random_uuid(), $1, 'INSPECTION') RETURNING id`, [serialId])).rows[0].id };
      ids.aircraft_component_installations = { ...ids.aircraft_component_installations, [label]: (await c.query(`INSERT INTO public.aircraft_component_installations (id, aircraft_id, serialized_component_id, installed_at) VALUES (gen_random_uuid(), $1, $2, CURRENT_DATE) RETURNING id`, [aircraftId, serialId])).rows[0].id };
    }

    crossLinkId = (await c.query(`INSERT INTO public.customer_aircraft_links (id, customer_id, aircraft_id, relationship_type, is_current, start_date) VALUES (gen_random_uuid(), $1, $2, 'OPERATOR', true, CURRENT_DATE) RETURNING id`, [parents.customers.a, parents.aircraft.b])).rows[0].id;
    crossInstallId = (await c.query(`INSERT INTO public.aircraft_component_installations (id, aircraft_id, serialized_component_id, installed_at) VALUES (gen_random_uuid(), $1, $2, CURRENT_DATE) RETURNING id`, [parents.aircraft.a, parents.serialized_components.b])).rows[0].id;
  });
});

afterAll(async () => {
  await withOwner(async (c) => {
    const aircrafts = [parents.aircraft.a, parents.aircraft.b];
    const customers = [parents.customers.a, parents.customers.b];
    const serials = [parents.serialized_components.a, parents.serialized_components.b];
    await c.query(`DELETE FROM public.aircraft_component_installations WHERE aircraft_id = ANY($1::uuid[]) OR serialized_component_id = ANY($2::uuid[])`, [aircrafts, serials]);
    await c.query(`DELETE FROM public.customer_aircraft_links WHERE customer_id = ANY($1::uuid[]) OR aircraft_id = ANY($2::uuid[])`, [customers, aircrafts]);
    await c.query(`DELETE FROM public.serialized_component_maintenance_events WHERE serialized_component_id = ANY($1::uuid[])`, [serials]);
    await c.query(`DELETE FROM public.serialized_component_life_states WHERE serialized_component_id = ANY($1::uuid[])`, [serials]);
    await c.query(`DELETE FROM public.customer_users WHERE customer_id = ANY($1::uuid[])`, [customers]);
    await c.query(`DELETE FROM public.aircraft_sid_status WHERE aircraft_id = ANY($1::uuid[])`, [aircrafts]);
    await c.query(`DELETE FROM public.aircraft_compliance WHERE aircraft_id = ANY($1::uuid[])`, [aircrafts]);
    await c.query(`DELETE FROM public.aircraft_sb_compliance WHERE aircraft_id = ANY($1::uuid[])`, [aircrafts]);
    // utilisation_events is immutable; temporarily disable its prevent triggers to remove test fixtures, then re-enable.
    await c.query(`ALTER TABLE public.utilisation_events DISABLE TRIGGER utilisation_events_prevent_delete`);
    await c.query(`ALTER TABLE public.utilisation_events DISABLE TRIGGER utilisation_events_prevent_update`);
    await c.query(`DELETE FROM public.utilisation_events WHERE aircraft_id = ANY($1::uuid[])`, [aircrafts]);
    await c.query(`ALTER TABLE public.utilisation_events ENABLE TRIGGER utilisation_events_prevent_delete`);
    await c.query(`ALTER TABLE public.utilisation_events ENABLE TRIGGER utilisation_events_prevent_update`);
    await c.query(`DELETE FROM public.aircraft WHERE tenant_id = ANY($1::uuid[])`, [[tenantA, tenantB]]);
    await c.query(`DELETE FROM public.customers WHERE tenant_id = ANY($1::uuid[])`, [[tenantA, tenantB]]);
    await c.query(`DELETE FROM public.serialized_components WHERE custodian_tenant_id = ANY($1::uuid[])`, [[tenantA, tenantB]]);
    await c.query(`DELETE FROM public.service_bulletins WHERE sb_number = $1`, [`452SB-${SUFFIX}`]);
    await c.query(`DELETE FROM public.compliance_items WHERE code = $1`, [`452CI-${SUFFIX}`]);
    await c.query(`DELETE FROM public.cessna_sids WHERE sid_number = $1`, [`452SID-${SUFFIX}`]);
    await c.query(`DELETE FROM public.component_models WHERE id = $1`, [modelId]);
    await c.query(`DELETE FROM public.rf_aircraft_category WHERE id = $1`, [categoryId]);
    await c.query(`DELETE FROM public.manufacturers WHERE id = $1`, [manufacturerId]);
    await c.query(`DELETE FROM public.rf_asset_type WHERE id = $1`, [assetTypeId]);
  });
  await Tenant.destroy({ where: { id: [tenantA, tenantB] } }).catch(() => undefined);
});

describe('4.5-2 aircraft + customer + component children RLS', () => {
  it('all nine tables owned by jupiter_tenant_owner with FORCE RLS and one policy', async () => {
    const rows = await sequelize.query<{ relname: string; owner: string; relrowsecurity: boolean; relforcerowsecurity: boolean; policies: number }>(
      `SELECT c.relname, r.rolname AS owner, c.relrowsecurity, c.relforcerowsecurity,
              (SELECT count(*)::int FROM pg_policies p WHERE p.tablename = c.relname AND p.policyname LIKE '%_tenant_rls') AS policies
       FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
       WHERE c.relname = ANY(ARRAY[:tables]) ORDER BY c.relname`,
      { replacements: { tables: TABLES }, type: QueryTypes.SELECT },
    );
    expect(rows).toHaveLength(9);
    for (const r of rows) {
      expect(r.owner).toBe(OWNER);
      expect(r.relrowsecurity).toBe(true);
      expect(r.relforcerowsecurity).toBe(true);
      expect(r.policies).toBe(1);
    }
  });

  it('missing context fails closed (SELECT) across all tables', async () => {
    await noContext(async (c) => {
      for (const table of TABLES) {
        expect((await c.query(`SELECT id FROM public.${table}`)).rowCount).toBe(0);
      }
    });
  });

  it('own-tenant SELECT succeeds across all tables', async () => {
    await withContext(tenantA, async (c) => {
      for (const table of TABLES) {
        expect((await c.query(`SELECT id FROM public.${table} WHERE id = $1`, [ids[table].a])).rowCount).toBe(1);
      }
    });
  });

  it('cross-tenant SELECT denied across all tables', async () => {
    await withContext(tenantA, async (c) => {
      for (const table of TABLES) {
        const r = await c.query(`SELECT id FROM public.${table}`);
        expect(r.rows.map((x: any) => x.id)).not.toContain(ids[table].b);
        expect(r.rows.map((x: any) => x.id)).toContain(ids[table].a);
      }
    });
  });

  it('cross-tenant UPDATE and DELETE denied across mutable tables', async () => {
    await withContext(tenantA, async (c) => {
      for (const table of TABLES.filter((t) => t !== 'utilisation_events')) {
        expect((await c.query(`UPDATE public.${table} SET id = id WHERE id = $1`, [ids[table].b])).rowCount).toBe(0);
        expect((await c.query(`DELETE FROM public.${table} WHERE id = $1`, [ids[table].b])).rowCount).toBe(0);
      }
    });
  });

  it('utilisation_events preserves event-time immutability', async () => {
    const [trig] = await sequelize.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_trigger WHERE tgrelid = 'utilisation_events'::regclass AND NOT tgisinternal AND tgenabled <> 'D'`,
      { type: QueryTypes.SELECT },
    );
    expect(trig.n).toBeGreaterThanOrEqual(1);
  });

  it('cross-tenant INSERT denied (representative customer child)', async () => {
    await withContext(tenantA, async (c) => {
      await expect(
        c.query(`INSERT INTO public.customer_users (id, customer_id, email, display_name) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id`, [parents.customers.b, `452x-${SUFFIX}@example.test`, 'X']),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it('own-tenant INSERT/UPDATE/DELETE succeed (representative customer child)', async () => {
    await withContext(tenantA, async (c) => {
      const ins = await c.query(`INSERT INTO public.customer_users (id, customer_id, email, display_name) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id`, [parents.customers.a, `452o-${SUFFIX}@example.test`, 'OWN']);
      expect(ins.rowCount).toBe(1);
      const id = ins.rows[0].id;
      expect((await c.query(`UPDATE public.customer_users SET display_name = 'OWN2' WHERE id = $1`, [id])).rowCount).toBe(1);
      expect((await c.query(`DELETE FROM public.customer_users WHERE id = $1`, [id])).rowCount).toBe(1);
    });
  });

  it('dual-root disagreement fails closed (customer_aircraft_links + installations)', async () => {
    await withContext(tenantA, async (c) => {
      // customer A + aircraft B link is invisible to A (customer matches, aircraft doesn't)
      const a = await c.query(`SELECT id FROM public.customer_aircraft_links WHERE id = $1`, [crossLinkId]);
      expect(a.rowCount).toBe(0);
      // aircraft A + serialized B installation is invisible to A (aircraft matches, custody doesn't)
      const b = await c.query(`SELECT id FROM public.aircraft_component_installations WHERE id = $1`, [crossInstallId]);
      expect(b.rowCount).toBe(0);
    });
    await withContext(tenantB, async (c) => {
      const a = await c.query(`SELECT id FROM public.customer_aircraft_links WHERE id = $1`, [crossLinkId]);
      expect(a.rowCount).toBe(0);
      const b = await c.query(`SELECT id FROM public.aircraft_component_installations WHERE id = $1`, [crossInstallId]);
      expect(b.rowCount).toBe(0);
    });
  });

  it('transaction-local context does not leak across pooled connections', async () => {
    await withContext(tenantA, async (c) => {
      expect((await c.query(`SELECT count(*)::int AS n FROM public.customer_users`)).rows[0].n).toBeGreaterThanOrEqual(1);
    });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      expect((await client.query(`SELECT id FROM public.customer_users`)).rowCount).toBe(0);
      await client.query(`SELECT set_config('${GUC}', $1, true)`, [tenantB]);
      const b = await client.query(`SELECT id FROM public.customer_users`);
      expect(b.rows.map((r: any) => r.id)).toContain(ids.customer_users.b);
      expect(b.rows.map((r: any) => r.id)).not.toContain(ids.customer_users.a);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });
});




