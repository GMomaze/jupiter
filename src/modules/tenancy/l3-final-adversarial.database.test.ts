import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import { PlatformAuthorityRepository } from '../platform-authority/platform-authority.repository.js';
import { platformMutationEvidence } from '../platform-authority/authoritative-platform-mutation.js';
import { TenantLifecycleCommandRepository } from './tenant-lifecycle-command.repository.js';

describe('L3-4 final guarded cross-boundary verification', () => {
  afterAll(async () => { await sequelize.close(); });

  it('suspends and reinstates one tenant without changing its membership or its peer tenant', async () => {
    expect((await sequelize.query<{ name: string }>('SELECT current_database() name', { type: QueryTypes.SELECT }))[0]?.name).toBe('jupiter_test');
    const ids = {
      actor: randomUUID(), principal: randomUUID(), member: randomUUID(),
      tenantA: randomUUID(), tenantB: randomUUID(), membership: randomUUID(),
      publicA: randomUUID(), publicB: randomUUID(),
    };
    await expect(sequelize.transaction(async transaction => {
      await sequelize.query(`INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES
        (:actor,:actorEmail,'unused','L3-4 Actor',true),(:member,:memberEmail,'unused','L3-4 Member',true)`, {
        replacements: { ...ids, actorEmail: `l3-4-${ids.actor}@example.test`, memberEmail: `l3-4-${ids.member}@example.test` }, transaction,
      });
      await sequelize.query(`INSERT INTO platform_principals(id,principal_type,user_id,display_name,status)
        VALUES(:principal,'HUMAN',:actor,'L3-4 Actor','ACTIVE')`, { replacements: ids, transaction });
      await sequelize.query(`INSERT INTO platform_capability_grants(id,principal_id,capability_id,granted_by_principal_id,grant_reason)
        SELECT gen_random_uuid(),:principal,id,:principal,'L3-4 verification' FROM platform_capabilities
        WHERE code IN('TENANT_SUSPEND','TENANT_REINSTATE')`, { replacements: ids, transaction });
      await sequelize.query(`INSERT INTO tenants(id,public_id,code,display_name,status,created_by_user_id,updated_by_user_id) VALUES
        (:tenantA,:publicA,:codeA,'L3-4 Tenant A','ACTIVE',:actor,:actor),
        (:tenantB,:publicB,:codeB,'L3-4 Tenant B','ACTIVE',:actor,:actor)`, {
        replacements: { ...ids, codeA: `L3A_${ids.tenantA.replaceAll('-', '').toUpperCase()}`, codeB: `L3B_${ids.tenantB.replaceAll('-', '').toUpperCase()}` }, transaction,
      });
      await sequelize.query(`INSERT INTO tenant_memberships(id,tenant_id,user_id,status,joined_at,created_by_user_id,updated_by_user_id)
        VALUES(:membership,:tenantA,:member,'ACTIVE',CURRENT_TIMESTAMP,:actor,:actor)`, { replacements: ids, transaction });

      const resolver = new PlatformAuthorityRepository({ query: async () => ({ rows: [{
        id: ids.principal, principal_type: 'HUMAN', principal_code: ids.actor,
        capabilities: ['TENANT_SUSPEND', 'TENANT_REINSTATE'],
      }], rowCount: 1 }) } as any);
      const authority = (await resolver.resolveHuman(ids.actor))!;
      const evidence = (operation: 'TENANT_SUSPEND' | 'TENANT_REINSTATE') => platformMutationEvidence(authority, [operation], {
        reason: `L3-4 ${operation}`, correlationId: randomUUID(), source: { kind: 'GUARDED_L3_4_TEST' }, resourceType: 'tenant',
      });
      const repository = new TenantLifecycleCommandRepository();
      await repository.suspend(evidence('TENANT_SUSPEND'), ids.publicA, 'L3-4 suspension', transaction);
      const suspended = await sequelize.query<any>(`SELECT
        (SELECT status FROM tenants WHERE id=:tenantA) status_a,
        (SELECT status FROM tenants WHERE id=:tenantB) status_b,
        (SELECT count(*)::int FROM tenant_memberships WHERE id=:membership AND tenant_id=:tenantA AND user_id=:member AND status='ACTIVE') membership_count`,
      { replacements: ids, type: QueryTypes.SELECT, transaction });
      expect(suspended[0]).toEqual({ status_a: 'SUSPENDED', status_b: 'ACTIVE', membership_count: 1 });

      await repository.reinstate(evidence('TENANT_REINSTATE'), ids.publicA, transaction);
      const restored = await sequelize.query<any>(`SELECT
        (SELECT status FROM tenants WHERE id=:tenantA) status_a,
        (SELECT status FROM tenants WHERE id=:tenantB) status_b,
        (SELECT count(*)::int FROM tenant_memberships WHERE id=:membership AND tenant_id=:tenantA AND user_id=:member AND status='ACTIVE') membership_count,
        (SELECT count(*)::int FROM platform_global_audit_log WHERE resource_id=:tenantA AND action IN('TENANT_SUSPEND','TENANT_REINSTATE') AND old_values IS NOT NULL AND new_values IS NOT NULL) audit_count`,
      { replacements: ids, type: QueryTypes.SELECT, transaction });
      expect(restored[0]).toEqual({ status_a: 'ACTIVE', status_b: 'ACTIVE', membership_count: 1, audit_count: 2 });
      await expect(sequelize.query('DELETE FROM tenants WHERE id=:tenantA', { replacements: ids, transaction }))
        .rejects.toThrow(/TENANT_DELETION_PROHIBITED/);
      throw new Error('ROLLBACK_L3_4_FIXTURE');
    })).rejects.toThrow('ROLLBACK_L3_4_FIXTURE');

    const residue = await sequelize.query<{ count: number }>(`SELECT
      (SELECT count(*)::int FROM users WHERE id IN(:actor,:member)) +
      (SELECT count(*)::int FROM platform_principals WHERE id=:principal) +
      (SELECT count(*)::int FROM tenants WHERE id IN(:tenantA,:tenantB)) +
      (SELECT count(*)::int FROM tenant_memberships WHERE id=:membership) +
      (SELECT count(*)::int FROM platform_global_audit_log WHERE resource_id IN(:tenantA,:tenantB)) count`,
    { replacements: ids, type: QueryTypes.SELECT });
    expect(residue[0]?.count).toBe(0);
  });
});
