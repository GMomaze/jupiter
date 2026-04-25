import { Request, Response, NextFunction } from 'express';

const MAX_IDLE = 30 * 60 * 1000; // 30 minutes

export function sessionTimeout(req: Request, res: Response, next: NextFunction) {

  if (!req.session) return next();

  const now = Date.now();

  if (req.session.lastActivity && now - req.session.lastActivity > MAX_IDLE) {
    if (
      typeof req.session.save === 'function' &&
      typeof req.session.regenerate === 'function'
    ) {
      return req.logout(() => {
        res.clearCookie('jupiter.sid');
        return res.redirect('/auth/login');
      });
    }

    return req.session.destroy(() => {
      res.clearCookie('jupiter.sid');
      return res.redirect('/auth/login');
    });
  }

  req.session.lastActivity = now;
  next();
}

