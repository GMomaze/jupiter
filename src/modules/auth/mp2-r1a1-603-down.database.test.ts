import { afterAll,describe,expect,it } from 'vitest';
import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';

describe('migration 603 guarded DOWN state',()=>{
  afterAll(async()=>sequelize.close());
  it('restores only the exact 602 last-admin objects',async()=>{
    expect((await sequelize.query<{name:string}>('SELECT current_database() name',{type:QueryTypes.SELECT}))[0]?.name).toBe('jupiter_test');
    const state=(await sequelize.query<any>(`SELECT
      (SELECT max(name) FROM public."SequelizeMeta") ledger_head,
      EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='tr_tenant_memberships_require_active_admin' AND tgenabled<>'D') membership_trigger,
      EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='tr_tenant_membership_roles_require_active_admin' AND tgenabled<>'D') role_trigger,
      to_regprocedure('public.fn_tenant_requires_active_admin()') IS NOT NULL admin_function,
      to_regclass('public.staff_invitations') IS NOT NULL invitations,
      to_regclass('public.tenant_membership_authority_audit') IS NOT NULL audit,
      (SELECT count(*)::int FROM platform_capabilities WHERE code='TENANT_ADMIN_RECOVER' AND is_active AND system_locked) capability,
      (SELECT count(*)::int FROM platform_capability_grants g JOIN platform_capabilities c ON c.id=g.capability_id WHERE c.code='TENANT_ADMIN_RECOVER') grants`,{type:QueryTypes.SELECT}))[0];
    expect(state).toEqual({ledger_head:'602_create_staff_membership_administration.ts',membership_trigger:true,role_trigger:true,admin_function:true,invitations:true,audit:true,capability:1,grants:0});
  });
});
