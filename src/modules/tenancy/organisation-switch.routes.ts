import { Router, type Request, type RequestHandler, type Response } from 'express';
import { ensureAuthenticated } from '../../middleware/auth.middleware.js';
import type { StaffSessionLifecycle } from '../auth/staff-session-regeneration.js';
import type { ExpectedTenantContextToken } from './tenant-switch-contracts.js';
import type {
  TenantSwitchCoordinator,
  TenantSwitchSessionLifecycle,
} from './tenant-switch-coordinator.js';

export interface OrganisationSwitchRouterDependencies {
  readonly coordinator: Pick<TenantSwitchCoordinator, 'switchTenant'>;
  readonly csrfProtection: RequestHandler;
}

function isHtmx(req: Request): boolean {
  return req.get('HX-Request')?.toLowerCase() === 'true';
}

function wantsJson(req: Request): boolean {
  return Boolean(req.accepts('json') && !req.accepts('html'));
}

function validBody(body: unknown): body is {
  tenant_public_id: string;
  expected_context_token: string;
  _csrf?: string;
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const value = body as Record<string, unknown>;
  if (
    Object.keys(value).some(
      key =>
        key !== 'tenant_public_id' &&
        key !== 'expected_context_token' &&
        key !== '_csrf',
    )
  ) return false;
  return (
    typeof value.tenant_public_id === 'string' &&
    value.tenant_public_id.trim().length > 0 &&
    typeof value.expected_context_token === 'string' &&
    value.expected_context_token.length > 0 &&
    (value._csrf === undefined || typeof value._csrf === 'string')
  );
}

function success(req: Request, res: Response) {
  if (isHtmx(req)) {
    res.set('HX-Redirect', '/');
    return res.status(204).send();
  }
  if (wantsJson(req)) return res.status(200).json({ success: true });
  return res.redirect(303, '/');
}

function rejected(req: Request, res: Response) {
  if (isHtmx(req)) {
    res.set('HX-Redirect', '/organisation/unavailable');
    return res.status(409).send();
  }
  if (wantsJson(req)) {
    return res.status(409).json({ error: 'Organisation unavailable' });
  }
  return res.redirect(303, '/organisation/unavailable');
}

function failed(req: Request, res: Response) {
  const message = 'Organisation switching is temporarily unavailable';
  if (wantsJson(req)) return res.status(503).json({ error: message });
  return res.status(503).send(message);
}

function lifecycle<TUser>(
  req: Request,
): TenantSwitchSessionLifecycle<TUser> {
  const base: StaffSessionLifecycle<TUser> = {
    getSession: () => req.session,
    regenerate: () =>
      new Promise<void>((resolve, rejectPromise) => {
        req.session.regenerate(error => (error ? rejectPromise(error) : resolve()));
      }),
    login: (user, options) =>
      new Promise<void>((resolve, rejectPromise) => {
        req.login(
          user as Express.User,
          { session: true, ...options },
          error => (error ? rejectPromise(error) : resolve()),
        );
      }),
    save: () =>
      new Promise<void>((resolve, rejectPromise) => {
        req.session.save(error => (error ? rejectPromise(error) : resolve()));
      }),
    invalidate: () =>
      new Promise<void>((resolve, rejectPromise) => {
        req.session.destroy(error => (error ? rejectPromise(error) : resolve()));
      }),
    clearRequestUser: () => {
      req.user = undefined;
    },
  };
  return {
    ...base,
    getSessionId: () => req.sessionID,
    reload: () =>
      new Promise<void>((resolve, rejectPromise) => {
        req.session.reload(error => (error ? rejectPromise(error) : resolve()));
      }),
  };
}

export function createOrganisationSwitchRouter(
  dependencies: OrganisationSwitchRouterDependencies,
): Router {
  const router = Router();
  router.use(ensureAuthenticated);
  router.post('/switch', dependencies.csrfProtection, async (req, res) => {
    const user = req.user as (Readonly<{ id: string }> & object) | undefined;
    if (!user || typeof user.id !== 'string' || !user.id || !validBody(req.body)) {
      return rejected(req, res);
    }
    try {
      const result = await dependencies.coordinator.switchTenant({
        user,
        tenantPublicId: req.body.tenant_public_id,
        expectedContextToken:
          req.body.expected_context_token as ExpectedTenantContextToken,
        sessionLifecycle: lifecycle<typeof user>(req),
      });
      if (result.outcome === 'SWITCHED') return success(req, res);
      if (result.outcome === 'REJECTED') return rejected(req, res);
      return failed(req, res);
    } catch {
      return failed(req, res);
    }
  });
  return router;
}
