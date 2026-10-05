import { Router } from 'express';
import passport from 'passport';
import {
  terminateStaffSession,
  type StaffLogoutLifecycle,
} from './staff-session-logout.js';
import {
  orchestrateStaffLoginOrganisation,
  type StaffLoginOrganisationDependencies,
  type StaffLoginOrganisationOutcome,
} from '../tenancy/staff-login-organisation-orchestration.js';
import type { StaffSessionLifecycle } from './staff-session-regeneration.js';

export interface AuthRouterDependencies extends StaffLoginOrganisationDependencies {
  readonly orchestrate?: typeof orchestrateStaffLoginOrganisation;
  readonly isPlatformAdministrator?: (userId: string) => Promise<boolean>;
}

function isHtmx(req: any): boolean {
  return String(req.get?.('HX-Request') ?? '').toLowerCase() === 'true';
}

function wantsJson(req: any): boolean {
  return req.headers.accept?.includes('application/json') === true;
}

function outcomeDestination(outcome: StaffLoginOrganisationOutcome): string {
  if (outcome.kind === 'ORGANISATION_ESTABLISHED') return '/';
  if (outcome.kind === 'ORGANISATION_SELECTION_REQUIRED') return '/organisation/select';
  return '/organisation/unavailable';
}

function finishLogin(req: any, res: any, destination: string) {
  if (isHtmx(req)) {
    res.set('HX-Redirect', destination);
    return res.status(204).send();
  }
  if (wantsJson(req)) {
    return res.status(200).json({ success: true, redirect: destination });
  }
  return res.redirect(303, destination);
}

function signInUnavailable(req: any, res: any) {
  if (isHtmx(req)) res.set('HX-Redirect', '/auth/login');
  if (wantsJson(req)) return res.status(503).json({ error: 'Sign-in unavailable' });
  return res.status(503).send('Sign-in unavailable');
}

function finishLogout(req: any, res: any) {
  if (wantsJson(req)) return res.status(200).json({ success: true });
  return res.redirect('/auth/login');
}

function staffSessionLifecycle(req: any): StaffSessionLifecycle<any> {
  return {
    getSession: () => {
      if (!req.session) throw new Error('Session unavailable.');
      return req.session;
    },
    regenerate: () => new Promise<void>((resolve, reject) => {
      req.session.regenerate((error: unknown) => error ? reject(error) : resolve());
    }),
    login: (user, options) => new Promise<void>((resolve, reject) => {
      req.login(user, options, (error: unknown) => error ? reject(error) : resolve());
    }),
    save: () => new Promise<void>((resolve, reject) => {
      req.session.save((error: unknown) => error ? reject(error) : resolve());
    }),
    invalidate: () => new Promise<void>((resolve, reject) => {
      req.session.destroy((error: unknown) => error ? reject(error) : resolve());
    }),
    clearRequestUser: () => { req.user = undefined; },
  };
}

function staffLogoutLifecycle(req: any, res: any): StaffLogoutLifecycle {
  return {
    getSession: () => {
      if (!req.session) throw new Error('Session unavailable.');
      return req.session;
    },
    logout: (options) => new Promise<void>((resolve, reject) => {
      req.logout(options, (error: unknown) => error ? reject(error) : resolve());
    }),
    destroy: () => new Promise<void>((resolve, reject) => {
      if (!req.session || typeof req.session.destroy !== 'function') {
        reject(new Error('Session destruction unavailable.'));
        return;
      }
      req.session.destroy((error: unknown) => error ? reject(error) : resolve());
    }),
    save: () => new Promise<void>((resolve, reject) => {
      if (!req.session || typeof req.session.save !== 'function') {
        reject(new Error('Session save unavailable.'));
        return;
      }
      req.session.save((error: unknown) => error ? reject(error) : resolve());
    }),
    clearRequestUser: () => { req.user = undefined; },
    clearSessionCookie: () => { res.clearCookie('jupiter.sid', { path: '/' }); },
  };
}

async function containFailedLogin(req: any, res: any): Promise<void> {
  try {
    await terminateStaffSession(staffLogoutLifecycle(req, res), Date.now);
  } catch {
    try { req.user = undefined; } catch { /* containment continues */ }
    try {
      if (req.session && typeof req.session.destroy === 'function') {
        await new Promise<void>(resolvePromise =>
          req.session.destroy(() => resolvePromise())
        );
      }
    } catch { /* fail closed */ }
    try { res.clearCookie('jupiter.sid', { path: '/' }); } catch { /* response remains failed */ }
  }
}

async function failSignIn(req: any, res: any): Promise<void> {
  await containFailedLogin(req, res);
  signInUnavailable(req, res);
}

export function createAuthRouter(dependencies: AuthRouterDependencies): Router {
  const router = Router();

  router.get('/login', (_req, res) => {
    res.render('auth/login');
  });

  router.post('/login', (req, res, next) => {
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        void failSignIn(req, res);
        return;
      }
      if (!user) {
        if (wantsJson(req)) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        req.flash('error', info?.message || 'Invalid credentials.');
        return res.redirect('/auth/login');
      }

      if (
        !req.session ||
        typeof req.session.regenerate !== 'function' ||
        typeof req.session.save !== 'function'
      ) {
        void failSignIn(req, res);
        return;
      }

      const orchestrate =
        dependencies.orchestrate ?? orchestrateStaffLoginOrganisation;
      void orchestrate(
        { user, sessionLifecycle: staffSessionLifecycle(req) },
        dependencies,
      )
        .then(async outcome => {
          let destination = outcomeDestination(outcome);
          if (
            outcome.kind === 'ORGANISATION_UNAVAILABLE' &&
            dependencies.isPlatformAdministrator
          ) {
            try {
              if (await dependencies.isPlatformAdministrator(user.id)) {
                destination = '/platform';
              }
            } catch {
              // Keep the organisation-unavailable destination on any resolution failure.
            }
          }
          finishLogin(req, res, destination);
        })
        .catch(async () => {
          await failSignIn(req, res);
        });
    })(req, res, next);
  });

  router.post('/logout', async (req, res, next) => {
    try {
      await terminateStaffSession(staffLogoutLifecycle(req, res), Date.now);
      return finishLogout(req, res);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
