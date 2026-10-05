import { randomUUID } from 'node:crypto';
import { afterAll,describe,expect,it,vi } from 'vitest';
import { pool } from '../../config/database.js';
import sequelize from '../../config/database.js';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { StaffInvitationService,StaffMembershipAdministrationRepository } from './staff-membership-administration.js';
import { PlatformAuthorityRepository } from '../platform-authority/platform-authority.repository.js';
import { platformMutationEvidence } from '../platform-authority/authoritative-platform-mutation.js';
import { TenantAdminRecoveryRepository } from '../tenancy/tenant-admin-recovery.js';

describe('MP2-R1A-1 guarded cross-boundary adversarial behavior',()=>{
  afterAll(async()=>{await pool.end();await sequelize.close();});
  it('keeps invitation, membership and recovery mutations tenant-local, atomic and audited',async()=>{
    const client=await pool.connect();
    const ids={tenantA:randomUUID(),tenantB:randomUUID(),admin:randomUUID(),member:randomUUID(),recovery:randomUUID(),principal:randomUUID(),grant:randomUUID()};
    let savepoint=0;
    const adapter:any={query:(sql:string,params?:unknown[])=>client.query(sql,params as any),connect:async()=>({query:async(sql:string,params?:unknown[])=>{
      if(sql==='BEGIN'){savepoint+=1;return client.query(`SAVEPOINT r1a_${savepoint}`);}
      if(sql==='COMMIT')return client.query(`RELEASE SAVEPOINT r1a_${savepoint}`);
      if(sql==='ROLLBACK')return client.query(`ROLLBACK TO SAVEPOINT r1a_${savepoint}`);
      return client.query(sql,params as any);
    },release:()=>{}})};
    try{
      await client.query('BEGIN');
      for(const [id,label] of [[ids.admin,'Admin'],[ids.member,'Member'],[ids.recovery,'Recovery']] as const)
        await client.query(`INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES($1,$2,'unused',$3,true)`,[id,`${id}@example.test`,label]);
      for(const [id,code] of [[ids.tenantA,'R1A_A'],[ids.tenantB,'R1A_B']] as const)
        await client.query(`INSERT INTO tenants(id,public_id,code,display_name,status,created_by_user_id,updated_by_user_id) VALUES($1,$2,$3,$3,'ACTIVE',$4,$4)`,[id,randomUUID(),`${code}_${randomUUID().replaceAll('-','').toUpperCase()}`,ids.admin]);
      const adminMembership=randomUUID(),peerMembership=randomUUID();
      await client.query(`SELECT set_config('jupiter.tenant_id',$1,true)`,[ids.tenantA]);
      await client.query(`INSERT INTO tenant_memberships(id,tenant_id,user_id,status,joined_at,created_by_user_id,updated_by_user_id) VALUES($1,$2,$3,'ACTIVE',CURRENT_TIMESTAMP,$3,$3)`,[adminMembership,ids.tenantA,ids.admin]);
      await client.query(`INSERT INTO tenant_membership_roles(id,membership_id,role_id,assigned_by_user_id) SELECT gen_random_uuid(),$1,id,$2 FROM rf_role WHERE code='ADMIN'`,[adminMembership,ids.admin]);
      await client.query(`SELECT set_config('jupiter.tenant_id',$1,true)`,[ids.tenantB]);
      await client.query(`INSERT INTO tenant_memberships(id,tenant_id,user_id,status,joined_at,created_by_user_id,updated_by_user_id) VALUES($1,$2,$3,'ACTIVE',CURRENT_TIMESTAMP,$3,$3)`,[peerMembership,ids.tenantB,ids.member]);
      const authority=createTenantQueryAuthority({state:'VALID_ACTIVE_TENANT',validatedAt:Date.now(),tenant:{id:ids.tenantA,publicId:'a',code:'A',displayName:'A',status:'ACTIVE'},membership:{id:adminMembership,tenantId:ids.tenantA,userId:ids.admin,status:'ACTIVE'}});
      const delivery={deliver:vi.fn().mockResolvedValue(undefined)};
      const administration=new StaffMembershipAdministrationRepository(adapter);
      const invitation=new StaffInvitationService(administration,delivery);
      await expect(invitation.invite(authority,{email:`${ids.member}@example.test`,fullName:'Hidden existing identity',actorUserId:ids.admin,reason:'Tenant A invite'})).resolves.toEqual({accepted:true});
      const token=delivery.deliver.mock.calls[0][0].token;
      const stored=await client.query(`SELECT si.token_hash,si.membership_id,tm.tenant_id FROM staff_invitations si JOIN tenant_memberships tm ON tm.id=si.membership_id WHERE si.user_id=$1`,[ids.member]);
      expect(stored.rows[0].token_hash).not.toBe(token); expect(stored.rows[0].tenant_id).toBe(ids.tenantA);
      await expect(invitation.accept({token,tenantId:ids.tenantA,currentUserId:ids.admin})).rejects.toThrow('STAFF_MEMBERSHIP_UNAVAILABLE');
      await invitation.accept({token,tenantId:ids.tenantA,currentUserId:ids.member});
      await expect(invitation.accept({token,tenantId:ids.tenantA,currentUserId:ids.member})).rejects.toThrow('STAFF_MEMBERSHIP_UNAVAILABLE');
      const membershipId=stored.rows[0].membership_id;
      await administration.setMembershipStatus(authority,ids.member,'DISABLED',ids.admin,'Offboard',randomUUID());
      await client.query(`SELECT set_config('jupiter.tenant_id',$1,true)`,[ids.tenantA]);
      const aRows=(await client.query(`SELECT tenant_id,status,id FROM tenant_memberships WHERE user_id=$1`,[ids.member])).rows;
      await client.query(`SELECT set_config('jupiter.tenant_id',$1,true)`,[ids.tenantB]);
      const bRows=(await client.query(`SELECT tenant_id,status,id FROM tenant_memberships WHERE user_id=$1`,[ids.member])).rows;
      expect([...aRows,...bRows]).toEqual(expect.arrayContaining([{tenant_id:ids.tenantA,status:'DISABLED',id:membershipId},{tenant_id:ids.tenantB,status:'ACTIVE',id:peerMembership}]));
      await administration.setMembershipStatus(authority,ids.member,'ACTIVE',ids.admin,'Reinstate',randomUUID());
      await client.query(`SELECT set_config('jupiter.tenant_id',$1,true)`,[ids.tenantA]);
      expect((await client.query(`SELECT id,status FROM tenant_memberships WHERE tenant_id=$1 AND user_id=$2`,[ids.tenantA,ids.member])).rows[0]).toEqual({id:membershipId,status:'ACTIVE'});
      await invitation.invite(authority,{email:`${ids.recovery}@example.test`,fullName:'Recovery',actorUserId:ids.admin,reason:'Expiry test'});
      const expiredToken=delivery.deliver.mock.calls[1][0].token;
      await client.query(`SELECT set_config('jupiter.tenant_id',$1,true)`,[ids.tenantA]);
      await client.query(`UPDATE staff_invitations SET created_at=CURRENT_TIMESTAMP-interval '2 minutes',expires_at=CURRENT_TIMESTAMP-interval '1 minute' WHERE user_id=$1`,[ids.recovery]);
      await expect(invitation.accept({token:expiredToken,tenantId:ids.tenantA,currentUserId:ids.recovery})).rejects.toThrow('STAFF_MEMBERSHIP_UNAVAILABLE');
      await client.query(`INSERT INTO platform_principals(id,principal_type,user_id,display_name,status) VALUES($1,'HUMAN',$2,'R1A owner','ACTIVE')`,[ids.principal,ids.admin]);
      await client.query(`INSERT INTO platform_capability_grants(id,principal_id,capability_id,granted_by_principal_id,grant_reason) SELECT $1,$2,id,$2,'R1A verify' FROM platform_capabilities WHERE code='TENANT_ADMIN_RECOVER'`,[ids.grant,ids.principal]);
      const platform=await new PlatformAuthorityRepository(adapter).resolveHuman(ids.admin); expect(platform).toBeDefined();
      const tenantPublicId=(await client.query(`SELECT public_id FROM tenants WHERE id=$1`,[ids.tenantA])).rows[0].public_id;
      const recovery=new TenantAdminRecoveryRepository(adapter);
      const evidence=()=>platformMutationEvidence(platform,['TENANT_ADMIN_RECOVER'],{reason:'Recover exact admin',correlationId:randomUUID(),source:{kind:'VERIFY'},resourceType:'tenant',resourceId:tenantPublicId});
      await recovery.recover(evidence(),tenantPublicId,ids.recovery);
      await client.query(`SELECT set_config('jupiter.tenant_id',$1,true)`,[ids.tenantA]);
      expect((await client.query(`SELECT count(*)::int count FROM tenant_memberships tm JOIN tenant_membership_roles tmr ON tmr.membership_id=tm.id AND tmr.revoked_at IS NULL JOIN rf_role r ON r.id=tmr.role_id AND r.code='ADMIN' WHERE tm.tenant_id=$1 AND tm.user_id=$2 AND tm.status='ACTIVE'`,[ids.tenantA,ids.recovery])).rows[0].count).toBe(1);
      await client.query(`UPDATE platform_capability_grants SET revoked_at=CURRENT_TIMESTAMP,revoked_by_principal_id=$1,revocation_reason='Verify stale rejection' WHERE id=$2`,[ids.principal,ids.grant]);
      await expect(recovery.recover(evidence(),tenantPublicId,ids.member)).rejects.toThrow('PLATFORM_CAPABILITY_REQUIRED');
      await client.query(`SELECT set_config('jupiter.tenant_id',$1,true)`,[ids.tenantA]);
      const audits=await client.query(`SELECT (SELECT count(*)::int FROM tenant_membership_authority_audit WHERE tenant_id=$1::uuid) membership,(SELECT count(*)::int FROM platform_global_audit_log WHERE resource_id=$1::text AND capability_code='TENANT_ADMIN_RECOVER') recovery`,[ids.tenantA]);
      expect(audits.rows[0].membership).toBeGreaterThanOrEqual(4); expect(audits.rows[0].recovery).toBe(1);
    }finally{await client.query('ROLLBACK');client.release();}
    const residue=await pool.query(`SELECT (SELECT count(*)::int FROM tenants WHERE id=ANY($1::uuid[]))+(SELECT count(*)::int FROM users WHERE id=ANY($2::uuid[])) count`,[[ids.tenantA,ids.tenantB],[ids.admin,ids.member,ids.recovery]]);
    expect(residue.rows[0].count).toBe(0);
  });
});
