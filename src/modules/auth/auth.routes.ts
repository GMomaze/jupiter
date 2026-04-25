import { Router } from 'express';
import passport from 'passport';

const router = Router();

function finishLogout(req: any, res: any) {
  if (req.headers.accept?.includes('application/json')) {
    return res.status(200).json({ success: true });
  }

  return res.redirect('/auth/login');
}

function fallbackLogout(req: any, res: any, next: any) {
  try {
    if (req.session?.passport) {
      delete req.session.passport;
    }

    req.user = undefined;

    if (typeof req.session?.destroy === 'function') {
      return req.session.destroy((destroyErr: any) => {
        if (destroyErr) return next(destroyErr);
        res.clearCookie('jupiter.sid');
        return finishLogout(req, res);
      });
    }

    res.clearCookie('jupiter.sid');
    return finishLogout(req, res);
  } catch (err) {
    return next(err);
  }
}

/**
 * LOGIN PAGE
 */
router.get('/login', (req, res) => {
  res.render('auth/login');
});

/**
 * LOGIN (JSON + FORM SAFE)
 */
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err: any, user: any, info: any) => {
    if (err) return next(err);

    if (!user) {
      // JSON request
      if (req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      req.flash('error', info?.message || 'Invalid credentials.');
      return res.redirect('/auth/login');
    }

    if (
      (!req.session ||
        typeof req.session.regenerate !== 'function' ||
        typeof req.session.save !== 'function') &&
      (req as any).sessionStore?.generate
    ) {
      console.warn('⚠️ Session regeneration needed at login');
      (req as any).sessionStore.generate(req);
    }

    if (
      !req.session ||
      typeof req.session.regenerate !== 'function' ||
      typeof req.session.save !== 'function'
    ) {
      console.error('❌ CRITICAL: Session unavailable for login', {
        hasSession: !!req.session,
        hasRegenerate: typeof req.session?.regenerate === 'function',
        hasSave: typeof req.session?.save === 'function',
      });
      return next(new Error('Session unavailable for login. Check session store connectivity.'));
    }

    req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);

      // JSON response for tests
      if (req.headers.accept?.includes('application/json')) {
        return res.status(200).json({ success: true });
      }

      return res.redirect('/');
    });
  })(req, res, next);
});

/**
 * LOGOUT
 */
router.post('/logout', (req, res, next) => {
  if (
    !req.session ||
    typeof req.session.save !== 'function' ||
    typeof req.session.regenerate !== 'function'
  ) {
    console.warn('Session missing Passport logout methods, using fallback logout');
    return fallbackLogout(req, res, next);
  }

  req.logout((err) => {
    if (err) {
      console.warn('Passport logout failed, using fallback logout:', err);
      return fallbackLogout(req, res, next);
    }

    res.clearCookie('jupiter.sid');
    return finishLogout(req, res);
  });
});

export default router;
