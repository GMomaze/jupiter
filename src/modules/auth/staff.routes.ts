import { Router, type RequestHandler } from 'express';
import { pool } from '../../config/database.js';
import { ensureAuthenticated } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { assertTenantQueryAuthority, type TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { createActiveTenantRbacHydration } from './active-tenant-rbac.middleware.js';
import { PostgresStaffTenantRepository, STAFF_TENANT_TARGET_UNAVAILABLE, type StaffTenantRepository } from './staff-tenant.repository.js';
import { StaffTenantService, STAFF_TENANT_REQUEST_INVALID } from './staff-tenant.service.js';
import { randomUUID } from 'node:crypto';
import { NullStaffInvitationDelivery, StaffInvitationService, StaffMembershipAdministrationRepository, STAFF_MEMBERSHIP_UNAVAILABLE } from './staff-membership-administration.js';

export interface StaffRouterDependencies {
  readonly repository?: StaffTenantRepository;
  readonly hydrateActiveTenantRbac?: RequestHandler;
  readonly administration?: StaffMembershipAdministrationRepository;
  readonly invitationService?: StaffInvitationService;
}

function requireTenantAuthority(req: { tenantAuthority?: unknown }): TenantQueryAuthority {
  assertTenantQueryAuthority(req.tenantAuthority);
  return req.tenantAuthority;
}

export function createStaffRouter(requireValidActiveTenantContext: RequestHandler, dependencies: StaffRouterDependencies = {}) {
const router = Router();
const service = new StaffTenantService(dependencies.repository ?? new PostgresStaffTenantRepository(pool));
const administration = dependencies.administration ?? new StaffMembershipAdministrationRepository(pool);
const invitations = dependencies.invitationService ?? new StaffInvitationService(administration, new NullStaffInvitationDelivery());
const hydrate = dependencies.hydrateActiveTenantRbac ?? createActiveTenantRbacHydration(pool);

router.use(ensureAuthenticated, hydrate, requireRole('ADMIN'), requireValidActiveTenantContext);

// 2.4: Staff List View
router.get('/', async (req, res) => {
  const viewModel = await service.list(requireTenantAuthority(req));
  res.render('auth/staff-list', viewModel);
});

// 2.4: Role Toggle Action (Assign/Remove)
router.post('/toggle-role', async (req, res, next) => {
  const { userId, roleId } = req.body;
  try {
    await service.toggleRole(requireTenantAuthority(req), {
      targetUserId: userId,
      roleId,
      actorUserId: (req.user as { id?: unknown } | undefined)?.id,
      reason: req.body?.reason,
      correlationId: req.headers['x-correlation-id'],
    });
    res.status(200).send();
  } catch (error) {
    if (error instanceof Error && error.message === 'LAST_ACTIVE_TENANT_ADMIN_REQUIRED') {
      return res.status(409).send();
    }

    if (error instanceof Error && [STAFF_TENANT_REQUEST_INVALID, STAFF_TENANT_TARGET_UNAVAILABLE].includes(error.message)) {
      return res.status(404).send();
    }
    next(error);
  }
});

router.post('/invite', async(req,res,next)=>{try{
  await invitations.invite(requireTenantAuthority(req),{email:req.body?.email,fullName:req.body?.fullName,actorUserId:(req.user as {id?:unknown}|undefined)?.id,reason:req.body?.reason,correlationId:req.headers['x-correlation-id']});
  return res.status(202).json({accepted:true});
}catch(error){if(error instanceof Error&&error.message===STAFF_MEMBERSHIP_UNAVAILABLE)return res.status(404).send();next(error);}});

for(const [path,status] of [['disable','DISABLED'],['reinstate','ACTIVE']] as const){
  router.post(`/:userId/${path}`,async(req,res,next)=>{try{
    const actor=(req.user as {id?:unknown}|undefined)?.id, target=req.params.userId, reason=req.body?.reason;
    if(typeof actor!=='string'||typeof target!=='string'||typeof reason!=='string'||!reason.trim())throw new Error(STAFF_MEMBERSHIP_UNAVAILABLE);
    await administration.setMembershipStatus(requireTenantAuthority(req),target,status,actor,reason.trim(),typeof req.headers['x-correlation-id']==='string'?req.headers['x-correlation-id']:randomUUID());
    return res.status(200).json({status});
  }catch(error){if(error instanceof Error&&error.message===STAFF_MEMBERSHIP_UNAVAILABLE)return res.status(404).send();if(error instanceof Error&&error.message==='LAST_ACTIVE_TENANT_ADMIN_REQUIRED')return res.status(409).send();next(error);}});
}

return router;
}
