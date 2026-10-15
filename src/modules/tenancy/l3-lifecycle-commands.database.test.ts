import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { QueryTypes } from 'sequelize';
import pg from 'pg';
import sequelize from '../../config/database.js';
import { PlatformAuthorityRepository } from '../platform-authority/platform-authority.repository.js';
import { platformMutationEvidence } from '../platform-authority/authoritative-platform-mutation.js';
import { TenantLifecycleCommandRepository } from './tenant-lifecycle-command.repository.js';

const operations = ['TENANT_PROVISION', 'TENANT_ACTIVATE', 'TENANT_SUSPEND', 'TENANT_REINSTATE'] as const;

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
  try { return await work(c); } finally { await c.end(); }
}

describe('L3-2 guarded authoritative lifecycle commands', () => {
  afterAll(async () => { await sequelize.close(); });

  it('provisions, activates, suspends and reinstates across committed transactions; audits before/after; rejects revoked authority; leaves zero residue', async () => {
    expect((await sequelize.query<{ name: string }>('SELECT current_database() name', { type: QueryTypes.SELECT }))[0]?.name).toBe('jupiter_test');
    const ids = { user: randomUUID(), initialUser: randomUUID(), principal: randomUUID() };
    const code = `L3_${randomUUID().replaceAll('-', '').toUpperCase()}`;

    const resolver = () => new PlatformAuthorityRepository({ query: async () => ({
      rows: [{ id: ids.principal, principal_type: 'HUMAN', principal_code: ids.user, capabilities: [...operations] }], rowCount: 1,
    }) } as any);
    const evidence = async (operation: typeof operations[number], reason: string) => {
      const authority = (await resolver().resolveHuman(ids.user))!;
      return platformMutationEvidence(authority, [operation], {
        reason, correlationId: randomUUID(), source: { kind: 'GUARDED_L3_2_TEST' }, resourceType: 'tenant',
      });
    };
    const repository = new TenantLifecycleCommandRepository();

    // Phase 1 (committed): fixtures + provision. Activation's adminPool check must
    // observe committed membership state, matching the production flow.
    const { provisioned } = await sequelize.transaction(async transaction => {
      await sequelize.query(`INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES
        (:user,:userEmail,'unused','L3 Actor',true),(:initialUser,:initialEmail,'unused','L3 Initial Admin',true)`, {
        replacements: { ...ids, userEmail: `l3-actor-${ids.user}@example.test`, initialEmail: `l3-admin-${ids.initialUser}@example.test` }, transaction,
      });
      await sequelize.query(`INSERT INTO platform_principals(id,principal_type,user_id,display_name,status)
        VALUES(:principal,'HUMAN',:user,'L3 Actor','ACTIVE')`, { replacements: ids, transaction });
      await sequelize.query(`INSERT INTO platform_capability_grants
        (id,principal_id,capability_id,granted_by_principal_id,grant_reason)
        SELECT gen_random_uuid(),:principal,id,:principal,'L3 guarded test'
        FROM platform_capabilities WHERE code IN(:operations)`, {
        replacements: { principal: ids.principal, operations: [...operations] }, transaction,
      });
      const provisioned = await repository.provision(await evidence('TENANT_PROVISION', 'Provision test tenant'), {
        code, displayName: 'L3 Guarded Tenant', initialUserId: ids.initialUser,
      }, transaction);
      expect(provisioned.status).toBe('PROVISIONING');
      // Foundation check inside the provision transaction, where jupiter.tenant_id
      // context is set (tenant_memberships/roles are FORCE RLS).
      const foundation = (await sequelize.query<any>(`SELECT t.status,
        (SELECT count(*)::int FROM tenant_memberships tm WHERE tm.tenant_id=t.id AND tm.user_id=:initialUser AND tm.status='ACTIVE') memberships,
        (SELECT count(*)::int FROM tenant_membership_roles tmr JOIN tenant_memberships tm ON tm.id=tmr.membership_id JOIN rf_role r ON r.id=tmr.role_id WHERE tm.tenant_id=t.id AND r.code='ADMIN' AND tmr.revoked_at IS NULL) admin_roles
        FROM tenants t WHERE t.id=:tenantId`, { replacements: { tenantId: provisioned.tenantId, initialUser: ids.initialUser }, type: QueryTypes.SELECT, transaction }))[0];
      expect(foundation).toEqual({ status: 'PROVISIONING', memberships: 1, admin_roles: 1 });
      return { provisioned };
    });

    const createdTenantId = provisioned.tenantId;

    // Phase 2: lifecycle commands, each in its own committed transaction.
    await expect(repository.activate(await evidence('TENANT_ACTIVATE', 'Activate test tenant'), provisioned.publicId)).resolves.toMatchObject({ status: 'ACTIVE' });
    await expect(repository.suspend(await evidence('TENANT_SUSPEND', 'Suspend test tenant'), provisioned.publicId, 'Suspend test tenant')).resolves.toMatchObject({ status: 'SUSPENDED' });
    await expect(repository.reinstate(await evidence('TENANT_REINSTATE', 'Reinstate test tenant'), provisioned.publicId)).resolves.toMatchObject({ status: 'ACTIVE' });
    await expect(repository.reinstate(await evidence('TENANT_REINSTATE', 'Stale retry'), provisioned.publicId)).rejects.toThrow('TENANT_LIFECYCLE_COMMAND_UNAVAILABLE');

    await sequelize.query(`UPDATE platform_capability_grants SET revoked_at=CURRENT_TIMESTAMP,
      revoked_by_principal_id=:principal,revocation_reason='Guarded revocation'
      WHERE principal_id=:principal AND capability_id=(SELECT id FROM platform_capabilities WHERE code='TENANT_SUSPEND')`,
    { replacements: { principal: ids.principal } });
    await expect(repository.suspend(await evidence('TENANT_SUSPEND', 'Revoked attempt'), provisioned.publicId, 'Revoked attempt'))
      .rejects.toThrow('PLATFORM_CAPABILITY_REQUIRED');

    const final = (await sequelize.query<any>(`SELECT status,suspension_reason,suspended_at,suspended_by_user_id
      FROM tenants WHERE id=:tenantId`, { replacements: { tenantId: createdTenantId }, type: QueryTypes.SELECT }))[0];
    expect(final).toEqual({ status: 'ACTIVE', suspension_reason: null, suspended_at: null, suspended_by_user_id: null });
    const audits = await sequelize.query<any>(`SELECT action,capability_code,old_values,new_values
      FROM platform_global_audit_log WHERE resource_id=:tenantId ORDER BY created_at,id`,
    { replacements: { tenantId: createdTenantId }, type: QueryTypes.SELECT });
    expect(new Set(audits.map(row => row.action))).toEqual(new Set(operations));
    expect(audits.every(row => row.action === row.capability_code)).toBe(true);
    expect(audits).toHaveLength(4);
    expect(audits.every(row => row.new_values !== null)).toBe(true);
    expect(audits.filter(row => row.action !== 'TENANT_PROVISION').every(row => row.old_values !== null)).toBe(true);
    await expect(sequelize.query('DELETE FROM tenants WHERE id=:tenantId', { replacements: { tenantId: createdTenantId } }))
      .rejects.toThrow(/TENANT_DELETION_PROHIBITED/);

    // Cleanup via owner connection (deletion is prohibited for the runtime role).
    await withOwner(async (c) => {
      await c.query('ALTER TABLE public.tenants DISABLE TRIGGER tr_tenants_delete_prohibited');
      await c.query('ALTER TABLE public.platform_global_audit_log DISABLE TRIGGER tr_platform_global_audit_immutable');
      try {
        await c.query('DELETE FROM platform_global_audit_log WHERE resource_id=$1', [createdTenantId]);
        await c.query('DELETE FROM tenant_membership_roles WHERE membership_id IN (SELECT id FROM tenant_memberships WHERE tenant_id=$1)', [createdTenantId]);
        await c.query('DELETE FROM tenant_memberships WHERE tenant_id=$1', [createdTenantId]);
        await c.query('DELETE FROM tenants WHERE id=$1', [createdTenantId]);
        await c.query('DELETE FROM platform_capability_grants WHERE principal_id=$1', [ids.principal]);
        await c.query('DELETE FROM platform_principals WHERE id=$1', [ids.principal]);
        await c.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[ids.user, ids.initialUser]]);
      } finally {
        await c.query('ALTER TABLE public.platform_global_audit_log ENABLE TRIGGER tr_platform_global_audit_immutable');
        await c.query('ALTER TABLE public.tenants ENABLE TRIGGER tr_tenants_delete_prohibited');
      }
    });

    const residue = (await sequelize.query<{ count: number }>(`SELECT
      (SELECT count(*)::int FROM users WHERE id IN(:users)) +
      (SELECT count(*)::int FROM platform_principals WHERE id=:principal) +
      (SELECT count(*)::int FROM tenants WHERE id=:tenantId) +
      (SELECT count(*)::int FROM platform_global_audit_log WHERE resource_id=:tenantId) count`, {
      replacements: { users: [ids.user, ids.initialUser], principal: ids.principal, tenantId: createdTenantId }, type: QueryTypes.SELECT,
    }))[0];
    expect(residue?.count).toBe(0);
  });
});
