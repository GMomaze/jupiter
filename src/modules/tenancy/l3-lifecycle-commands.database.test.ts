import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import { PlatformAuthorityRepository } from '../platform-authority/platform-authority.repository.js';
import { platformMutationEvidence } from '../platform-authority/authoritative-platform-mutation.js';
import { TenantLifecycleCommandRepository } from './tenant-lifecycle-command.repository.js';

const operations = ['TENANT_PROVISION', 'TENANT_ACTIVATE', 'TENANT_SUSPEND', 'TENANT_REINSTATE'] as const;

describe('L3-2 guarded authoritative lifecycle commands', () => {
  afterAll(async () => { await sequelize.close(); });

  it('executes all commands atomically, audits before/after, rejects revoked authority, and leaves zero residue', async () => {
    expect((await sequelize.query<{ name: string }>('SELECT current_database() name', { type: QueryTypes.SELECT }))[0]?.name).toBe('jupiter_test');
    const ids = { user: randomUUID(), initialUser: randomUUID(), principal: randomUUID() };
    let createdTenantId = '';
    await expect(sequelize.transaction(async transaction => {
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
      const resolver = new PlatformAuthorityRepository({ query: async () => ({
        rows: [{ id: ids.principal, principal_type: 'HUMAN', principal_code: ids.user, capabilities: [...operations] }], rowCount: 1,
      }) } as any);
      const authority = (await resolver.resolveHuman(ids.user))!;
      const evidence = (operation: typeof operations[number], reason: string) => platformMutationEvidence(authority, [operation], {
        reason, correlationId: randomUUID(), source: { kind: 'GUARDED_L3_2_TEST' }, resourceType: 'tenant',
      });
      const repository = new TenantLifecycleCommandRepository();
      const provisioned = await repository.provision(evidence('TENANT_PROVISION', 'Provision test tenant'), {
        code: `L3_${randomUUID().replaceAll('-', '').toUpperCase()}`,
        displayName: 'L3 Guarded Tenant', initialUserId: ids.initialUser,
      }, transaction);
      createdTenantId = provisioned.tenantId;
      expect(provisioned.status).toBe('PROVISIONING');
      const foundation = (await sequelize.query<any>(`SELECT t.status,
        (SELECT count(*)::int FROM tenant_memberships tm WHERE tm.tenant_id=t.id AND tm.user_id=:initialUser AND tm.status='ACTIVE') memberships,
        (SELECT count(*)::int FROM tenant_membership_roles tmr JOIN tenant_memberships tm ON tm.id=tmr.membership_id JOIN rf_role r ON r.id=tmr.role_id WHERE tm.tenant_id=t.id AND r.code='ADMIN' AND tmr.revoked_at IS NULL) admin_roles
        FROM tenants t WHERE t.id=:tenantId`, { replacements: { tenantId: createdTenantId, initialUser: ids.initialUser }, type: QueryTypes.SELECT, transaction }))[0];
      expect(foundation).toEqual({ status: 'PROVISIONING', memberships: 1, admin_roles: 1 });

      await expect(repository.activate(evidence('TENANT_ACTIVATE', 'Activate test tenant'), provisioned.publicId, transaction)).resolves.toMatchObject({ status: 'ACTIVE' });
      await expect(repository.suspend(evidence('TENANT_SUSPEND', 'Suspend test tenant'), provisioned.publicId, 'Suspend test tenant', transaction)).resolves.toMatchObject({ status: 'SUSPENDED' });
      await expect(repository.reinstate(evidence('TENANT_REINSTATE', 'Reinstate test tenant'), provisioned.publicId, transaction)).resolves.toMatchObject({ status: 'ACTIVE' });
      await expect(repository.reinstate(evidence('TENANT_REINSTATE', 'Stale retry'), provisioned.publicId, transaction)).rejects.toThrow('TENANT_LIFECYCLE_COMMAND_UNAVAILABLE');

      await sequelize.query(`UPDATE platform_capability_grants SET revoked_at=CURRENT_TIMESTAMP,
        revoked_by_principal_id=:principal,revocation_reason='Guarded revocation'
        WHERE principal_id=:principal AND capability_id=(SELECT id FROM platform_capabilities WHERE code='TENANT_SUSPEND')`,
      { replacements: { principal: ids.principal }, transaction });
      await expect(repository.suspend(evidence('TENANT_SUSPEND', 'Revoked attempt'), provisioned.publicId, 'Revoked attempt', transaction))
        .rejects.toThrow('PLATFORM_CAPABILITY_REQUIRED');

      const final = (await sequelize.query<any>(`SELECT status,suspension_reason,suspended_at,suspended_by_user_id
        FROM tenants WHERE id=:tenantId`, { replacements: { tenantId: createdTenantId }, type: QueryTypes.SELECT, transaction }))[0];
      expect(final).toEqual({ status: 'ACTIVE', suspension_reason: null, suspended_at: null, suspended_by_user_id: null });
      const audits = await sequelize.query<any>(`SELECT action,capability_code,old_values,new_values
        FROM platform_global_audit_log WHERE resource_id=:tenantId ORDER BY created_at,id`,
      { replacements: { tenantId: createdTenantId }, type: QueryTypes.SELECT, transaction });
      expect(new Set(audits.map(row => row.action))).toEqual(new Set(operations));
      expect(audits.every(row => row.action === row.capability_code)).toBe(true);
      expect(audits).toHaveLength(4);
      expect(audits.every(row => row.new_values !== null)).toBe(true);
      expect(audits.filter(row => row.action !== 'TENANT_PROVISION').every(row => row.old_values !== null)).toBe(true);
      await expect(sequelize.query('DELETE FROM tenants WHERE id=:tenantId', { replacements: { tenantId: createdTenantId }, transaction }))
        .rejects.toThrow(/TENANT_DELETION_PROHIBITED/);
      throw new Error('ROLLBACK_L3_2_FIXTURE');
    })).rejects.toThrow('ROLLBACK_L3_2_FIXTURE');

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
