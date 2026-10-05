import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import migration601 from '../../../migrations/601_create_tenant_lifecycle_foundation.js';

const capabilityCodes = ['TENANT_PROVISION', 'TENANT_ACTIVATE', 'TENANT_SUSPEND', 'TENANT_REINSTATE'];

describe('L3-1 guarded lifecycle foundation', () => {
  afterAll(async () => { await sequelize.close(); });

  it('is installed only on exact jupiter_test with locked seeds and delete protection', async () => {
    expect((await sequelize.query<{ name: string }>('SELECT current_database() name', { type: QueryTypes.SELECT }))[0]?.name).toBe('jupiter_test');
    const state = (await sequelize.query<any>(`SELECT
      (SELECT count(*)::int FROM platform_capabilities WHERE code IN(:codes) AND is_active AND system_locked) capabilities,
      EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='tr_tenants_lifecycle_transition' AND tgenabled<>'D') lifecycle_trigger,
      EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='tr_tenants_delete_prohibited' AND tgenabled<>'D') delete_trigger,
      has_table_privilege('jupiter_app','public.tenants','DELETE') app_can_delete,
      (SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 1) ledger_head`,
      { replacements: { codes: capabilityCodes }, type: QueryTypes.SELECT }))[0];
    expect(state).toEqual({ capabilities: 4, lifecycle_trigger: true, delete_trigger: true, app_can_delete: false, ledger_head: '601_create_tenant_lifecycle_foundation.ts' });
  });

  it('enforces lifecycle transitions and unconditional deletion with zero fixture residue', async () => {
    const userId = randomUUID();
    const tenantId = randomUUID();
    await expect(sequelize.transaction(async transaction => {
      await sequelize.query(`INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES(:id,:email,'unused','L3 Fixture',true)`,
        { replacements: { id: userId, email: `l3-${userId}@example.test` }, transaction });
      await sequelize.query(`INSERT INTO tenants(id,public_id,code,display_name,status,created_by_user_id,updated_by_user_id)
        VALUES(:id,:publicId,:code,'L3 Fixture','PROVISIONING',:userId,:userId)`,
        { replacements: { id: tenantId, publicId: randomUUID(), code: `L3_${randomUUID().replaceAll('-', '').toUpperCase()}`, userId }, transaction });
      await sequelize.query(`UPDATE tenants SET status='ACTIVE',updated_by_user_id=:userId WHERE id=:id`, { replacements: { id: tenantId, userId }, transaction });
      await sequelize.query(`UPDATE tenants SET status='SUSPENDED',suspension_reason='Guarded test',suspended_at=CURRENT_TIMESTAMP,suspended_by_user_id=:userId,updated_by_user_id=:userId WHERE id=:id`, { replacements: { id: tenantId, userId }, transaction });
      await sequelize.query(`UPDATE tenants SET status='ACTIVE',suspension_reason=NULL,suspended_at=NULL,suspended_by_user_id=NULL,updated_by_user_id=:userId WHERE id=:id`, { replacements: { id: tenantId, userId }, transaction });

      await sequelize.query('SAVEPOINT invalid_transition', { transaction });
      await expect(sequelize.query(`UPDATE tenants SET status='ARCHIVED',archived_at=CURRENT_TIMESTAMP WHERE id=:id`, { replacements: { id: tenantId }, transaction })).rejects.toThrow(/TENANT_LIFECYCLE_TRANSITION_PROHIBITED/);
      await sequelize.query('ROLLBACK TO SAVEPOINT invalid_transition', { transaction });
      await sequelize.query('SAVEPOINT prohibited_delete', { transaction });
      await expect(sequelize.query('DELETE FROM tenants WHERE id=:id', { replacements: { id: tenantId }, transaction })).rejects.toThrow(/TENANT_DELETION_PROHIBITED/);
      await sequelize.query('ROLLBACK TO SAVEPOINT prohibited_delete', { transaction });
      throw new Error('ROLLBACK_L3_FIXTURE');
    })).rejects.toThrow('ROLLBACK_L3_FIXTURE');
    const residue = await sequelize.query<{ count: number }>(`SELECT
      (SELECT count(*)::int FROM tenants WHERE id=:tenantId) +
      (SELECT count(*)::int FROM users WHERE id=:userId) count`,
      { replacements: { tenantId, userId }, type: QueryTypes.SELECT });
    expect(residue[0]?.count).toBe(0);
  });

  it('refuses DOWN with lifecycle grant evidence and leaves the foundation intact', async () => {
    const userId = randomUUID();
    const principalId = randomUUID();
    const grantId = randomUUID();
    try {
      await sequelize.query(`INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES(:id,:email,'unused','L3 Down Fixture',true)`, { replacements: { id: userId, email: `l3-down-${userId}@example.test` } });
      await sequelize.query(`INSERT INTO platform_principals(id,principal_type,user_id,display_name,status) VALUES(:id,'HUMAN',:userId,'L3 Down Fixture','ACTIVE')`, { replacements: { id: principalId, userId } });
      await sequelize.query(`INSERT INTO platform_capability_grants(id,principal_id,capability_id,granted_by_principal_id,grant_reason)
        SELECT :id,:principal,id,:principal,'L3 guarded refusal' FROM platform_capabilities WHERE code='TENANT_SUSPEND'`,
        { replacements: { id: grantId, principal: principalId } });
      await expect(migration601.down(sequelize.getQueryInterface())).rejects.toThrow('MIGRATION_601_DOWN_REFUSES_LIFECYCLE_EVIDENCE');
    } finally {
      await sequelize.query('DELETE FROM platform_capability_grants WHERE id=:id', { replacements: { id: grantId } });
      await sequelize.query('DELETE FROM platform_principals WHERE id=:id', { replacements: { id: principalId } });
      await sequelize.query('DELETE FROM users WHERE id=:id', { replacements: { id: userId } });
    }
    const state = (await sequelize.query<any>(`SELECT
      (SELECT count(*)::int FROM platform_capabilities WHERE code IN(:codes)) capabilities,
      EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='tr_tenants_delete_prohibited' AND tgenabled<>'D') delete_trigger,
      (SELECT count(*)::int FROM platform_capability_grants g JOIN platform_capabilities c ON c.id=g.capability_id WHERE c.code IN(:codes)) grants,
      (SELECT count(*)::int FROM platform_global_audit_log WHERE capability_code IN(:codes)) audits`,
      { replacements: { codes: capabilityCodes }, type: QueryTypes.SELECT }))[0];
    expect(state).toEqual({ capabilities: 4, delete_trigger: true, grants: 0, audits: 0 });
  });
});
