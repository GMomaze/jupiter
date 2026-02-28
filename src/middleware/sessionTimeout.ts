import { Request, Response, NextFunction } from 'express';

const MAX_IDLE = 30 * 60 * 1000; // 30 minutes

export function sessionTimeout(req: Request, res: Response, next: NextFunction) {

  if (!req.session) return next();

  const now = Date.now();

  if (req.session.lastActivity && now - req.session.lastActivity > MAX_IDLE) {
    req.logout(() => {});
    req.session.destroy(() => {});
    return res.redirect('/login');
  }

  req.session.lastActivity = now;
  next();
}

