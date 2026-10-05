import { Router, type RequestHandler } from 'express';
import { dashboardMetricsService } from '../modules/dashboard/dashboard-metrics.service.live.js';
import { assertTenantQueryAuthority } from '../modules/tenancy/tenant-query-authority.js';

/**
 * Middleware: Blocks access if no Passport session exists
 */
const ensureAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.redirect('/auth/login');
};

/**
 * Root Dashboard
 */
export function createMainRouter(requireValidActiveTenantContext: RequestHandler) {
  const router = Router();

  // Route an authenticated platform administrator with no active tenant context
  // to /platform instead of the tenant application path. Ordinary tenant users
  // and unauthenticated requests continue through the existing chain unchanged.
  const routePlatformAdministrator: RequestHandler = (req, res, next) => {
    if (res.locals.canPlatformAdmin && !req.session?.activeTenantContext) {
      return res.redirect(303, '/platform');
    }
    return next();
  };


  router.get('/', ensureAuthenticated, routePlatformAdministrator, requireValidActiveTenantContext, async (req, res) => {
  try {
    assertTenantQueryAuthority(req.tenantAuthority);
    res.render('dashboard/index', await dashboardMetricsService.load(req.tenantAuthority));
  } catch (error) {
    if (error instanceof Error && error.message === 'TENANT_AUTHORITY_REQUIRED') {
      return res.redirect(303, '/organisation/unavailable');
    }
    throw error;
  }
  });

  return router;
}

export default createMainRouter;
