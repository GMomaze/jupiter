import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { QueryTypes, Transaction } from 'sequelize';
import sequelize from '../../config/database.js';
import { PlatformAuthorityRepository } from '../platform-authority/platform-authority.repository.js';
import { platformMutationEvidence, platformServiceMutationEvidence } from '../platform-authority/authoritative-platform-mutation.js';
import { scheduledSbSyncFiles } from '../uploads/service-bulletin-sync-file-boundary.js';
import { ServiceBulletinSyncService } from './service-bulletin-sync.service.js';

describe('L2-2D3 guarded HUMAN/SERVICE synchronization', () => {
  afterAll(async () => { await sequelize.close(); });
  it('revalidates HUMAN and SERVICE per run, audits atomically, rejects stale grants and rolls back without residue', async () => {
    expect((await sequelize.query<{ name: string }>('SELECT current_database() name', { type: QueryTypes.SELECT }))[0]?.name).toBe('jupiter_test');
    const ids = { user: randomUUID(), human: randomUUID(), service: randomUUID(), humanGrant: randomUUID(), serviceGrant: randomUUID(), humanCorrelation: randomUUID(), serviceCorrelation: randomUUID() };
    const transaction = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE });
    try {
      await sequelize.query(`INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES(:id,:email,'unused','D3 Human',true)`, { replacements: { id: ids.user, email: `d3-${ids.user}@example.test` }, transaction });
      await sequelize.query(`INSERT INTO platform_principals(id,principal_type,user_id,display_name,status) VALUES(:id,'HUMAN',:user,'D3 Human','ACTIVE')`, { replacements: { id: ids.human, user: ids.user }, transaction });
      await sequelize.query(`INSERT INTO platform_principals(id,principal_type,service_code,display_name,status) VALUES(:id,'SERVICE','SB_SYNC_SCHEDULER','D3 Scheduler','ACTIVE')`, { replacements: { id: ids.service }, transaction });
      await sequelize.query(`INSERT INTO platform_capability_grants(id,principal_id,capability_id,granted_by_principal_id,grant_reason)
        SELECT :humanGrant,:human,id,:human,'D3 fixture' FROM platform_capabilities WHERE code='SERVICE_BULLETIN_SYNC_EXECUTE'`, { replacements: ids, transaction });
      await sequelize.query(`INSERT INTO platform_capability_grants(id,principal_id,capability_id,granted_by_principal_id,grant_reason)
        SELECT :serviceGrant,:service,id,:human,'D3 fixture' FROM platform_capabilities WHERE code='SERVICE_BULLETIN_SYNC_EXECUTE'`, { replacements: ids, transaction });
      const adapter = { query: async (sql: string, values?: unknown[]) => { const rows = await sequelize.query(sql, { bind: values, transaction, type: QueryTypes.SELECT }); return { rows, rowCount: rows.length }; } };
      const repository = new PlatformAuthorityRepository(adapter as any);
      const human = await repository.resolveHuman(ids.user);
      const service = await repository.resolveService('SB_SYNC_SCHEDULER');
      const files = await scheduledSbSyncFiles('ATP');
      const humanEvidence = platformMutationEvidence(human, ['SERVICE_BULLETIN_SYNC'], { reason: 'D3 guarded HUMAN', correlationId: ids.humanCorrelation, source: { kind: 'TEST_FIXTURE' }, resourceType: 'service_bulletin_sync_run' });
      const serviceEvidence = platformServiceMutationEvidence(service, ['SERVICE_BULLETIN_SYNC'], { reason: 'D3 guarded SERVICE', correlationId: ids.serviceCorrelation, source: { kind: 'TEST_FIXTURE' }, resourceType: 'service_bulletin_sync_run' });
      await expect(ServiceBulletinSyncService.syncAll(humanEvidence, 'MANUAL', { method: 'ATP', files }, transaction)).resolves.toMatchObject({ synced: 0, created: 0, updated: 0 });
      const contender = await sequelize.transaction();
      try {
        const [lock] = await sequelize.query<Array<{ acquired: boolean }>>(`SELECT pg_try_advisory_xact_lock(hashtext('JUPITER_SERVICE_BULLETIN_SYNC')) acquired`, { transaction: contender, type: QueryTypes.SELECT });
        expect(lock?.acquired).toBe(false);
      } finally { await contender.rollback(); }
      await expect(ServiceBulletinSyncService.syncAll(serviceEvidence, 'CRON', { method: 'ATP', files }, transaction)).resolves.toMatchObject({ synced: 0, created: 0, updated: 0 });
      expect((await sequelize.query<{ count: number }>(`SELECT count(*)::int count FROM platform_global_audit_log WHERE correlation_id IN (:humanCorrelation,:serviceCorrelation) AND action='SERVICE_BULLETIN_SYNC'`, { replacements: ids, transaction, type: QueryTypes.SELECT }))[0]?.count).toBe(2);
      await sequelize.query(`UPDATE platform_capability_grants SET revoked_at=CURRENT_TIMESTAMP,revoked_by_principal_id=:human,revocation_reason='D3 stale test' WHERE id=:serviceGrant`, { replacements: ids, transaction });
      await expect(ServiceBulletinSyncService.syncAll(serviceEvidence, 'CRON', { method: 'ATP', files }, transaction)).rejects.toThrow('PLATFORM_CAPABILITY_REQUIRED');
    } finally { await transaction.rollback(); }
    const residue = (await sequelize.query<{ count: number }>(`SELECT
      (SELECT count(*) FROM users WHERE id=:user)+(SELECT count(*) FROM platform_principals WHERE id IN (:human,:service))+
      (SELECT count(*) FROM platform_capability_grants WHERE id IN (:humanGrant,:serviceGrant))+
      (SELECT count(*) FROM platform_global_audit_log WHERE correlation_id IN (:humanCorrelation,:serviceCorrelation)) count`, { replacements: ids, type: QueryTypes.SELECT }))[0]?.count;
    expect(Number(residue)).toBe(0);
    const state = (await sequelize.query<any>(`SELECT (SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 1) ledger_head,(SELECT count(*)::int FROM platform_capabilities) capabilities,(SELECT tgenabled FROM pg_trigger WHERE tgname='tr_platform_global_audit_immutable') audit_trigger`, { type: QueryTypes.SELECT }))[0];
    expect(state).toEqual({ ledger_head: '600_create_platform_file_operations.ts', capabilities: 17, audit_trigger: 'O' });
  });
});
