import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import pg from 'pg';
import { pool } from '../../config/database.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { StaffInvitationService, StaffMembershipAdministrationRepository, STAFF_MEMBERSHIP_UNAVAILABLE } from './staff-membership-administration.js';

async function withOwner<T>(work: (c: pg.Client) => Promise<T>): Promise<T> {
  const { config } = await import('dotenv');
  config({ path: '.env.test', override: true, quiet: true });
  const c = new pg.Client({ host: process.env.DB_MIGRATION_HOST, port: Number(process.env.DB_MIGRATION_PORT ?? '5432'), database: process.env.DB_MIGRATION_NAME, user: process.env.DB_MIGRATION_USER, password: process.env.DB_MIGRATION_PASSWORD });
  await c.connect();
  try { return await work(c); } finally { await c.end(); }
}

async function setupTenant(tenantId: string, adminId: string, label: string) {
  await pool.query(`INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES($1,$2,'unused',$3,true)`, [adminId, `acc-admin-${label}@example.test`, 'Admin']);
  await pool.query(`INSERT INTO tenants(id,public_id,code,display_name,status,created_by_user_id,updated_by_user_id) VALUES($1,$2,$3,$3,'ACTIVE',$4,$4)`, [tenantId, randomUUID(), `ACC_${label}`, adminId]);
  const membershipId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('jupiter.tenant_id',$1,true)`, [tenantId]);
    await client.query(`INSERT INTO tenant_memberships(id,tenant_id,user_id,status,joined_at,created_by_user_id,updated_by_user_id) VALUES($1,$2,$3,'ACTIVE',CURRENT_TIMESTAMP,$3,$3)`, [membershipId, tenantId, adminId]);
    await client.query(`INSERT INTO tenant_membership_roles(id,membership_id,role_id,assigned_by_user_id) SELECT gen_random_uuid(),$1,id,$2 FROM rf_role WHERE code='ADMIN'`, [membershipId, adminId]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  return { membershipId, authority: createTenantQueryAuthority({ state: 'VALID_ACTIVE_TENANT', validatedAt: Date.now(), tenant: { id: tenantId, publicId: 'p', code: 'C', displayName: 'D', status: 'ACTIVE' }, membership: { id: membershipId, tenantId, userId: adminId, status: 'ACTIVE' } }) };
}

async function cleanup(tenantIds: string[]) {
  await withOwner(async (c) => {
    await c.query(`ALTER TABLE public.tenant_membership_authority_audit DISABLE TRIGGER tr_tenant_membership_authority_audit_immutable`);
    await c.query(`DELETE FROM tenant_membership_authority_audit WHERE tenant_id=ANY($1::uuid[])`, [tenantIds]);
    await c.query(`DELETE FROM staff_invitations WHERE tenant_id=ANY($1::uuid[])`, [tenantIds]);
    await c.query(`DELETE FROM tenant_membership_roles WHERE membership_id IN (SELECT id FROM tenant_memberships WHERE tenant_id=ANY($1::uuid[]))`, [tenantIds]);
    await c.query(`DELETE FROM tenant_memberships WHERE tenant_id=ANY($1::uuid[])`, [tenantIds]);
    await c.query(`ALTER TABLE public.tenant_membership_authority_audit ENABLE TRIGGER tr_tenant_membership_authority_audit_immutable`);
  });
}

describe('staff invitation acceptance under tenant RLS (fresh transaction)', () => {
  it('accepts a valid invitation through a fresh connection with no leaked tenant context', async () => {
    await assertTestDatabaseSafety(pool);
    const SUFFIX = randomUUID().replace(/-/g, '').toUpperCase();
    const ids = { tenant: randomUUID(), admin: randomUUID() };
    const { authority } = await setupTenant(ids.tenant, ids.admin, SUFFIX);

    const delivery = { deliver: vi.fn().mockResolvedValue(undefined) };
    const service = new StaffInvitationService(new StaffMembershipAdministrationRepository(pool), delivery);

    await service.invite(authority, { email: `acc-staff-${SUFFIX}@example.test`, fullName: 'Staff', actorUserId: ids.admin, reason: 'acceptance test' });
    const message = delivery.deliver.mock.calls[0][0];
    expect(message.tenantId).toBe(ids.tenant);

    await service.accept({ token: message.token, tenantId: ids.tenant, password: 'acceptance-password-123' });

    const staffId = (await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, [message.email])).rows[0].id;
    const membership = await withOwner(async (c) => (await c.query(`SELECT status FROM tenant_memberships WHERE tenant_id=$1 AND user_id=$2`, [ids.tenant, staffId])).rows[0]);
    expect(membership.status).toBe('ACTIVE');
    const invitation = await withOwner(async (c) => (await c.query(`SELECT consumed_at, revoked_at FROM staff_invitations WHERE token_hash=$1`, [createHash('sha256').update(message.token).digest('hex')])).rows[0]);
    expect(invitation.consumed_at).not.toBeNull();
    expect(invitation.revoked_at).toBeNull();

    await cleanup([ids.tenant]);
  });

  it('fails closed for wrong tenant, invalid token, expiry, revocation and replay', async () => {
    await assertTestDatabaseSafety(pool);
    const SUFFIX = randomUUID().replace(/-/g, '').toUpperCase();
    const ids = { tenantA: randomUUID(), tenantB: randomUUID(), admin: randomUUID() };
    const { authority } = await setupTenant(ids.tenantA, ids.admin, `${SUFFIX}A`);
    await pool.query(`INSERT INTO tenants(id,public_id,code,display_name,status,created_by_user_id,updated_by_user_id) VALUES($1,$2,$3,$3,'ACTIVE',$4,$4)`, [ids.tenantB, randomUUID(), `ACC_${SUFFIX}B`, ids.admin]);

    const delivery = { deliver: vi.fn().mockResolvedValue(undefined) };
    const service = new StaffInvitationService(new StaffMembershipAdministrationRepository(pool), delivery);

    await service.invite(authority, { email: `acc-staff-${SUFFIX}@example.test`, fullName: 'Staff', actorUserId: ids.admin, reason: 'adversarial test' });
    const message = delivery.deliver.mock.calls[0][0];
    const tokenHash = createHash('sha256').update(message.token).digest('hex');

    await expect(service.accept({ token: message.token, tenantId: ids.tenantB, password: 'acceptance-password-123' })).rejects.toThrow(STAFF_MEMBERSHIP_UNAVAILABLE);
    await expect(service.accept({ token: 'x'.repeat(64), tenantId: ids.tenantA, password: 'acceptance-password-123' })).rejects.toThrow(STAFF_MEMBERSHIP_UNAVAILABLE);

    await withOwner(async (c) => c.query(`UPDATE staff_invitations SET created_at=CURRENT_TIMESTAMP - interval '2 minutes', expires_at=CURRENT_TIMESTAMP - interval '1 minute' WHERE token_hash=$1`, [tokenHash]));
    await expect(service.accept({ token: message.token, tenantId: ids.tenantA, password: 'acceptance-password-123' })).rejects.toThrow(STAFF_MEMBERSHIP_UNAVAILABLE);

    await withOwner(async (c) => c.query(`UPDATE staff_invitations SET revoked_at=CURRENT_TIMESTAMP, revoked_by_user_id=$2 WHERE token_hash=$1`, [tokenHash, ids.admin]));
    await expect(service.accept({ token: message.token, tenantId: ids.tenantA, password: 'acceptance-password-123' })).rejects.toThrow(STAFF_MEMBERSHIP_UNAVAILABLE);

    await service.invite(authority, { email: `acc-staff-2-${SUFFIX}@example.test`, fullName: 'Staff 2', actorUserId: ids.admin, reason: 'adversarial test 2' });
    const message2 = delivery.deliver.mock.calls[1][0];
    await service.accept({ token: message2.token, tenantId: ids.tenantA, password: 'acceptance-password-123' });
    await expect(service.accept({ token: message2.token, tenantId: ids.tenantA, password: 'acceptance-password-123' })).rejects.toThrow(STAFF_MEMBERSHIP_UNAVAILABLE);

    await cleanup([ids.tenantA, ids.tenantB]);
  });
});
