import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { executeAuthoritativePgPlatformMutation, requirePlatformMutationOperations, assertAuthoritativeTargetTenant, type PlatformMutationEvidence } from '../platform-authority/authoritative-platform-mutation.js';
import { TENANT_LIFECYCLE_LOCK_NAMESPACE } from './tenant-lifecycle-coordination.js';

export class TenantAdminRecoveryRepository {
  constructor(private readonly database: Pool) {}
  async recover(evidence: PlatformMutationEvidence, publicId: string, userId: string) {
    const fixed=requirePlatformMutationOperations(evidence,['TENANT_ADMIN_RECOVER']);
    return executeAuthoritativePgPlatformMutation(this.database,fixed,async(client,audit)=>{
      const tenant=await client.query(`SELECT id,public_id,status FROM tenants WHERE public_id=$1 FOR UPDATE`,[publicId]);
      if(tenant.rowCount!==1) throw new Error('TENANT_ADMIN_RECOVERY_UNAVAILABLE');
      const tenantId=tenant.rows[0].id;
      assertAuthoritativeTargetTenant(tenantId);
      await client.query(`SELECT set_config('jupiter.tenant_id', $1, true)`,[tenantId]);
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1::text, ${TENANT_LIFECYCLE_LOCK_NAMESPACE}::bigint))`,[tenantId]);
      const user=await client.query(`SELECT id FROM users WHERE id=$1 AND is_active=true FOR SHARE`,[userId]);
      if(user.rowCount!==1) throw new Error('TENANT_ADMIN_RECOVERY_UNAVAILABLE');
      const role=await client.query(`SELECT id FROM rf_role WHERE code='ADMIN' AND is_active=true LIMIT 2`);
      if(role.rowCount!==1) throw new Error('TENANT_ADMIN_RECOVERY_UNAVAILABLE');
      let membership=await client.query(`SELECT id,status FROM tenant_memberships WHERE tenant_id=$1 AND user_id=$2 FOR UPDATE`,[tenantId,userId]);
      const before=membership.rowCount?{membershipId:membership.rows[0].id,status:membership.rows[0].status}:null;
      let membershipId:string;
      if(!membership.rowCount){membershipId=randomUUID();await client.query(`INSERT INTO tenant_memberships(id,tenant_id,user_id,status,joined_at,created_by_user_id,updated_by_user_id) VALUES($1,$2,$3,'ACTIVE',CURRENT_TIMESTAMP,$4,$4)`,[membershipId,tenantId,userId,fixed.authority.principalCode]);}
      else { membershipId=membership.rows[0].id; if(membership.rows[0].status!=='ACTIVE') await client.query(`UPDATE tenant_memberships SET status='ACTIVE',joined_at=COALESCE(joined_at,CURRENT_TIMESTAMP),suspended_at=NULL,suspended_by_user_id=NULL,disabled_at=NULL,disabled_by_user_id=NULL,status_reason=NULL,updated_at=CURRENT_TIMESTAMP,updated_by_user_id=$2 WHERE id=$1`,[membershipId,fixed.authority.principalCode]); }
      const assigned=await client.query(`SELECT id FROM tenant_membership_roles WHERE membership_id=$1 AND role_id=$2 AND revoked_at IS NULL FOR UPDATE`,[membershipId,role.rows[0].id]);
      if(!assigned.rowCount) await client.query(`INSERT INTO tenant_membership_roles(id,membership_id,role_id,assigned_by_user_id) VALUES($1,$2,$3,$4)`,[randomUUID(),membershipId,role.rows[0].id,fixed.authority.principalCode]);
      await client.query(`INSERT INTO tenant_membership_authority_audit(id,tenant_id,membership_id,actor_user_id,actor_kind,action,reason,correlation_id,old_values,new_values) VALUES($1,$2,$3,$4,'PLATFORM_HUMAN','TENANT_ADMIN_RECOVERED',$5,$6,$7::jsonb,$8::jsonb)`,[randomUUID(),tenantId,membershipId,fixed.authority.principalCode,fixed.reason,fixed.correlationId,JSON.stringify(before),JSON.stringify({membershipId,status:'ACTIVE',role:'ADMIN'})]);
      audit.setBefore(before);
      return {tenantId,membershipId,userId,status:'ACTIVE' as const,role:'ADMIN' as const};
    },result=>({resourceId:result.tenantId,after:result}));
  }
}
