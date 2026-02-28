import { Router } from 'express';
import passport from 'passport';

const router = Router();

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
  req.logout((err) => {
    if (err) return next(err);

    if (req.headers.accept?.includes('application/json')) {
      return res.status(200).json({ success: true });
    }

    res.redirect('/auth/login');
  });
});

export default router;