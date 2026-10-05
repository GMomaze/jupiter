import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import { pool } from '../../config/database.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import { requireDatabaseTestExecutionApproval } from '../../config/databaseTestExecutionSafety.js';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { PostgresStaffTenantRepository } from './staff-tenant.repository.js';
import { StaffMembershipAdministrationRepository } from './staff-membership-administration.js';
import { PlatformAuthorityRepository } from '../platform-authority/platform-authority.repository.js';
import { platformMutationEvidence } from '../platform-authority/authoritative-platform-mutation.js';
import { TenantAdminRecoveryRepository } from '../tenancy/tenant-admin-recovery.js';

let client: PoolClient;
let beforeSnapshot: unknown;
let adminRoleId: string;

const ids = {
  admin1: randomUUID(), admin2: randomUUID(), member: randomUUID(), recovery: randomUUID(),
  tenant: randomUUID(),
  mAdmin1: randomUUID(), mAdmin2: randomUUID(), mMember: randomUUID(),
  principal: randomUUID(), grant: randomUUID(),
};

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
    membership: { id: membershipId, tenantId, userId: ids.admin1, status: 'ACTIVE' } });
}

// Adapter mapping repository-level BEGIN/COMMIT/ROLLBACK onto savepoints within the shared test transaction.
let savepoint = 0;
const adapter = {
  query: (sql: string, params?: unknown[]) => client.query(sql, params as never),
  connect: async () => ({
    query: async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN') { savepoint += 1; return client.query(`SAVEPOINT la_${savepoint}`); }
      if (sql === 'COMMIT') return client.query(`RELEASE SAVEPOINT la_${savepoint}`);
      if (sql === 'ROLLBACK') return client.query(`ROLLBACK TO SAVEPOINT la_${savepoint}`);
      return client.query(sql, params as never);
    },
    release: () => {},
  }),
};

beforeAll(async () => {
  requireDatabaseTestExecutionApproval(process.env);
  await assertTestDatabaseSafety(pool);
  beforeSnapshot = await snapshot();
  client = await pool.connect(); await client.query('BEGIN');
  for (const [id, name] of [[ids.admin1, 'Admin1'], [ids.admin2, 'Admin2'], [ids.member, 'Member'], [ids.recovery, 'Recovery']] as const) {
    await client.query(`INSERT INTO users (id,email,password_hash,full_name,is_active) VALUES ($1,$2,'test',$3,true)`, [id, `${id}@example.test`, name]);
  }
  await client.query(`INSERT INTO tenants (id,public_id,code,display_name,status,created_by_user_id,updated_by_user_id) VALUES ($1,$1,'LASTADMIN','LastAdmin','ACTIVE',$2,$2)`, [ids.tenant, ids.admin1]);
  for (const [id, user] of [[ids.mAdmin1, ids.admin1], [ids.mAdmin2, ids.admin2], [ids.mMember, ids.member]] as const) {
    await client.query(`INSERT INTO tenant_memberships (id,tenant_id,user_id,status,joined_at,created_by_user_id,updated_by_user_id) VALUES ($1,$2,$3,'ACTIVE',CURRENT_TIMESTAMP,$3,$3)`, [id, ids.tenant, user]);
  }
  adminRoleId = (await client.query(`SELECT id FROM rf_role WHERE code='ADMIN' AND is_active=true`)).rows[0].id;
  await grantAdmin(ids.mAdmin1);
});

async function grantAdmin(membershipId: string) {
  await client.query(`INSERT INTO tenant_membership_roles (id,membership_id,role_id,assigned_by_user_id)
    SELECT gen_random_uuid(),$1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM tenant_membership_roles WHERE membership_id=$1 AND role_id=$2 AND revoked_at IS NULL)`, [membershipId, adminRoleId, ids.admin1]);
}
async function activeAdminCount(): Promise<number> {
  return (await client.query(`SELECT count(*)::int count FROM tenant_memberships tm JOIN tenant_membership_roles tmr ON tmr.membership_id=tm.id AND tmr.revoked_at IS NULL JOIN rf_role r ON r.id=tmr.role_id AND r.code='ADMIN' AND r.is_active=true WHERE tm.tenant_id=$1 AND tm.status='ACTIVE'`, [ids.tenant])).rows[0].count;
}
async function membershipAuthorityAuditCount(): Promise<number> {
  return (await client.query(`SELECT count(*)::int count FROM tenant_membership_authority_audit WHERE tenant_id=$1`, [ids.tenant])).rows[0].count;
}

afterAll(async () => {
  if (client) { await client.query('ROLLBACK'); client.release(); }
  expect(await snapshot()).toEqual(beforeSnapshot);
});

