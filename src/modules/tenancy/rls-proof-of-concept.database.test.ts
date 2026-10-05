import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg, { type PoolClient } from 'pg';
import { pool } from '../../config/database.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import { Customer, CustomerUser, Tenant, User } from '../../models/index.js';

const DIRECT = 'customers';
const INDIRECT = 'customer_users';
const GUC = 'jupiter.tenant_id';

async function run(client: PoolClient, tenantId: string | null, work: (c: PoolClient) => Promise<unknown>) {
  await client.query('BEGIN');
  try {
    if (tenantId !== null) {
      await client.query(`SELECT set_config('${GUC}', $1, true)`, [tenantId]);
    }
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
let customerA: string;
let customerB: string;
let customerA2: string; // no dependent customer_users, for own DELETE
let userA: string;
let userB: string;
const SUFFIX = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();

async function withOwner<T>(work: (c: pg.Client) => Promise<T>): Promise<T> {
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

async function applyPolicies(): Promise<void> {
  await withOwner(async (c) => {
    await c.query(`ALTER TABLE public.${DIRECT} ENABLE ROW LEVEL SECURITY`);
    await c.query(`ALTER TABLE public.${DIRECT} FORCE ROW LEVEL SECURITY`);
    await c.query(
      `CREATE POLICY ${DIRECT}_tenant_rls_44 ON public.${DIRECT}
         FOR ALL
         USING (tenant_id = NULLIF(current_setting('${GUC}', true), '')::uuid)
         WITH CHECK (tenant_id = NULLIF(current_setting('${GUC}', true), '')::uuid)`
    );
    await c.query(`ALTER TABLE public.${INDIRECT} ENABLE ROW LEVEL SECURITY`);
    await c.query(`ALTER TABLE public.${INDIRECT} FORCE ROW LEVEL SECURITY`);
    await c.query(
      `CREATE POLICY ${INDIRECT}_tenant_rls_44 ON public.${INDIRECT}
         FOR ALL
         USING (EXISTS (
           SELECT 1 FROM public.${DIRECT} c
           WHERE c.id = ${INDIRECT}.customer_id
             AND c.tenant_id = NULLIF(current_setting('${GUC}', true), '')::uuid
         ))
         WITH CHECK (EXISTS (
           SELECT 1 FROM public.${DIRECT} c
           WHERE c.id = ${INDIRECT}.customer_id
             AND c.tenant_id = NULLIF(current_setting('${GUC}', true), '')::uuid
         ))`
    );
  });
}

async function dropPolicies(): Promise<void> {
  await withOwner(async (c) => {
    await c.query(`DROP POLICY IF EXISTS ${DIRECT}_tenant_rls_44 ON public.${DIRECT}`);
    await c.query(`DROP POLICY IF EXISTS ${INDIRECT}_tenant_rls_44 ON public.${INDIRECT}`);
  });
}

let customerUserA: string;
let customerUserB: string;

beforeAll(async () => {
  await assertTestDatabaseSafety(pool);

  userA = (await User.create({ email: `poc-a-${SUFFIX}@example.test`, password_hash: 'x', full_name: 'POC A', is_active: true })).id;
  userB = (await User.create({ email: `poc-b-${SUFFIX}@example.test`, password_hash: 'x', full_name: 'POC B', is_active: true })).id;
  tenantA = (await Tenant.create({ code: `POC_A_${SUFFIX}`, display_name: 'POC A', status: 'ACTIVE', created_by_user_id: userA, updated_by_user_id: userA })).id;
  tenantB = (await Tenant.create({ code: `POC_B_${SUFFIX}`, display_name: 'POC B', status: 'ACTIVE', created_by_user_id: userB, updated_by_user_id: userB })).id;
  customerA = (await Customer.create({ tenant_id: tenantA, name: `A-${SUFFIX}`, contact_person: 'A', email: `ca-${SUFFIX}@example.test`, phone: '1', status: 'ACTIVE' })).id;
  customerB = (await Customer.create({ tenant_id: tenantB, name: `B-${SUFFIX}`, contact_person: 'B', email: `cb-${SUFFIX}@example.test`, phone: '1', status: 'ACTIVE' })).id;
  customerA2 = (await Customer.create({ tenant_id: tenantA, name: `A2-${SUFFIX}`, contact_person: 'A2', email: `ca2-${SUFFIX}@example.test`, phone: '1', status: 'ACTIVE' })).id;
  customerUserA = (await CustomerUser.create({ customer_id: customerA, email: `ua-${SUFFIX}@example.test`, display_name: 'UA', status: 'ACTIVE' })).id;
  customerUserB = (await CustomerUser.create({ customer_id: customerB, email: `ub-${SUFFIX}@example.test`, display_name: 'UB', status: 'ACTIVE' })).id;

  await applyPolicies();
});

afterAll(async () => {
  await dropPolicies();
  await pool.query(`DELETE FROM public.customer_users WHERE customer_id = ANY($1::uuid[])`, [[customerA, customerA2, customerB]]);
  await pool.query(`DELETE FROM public.customers WHERE id = ANY($1::uuid[])`, [[customerA, customerA2, customerB]]);
  // Tenants and Users are intentionally left in place: tenant deletion is
  // DB-prohibited by tr_tenants_delete_prohibited (migration 601), and the
  // created users are referenced by those tenants' created_by_user_id FK.
  // This residue is confined to the disposable jupiter_test database.
});

describe.skip('4.4 RLS proof of concept (superseded by 4.5-1 direct-custody RLS + 4.5-3 workpack RLS)', () => {
  it('missing context fails closed for SELECT/INSERT/UPDATE/DELETE', async () => {
    await noContext(async (c) => {
      expect((await c.query(`SELECT id FROM public.${DIRECT}`)).rowCount).toBe(0);
      expect((await c.query(`UPDATE public.${DIRECT} SET name = $1 WHERE id = $2`, [`X-${SUFFIX}`, customerA])).rowCount).toBe(0);
      expect((await c.query(`DELETE FROM public.${DIRECT} WHERE id = $1`, [customerA])).rowCount).toBe(0);
      await expect(
        c.query(
          `INSERT INTO public.${DIRECT} (id, tenant_id, name, contact_person, email, phone, status)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'ACTIVE') RETURNING id`,
          [tenantA, `MISS-${SUFFIX}`, 'X', 'x@example.test', '1']
        )
      ).rejects.toThrow(/row-level security/);
    });
  });

  it('own-tenant SELECT/INSERT/UPDATE/DELETE succeed (direct)', async () => {
    await withContext(tenantA, async (c) => {
      const sel = await c.query(`SELECT id FROM public.${DIRECT} WHERE tenant_id = $1`, [tenantA]);
      expect(sel.rowCount).toBeGreaterThanOrEqual(2);

      const ins = await c.query(
        `INSERT INTO public.${DIRECT} (id, tenant_id, name, contact_person, email, phone, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'ACTIVE') RETURNING id`,
        [tenantA, `OWN-${SUFFIX}`, 'OWN', 'own@example.test', '1']
      );
      expect(ins.rowCount).toBe(1);
      const ownId = ins.rows[0].id;

      expect((await c.query(`UPDATE public.${DIRECT} SET name = $1 WHERE id = $2`, [`OWN2-${SUFFIX}`, ownId])).rowCount).toBe(1);
      expect((await c.query(`DELETE FROM public.${DIRECT} WHERE id = $1`, [ownId])).rowCount).toBe(1);
    });
  });

  it('cross-tenant SELECT/INSERT/UPDATE/DELETE denied (direct)', async () => {
    await withContext(tenantA, async (c) => {
      const sel = await c.query(`SELECT id FROM public.${DIRECT}`);
      expect(sel.rows.map((r: any) => r.id)).not.toContain(customerB);
      expect((await c.query(`UPDATE public.${DIRECT} SET name = $1 WHERE id = $2`, [`X-${SUFFIX}`, customerB])).rowCount).toBe(0);
      expect((await c.query(`DELETE FROM public.${DIRECT} WHERE id = $1`, [customerB])).rowCount).toBe(0);
      await expect(
        c.query(
          `INSERT INTO public.${DIRECT} (id, tenant_id, name, contact_person, email, phone, status)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'ACTIVE') RETURNING id`,
          [tenantB, `CROSS-${SUFFIX}`, 'X', 'cross@example.test', '1']
        )
      ).rejects.toThrow(/row-level security/);
    });
  });

  it('own-tenant SELECT/INSERT/UPDATE/DELETE succeed (indirect)', async () => {
    await withContext(tenantA, async (c) => {
      const sel = await c.query(`SELECT id FROM public.${INDIRECT} WHERE customer_id = $1`, [customerA]);
      expect(sel.rowCount).toBeGreaterThanOrEqual(1);

      const ins = await c.query(
        `INSERT INTO public.${INDIRECT} (id, customer_id, email, display_name, status)
         VALUES (gen_random_uuid(), $1, $2, $3, 'ACTIVE') RETURNING id`,
        [customerA, `ownu-${SUFFIX}@example.test`, 'OWNU']
      );
      expect(ins.rowCount).toBe(1);
      const uid = ins.rows[0].id;

      expect((await c.query(`UPDATE public.${INDIRECT} SET display_name = 'OWNU2' WHERE id = $1`, [uid])).rowCount).toBe(1);
      expect((await c.query(`DELETE FROM public.${INDIRECT} WHERE id = $1`, [uid])).rowCount).toBe(1);
    });
  });

  it('cross-tenant SELECT/INSERT/UPDATE/DELETE denied (indirect); parent cannot be crossed', async () => {
    await withContext(tenantA, async (c) => {
      const sel = await c.query(`SELECT id FROM public.${INDIRECT}`);
      expect(sel.rows.map((r: any) => r.id)).not.toContain(customerUserB);
      expect(sel.rows.map((r: any) => r.id)).toContain(customerUserA);
      expect((await c.query(`UPDATE public.${INDIRECT} SET display_name = 'X' WHERE id = $1`, [customerUserB])).rowCount).toBe(0);
      expect((await c.query(`DELETE FROM public.${INDIRECT} WHERE id = $1`, [customerUserB])).rowCount).toBe(0);
      await expect(
        c.query(
          `INSERT INTO public.${INDIRECT} (id, customer_id, email, display_name, status)
           VALUES (gen_random_uuid(), $1, $2, $3, 'ACTIVE') RETURNING id`,
          [customerB, `crossu-${SUFFIX}@example.test`, 'CROSSU']
        )
      ).rejects.toThrow(/row-level security/);
    });
  });

  it('connection-pool reuse carries no tenant context', async () => {
    await withContext(tenantA, async (c) => {
      expect((await c.query(`SELECT count(*)::int AS n FROM public.${DIRECT}`)).rows[0].n).toBeGreaterThanOrEqual(1);
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = await client.query(`SELECT current_setting('${GUC}', true) AS guc`);
      // Transaction-local set_config reverts to '' (not NULL) on a reused connection.
      expect(['', null]).toContain(before.rows[0].guc);

      // Fail-closed: with absent context, no tenant data is visible via RLS.
      expect((await client.query(`SELECT id FROM public.${DIRECT}`)).rowCount).toBe(0);

      await client.query(`SELECT set_config('${GUC}', $1, true)`, [tenantB]);
      const b = await client.query(`SELECT id FROM public.${DIRECT}`);
      expect(b.rows.map((r: any) => r.id)).toContain(customerB);
      expect(b.rows.map((r: any) => r.id)).not.toContain(customerA);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });

  it('RLS query plans are index-aware (performance)', async () => {
    await withContext(tenantA, async (c) => {
      const direct = await c.query(`EXPLAIN SELECT id FROM public.${DIRECT} WHERE tenant_id = current_setting('${GUC}', true)::uuid`);
      console.log('[RLS direct EXPLAIN]\n' + direct.rows.map((r: any) => r['QUERY PLAN']).join('\n'));
      const indirect = await c.query(`EXPLAIN SELECT id FROM public.${INDIRECT}`);
      console.log('[RLS indirect EXPLAIN]\n' + indirect.rows.map((r: any) => r['QUERY PLAN']).join('\n'));
    });
    const idx = await pool.query(
      `SELECT tablename, indexname FROM pg_indexes
       WHERE tablename IN ('${DIRECT}','${INDIRECT}')
         AND (indexname ILIKE '%tenant%' OR indexname ILIKE '%customer%')
       ORDER BY tablename, indexname`
    );
    console.log('[RLS relevant indexes] ' + JSON.stringify(idx.rows));
  });
});



