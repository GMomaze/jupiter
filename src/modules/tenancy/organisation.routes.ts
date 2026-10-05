import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { ensureAuthenticated } from '../../middleware/auth.middleware.js';
import type {
  OrganisationSelectionService,
  OrganisationSessionLifecycle,
} from './organisation-selection.service.js';

export interface OrganisationRouterDependencies {
  readonly selectionService: Pick<
    OrganisationSelectionService,
    'listOptions' | 'select'
  >;
  readonly csrfProtection: RequestHandler;
}

function isHtmx(req: Request): boolean {
  return req.get('HX-Request')?.toLowerCase() === 'true';
}

function wantsJson(req: Request): boolean {
  return Boolean(req.accepts('json') && !req.accepts('html'));
}

function authenticatedUserId(req: Request): string | null {
  const id = (req.user as { id?: unknown } | undefined)?.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function unavailable(req: Request, res: Response, jsonStatus = 403) {
  if (isHtmx(req)) {
    res.set('HX-Redirect', '/organisation/unavailable');
    return res.status(409).send();
  }
  if (wantsJson(req)) {
    return res.status(jsonStatus).json({ error: 'Organisation unavailable' });
  }
  return res.redirect(303, '/organisation/unavailable');
}

function home(req: Request, res: Response) {
  if (isHtmx(req)) {
    res.set('HX-Redirect', '/');
    return res.status(204).send();
  }
  if (wantsJson(req)) {
    return res.status(200).json({ success: true, redirect: '/' });
  }
  return res.redirect(303, '/');
}

function validSelectionBody(body: unknown): body is {
  tenant_public_id: string;
  _csrf?: string;
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const value = body as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.some((key) => key !== 'tenant_public_id' && key !== '_csrf')) return false;
  return (
    typeof value.tenant_public_id === 'string' &&
    value.tenant_public_id.trim().length > 0 &&
    (value._csrf === undefined || typeof value._csrf === 'string')
  );
}

function lifecycle(req: Request): OrganisationSessionLifecycle {
  return {
    getSession: () => req.session,
    save: () =>
      new Promise<void>((resolve, reject) => {
        req.session.save((error) => (error ? reject(error) : resolve()));
      }),
    clearRequestUser: () => {
      req.user = undefined;
    },
    invalidate: () =>
      new Promise<void>((resolve, reject) => {
        req.session.destroy((error) => (error ? reject(error) : resolve()));
      }),
  };
}

export function createOrganisationRouter(
  dependencies: OrganisationRouterDependencies,
): Router {
  const router = Router();
  router.use(ensureAuthenticated);

  router.get('/select', async (req, res, next) => {
    try {
      const userId = authenticatedUserId(req);
      if (!userId) return unavailable(req, res);
      if (req.session.activeTenantContext) return home(req, res);

      const organisations = await dependencies.selectionService.listOptions(userId);
      if (organisations.length === 0) return unavailable(req, res, 409);

      if (wantsJson(req)) {
        return res.status(200).json({ organisations });
      }
      return res.render('organisation/organisation-select', { organisations });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/select', dependencies.csrfProtection, async (req, res, next) => {
    try {
      const userId = authenticatedUserId(req);
      if (!userId || !validSelectionBody(req.body)) return unavailable(req, res);
      if (req.session.activeTenantContext) return home(req, res);

      const result = await dependencies.selectionService.select(
        userId,
        req.body.tenant_public_id,
        lifecycle(req),
      );
      return result.available ? home(req, res) : unavailable(req, res);
    } catch (error) {
      return next(error);
    }
  });

  router.get('/unavailable', (req, res) => {
    if (wantsJson(req)) {
      return res.status(200).json({ error: 'Organisation unavailable' });
    }
    return res.render('organisation/organisation-unavailable');
  });

  router.use(
    (error: unknown, req: Request, res: Response, next: NextFunction) => {
      if (res.headersSent) return next(error);
      if (isHtmx(req)) {
        return res.status(503).send('Organisation unavailable');
      }
      if (wantsJson(req)) {
        return res.status(503).json({ error: 'Organisation unavailable' });
      }
      return res.status(503).send('Organisation unavailable');
    },
  );

  return router;
}
