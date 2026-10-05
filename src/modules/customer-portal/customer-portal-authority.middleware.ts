import type { NextFunction, Request, Response } from 'express';
import { createCustomerPortalQueryAuthority } from './customer-portal-query-authority.js';
import { customerPortalRepository } from './customer-portal.repository.live.js';
import type { CustomerPortalRepository } from './customer-portal.repository.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unavailable(req: Request, res: Response) {
  if (req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: 'Customer authentication required' });
  }
  return res.redirect('/customer-auth/login');
}

export function createCustomerPortalAuthorityMiddleware(
  repository: Pick<CustomerPortalRepository, 'resolveIdentity'> = customerPortalRepository,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerUserId: unknown = req.session?.customerUser?.id;
      if (typeof customerUserId !== 'string' || !UUID.test(customerUserId)) {
        return unavailable(req, res);
      }

      const resolved = await repository.resolveIdentity(customerUserId);
      if (!resolved) return unavailable(req, res);

      Object.defineProperty(req, 'customerPortalAuthority', {
        value: createCustomerPortalQueryAuthority({
          customerUserId: resolved.customerUserId,
          customerId: resolved.customerId,
          tenantId: resolved.tenantId,
        }),
        enumerable: false,
        writable: false,
        configurable: false,
      });
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const resolveCustomerPortalAuthority =
  createCustomerPortalAuthorityMiddleware(customerPortalRepository);
