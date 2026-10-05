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
const P = `456-${SUFFIX}`;

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
async function visible(tenantId: string, table: string, id: string): Promise<boolean> {
  return withContext(tenantId, async (c) => (await c.query(`SELECT id FROM public.${table} WHERE id = $1`, [id])).rowCount === 1);
}
async function visibleNoContext(table: string, id: string): Promise<boolean> {
  return noContext(async (c) => (await c.query(`SELECT id FROM public.${table} WHERE id = $1`, [id])).rowCount === 1);
}

let tenantA: string; let tenantB: string;
const f: Record<string, string> = {};

beforeAll(async () => {
  await assertTestDatabaseSafety(pool);
  const userA = await User.create({ email: `${P}a@example.test`, password_hash: 'x', full_name: '4.5.5 A' });
  const userB = await User.create({ email: `${P}b@example.test`, password_hash: 'x', full_name: '4.5.5 B' });
  const ta = await Tenant.create({ code: `POC456A_${SUFFIX}`, display_name: '4.5.5 A', status: 'ACTIVE', created_by_user_id: userA.id, updated_by_user_id: userA.id });
  const tb = await Tenant.create({ code: `POC456B_${SUFFIX}`, display_name: '4.5.5 B', status: 'ACTIVE', created_by_user_id: userB.id, updated_by_user_id: userB.id });
  tenantA = ta.id; tenantB = tb.id;
  f.userA = userA.id; f.userB = userB.id;

  await withOwner(async (c) => {
    let adminRole = (await c.query(`SELECT id FROM rf_role WHERE code='ENGINEER' AND is_active=true LIMIT 1`)).rows[0];
    if (!adminRole) {
      adminRole = (await c.query(`INSERT INTO rf_role (id, code, label) VALUES (gen_random_uuid(), 'ENGINEER', 'Engineer') RETURNING id`)).rows[0];
    }
    const roleId = adminRole.id;

    const memA = (await c.query(`INSERT INTO public.tenant_memberships (id, tenant_id, user_id, status, joined_at, created_by_user_id, updated_by_user_id) VALUES (gen_random_uuid(), $1, $2, 'ACTIVE', CURRENT_TIMESTAMP, $2, $2) RETURNING id`, [tenantA, userA.id])).rows[0].id;
    const memB = (await c.query(`INSERT INTO public.tenant_memberships (id, tenant_id, user_id, status, joined_at, created_by_user_id, updated_by_user_id) VALUES (gen_random_uuid(), $1, $2, 'ACTIVE', CURRENT_TIMESTAMP, $2, $2) RETURNING id`, [tenantB, userB.id])).rows[0].id;
    const roleA = (await c.query(`INSERT INTO public.tenant_membership_roles (id, membership_id, role_id, assigned_by_user_id) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id`, [memA, roleId, userA.id])).rows[0].id;
    const roleB = (await c.query(`INSERT INTO public.tenant_membership_roles (id, membership_id, role_id, assigned_by_user_id) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id`, [memB, roleId, userB.id])).rows[0].id;

    const mbA = (await c.query(`INSERT INTO public.migration_batches (id, tenant_id, migration_type, status) VALUES (gen_random_uuid(), $1, 'LEGACY', 'DRAFT') RETURNING id`, [tenantA])).rows[0].id;
    const mbB = (await c.query(`INSERT INTO public.migration_batches (id, tenant_id, migration_type, status) VALUES (gen_random_uuid(), $1, 'LEGACY', 'DRAFT') RETURNING id`, [tenantB])).rows[0].id;
    const brA = (await c.query(`INSERT INTO public.migration_batch_rows (id, batch_id, source_table, source_row_id, status) VALUES (gen_random_uuid(), $1, 'aircraft_components', gen_random_uuid(), 'PENDING') RETURNING id`, [mbA])).rows[0].id;
    const brB = (await c.query(`INSERT INTO public.migration_batch_rows (id, batch_id, source_table, source_row_id, status) VALUES (gen_random_uuid(), $1, 'aircraft_components', gen_random_uuid(), 'PENDING') RETURNING id`, [mbB])).rows[0].id;
    const ctA = (await c.query(`INSERT INTO public.migration_created_targets (id, batch_id, batch_row_id, target_table, target_row_id, rollback_status) VALUES (gen_random_uuid(), $1, $2, 'serialized_components', gen_random_uuid(), 'PENDING') RETURNING id`, [mbA, brA])).rows[0].id;
    const ctB = (await c.query(`INSERT INTO public.migration_created_targets (id, batch_id, batch_row_id, target_table, target_row_id, rollback_status) VALUES (gen_random_uuid(), $1, $2, 'serialized_components', gen_random_uuid(), 'PENDING') RETURNING id`, [mbB, brB])).rows[0].id;

    Object.assign(f, { memA, memB, roleA, roleB, mbA, mbB, brA, brB, ctA, ctB });
  });
});

