import { Router } from 'express';
import { StaffInvitationService, STAFF_MEMBERSHIP_UNAVAILABLE } from './staff-membership-administration.js';

export function createStaffInvitationAcceptanceRouter(service: StaffInvitationService) {
  const router=Router();

  router.get('/accept',async(req,res)=>{
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const tenant = typeof req.query.tenant === 'string' ? req.query.tenant : '';
    const description = await service.describe({ token, tenantId: tenant });
    return res.render('auth/invitation-accept', {
      title: 'Accept invitation',
      csrfToken: typeof req.csrfToken === 'function' ? req.csrfToken() : '',
      token,
      tenant,
      valid: description.valid,
      email: description.valid ? description.email : '',
      needsPassword: description.valid ? description.needsPassword : false,
      completed: false,
      awaitingActivation: false,
      companyName: '',
    });
  });

  router.post('/accept',async(req,res)=>{
    const wantsJson = (req.headers.accept || '').includes('application/json') || (typeof req.is === 'function' && !!req.is('application/json'));
    const token = req.body?.token;
    const tenantId = req.body?.tenantId ?? req.body?.tenant;
    const password = req.body?.password;
    try {
      const result=await service.accept({token,tenantId,password,currentUserId:(req.user as {id?:unknown}|undefined)?.id,correlationId:req.headers['x-correlation-id']});
      if (wantsJson) return res.status(200).json(result);
      return res.render('auth/invitation-accept', {
        title: 'Account created',
        csrfToken: typeof req.csrfToken === 'function' ? req.csrfToken() : '',
        token: '',
        tenant: '',
        valid: false,
        email: '',
        needsPassword: false,
        completed: true,
        companyName: typeof result.tenantName === 'string' ? result.tenantName : '',
        awaitingActivation: result.tenantStatus === 'PROVISIONING',
      });
    } catch(error) {
      if (wantsJson) {
        if(error instanceof Error&&error.message===STAFF_MEMBERSHIP_UNAVAILABLE) return res.status(404).json({error:'Invitation unavailable'});
        return res.status(409).json({error:'Invitation unavailable'});
      }
      req.flash('error', 'This invitation is invalid, has expired or has already been used.');
      return res.redirect('/auth/staff-invitations/accept?token='+encodeURIComponent(String(token??''))+'&tenant='+encodeURIComponent(String(tenantId??'')));
    }
  });

  return router;
}

