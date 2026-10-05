import { afterAll, describe, expect, it } from 'vitest';
import { pool } from '../../config/database.js';
import { PLATFORM_MUTATION_CAPABILITIES } from './platform-authority.js';
import { PlatformAuthorityRepository } from './platform-authority.repository.js';
import { authorizeSharedOperation } from './shared-operation-policy.js';

const humanUserId = '59900000-0000-4000-8000-000000000001';
const legacyUserId = '59900000-0000-4000-8000-000000000002';
const humanPrincipalId = '59900000-0000-4000-8000-000000000011';
const servicePrincipalId = '59900000-0000-4000-8000-000000000012';

describe('L2-2A guarded operation policy', () => {
  afterAll(async () => { await pool.end(); });
  it('revalidates HUMAN/SERVICE authority and leaves zero residue', async () => {
    const before = (await pool.query(`SELECT
      (SELECT count(*)::int FROM users) users,
      (SELECT count(*)::int FROM platform_principals) principals,
      (SELECT count(*)::int FROM platform_capability_grants) grants,
      (SELECT count(*)::int FROM platform_global_audit_log) audits,
      (SELECT count(*)::int FROM platform_capabilities) capabilities,
      (SELECT count(*)::int FROM "SequelizeMeta") ledger,
      (SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 1) head,
      (SELECT tgenabled FROM pg_trigger WHERE tgname='tr_platform_global_audit_immutable') trigger`)).rows[0];
    expect(before.capabilities).toBe(17);
    expect(before.head).toBe('600_create_platform_file_operations.ts');
    const seeded = await pool.query(`SELECT code,is_active,system_locked FROM platform_capabilities WHERE code=ANY($1::text[]) ORDER BY code`, [[...PLATFORM_MUTATION_CAPABILITIES]]);
    expect(seeded.rows).toHaveLength(15);
    expect(seeded.rows.every(row => row.is_active && row.system_locked)).toBe(true);
    const client = await pool.connect();
    await client.query('BEGIN');
    try {
      await client.query(`INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES
        ($1,'l2-2a-human@example.test','x','Human',true),($2,'l2-2a-legacy@example.test','x','Legacy',true)`, [humanUserId, legacyUserId]);
      const adminRole = (await client.query(`SELECT id FROM rf_role WHERE code='ADMIN'`)).rows[0];
      if (adminRole) await client.query(`INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)`, [legacyUserId, adminRole.id]);
      const humanCapability = (await client.query(`SELECT id FROM platform_capabilities WHERE code='REFERENCE_DATA_CREATE'`)).rows[0].id;
      const syncCapability = (await client.query(`SELECT id FROM platform_capabilities WHERE code='SERVICE_BULLETIN_SYNC_EXECUTE'`)).rows[0].id;
      await client.query(`INSERT INTO platform_principals(id,principal_type,user_id,service_code,display_name,status) VALUES
        ($1,'HUMAN',$2,NULL,'Human','ACTIVE'),($3,'SERVICE',NULL,'L2_2A_SYNC','Sync','ACTIVE')`, [humanPrincipalId, humanUserId, servicePrincipalId]);
      await client.query(`INSERT INTO platform_capability_grants(id,principal_id,capability_id,granted_by_principal_id,grant_reason) VALUES
        (gen_random_uuid(),$1,$3,$1,'verify'),(gen_random_uuid(),$2,$4,$1,'verify')`, [humanPrincipalId, servicePrincipalId, humanCapability, syncCapability]);
      const adapter = { query: (sql:string, values?:unknown[]) => client.query(sql, values), connect: async () => ({ query: async (sql:string, values?:unknown[]) => {
        if(sql==='BEGIN') return client.query('SAVEPOINT operation_policy');
        if(sql==='COMMIT') return client.query('RELEASE SAVEPOINT operation_policy');
        if(sql==='ROLLBACK') return client.query('ROLLBACK TO SAVEPOINT operation_policy');
        return client.query(sql, values);
      }, release(){} }) };
      const repository = new PlatformAuthorityRepository(adapter as any);
      const human = await repository.resolveHuman(humanUserId);
      const service = await repository.resolveService('l2_2a_sync');
      expect(await repository.resolveHuman(legacyUserId)).toBeNull();
      await expect(authorizeSharedOperation(repository, human, 'REFERENCE_CREATE')).resolves.toBeUndefined();
      await expect(authorizeSharedOperation(repository, service, 'SERVICE_BULLETIN_SYNC')).resolves.toBeUndefined();
      await expect(authorizeSharedOperation(repository, service, 'REFERENCE_CREATE')).rejects.toThrow('PLATFORM_PRINCIPAL_TYPE_REQUIRED');
      await client.query(`UPDATE platform_capability_grants SET revoked_by_principal_id=$1,revoked_at=CURRENT_TIMESTAMP,revocation_reason='verify' WHERE principal_id=$1`, [humanPrincipalId]);
      await expect(authorizeSharedOperation(repository, human, 'REFERENCE_CREATE')).rejects.toThrow('PLATFORM_CAPABILITY_REQUIRED');
      await client.query(`UPDATE platform_principals SET status='DISABLED',disabled_at=CURRENT_TIMESTAMP,disabled_by_principal_id=$1 WHERE id=$1`, [servicePrincipalId]);
      await expect(authorizeSharedOperation(repository, service, 'SERVICE_BULLETIN_SYNC')).rejects.toThrow('PLATFORM_CAPABILITY_REQUIRED');
      await expect(authorizeSharedOperation(repository, { principalId: humanPrincipalId }, 'REFERENCE_CREATE')).rejects.toThrow('PLATFORM_AUTHORITY_REQUIRED');
    } finally { await client.query('ROLLBACK'); client.release(); }
    const after = (await pool.query(`SELECT
      (SELECT count(*)::int FROM users) users,
      (SELECT count(*)::int FROM platform_principals) principals,
      (SELECT count(*)::int FROM platform_capability_grants) grants,
      (SELECT count(*)::int FROM platform_global_audit_log) audits,
      (SELECT count(*)::int FROM platform_capabilities) capabilities,
      (SELECT count(*)::int FROM "SequelizeMeta") ledger,
      (SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 1) head,
      (SELECT tgenabled FROM pg_trigger WHERE tgname='tr_platform_global_audit_immutable') trigger`)).rows[0];
    expect(after).toEqual(before);
  });
});