describe('last-active-tenant-admin protection', () => {
  it('denies revoking the sole ACTIVE ADMIN role (including self-demotion) without mutation', async () => {
    const repository = new PostgresStaffTenantRepository(pool, client);
    const auditsBefore = await membershipAuthorityAuditCount();
    await expect(repository.toggleRole(authority(ids.tenant, ids.mAdmin1), ids.admin1, adminRoleId, ids.admin1))
      .rejects.toThrow('LAST_ACTIVE_TENANT_ADMIN_REQUIRED');
    expect(await activeAdminCount()).toBe(1);
    expect((await client.query(`SELECT revoked_at FROM tenant_membership_roles WHERE membership_id=$1 AND role_id=$2`, [ids.mAdmin1, adminRoleId])).rows[0].revoked_at).toBeNull();
    expect(await membershipAuthorityAuditCount()).toBe(auditsBefore);
  });

  it('allows revoking one of two ACTIVE ADMINs', async () => {
    await grantAdmin(ids.mAdmin2);
    const repository = new PostgresStaffTenantRepository(pool, client);
    expect(await repository.toggleRole(authority(ids.tenant, ids.mAdmin1), ids.admin2, adminRoleId, ids.admin1)).toBe('REVOKED');
    expect(await activeAdminCount()).toBe(1);
    expect((await client.query(`SELECT revoked_at FROM tenant_membership_roles WHERE membership_id=$1 AND role_id=$2`, [ids.mAdmin2, adminRoleId])).rows[0].revoked_at).not.toBeNull();
  });

  it('denies disabling the sole ACTIVE ADMIN membership', async () => {
    const administration = new StaffMembershipAdministrationRepository(adapter as never);
    await expect(administration.setMembershipStatus(authority(ids.tenant, ids.mAdmin1), ids.admin1, 'DISABLED', ids.admin1, 'Offboard', randomUUID()))
      .rejects.toThrow('LAST_ACTIVE_TENANT_ADMIN_REQUIRED');
    expect((await client.query(`SELECT status FROM tenant_memberships WHERE id=$1`, [ids.mAdmin1])).rows[0].status).toBe('ACTIVE');
  });

  it('allows disabling a non-ADMIN membership', async () => {
    const administration = new StaffMembershipAdministrationRepository(adapter as never);
    await administration.setMembershipStatus(authority(ids.tenant, ids.mAdmin1), ids.member, 'DISABLED', ids.admin1, 'Offboard', randomUUID());
    expect((await client.query(`SELECT status FROM tenant_memberships WHERE id=$1`, [ids.mMember])).rows[0].status).toBe('DISABLED');
  });

  it('holds the ≥1-ADMIN invariant across sequential revokes', async () => {
    await grantAdmin(ids.mAdmin1);
    await grantAdmin(ids.mAdmin2);
    const repository = new PostgresStaffTenantRepository(pool, client);
    expect(await activeAdminCount()).toBe(2);
    await repository.toggleRole(authority(ids.tenant, ids.mAdmin1), ids.admin2, adminRoleId, ids.admin1);
    expect(await activeAdminCount()).toBe(1);
    await expect(repository.toggleRole(authority(ids.tenant, ids.mAdmin1), ids.admin1, adminRoleId, ids.admin1))
      .rejects.toThrow('LAST_ACTIVE_TENANT_ADMIN_REQUIRED');
    expect(await activeAdminCount()).toBe(1);
  });

  it('writes no audit row on denial and retains audit on success', async () => {
    const repository = new PostgresStaffTenantRepository(pool, client);
    const before = await membershipAuthorityAuditCount();
    await expect(repository.toggleRole(authority(ids.tenant, ids.mAdmin1), ids.admin1, adminRoleId, ids.admin1))
      .rejects.toThrow('LAST_ACTIVE_TENANT_ADMIN_REQUIRED');
    expect(await membershipAuthorityAuditCount()).toBe(before);
    const engineer = (await client.query(`SELECT id FROM rf_role WHERE code='ENGINEER' AND is_active=true`)).rows[0].id;
    await repository.toggleRole(authority(ids.tenant, ids.mAdmin2), ids.admin2, engineer, ids.admin1);
    expect(await membershipAuthorityAuditCount()).toBeGreaterThan(before);
    const granted = (await client.query(`SELECT count(*)::int count FROM tenant_membership_authority_audit WHERE tenant_id=$1 AND action='TENANT_ROLE_GRANTED'`, [ids.tenant])).rows[0].count;
    expect(granted).toBeGreaterThan(0);
  });

  it('leaves TENANT_ADMIN_RECOVER functional and unaffected', async () => {
    await client.query(`INSERT INTO platform_principals(id,principal_type,user_id,display_name,status) VALUES($1,'HUMAN',$2,'LA owner','ACTIVE')`, [ids.principal, ids.admin1]);
    await client.query(`INSERT INTO platform_capability_grants(id,principal_id,capability_id,granted_by_principal_id,grant_reason) SELECT $1,$2,id,$2,'LA verify' FROM platform_capabilities WHERE code='TENANT_ADMIN_RECOVER'`, [ids.grant, ids.principal]);
    const platform = await new PlatformAuthorityRepository(adapter as never).resolveHuman(ids.admin1);
    expect(platform).toBeDefined();
    const publicId = (await client.query(`SELECT public_id FROM tenants WHERE id=$1`, [ids.tenant])).rows[0].public_id;
    const recovery = new TenantAdminRecoveryRepository(adapter as never);
    const evidence = () => platformMutationEvidence(platform, ['TENANT_ADMIN_RECOVER'], { reason: 'Recover', correlationId: randomUUID(), source: { kind: 'VERIFY' }, resourceType: 'tenant', resourceId: publicId });
    await recovery.recover(evidence(), publicId, ids.recovery);
    expect((await client.query(`SELECT count(*)::int count FROM tenant_memberships tm JOIN tenant_membership_roles tmr ON tmr.membership_id=tm.id AND tmr.revoked_at IS NULL JOIN rf_role r ON r.id=tmr.role_id AND r.code='ADMIN' WHERE tm.tenant_id=$1 AND tm.user_id=$2 AND tm.status='ACTIVE'`, [ids.tenant, ids.recovery])).rows[0].count).toBe(1);
  });
});

