import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import { pool } from '../../config/database.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import { requireDatabaseTestExecutionApproval } from '../../config/databaseTestExecutionSafety.js';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { PostgresStaffTenantRepository, STAFF_TENANT_TARGET_UNAVAILABLE } from './staff-tenant.repository.js';

let client: PoolClient;
let beforeSnapshot: unknown;
const ids = { actor: randomUUID(), local: randomUUID(), foreign: randomUUID(), a: randomUUID(), b: randomUUID(), ma: randomUUID(), mla: randomUUID(), mb: randomUUID() };
async function snapshot() {
  const result = await pool.query(`SELECT
    (SELECT count(*)::int FROM users) users,
    (SELECT count(*)::int FROM tenants) tenants,
    (SELECT count(*)::int FROM tenant_memberships) memberships,
    (SELECT count(*)::int FROM tenant_membership_roles) membership_roles,
    (SELECT count(*)::int FROM audit_log) audits,
    (SELECT count(*)::int FROM "SequelizeMeta") migration_ledger,
    (SELECT md5(string_agg(id::text || code || is_active::text, ',' ORDER BY id)) FROM rf_role) role_hash,
    (SELECT md5(string_agg(id::text || code || is_active::text, ',' ORDER BY id)) FROM rf_permission) permission_hash,
    (SELECT count(*)::int FROM pg_trigger WHERE NOT tgisinternal AND tgenabled <> 'D') enabled_triggers`);
  return result.rows[0];
}
function authority(tenantId: string, membershipId: string) {
  return createTenantQueryAuthority({ state: 'VALID_ACTIVE_TENANT', validatedAt: Date.now(),
    tenant: { id: tenantId, publicId: tenantId, code: 'TEST', displayName: 'Test', status: 'ACTIVE' },
    membership: { id: membershipId, tenantId, userId: ids.actor, status: 'ACTIVE' } });
}

beforeAll(async () => {
  requireDatabaseTestExecutionApproval(process.env);
  await assertTestDatabaseSafety(pool);
  beforeSnapshot = await snapshot();
  client = await pool.connect(); await client.query('BEGIN');
  for (const [id, name] of [[ids.actor, 'Actor'], [ids.local, 'Local'], [ids.foreign, 'Foreign']] as const) {
    await client.query(`INSERT INTO users (id,email,password_hash,full_name,is_active) VALUES ($1,$2,'test',$3,true)`, [id, `${id}@example.test`, name]);
  }
  for (const [id, code] of [[ids.a, 'STAFFA'], [ids.b, 'STAFFB']] as const) {
    await client.query(`INSERT INTO tenants (id,public_id,code,display_name,status,created_by_user_id,updated_by_user_id) VALUES ($1,$1,$2,$2,'ACTIVE',$3,$3)`, [id, code, ids.actor]);
  }
  const now = new Date();
  for (const [id, tenant, user] of [[ids.ma, ids.a, ids.actor], [ids.mla, ids.a, ids.local], [ids.mb, ids.b, ids.foreign]] as const) {
    await client.query(`INSERT INTO tenant_memberships (id,tenant_id,user_id,status,joined_at,created_by_user_id,updated_by_user_id) VALUES ($1,$2,$3,'ACTIVE',$4,$5,$5)`, [id, tenant, user, now, ids.actor]);
  }
});
afterAll(async () => {
  if (client) { await client.query('ROLLBACK'); client.release(); }
  expect(await snapshot()).toEqual(beforeSnapshot);
});

describe('guarded tenant-local staff and role administration', () => {
  it('lists only active-tenant staff and excludes foreign-only identities', async () => {
    const repository = new PostgresStaffTenantRepository(pool, client);
    const rows = await repository.listStaff(authority(ids.a, ids.ma));
    expect(rows.map(row => row.id)).toEqual(expect.arrayContaining([ids.actor, ids.local]));
    expect(rows.map(row => row.id)).not.toContain(ids.foreign);
  });
  it('assigns and revokes locally with actor evidence', async () => {
    const repository = new PostgresStaffTenantRepository(pool, client);
    const role = await client.query(`SELECT id FROM rf_role WHERE code = 'ENGINEER' AND is_active = true`);
    expect(await repository.toggleRole(authority(ids.a, ids.ma), ids.local, role.rows[0].id, ids.actor)).toBe('ASSIGNED');
    const assigned = await client.query(`SELECT assigned_by_user_id,revoked_at FROM tenant_membership_roles WHERE membership_id=$1 AND role_id=$2`, [ids.mla, role.rows[0].id]);
    expect(assigned.rows[0]).toMatchObject({ assigned_by_user_id: ids.actor, revoked_at: null });
    expect(await repository.toggleRole(authority(ids.a, ids.ma), ids.local, role.rows[0].id, ids.actor)).toBe('REVOKED');
    const revoked = await client.query(`SELECT revoked_by_user_id,revocation_reason FROM tenant_membership_roles WHERE membership_id=$1 AND role_id=$2`, [ids.mla, role.rows[0].id]);
    expect(revoked.rows[0].revoked_by_user_id).toBe(ids.actor);
    expect(revoked.rows[0].revocation_reason).toBeTruthy();
  });
  it('rejects direct foreign target substitution without cross-tenant change', async () => {
    const repository = new PostgresStaffTenantRepository(pool, client);
    const role = await client.query(`SELECT id FROM rf_role WHERE code = 'ENGINEER' AND is_active = true`);
    await expect(repository.toggleRole(authority(ids.a, ids.ma), ids.foreign, role.rows[0].id, ids.actor)).rejects.toThrow(STAFF_TENANT_TARGET_UNAVAILABLE);
    expect((await client.query(`SELECT count(*)::int count FROM tenant_membership_roles WHERE membership_id=$1`, [ids.mb])).rows[0].count).toBe(0);
  });
});
