import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { PasswordRecoveryService } from './password-recovery.js';

/**
 * Self-service staff password recovery routes. Mounted under /auth and already
 * behind the global CSRF middleware. A dedicated tighter rate limit is applied
 * to both the request and completion endpoints (global rate limiting skips
 * authenticated users and is therefore too loose for this unauthenticated flow).
 */

export interface PasswordRecoveryRouterDependencies {
  readonly service: PasswordRecoveryService;
}

const RESET_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: any) => process.env.NODE_ENV === 'test',
} as const;

function wantsJson(req: any): boolean {
  return req.headers.accept?.includes('application/json') === true;
}

export function createPasswordRecoveryRouter(
  dependencies: PasswordRecoveryRouterDependencies,
): Router {
  const router = Router();
  const requestLimiter = rateLimit({ ...RESET_RATE_LIMIT });
  const completeLimiter = rateLimit({ ...RESET_RATE_LIMIT });

  router.get('/request', (_req, res) => {
    res.render('auth/password-reset-request');
  });

  router.post('/request', requestLimiter, async (req, res, next) => {
    try {
      await dependencies.service.requestReset(req.body?.email);
      const message =
        'If an account with that email address is eligible, password reset instructions have been sent.';
      if (wantsJson(req)) return res.status(200).json({ success: true });
      req.flash('success', message);
      return res.redirect('/auth/password-reset/request');
    } catch (error) {
      return next(error);
    }
  });

  router.get('/complete', (req, res) => {
    const token = String(req.query?.token ?? '').trim();
    res.render('auth/password-reset-complete', { token });
  });

  router.post('/complete', completeLimiter, async (req, res, next) => {
    try {
      const outcome = await dependencies.service.completeReset(
        req.body?.token,
        req.body?.password,
        req.body?.confirm_password,
      );
      if (outcome === 'SUCCESS') {
        if (wantsJson(req)) return res.status(200).json({ success: true });
        req.flash('success', 'Password reset completed. You may now sign in with your new password.');
        return res.redirect('/auth/login');
      }
      if (wantsJson(req)) {
        return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
      }
      req.flash('error', 'Reset link is invalid or has expired.');
      return res.redirect('/auth/password-reset/request');
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
