import { Router, type Request, type Response } from 'express';
import type { PlatformAuthorityRepository } from '../platform-authority/platform-authority.repository.js';
import type { TenantLifecycleCommandService } from './tenant-lifecycle-command.service.js';
import { INVITATION_DELIVERY_FAILED } from './tenant-lifecycle-command.service.js';
import { randomUUID } from 'node:crypto';
import { platformMutationEvidence } from '../platform-authority/authoritative-platform-mutation.js';
import type { TenantAdminRecoveryRepository } from './tenant-admin-recovery.js';

function reason(req: Request): string {
  return typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
}

function publicId(req: Request): string {
  const value = req.params.publicId;
  if (typeof value !== 'string') throw new Error('TENANT_LIFECYCLE_COMMAND_UNAVAILABLE');
  return value;
}

export function createTenantLifecycleCommandRouter(
  authorities: PlatformAuthorityRepository,
  service: TenantLifecycleCommandService,
  recovery?: TenantAdminRecoveryRepository,
) {
  const router = Router();

  const execute = (handler: (req: Request, authority: NonNullable<Request['platformAuthority']>) => Promise<unknown>, successMessage: string) =>
    async (req: Request, res: Response) => {
      try {
        const userId = (req.user as { id?: unknown } | undefined)?.id;
        if (typeof userId !== 'string') { req.flash('error', 'Platform authority required.'); return res.redirect(303, '/platform?section=companies'); }
        const authority = await authorities.resolveHuman(userId);
        if (!authority) { req.flash('error', 'Platform authority required.'); return res.redirect(303, '/platform?section=companies'); }
        await handler(req, authority);
        req.flash('success', successMessage);
        return res.redirect(303, '/platform?section=companies');
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        req.flash('error', /PLATFORM_AUTHORITY|PLATFORM_CAPABILITY|PLATFORM_PRINCIPAL/.test(code) ? 'Platform authority required.' : 'Tenant lifecycle command unavailable.');
        return res.redirect(303, '/platform?section=companies');
      }
    };

  const context = (req: Request, authority: NonNullable<Request['platformAuthority']>) => {
    const correlationId = req.headers['x-correlation-id'];
    return {
      authority,
      reason: reason(req),
      ...(typeof correlationId === 'string' ? { correlationId } : {}),
      source: { kind: 'MOUNTED_HUMAN_REQUEST', method: req.method, path: `${req.baseUrl}${req.path}` },
    };
  };

  router.post('/', async (req: Request, res: Response) => {
    try {
      const userId = (req.user as { id?: unknown } | undefined)?.id;
      if (typeof userId !== 'string') { req.flash('error', 'Platform authority required.'); return res.redirect(303, '/platform?section=companies'); }
      const authority = await authorities.resolveHuman(userId);
      if (!authority) { req.flash('error', 'Platform authority required.'); return res.redirect(303, '/platform?section=companies'); }
      const result = await service.provisionWithInitialAdminInvitation(context(req, authority), {
        code: req.body?.code,
        displayName: req.body?.displayName,
        legalName: req.body?.legalName,
        initialAdminEmail: req.body?.initialAdminEmail,
        initialAdminName: req.body?.initialAdminName,
      });
      req.flash('success', 'Company provisioned. Administrator invitation email sent.');
      return res.redirect(303, '/platform?section=companies');
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === INVITATION_DELIVERY_FAILED) {
        req.flash('error', 'Company provisioned, but the administrator invitation email could not be sent. You can resend it from the Companies list.');
        return res.redirect(303, '/platform?section=companies');
      }
      req.flash('error', /PLATFORM_AUTHORITY|PLATFORM_CAPABILITY|PLATFORM_PRINCIPAL/.test(code) ? 'Platform authority required.' : 'Tenant lifecycle command unavailable.');
      return res.redirect(303, '/platform?section=companies');
    }
  });
  router.post('/:publicId/activate', execute((req, authority) => service.activate(context(req, authority), publicId(req)), 'Company activated.'));
  router.post('/:publicId/suspend', execute((req, authority) => service.suspend(context(req, authority), publicId(req)), 'Company suspended.'));
  router.post('/:publicId/reinstate', execute((req, authority) => service.reinstate(context(req, authority), publicId(req)), 'Company reinstated.'));
  if (recovery) router.post('/:publicId/admin-recovery', execute(async(req,authority)=>{
    const userId=req.body?.userId;
    if(typeof userId!=='string') throw new Error('TENANT_ADMIN_RECOVERY_UNAVAILABLE');
    const tenantPublicId=publicId(req);
    return recovery.recover(platformMutationEvidence(authority,['TENANT_ADMIN_RECOVER'],{
      reason: reason(req)||`Authorized ${req.method} ${req.baseUrl}${req.path}`,
      correlationId: typeof req.headers['x-correlation-id']==='string'?req.headers['x-correlation-id']:randomUUID(),
      source:{kind:'MOUNTED_HUMAN_REQUEST',method:req.method,path:`${req.baseUrl}${req.path}`},resourceType:'tenant',resourceId:tenantPublicId,
    }),tenantPublicId,userId);
  }, 'Company administrator recovered.'));
  router.post('/:publicId/reissue-admin-invitation', async(req:Request,res:Response)=>{
    try{
      const userId=(req.user as {id?:unknown}|undefined)?.id;
      if(typeof userId!=='string'){req.flash('error','Platform authority required.');return res.redirect(303,'/platform?section=companies');}
      const authority=await authorities.resolveHuman(userId);
      if(!authority){req.flash('error','Platform authority required.');return res.redirect(303,'/platform?section=companies');}
      await service.reissueInitialAdminInvitation(context(req,authority),publicId(req));
      req.flash('success','Administrator invitation reissued. A new email has been sent.');
      return res.redirect(303,'/platform?section=companies');
    }catch(error){
      const code=error instanceof Error?error.message:'';
      if(code===INVITATION_DELIVERY_FAILED){req.flash('error','Invitation reissued, but the new email could not be sent. You can retry.');return res.redirect(303,'/platform?section=companies');}
      req.flash('error',/PLATFORM_AUTHORITY|PLATFORM_CAPABILITY|PLATFORM_PRINCIPAL/.test(code)?'Platform authority required.':'Tenant lifecycle command unavailable.');
      return res.redirect(303,'/platform?section=companies');
    }
  });
  router.post('/:publicId/correct-admin-invitation', async(req:Request,res:Response)=>{
    try{
      const userId=(req.user as {id?:unknown}|undefined)?.id;
      if(typeof userId!=='string'){req.flash('error','Platform authority required.');return res.redirect(303,'/platform?section=companies');}
      const authority=await authorities.resolveHuman(userId);
      if(!authority){req.flash('error','Platform authority required.');return res.redirect(303,'/platform?section=companies');}
      const email=typeof req.body?.email==='string'?req.body.email:'';
      const fullName=typeof req.body?.fullName==='string'?req.body.fullName:'';
      await service.correctInitialAdminInvitation(context(req,authority),publicId(req),email,fullName);
      req.flash('success','Initial administrator changed. A new invitation email has been sent.');
      return res.redirect(303,'/platform?section=companies');
    }catch(error){
      const code=error instanceof Error?error.message:'';
      if(code===INVITATION_DELIVERY_FAILED){req.flash('error','Initial administrator changed, but the new email could not be sent. You can retry.');return res.redirect(303,'/platform?section=companies');}
      req.flash('error',/PLATFORM_AUTHORITY|PLATFORM_CAPABILITY|PLATFORM_PRINCIPAL/.test(code)?'Platform authority required.':'Tenant lifecycle command unavailable.');
      return res.redirect(303,'/platform?section=companies');
    }
  });
  return router;
}
