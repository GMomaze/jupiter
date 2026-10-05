import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import pg from 'pg';
import { pool } from '../../config/database.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import sequelize from '../../config/database.js';
import { QueryTypes } from 'sequelize';
import { PlatformAuthorityRepository } from '../platform-authority/platform-authority.repository.js';
import { platformMutationEvidence } from '../platform-authority/authoritative-platform-mutation.js';
import { TenantAdminRecoveryRepository } from './tenant-admin-recovery.js';

async function withOwner<T>(work: (c: pg.Client) => Promise<T>): Promise<T> {
  const { config } = await import('dotenv');
  config({ path: '.env.test', override: true, quiet: true });
  const c = new pg.Client({ host: process.env.DB_MIGRATION_HOST, port: Number(process.env.DB_MIGRATION_PORT ?? '5432'), database: process.env.DB_MIGRATION_NAME, user: process.env.DB_MIGRATION_USER, password: process.env.DB_MIGRATION_PASSWORD });
  await c.connect();
  try { return await work(c); } finally { await c.end(); }
}

describe('4.5-6 suspended-tenant admin recovery (end-to-end)', () => {
  it('recovers a SUSPENDED tenant admin under TENANT_ADMIN_RECOVER; another tenant untouched', async () => {
    await assertTestDatabaseSafety(pool);
    expect((await sequelize.query<{ name: string }>('SELECT current_database() name', { type: QueryTypes.SELECT }))[0]?.name).toBe('jupiter_test');

    const SUFFIX = randomUUID().replace(/-/g, '').toUpperCase();
    const ids = {
      operator: randomUUID(), target: randomUUID(), principal: randomUUID(),
      tenant: randomUUID(), publicId: randomUUID(),
      otherTenant: randomUUID(), otherPublicId: randomUUID(), otherUser: randomUUID(),
    };
    const tenantCode = `REC_${SUFFIX}`;
    const otherCode = `RECX_${SUFFIX}`;

    await sequelize.query(`INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES
      (:operator,:opEmail,'unused','Recovery Operator',true),
      (:target,:tgtEmail,'unused','Recovery Target Admin',true),
      (:otherUser,:otherEmail,'unused','Other Tenant User',true)`, {
      replacements: { ...ids, opEmail: `rec-op-${SUFFIX}@example.test`, tgtEmail: `rec-tgt-${SUFFIX}@example.test`, otherEmail: `rec-oth-${SUFFIX}@example.test` },
    });
    await sequelize.query(`INSERT INTO tenants(id,public_id,code,display_name,status,created_by_user_id,updated_by_user_id,suspension_reason,suspended_at,suspended_by_user_id) VALUES
      (:tenant,:publicId,:code,'Recovery Tenant','SUSPENDED',:operator,:operator,'test suspension',CURRENT_TIMESTAMP,:operator),
      (:otherTenant,:otherPublicId,:otherCode,'Other Tenant','ACTIVE',:operator,:operator,NULL,NULL,NULL)`, {
      replacements: { ...ids, code: tenantCode, otherCode },
    });
    await sequelize.query(`INSERT INTO platform_principals(id,principal_type,user_id,display_name,status)
      VALUES(:principal,'HUMAN',:operator,'Recovery Principal','ACTIVE')`, { replacements: ids });
    await sequelize.query(`INSERT INTO platform_capability_grants(id,principal_id,capability_id,granted_by_principal_id,grant_reason)
      SELECT gen_random_uuid(),:principal,id,:principal,'4.5-6 recovery test'
      FROM platform_capabilities WHERE code='TENANT_ADMIN_RECOVER'`, { replacements: { principal: ids.principal } });

    const resolver = new PlatformAuthorityRepository({ query: async () => ({
      rows: [{ id: ids.principal, principal_type: 'HUMAN', principal_code: ids.operator, capabilities: ['TENANT_ADMIN_RECOVER'] }], rowCount: 1,
    }) } as any);
    const authority = (await resolver.resolveHuman(ids.operator))!;
    const evidence = platformMutationEvidence(authority, ['TENANT_ADMIN_RECOVER'], {
      reason: 'Recover suspended tenant admin', correlationId: randomUUID(),
      source: { kind: 'GUARDED_4_5_6_TEST' }, resourceType: 'tenant',
    });

    const repository = new TenantAdminRecoveryRepository(pool);
    const result = await repository.recover(evidence, ids.publicId, ids.target);

    expect(result.tenantId).toBe(ids.tenant);
    expect(result.userId).toBe(ids.target);
    expect(result.status).toBe('ACTIVE');
    expect(result.role).toBe('ADMIN');

    await withOwner(async (c) => {
      const m = await c.query(`SELECT tm.status, (SELECT count(*)::int FROM tenant_membership_roles tmr JOIN rf_role r ON r.id=tmr.role_id AND r.code='ADMIN' WHERE tmr.membership_id=tm.id AND tmr.revoked_at IS NULL) admin_roles FROM tenant_memberships tm WHERE tm.tenant_id=$1 AND tm.user_id=$2`, [ids.tenant, ids.target]);
      expect(m.rowCount).toBe(1);
      expect(m.rows[0].status).toBe('ACTIVE');
      expect(Number(m.rows[0].admin_roles)).toBe(1);
      const a = await c.query(`SELECT count(*)::int n FROM tenant_membership_authority_audit WHERE tenant_id=$1 AND action='TENANT_ADMIN_RECOVERED'`, [ids.tenant]);
      expect(Number(a.rows[0].n)).toBe(1);
      const o = await c.query(`SELECT count(*)::int n FROM tenant_memberships WHERE tenant_id=$1 AND user_id=$2`, [ids.otherTenant, ids.target]);
      expect(Number(o.rows[0].n)).toBe(0);
    });

    await sequelize.query(`UPDATE platform_capability_grants SET revoked_at=CURRENT_TIMESTAMP,
      revoked_by_principal_id=:principal, revocation_reason='4.5-6 revocation'
      WHERE principal_id=:principal`, { replacements: { principal: ids.principal } });
    await expect(repository.recover(evidence, ids.publicId, ids.target)).rejects.toThrow('PLATFORM_CAPABILITY_REQUIRED');

    const client = await pool.connect();
    try {
      const leaked = await client.query(`SELECT count(*)::int n FROM tenant_memberships WHERE tenant_id=$1`, [ids.tenant]);
      expect(Number(leaked.rows[0].n)).toBe(0);
    } finally { client.release(); }

    await withOwner(async (c) => {
      await c.query(`ALTER TABLE public.tenant_membership_authority_audit DISABLE TRIGGER tr_tenant_membership_authority_audit_immutable`);
      await c.query(`ALTER TABLE public.platform_global_audit_log DISABLE TRIGGER tr_platform_global_audit_immutable`);
      await c.query(`DELETE FROM tenant_membership_authority_audit WHERE tenant_id=$1`, [ids.tenant]);
      await c.query(`DELETE FROM tenant_membership_roles WHERE membership_id IN (SELECT id FROM tenant_memberships WHERE tenant_id=$1)`, [ids.tenant]);
      await c.query(`DELETE FROM tenant_memberships WHERE tenant_id=$1`, [ids.tenant]);
      await c.query(`DELETE FROM platform_global_audit_log WHERE principal_id=$1`, [ids.principal]);
      await c.query(`DELETE FROM platform_capability_grants WHERE principal_id=$1`, [ids.principal]);
      await c.query(`DELETE FROM platform_principals WHERE id=$1`, [ids.principal]);
      await c.query(`ALTER TABLE public.platform_global_audit_log ENABLE TRIGGER tr_platform_global_audit_immutable`);
      await c.query(`ALTER TABLE public.tenant_membership_authority_audit ENABLE TRIGGER tr_tenant_membership_authority_audit_immutable`);
    });
  });
});
