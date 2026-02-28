import { Router } from 'express';

const router = Router();

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
router.get('/', ensureAuthenticated, (req, res) => {
  res.render('dashboard/index');
});

export default router;