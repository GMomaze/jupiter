import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import { pool } from '../../config/database.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import { requireDatabaseTestExecutionApproval } from '../../config/databaseTestExecutionSafety.js';

// Guarded disposable-database regression for migration 628 (column-level SELECT grant).
// Executes ONLY against jupiter_test as jupiter_test with an approved reset, and rolls
// everything back with a residue check. Exercises the direct revocation UPDATE under
// actual jupiter_app privileges to prove the 42501 is resolved without exposing the
// protected role-assignment columns or the tenant boundary.

let client: PoolClient;
let beforeSnapshot: unknown;
const ids = {
  tenantA: randomUUID(), tenantB: randomUUID(),
  actor: randomUUID(), local: randomUUID(), foreign: randomUUID(),
  mActor: randomUUID(), mLocal: randomUUID(), mForeign: randomUUID(),
  aLocal: randomUUID(), aForeign: randomUUID(),
  engineer: '',
};

async function snapshot() {
  const r = await pool.query(`SELECT
    (SELECT count(*)::int FROM users) users,
    (SELECT count(*)::int FROM tenants) tenants,
    (SELECT count(*)::int FROM tenant_memberships) memberships,
    (SELECT count(*)::int FROM tenant_membership_roles) membership_roles,
    (SELECT count(*)::int FROM tenant_membership_authority_audit) audits,
    (SELECT count(*)::int FROM "SequelizeMeta") migration_ledger`);
  return r.rows[0];
}

beforeAll(async () => {
  requireDatabaseTestExecutionApproval(process.env);
  await assertTestDatabaseSafety(pool);
  beforeSnapshot = await snapshot();
  client = await pool.connect();
  await client.query('BEGIN');
  for (const [id, name] of [[ids.actor, 'Actor'], [ids.local, 'Local'], [ids.foreign, 'Foreign']] as const) {
    await client.query(`INSERT INTO users (id,email,password_hash,full_name,is_active) VALUES ($1,$2,'test',$3,true)`, [id, `${id}@example.test`, name]);
  }
  for (const [id, code] of [[ids.tenantA, 'A'], [ids.tenantB, 'B']] as const) {
    await client.query(`INSERT INTO tenants (id,public_id,code,display_name,status,created_by_user_id,updated_by_user_id) VALUES ($1,$1,$2,$2,'ACTIVE',$3,$3)`, [id, code, ids.actor]);
  }
  const now = new Date();
  for (const [id, tenant, user] of [[ids.mActor, ids.tenantA, ids.actor], [ids.mLocal, ids.tenantA, ids.local], [ids.mForeign, ids.tenantB, ids.foreign]] as const) {
    await client.query(`INSERT INTO tenant_memberships (id,tenant_id,user_id,status,joined_at,created_by_user_id,updated_by_user_id) VALUES ($1,$2,$3,'ACTIVE',$4,$5,$5)`, [id, tenant, user, now, ids.actor]);
  }
  const er = await client.query(`SELECT id FROM rf_role WHERE code='ENGINEER' AND is_active=true`);
  ids.engineer = er.rows[0].id;
  await client.query(`INSERT INTO tenant_membership_roles (id,membership_id,role_id,assigned_by_user_id) VALUES ($1,$2,$3,$4)`, [ids.aLocal, ids.mLocal, ids.engineer, ids.actor]);
  await client.query(`INSERT INTO tenant_membership_roles (id,membership_id,role_id,assigned_by_user_id) VALUES ($1,$2,$3,$4)`, [ids.aForeign, ids.mForeign, ids.engineer, ids.actor]);
});

describe('migration 628 — narrow column-level SELECT revocation', () => {
  it('revokes a role via a direct UPDATE under jupiter_app (42501 resolved)', async () => {
    await client.query('SET LOCAL ROLE jupiter_app');
    await client.query(`SELECT set_config('jupiter.tenant_id', $1, true)`, [ids.tenantA]);
    await client.query(
      `UPDATE tenant_membership_roles SET revoked_at = CURRENT_TIMESTAMP, revoked_by_user_id = $2,
         revocation_reason = 'revoke', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND revoked_at IS NULL`,
      [ids.aLocal, ids.actor],
    );
    await client.query('RESET ROLE');
    const r = await client.query(`SELECT revoked_at, revoked_by_user_id FROM tenant_membership_roles WHERE id = $1`, [ids.aLocal]);
    expect(r.rows[0].revoked_at).not.toBeNull();
    expect(r.rows[0].revoked_by_user_id).toBe(ids.actor);
  });

  it('still denies SELECT/UPDATE on protected columns with 42501 under jupiter_app', async () => {
    await client.query('SET LOCAL ROLE jupiter_app');
    await client.query(`SELECT set_config('jupiter.tenant_id', $1, true)`, [ids.tenantA]);
    // membership_id is NOT one of the approved SELECT columns.
    await expect(
      client.query(`UPDATE tenant_membership_roles SET membership_id = $1 WHERE id = $2`, [ids.mLocal, ids.aLocal]),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      client.query(`SELECT membership_id, role_id FROM tenant_membership_roles`),
    ).rejects.toMatchObject({ code: '42501' });
    await client.query('RESET ROLE');
  });

  it('denies cross-tenant revocation via FORCE RLS', async () => {
    await client.query('SET LOCAL ROLE jupiter_app');
    await client.query(`SELECT set_config('jupiter.tenant_id', $1, true)`, [ids.tenantA]);
    const r = await client.query(
      `UPDATE tenant_membership_roles SET revoked_at = CURRENT_TIMESTAMP, revoked_by_user_id = $2,
         revocation_reason = 'revoke', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND revoked_at IS NULL`,
      [ids.aForeign, ids.actor],
    );
    expect(r.rowCount).toBe(0);
    await client.query('RESET ROLE');
  });

  it('does not re-revoke an already-revoked assignment', async () => {
    await client.query('SET LOCAL ROLE jupiter_app');
    await client.query(`SELECT set_config('jupiter.tenant_id', $1, true)`, [ids.tenantA]);
    await client.query(
      `UPDATE tenant_membership_roles SET revoked_at = CURRENT_TIMESTAMP, revoked_by_user_id = $2,
         revocation_reason = 'revoke', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND revoked_at IS NULL`,
      [ids.aLocal, ids.actor],
    );
    const again = await client.query(
      `UPDATE tenant_membership_roles SET revoked_at = CURRENT_TIMESTAMP, revoked_by_user_id = $2,
         revocation_reason = 'revoke', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND revoked_at IS NULL`,
      [ids.aLocal, ids.actor],
    );
    expect(again.rowCount).toBe(0);
    await client.query('RESET ROLE');
  });
});

afterAll(async () => {
  if (client) { await client.query('ROLLBACK'); client.release(); }
  expect(await snapshot()).toEqual(beforeSnapshot);
});
