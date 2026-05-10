import { Request, Response, NextFunction } from 'express';

export const ensureCustomerAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.session?.customerUser) {
    return next();
  }

  if (req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: 'Customer authentication required' });
  }

  return res.redirect('/customer-auth/login');
};

export default {
  ensureCustomerAuthenticated,
};
