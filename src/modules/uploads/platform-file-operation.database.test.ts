import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import { PlatformFileOperationRepository } from './platform-file-operation.repository.js';
import migration600 from '../../../migrations/600_create_platform_file_operations.js';

describe('L2-2D1 guarded platform file-operation journal',()=>{
  afterAll(async()=>{await sequelize.close();});
  it('uses exact jupiter_test, enforces transitions, rolls back, and leaves zero residue',async()=>{
    expect((await sequelize.query<{name:string}>('SELECT current_database() name',{type:QueryTypes.SELECT}))[0]?.name).toBe('jupiter_test');
    const ids={user:randomUUID(),principal:randomUUID(),correlation:randomUUID()};
    const repository=new PlatformFileOperationRepository();
    await sequelize.transaction(async transaction=>{
      await sequelize.query(`INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES(:id,:email,'unused','D1 Fixture',true)`,{replacements:{id:ids.user,email:`d1-${ids.user}@example.test`},transaction});
      await sequelize.query(`INSERT INTO platform_principals(id,principal_type,user_id,display_name,status) VALUES(:id,'HUMAN',:userId,'D1 Fixture','ACTIVE')`,{replacements:{id:ids.principal,userId:ids.user},transaction});
      const operationId=await repository.prepare({correlationId:ids.correlation,principalId:ids.principal,operationKind:'REPLACEMENT',quarantineRootKey:'MANUFACTURER_QUARANTINE',destinationRootKey:'MANUFACTURER_PUBLIC',quarantineName:`${randomUUID()}.upload`,destinationName:`${randomUUID()}.png`,previousName:'existing.png',originalName:'client.png',declaredMime:'image/png'},transaction);
      await repository.transition(operationId,'VALIDATED',{detectedMediaType:'image/png',contentSha256:'a'.repeat(64),sizeBytes:16},transaction);
      await repository.transition(operationId,'PROMOTING',{},transaction);
      await repository.transition(operationId,'PROMOTED',{},transaction);
      await repository.recordPreviousName(operationId,'authoritative-existing.png',transaction);
      await repository.transition(operationId,'COMMITTED',{},transaction);
      const row=await repository.lock(operationId,transaction);expect(row).toMatchObject({state:'COMMITTED',previous_name:'authoritative-existing.png'});
      await expect(repository.transition(operationId,'CLEANED',{},transaction)).rejects.toThrow('FILE_OPERATION_INVALID_TRANSITION');
      throw new Error('ROLLBACK_D1_FIXTURE');
    }).catch(error=>{if((error as Error).message!=='ROLLBACK_D1_FIXTURE')throw error;});
    const state=(await sequelize.query<any>(`SELECT
      (SELECT count(*)::int FROM platform_file_operations WHERE correlation_id=:correlation) journal,
      (SELECT count(*)::int FROM platform_principals WHERE id=:principal) principals,
      (SELECT count(*)::int FROM platform_capability_grants) grants,
      (SELECT count(*)::int FROM platform_capabilities) capabilities,
      (SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 1) ledger_head,
      (SELECT tgenabled FROM pg_trigger WHERE tgname='tr_platform_global_audit_immutable') audit_trigger`,{replacements:ids,type:QueryTypes.SELECT}))[0];
    expect(state).toEqual({journal:0,principals:0,grants:0,capabilities:17,ledger_head:'600_create_platform_file_operations.ts',audit_trigger:'O'});
  });
  it('refuses populated DOWN and removes its committed refusal fixture',async()=>{
    const ids={user:randomUUID(),principal:randomUUID(),operation:randomUUID(),correlation:randomUUID()};
    try{
      await sequelize.query(`INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES(:id,:email,'unused','D1 Down Fixture',true)`,{replacements:{id:ids.user,email:`d1-down-${ids.user}@example.test`}});
      await sequelize.query(`INSERT INTO platform_principals(id,principal_type,user_id,display_name,status) VALUES(:id,'HUMAN',:userId,'D1 Down Fixture','ACTIVE')`,{replacements:{id:ids.principal,userId:ids.user}});
      await sequelize.query(`INSERT INTO platform_file_operations(id,correlation_id,principal_id,operation_kind,state,quarantine_root_key,destination_root_key,quarantine_name) VALUES(:id,:correlation,:principal,'PROMOTION','PREPARED','MANUFACTURER_QUARANTINE','MANUFACTURER_PUBLIC',:name)`,{replacements:{id:ids.operation,correlation:ids.correlation,principal:ids.principal,name:`${randomUUID()}.upload`}});
      await expect(migration600.down(sequelize.getQueryInterface())).rejects.toThrow('MIGRATION_600_DOWN_REFUSES_FILE_OPERATION_EVIDENCE');
      expect((await sequelize.query<{name:string}>('SELECT to_regclass(\'public.platform_file_operations\')::text name',{type:QueryTypes.SELECT}))[0]?.name).toBe('platform_file_operations');
    }finally{
      await sequelize.query('DELETE FROM platform_file_operations WHERE id=:id',{replacements:{id:ids.operation}});
      await sequelize.query('DELETE FROM platform_principals WHERE id=:id',{replacements:{id:ids.principal}});
      await sequelize.query('DELETE FROM users WHERE id=:id',{replacements:{id:ids.user}});
    }
    const residue=await sequelize.query<{count:number}>(`SELECT
      (SELECT count(*)::int FROM platform_file_operations WHERE id=:operation) +
      (SELECT count(*)::int FROM platform_principals WHERE id=:principal) +
      (SELECT count(*)::int FROM users WHERE id=:user) count`,{replacements:ids,type:QueryTypes.SELECT});
    expect(residue[0]?.count).toBe(0);
  });
});
