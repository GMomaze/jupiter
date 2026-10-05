import { randomUUID } from 'node:crypto';
import { QueryTypes, Transaction } from 'sequelize';
import { afterAll, describe, expect, it } from 'vitest';
import sequelize from '../../config/database.js';
import { PlatformAuthorityRepository } from './platform-authority.repository.js';
import { executeAuthoritativePlatformMutation, platformMutationEvidence } from './authoritative-platform-mutation.js';

describe('L2-2C guarded authoritative mutation', () => {
  afterAll(async () => { await sequelize.close(); });

  it('revalidates and atomically audits on exact jupiter_test with rollback and zero residue', async () => {
    expect((await sequelize.query<{ name: string }>('SELECT current_database() name', { type: QueryTypes.SELECT }))[0]?.name).toBe('jupiter_test');
    const ids = { user: randomUUID(), principal: randomUUID(), grant: randomUUID(), asset: randomUUID(), deletedAsset: randomUUID(), failedAsset: randomUUID() };
    const transaction = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE });
    try {
      await sequelize.query(`INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES(:id,:email,'unused','L2-2C fixture',true)`, { replacements: { id: ids.user, email: `l2-2c-${ids.user}@example.test` }, transaction });
      await sequelize.query(`INSERT INTO platform_principals(id,principal_type,user_id,display_name,status) VALUES(:id,'HUMAN',:user,'L2-2C fixture','ACTIVE')`, { replacements: { id: ids.principal, user: ids.user }, transaction });
      await sequelize.query(`INSERT INTO platform_capability_grants(id,principal_id,capability_id,granted_by_principal_id,grant_reason)
        SELECT :grant,:principal,id,:principal,'L2-2C fixture' FROM platform_capabilities WHERE code='REFERENCE_DATA_CREATE'`, { replacements: { grant: ids.grant, principal: ids.principal }, transaction });
      const adapter = { query: async (sql: string, values?: unknown[]) => {
        const rows = await sequelize.query(sql, { bind: values, transaction, type: QueryTypes.SELECT });
        return { rows, rowCount: rows.length };
      } };
      const authority = await new PlatformAuthorityRepository(adapter as any).resolveHuman(ids.user);
      const evidence = platformMutationEvidence(authority, ['REFERENCE_CREATE'], {
        reason: 'guarded L2-2C verification', correlationId: randomUUID(), source: { kind: 'TEST_FIXTURE' }, resourceType: 'rf_asset_type',
      });
      await executeAuthoritativePlatformMutation(evidence, async tx => {
        await sequelize.query(`INSERT INTO rf_asset_type(id,code,label,system_locked,is_active) VALUES(:id,:code,'L2-2C fixture',false,true)`, { replacements: { id: ids.asset, code: `L2C_${ids.asset.slice(0, 8)}` }, transaction: tx });
        return ids.asset;
      }, id => ({ resourceId: id, after: { id } }), transaction);
      expect((await sequelize.query<{ count: number }>(`SELECT count(*)::int count FROM platform_global_audit_log WHERE resource_id=:id AND action='REFERENCE_CREATE'`, { replacements: { id: ids.asset }, transaction, type: QueryTypes.SELECT }))[0]?.count).toBe(1);

      const updateEvidence = platformMutationEvidence(authority, ['REFERENCE_CREATE'], {
        reason: 'guarded update evidence', correlationId: randomUUID(), source: { kind: 'TEST_FIXTURE' }, resourceType: 'rf_asset_type', resourceId: ids.asset,
      });
      await executeAuthoritativePlatformMutation(updateEvidence, async (tx, audit) => {
        const [before] = await sequelize.query<any>(`SELECT * FROM rf_asset_type WHERE id=:id FOR UPDATE`, { replacements: { id: ids.asset }, transaction: tx, type: QueryTypes.SELECT });
        audit.setBefore(before);
        const [after] = await sequelize.query<any>(`UPDATE rf_asset_type SET label='L2-2C after' WHERE id=:id RETURNING *`, { replacements: { id: ids.asset }, transaction: tx, type: QueryTypes.SELECT });
        return after;
      }, after => ({ resourceId: ids.asset, after }), transaction);
      const [updateAudit] = await sequelize.query<any>(`SELECT old_values,new_values FROM platform_global_audit_log WHERE correlation_id=:correlation`, { replacements: { correlation: updateEvidence.correlationId }, transaction, type: QueryTypes.SELECT });
      expect(updateAudit.old_values.label).toBe('L2-2C fixture');
      expect(updateAudit.new_values.label).toBe('L2-2C after');

      await sequelize.query(`INSERT INTO rf_asset_type(id,code,label,system_locked,is_active) VALUES(:id,:code,'delete-before',false,true)`, { replacements: { id: ids.deletedAsset, code: `L2D_${ids.deletedAsset.slice(0, 8)}` }, transaction });
      const deleteEvidence = platformMutationEvidence(authority, ['REFERENCE_CREATE'], {
        reason: 'guarded delete evidence', correlationId: randomUUID(), source: { kind: 'TEST_FIXTURE' }, resourceType: 'rf_asset_type', resourceId: ids.deletedAsset,
      });
      await executeAuthoritativePlatformMutation(deleteEvidence, async (tx, audit) => {
        const [before] = await sequelize.query<any>(`SELECT * FROM rf_asset_type WHERE id=:id FOR UPDATE`, { replacements: { id: ids.deletedAsset }, transaction: tx, type: QueryTypes.SELECT });
        audit.setBefore(before);
        await sequelize.query(`DELETE FROM rf_asset_type WHERE id=:id`, { replacements: { id: ids.deletedAsset }, transaction: tx });
      }, () => ({ resourceId: ids.deletedAsset, after: null }), transaction);
      const [deleteAudit] = await sequelize.query<any>(`SELECT old_values,new_values FROM platform_global_audit_log WHERE correlation_id=:correlation`, { replacements: { correlation: deleteEvidence.correlationId }, transaction, type: QueryTypes.SELECT });
      expect(deleteAudit.old_values.label).toBe('delete-before');
      expect(deleteAudit.new_values).toBeNull();

      const failedEvidence = platformMutationEvidence(authority, ['REFERENCE_CREATE'], {
        reason: 'forced audit failure', correlationId: randomUUID(), source: { kind: 'TEST_FIXTURE' }, resourceType: 'X'.repeat(121), resourceId: ids.failedAsset,
      });
      const savepoint = await sequelize.transaction({ transaction });
      await expect(executeAuthoritativePlatformMutation(failedEvidence, async tx => {
        await sequelize.query(`INSERT INTO rf_asset_type(id,code,label,system_locked,is_active) VALUES(:id,:code,'must rollback',false,true)`, { replacements: { id: ids.failedAsset, code: `L2F_${ids.failedAsset.slice(0, 8)}` }, transaction: tx });
      }, undefined, savepoint)).rejects.toThrow();
      await savepoint.rollback();
      expect((await sequelize.query<{ count: number }>(`SELECT count(*)::int count FROM rf_asset_type WHERE id=:id`, { replacements: { id: ids.failedAsset }, transaction, type: QueryTypes.SELECT }))[0]?.count).toBe(0);

      await sequelize.query(`UPDATE platform_capability_grants SET revoked_at=CURRENT_TIMESTAMP,revoked_by_principal_id=:principal,revocation_reason='test' WHERE id=:grant`, { replacements: { principal: ids.principal, grant: ids.grant }, transaction });
      await expect(executeAuthoritativePlatformMutation(evidence, async () => 'forbidden', undefined, transaction)).rejects.toThrow('PLATFORM_CAPABILITY_REQUIRED');
    } finally {
      await transaction.rollback();
    }
    const residue = (await sequelize.query<{ count: number }>(`SELECT
      (SELECT count(*) FROM users WHERE id=:user) +
      (SELECT count(*) FROM platform_principals WHERE id=:principal) +
      (SELECT count(*) FROM platform_capability_grants WHERE id=:grant) +
      (SELECT count(*) FROM rf_asset_type WHERE id=:asset) +
      (SELECT count(*) FROM rf_asset_type WHERE id IN (:deletedAsset,:failedAsset)) +
      (SELECT count(*) FROM platform_global_audit_log WHERE resource_id=:asset) AS count`, { replacements: ids, type: QueryTypes.SELECT }))[0]?.count;
    expect(Number(residue)).toBe(0);
    const invariants = (await sequelize.query<{ ledger_head: string; capabilities: number; trigger: string }>(`SELECT
      (SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 1) ledger_head,
      (SELECT count(*)::int FROM platform_capabilities) capabilities,
      (SELECT tgenabled FROM pg_trigger WHERE tgname='tr_platform_global_audit_immutable') trigger`, { type: QueryTypes.SELECT }))[0];
    expect(invariants).toEqual({ ledger_head: '600_create_platform_file_operations.ts', capabilities: 17, trigger: 'O' });
  });
});
