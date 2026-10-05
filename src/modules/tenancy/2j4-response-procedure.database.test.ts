import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import { PlatformAuthorityRepository } from '../platform-authority/platform-authority.repository.js';
import { platformMutationEvidence } from '../platform-authority/authoritative-platform-mutation.js';
import { TenantLifecycleCommandRepository } from './tenant-lifecycle-command.repository.js';
import { ActiveTenantContextService } from './active-tenant-context.service.js';
import type { ActiveTenantContextRepository } from './active-tenant-context.service.js';

describe('MP2 2J.4 C — response procedure (suspend → deny → reinstate → restore)', () => {
  afterAll(async () => { await sequelize.close(); });

  it('suspends, denies, reinstates and restores a tenant via real revalidation, with audit and zero residue', async () => {
    expect((await sequelize.query<{ name: string }>('SELECT current_database() name', { type: QueryTypes.SELECT }))[0]?.name).toBe('jupiter_test');
    const ids = { user: randomUUID(), initialUser: randomUUID(), principal: randomUUID() };
    const operations = ['TENANT_PROVISION', 'TENANT_ACTIVATE', 'TENANT_SUSPEND', 'TENANT_REINSTATE'] as const;
    let tenantId = '';
    let membershipId = '';

    await expect(sequelize.transaction(async (t) => {
      await sequelize.query(`INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES
        (:user,:userEmail,'unused','2J4 Actor',true),(:initialUser,:initialEmail,'unused','2J4 Admin',true)`, {
        replacements: { ...ids, userEmail: `2j4-actor-${ids.user}@example.test`, initialEmail: `2j4-admin-${ids.initialUser}@example.test` }, transaction: t,
      });
      await sequelize.query(`INSERT INTO platform_principals(id,principal_type,user_id,display_name,status)
        VALUES(:principal,'HUMAN',:user,'2J4 Actor','ACTIVE')`, { replacements: ids, transaction: t });
      await sequelize.query(`INSERT INTO platform_capability_grants(id,principal_id,capability_id,granted_by_principal_id,grant_reason)
        SELECT gen_random_uuid(),:principal,id,:principal,'2J4 guarded test'
        FROM platform_capabilities WHERE code IN(:operations)`, {
        replacements: { principal: ids.principal, operations: [...operations] }, transaction: t,
      });

      const resolver = new PlatformAuthorityRepository({ query: async () => ({
        rows: [{ id: ids.principal, principal_type: 'HUMAN', principal_code: ids.user, capabilities: [...operations] }], rowCount: 1,
      }) } as never);
      const authority = (await resolver.resolveHuman(ids.user))!;
      const evidence = (op: (typeof operations)[number], reason: string) => platformMutationEvidence(authority, [op], {
        reason, correlationId: randomUUID(), source: { kind: 'GUARDED_2J4_C_TEST' }, resourceType: 'tenant',
      });
      const repository = new TenantLifecycleCommandRepository();
      const provisioned = await repository.provision(evidence('TENANT_PROVISION', 'Provision'), {
        code: `2J4_${randomUUID().replaceAll('-', '').toUpperCase()}`, displayName: '2J4 Tenant', initialUserId: ids.initialUser,
      }, t);
      tenantId = provisioned.tenantId;
      await repository.activate(evidence('TENANT_ACTIVATE', 'Activate'), provisioned.publicId, t);

      const mem = (await sequelize.query<{ id: string }>(`SELECT id FROM tenant_memberships
        WHERE tenant_id=:tenantId AND user_id=:initialUser AND status='ACTIVE'`,
        { replacements: { tenantId, initialUser: ids.initialUser }, type: QueryTypes.SELECT, transaction: t }))[0];
      membershipId = mem.id;
      const ctxRepo: ActiveTenantContextRepository = {
        findStoredMembershipRelationship: async (userId, mid) => {
          const rows = await sequelize.query<Record<string, unknown>>(`SELECT
              tm.id mid, tm.tenant_id, tm.user_id, tm.status mstatus,
              tt.id tid, tt.public_id, tt.code, tt.display_name, tt.status tstatus
            FROM tenant_memberships tm JOIN tenants tt ON tt.id=tm.tenant_id
            WHERE tm.user_id=:userId AND tm.id=:mid`,
            { replacements: { userId, mid }, type: QueryTypes.SELECT, transaction: t });
          const r = rows[0] as { mid: string; tenant_id: string; user_id: string; mstatus: string; tid: string; public_id: string; code: string; display_name: string; tstatus: string } | undefined;
          if (!r) return null;
          return Object.freeze({
            membership: Object.freeze({ id: r.mid, tenantId: r.tenant_id, userId: r.user_id, status: r.mstatus }),
            tenant: Object.freeze({ id: r.tid, publicId: r.public_id, code: r.code, displayName: r.display_name, status: r.tstatus }),
          });
        },
        listMembershipRelationshipsForUser: async () => [],
        findMembershipRelationshipForUserAndTenantPublicId: async () => null,
      };
      const service = new ActiveTenantContextService(ctxRepo, () => 1);
      const stored = { tenantId, membershipId, contextVersion: 1 as const, selectedAt: 1, validatedAt: 1 };

      expect((await service.revalidateStoredContext(ids.initialUser, stored)).state).toBe('VALID_ACTIVE_TENANT');
      await repository.suspend(evidence('TENANT_SUSPEND', 'Emergency suspension'), provisioned.publicId, '2J4 emergency', t);
      expect((await service.revalidateStoredContext(ids.initialUser, stored)).state).toBe('SUSPENDED_TENANT');
      await repository.reinstate(evidence('TENANT_REINSTATE', 'Recovery reinstatement'), provisioned.publicId, t);
      expect((await service.revalidateStoredContext(ids.initialUser, stored)).state).toBe('VALID_ACTIVE_TENANT');

      const audits = await sequelize.query<{ action: string }>(`SELECT action FROM platform_global_audit_log
        WHERE resource_id=:tenantId ORDER BY created_at,id`,
        { replacements: { tenantId }, type: QueryTypes.SELECT, transaction: t });
      const actions = audits.map((r) => r.action);
      expect(actions).toContain('TENANT_SUSPEND');
      expect(actions).toContain('TENANT_REINSTATE');

      throw new Error('ROLLBACK_2J4_C');
    })).rejects.toThrow('ROLLBACK_2J4_C');

    const residue = (await sequelize.query<{ count: number }>(`SELECT
      (SELECT count(*)::int FROM users WHERE id IN(:users)) +
      (SELECT count(*)::int FROM platform_principals WHERE id=:principal) +
      (SELECT count(*)::int FROM tenants WHERE id=:tenantId) +
      (SELECT count(*)::int FROM platform_global_audit_log WHERE resource_id=:tenantId) count`,
      { replacements: { users: [ids.user, ids.initialUser], principal: ids.principal, tenantId }, type: QueryTypes.SELECT }))[0];
    expect(residue?.count).toBe(0);
  });
});
