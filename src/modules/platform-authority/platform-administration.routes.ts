import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import type { PlatformAuthority } from './platform-authority.js';
import { PlatformAuthorityRepository } from './platform-authority.repository.js';
import type { PlatformUserInvitationService } from './platform-user-invitation.js';
import { emitOperationalEvent } from '../observability/operational-event.js';

const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const denied=(res:Response)=>res.status(403).send('Platform authority required.');

/**
 * Derives the "ready for activation" flag for each PROVISIONING tenant.
 *
 * `staff_invitations` is subject to tenant row-level security, so it cannot be
 * read from a platform-level (no tenant context) request. For each PROVISIONING
 * tenant we set the tenant context transaction-locally and read the
 * authoritative acceptance state, then release the context at commit so it
 * cannot leak onto the pooled connection. Non-PROVISIONING tenants are left
 * untouched (the view only reads the flag for PROVISIONING rows).
 */
async function attachTenantReadiness(pool: Pool, tenants: any[]): Promise<void> {
  const provisioning = tenants.filter((t) => t.status === 'PROVISIONING');
  if (provisioning.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const tenant of provisioning) {
      await client.query(`SELECT set_config('jupiter.tenant_id', $1, true)`, [tenant.id]);
      const result = await client.query(
        `SELECT EXISTS(SELECT 1 FROM staff_invitations WHERE tenant_id=$1 AND consumed_at IS NOT NULL AND revoked_at IS NULL) AS admin_onboarded`,
        [tenant.id],
      );
      tenant.admin_onboarded = result.rows[0].admin_onboarded;
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function createPlatformAdministrationRouter(repository:PlatformAuthorityRepository,pool?:Pool,invitationService?:PlatformUserInvitationService){
  const router=Router();
  const authority=async(req:Request,capability:string)=>{const userId=(req.user as {id?:unknown}|undefined)?.id;if(typeof userId!=='string')throw new Error('PLATFORM_AUTHORITY_REQUIRED');const value=await repository.resolveHuman(userId);if(!value||value.principalType!=='HUMAN')throw new Error('PLATFORM_AUTHORITY_REQUIRED');await repository.authorizeCapability(value,capability,['HUMAN']);return value;};
  const target=(section:string,sub:string)=>'/platform?section='+section+(sub?'&sub='+sub:'');const execute=(operation:string,section:string,sub:string,successMessage:string,work:(req:Request,a:PlatformAuthority)=>Promise<unknown>)=>async(req:Request,res:Response)=>{const dest=target(section,sub);let a:PlatformAuthority;try{a=await authority(req,'PLATFORM_AUTHORITY_MANAGE');}catch(error){emitOperationalEvent({code:'PLATFORM_AUTHORITY_REFUSED',severity:'WARN',outcome:'DENIED',operation,error});req.flash('error','Platform authority required.');return res.redirect(303,dest);}try{if(!text(req.body?.reason))throw new Error('PLATFORM_OPERATION_REASON_REQUIRED');await work(req,a);emitOperationalEvent({code:'PLATFORM_OPERATION_SUCCEEDED',severity:'INFO',outcome:'SUCCESS',operation,correlationId:randomUUID()});req.flash('success',successMessage);return res.redirect(303,dest);}catch(error){emitOperationalEvent({code:'PLATFORM_OPERATION_REFUSED',severity:'ERROR',outcome:'FAILED',operation,error});const code=error instanceof Error?error.message:'';req.flash('error',/PLATFORM_AUTHORITY|PLATFORM_CAPABILITY|PLATFORM_PRINCIPAL/.test(code)?'Platform authority required.':'Platform operation unavailable.');return res.redirect(303,dest);}};
  router.get('/',async(req,res)=>{try{const userId=(req.user as {id?:unknown}|undefined)?.id;if(typeof userId!=='string')throw new Error('PLATFORM_AUTHORITY_REQUIRED');const a=await repository.resolveHuman(userId);if(!a||a.principalType!=='HUMAN')throw new Error('PLATFORM_AUTHORITY_REQUIRED');if(!a.capabilities.has('PLATFORM_AUDIT_VIEW')&&!a.capabilities.has('PLATFORM_AUTHORITY_MANAGE')){return res.redirect(303,'/library/manufacturers');}const state=await repository.inspect(a);let tenants:any[]=[];let users:any[]=[];let pendingInvitations:any[]=[];if(pool){const t=await pool.query(`SELECT id,public_id,code,display_name,legal_name,status,suspension_reason FROM tenants ORDER BY code`);const u=await pool.query(`SELECT id,email,full_name FROM users WHERE is_active=true ORDER BY email`);tenants=t.rows;users=u.rows;await attachTenantReadiness(pool,tenants);}if(invitationService){pendingInvitations=await invitationService.listPending();}return res.render('platform/index',{title:'Platform administration',state,canManage:a.capabilities.has('PLATFORM_AUTHORITY_MANAGE'),canProvisionTenants:a.capabilities.has('TENANT_PROVISION'),canActivateTenants:a.capabilities.has('TENANT_ACTIVATE'),canSuspendTenants:a.capabilities.has('TENANT_SUSPEND'),canReinstateTenants:a.capabilities.has('TENANT_REINSTATE'),section:(typeof req.query.section==='string'&&['companies','authority','grants','audit'].includes(req.query.section))?req.query.section:'companies',sub:(typeof req.query.sub==='string'?req.query.sub:''),tenants,users,pendingInvitations});}catch(error){emitOperationalEvent({code:'PLATFORM_AUTHORITY_REFUSED',severity:'WARN',outcome:'DENIED',operation:'PLATFORM_VIEW',error});return denied(res);}});
  router.post('/users/invite',execute('PLATFORM_USER_INVITE','authority','human','Platform user invited.',(req,a)=>invitationService?invitationService.invite(a,{email:req.body?.email,fullName:req.body?.fullName,reason:req.body?.reason,correlationId:req.headers['x-correlation-id']}):Promise.reject(new Error('PLATFORM_USER_INVITATION_UNAVAILABLE'))));
  router.post('/users/resend',execute('PLATFORM_USER_RESEND','authority','human','Invitation resent.',(req,a)=>invitationService?invitationService.resend(a,{invitationId:req.body?.invitationId,reason:req.body?.reason,correlationId:req.headers['x-correlation-id']}):Promise.reject(new Error('PLATFORM_USER_INVITATION_UNAVAILABLE'))));
  router.post('/users/revoke',execute('PLATFORM_USER_REVOKE','authority','human','Invitation revoked.',(req,a)=>invitationService?invitationService.revoke(a,{invitationId:req.body?.invitationId,reason:req.body?.reason,correlationId:req.headers['x-correlation-id']}):Promise.reject(new Error('PLATFORM_USER_INVITATION_UNAVAILABLE'))));
  router.post('/principals',execute('PRINCIPAL_CREATE','authority','human','Human platform authority added.',(req,a)=>repository.createPrincipal(a,{principalType:'HUMAN',userId:text(req.body?.userId),displayName:text(req.body?.displayName),reason:text(req.body?.reason)})));
  router.post('/grants',execute('CAPABILITY_GRANT','grants','grant','Capability granted.',(req,a)=>repository.grant(a,text(req.body?.principalId),text(req.body?.capabilityCode),text(req.body?.reason))));
  router.post('/grants/revoke',execute('CAPABILITY_REVOKE','grants','current','Capability revoked.',(req,a)=>repository.revoke(a,text(req.body?.principalId),text(req.body?.capabilityCode),text(req.body?.reason))));
  router.post('/principals/disable',execute('PRINCIPAL_DISABLE','authority','human','Human platform authority disabled.',(req,a)=>repository.disablePrincipal(a,text(req.body?.principalId),text(req.body?.reason))));
  router.post('/scheduler/provision',execute('SB_SYNC_SCHEDULER_PROVISION','authority','service','Service scheduler provisioned.',(req,a)=>repository.provisionSbSyncScheduler(a,text(req.body?.reason))));
  router.post('/scheduler/recover',execute('SB_SYNC_SCHEDULER_RECOVER','authority','service','Service scheduler recovered.',(req,a)=>repository.recoverSbSyncScheduler(a,text(req.body?.reason))));
  return router;
}