afterAll(async () => {
  await withOwner(async (c) => {
    await c.query(`DELETE FROM public.migration_created_targets WHERE id = ANY($1::uuid[])`, [[f.ctA, f.ctB]]);
    await c.query(`DELETE FROM public.migration_batch_rows WHERE id = ANY($1::uuid[])`, [[f.brA, f.brB]]);
    await c.query(`DELETE FROM public.migration_batches WHERE id = ANY($1::uuid[])`, [[f.mbA, f.mbB]]);
    await c.query(`DELETE FROM public.tenant_membership_roles WHERE id = ANY($1::uuid[])`, [[f.roleA, f.roleB]]);
    await c.query(`DELETE FROM public.tenant_memberships WHERE tenant_id = ANY($1::uuid[])`, [[tenantA, tenantB]]);
  });
  await Tenant.destroy({ where: { id: [tenantA, tenantB] } }).catch(() => undefined);
  await User.destroy({ where: { email: [`${P}a@example.test`, `${P}b@example.test`] } }).catch(() => undefined);
});
describe('4.5-5 membership + migration-ledger tenant RLS', () => {
  it('tenant_memberships: own visible, foreign denied, missing context denied', async () => {
    expect(await visible(tenantA, 'tenant_memberships', f.memA)).toBe(true);
    expect(await visible(tenantB, 'tenant_memberships', f.memA)).toBe(false);
    expect(await visible(tenantB, 'tenant_memberships', f.memB)).toBe(true);
    expect(await visible(tenantA, 'tenant_memberships', f.memB)).toBe(false);
    expect(await visibleNoContext('tenant_memberships', f.memA)).toBe(false);
  });

  it('tenant_membership_roles derive through membership', async () => {
    expect(await visible(tenantA, 'tenant_membership_roles', f.roleA)).toBe(true);
    expect(await visible(tenantB, 'tenant_membership_roles', f.roleA)).toBe(false);
    expect(await visible(tenantB, 'tenant_membership_roles', f.roleB)).toBe(true);
    expect(await visible(tenantA, 'tenant_membership_roles', f.roleB)).toBe(false);
    expect(await visibleNoContext('tenant_membership_roles', f.roleA)).toBe(false);
  });

  it('tenant_membership_authority_audit isolated (rollback fixture)', async () => {
    await withContextRollback(tenantA, async (c) => {
      const audit = (await c.query(`INSERT INTO public.tenant_membership_authority_audit (id, tenant_id, membership_id, actor_user_id, actor_kind, action, reason, correlation_id) VALUES (gen_random_uuid(), $1, $2, $3, 'TENANT_ADMIN', 'TEST', 'r', gen_random_uuid()) RETURNING id`, [tenantA, f.memA, f.userA])).rows[0].id;
      expect((await c.query(`SELECT id FROM public.tenant_membership_authority_audit WHERE id = $1`, [audit])).rowCount).toBe(1);
      await c.query(`SELECT set_config('${GUC}', $1, true)`, [tenantB]);
      expect((await c.query(`SELECT id FROM public.tenant_membership_authority_audit WHERE id = $1`, [audit])).rowCount).toBe(0);
    });
  });

  it('migration_batch_rows derive through migration_batches tenant', async () => {
    expect(await visible(tenantA, 'migration_batch_rows', f.brA)).toBe(true);
    expect(await visible(tenantB, 'migration_batch_rows', f.brA)).toBe(false);
    expect(await visible(tenantB, 'migration_batch_rows', f.brB)).toBe(true);
    expect(await visible(tenantA, 'migration_batch_rows', f.brB)).toBe(false);
    expect(await visibleNoContext('migration_batch_rows', f.brA)).toBe(false);
  });

  it('migration_created_targets derive through migration_batches tenant', async () => {
    expect(await visible(tenantA, 'migration_created_targets', f.ctA)).toBe(true);
    expect(await visible(tenantB, 'migration_created_targets', f.ctA)).toBe(false);
    expect(await visible(tenantB, 'migration_created_targets', f.ctB)).toBe(true);
    expect(await visible(tenantA, 'migration_created_targets', f.ctB)).toBe(false);
    expect(await visibleNoContext('migration_created_targets', f.ctA)).toBe(false);
  });

  it('cross-tenant writes denied (zero rows) and foreign INSERT rejected', async () => {
    await withContext(tenantA, async (c) => {
      const upd = await c.query(`UPDATE public.tenant_memberships SET status_reason='x' WHERE id = $1`, [f.memB]);
      expect(upd.rowCount).toBe(0);
      const del = await c.query(`DELETE FROM public.tenant_memberships WHERE id = $1`, [f.memB]);
      expect(del.rowCount).toBe(0);
      const delRow = await c.query(`DELETE FROM public.migration_batch_rows WHERE id = $1`, [f.brB]);
      expect(delRow.rowCount).toBe(0);
    });
    await expect(withContext(tenantA, async (c) => {
      await c.query(`INSERT INTO public.tenant_memberships (tenant_id, user_id, status, created_by_user_id, updated_by_user_id) VALUES ($1, $2, 'INVITED', $2, $2)`, [tenantB, (await c.query(`SELECT id FROM users LIMIT 1`)).rows[0].id]);
    })).rejects.toThrow();
  });

  it('own-tenant INSERT succeeds under context (simulates platform/set_config path)', async () => {
    const inserted = await withContext(tenantA, async (c) => {
      return (await c.query(`INSERT INTO public.tenant_memberships (tenant_id, user_id, status, created_by_user_id, updated_by_user_id) VALUES ($1, $2, 'INVITED', $2, $2) RETURNING id`, [tenantA, f.userB])).rows[0].id;
    });
    expect(await visible(tenantA, 'tenant_memberships', inserted)).toBe(true);
  });

  it('no BYPASSRLS and runtime cannot SET ROLE to owner; FORCE RLS enabled', async () => {
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
    const [forced] = await sequelize.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_class WHERE relname IN ('tenant_memberships','tenant_membership_roles','tenant_membership_authority_audit','migration_batch_rows','migration_created_targets') AND relrowsecurity AND relforcerowsecurity`,
      { type: QueryTypes.SELECT },
    );
    expect(forced.n).toBe(5);
  });

  it('pooled context does not leak after commit', async () => {
    // after the prior withContext(A) transaction commits, a fresh no-context read sees nothing
    expect(await visibleNoContext('tenant_memberships', f.memA)).toBe(false);
    expect(await visibleNoContext('migration_batch_rows', f.brA)).toBe(false);
  });
});

