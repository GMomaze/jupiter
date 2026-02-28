import { Request, Response, NextFunction } from 'express';

/**
 * UI Authentication Check
 * Redirects to login if session is missing.
 */
export const ensureAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  if (req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.redirect('/auth/login');
};

/**
 * API Authentication Check
 * Returns 401 instead of redirecting.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
};

export default {
  ensureAuthenticated,
  requireAuth
};