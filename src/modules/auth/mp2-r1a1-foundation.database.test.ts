import { randomUUID } from 'node:crypto';
import { afterAll,describe,expect,it } from 'vitest';
import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';

describe('MP2-R1A-1 guarded foundation',()=>{
  afterAll(async()=>sequelize.close());
  it('has exact capability and immutable audit while deferred last-admin enforcement is absent',async()=>{
    expect((await sequelize.query<{name:string}>('SELECT current_database() name',{type:QueryTypes.SELECT}))[0]?.name).toBe('jupiter_test');
    const state=(await sequelize.query<any>(`SELECT
      (SELECT count(*)::int FROM platform_capabilities WHERE code='TENANT_ADMIN_RECOVER' AND is_active AND system_locked) capability,
      (SELECT count(*)::int FROM platform_capability_grants g JOIN platform_capabilities c ON c.id=g.capability_id WHERE c.code='TENANT_ADMIN_RECOVER') grants,
      EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='tr_tenant_memberships_require_active_admin' AND tgenabled<>'D') membership_trigger,
      EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='tr_tenant_membership_roles_require_active_admin' AND tgenabled<>'D') role_trigger,
      to_regprocedure('public.fn_tenant_requires_active_admin()') IS NOT NULL admin_function,
      EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='tr_tenant_membership_authority_audit_immutable' AND tgenabled<>'D') audit_trigger,
      has_table_privilege('jupiter_app','tenant_membership_authority_audit','UPDATE') audit_update,
      has_table_privilege('jupiter_app','tenant_membership_authority_audit','DELETE') audit_delete,
      (SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 1) ledger_head` ,{type:QueryTypes.SELECT}))[0];
    expect(state).toEqual({capability:1,grants:0,membership_trigger:false,role_trigger:false,admin_function:false,audit_trigger:true,audit_update:false,audit_delete:false,ledger_head:'603_remove_deferred_last_admin_enforcement.ts'});
  });

  it('retains immutable audit without activating deferred last-admin enforcement',async()=>{
    const user=randomUUID(),tenant=randomUUID(),membership=randomUUID(),audit=randomUUID();
    await expect(sequelize.transaction(async transaction=>{
      await sequelize.query(`INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES(:user,:email,'unused','R1A Fixture',true)`,{replacements:{user,email:`r1a-${user}@example.test`},transaction});
      await sequelize.query(`INSERT INTO tenants(id,public_id,code,display_name,status,created_by_user_id,updated_by_user_id) VALUES(:tenant,:publicId,:code,'R1A','ACTIVE',:user,:user)`,{replacements:{tenant,publicId:randomUUID(),code:`R1A_${user.replaceAll('-','').toUpperCase()}`,user},transaction});
      await sequelize.query(`INSERT INTO tenant_memberships(id,tenant_id,user_id,status,joined_at,created_by_user_id,updated_by_user_id) VALUES(:membership,:tenant,:user,'ACTIVE',CURRENT_TIMESTAMP,:user,:user)`,{replacements:{membership,tenant,user},transaction});
      await sequelize.query(`INSERT INTO tenant_membership_authority_audit(id,tenant_id,membership_id,actor_user_id,actor_kind,action,reason,correlation_id) VALUES(:audit,:tenant,:membership,:user,'TENANT_ADMIN','TEST','Test evidence',:correlation)`,{replacements:{audit,tenant,membership,user,correlation:randomUUID()},transaction});
      await sequelize.query('SAVEPOINT immutable_audit',{transaction});
      await expect(sequelize.query(`UPDATE tenant_membership_authority_audit SET reason='Changed' WHERE id=:audit`,{replacements:{audit},transaction})).rejects.toThrow(/IMMUTABLE/);
      await sequelize.query('ROLLBACK TO SAVEPOINT immutable_audit',{transaction});
      await sequelize.query(`UPDATE tenant_memberships SET status='DISABLED',disabled_at=CURRENT_TIMESTAMP,disabled_by_user_id=:user,status_reason='Offboard',updated_by_user_id=:user WHERE id=:membership`,{replacements:{user,membership},transaction});
      await expect(sequelize.query('SET CONSTRAINTS ALL IMMEDIATE',{transaction})).resolves.toBeDefined();
      throw new Error('ROLLBACK_R1A_FIXTURES');
    })).rejects.toThrow('ROLLBACK_R1A_FIXTURES');
    const residue=(await sequelize.query<{count:number}>(`SELECT (SELECT count(*)::int FROM users WHERE id=:user)+(SELECT count(*)::int FROM tenants WHERE id=:tenant)+(SELECT count(*)::int FROM tenant_membership_authority_audit WHERE id=:audit) count`,{replacements:{user,tenant,audit},type:QueryTypes.SELECT}))[0]?.count;
    expect(residue).toBe(0);
  });
});
