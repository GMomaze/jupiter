import { Router } from 'express';
import { ensureCustomerAuthenticated } from '../../middleware/customer-auth.middleware.js';
import { resolveCustomerPortalAuthority } from './customer-portal-authority.middleware.js';
import { assertCustomerPortalQueryAuthority } from './customer-portal-query-authority.js';
import { customerPortalService } from './customer-portal.service.js';

const router = Router();

router.use(ensureCustomerAuthenticated);
router.use(resolveCustomerPortalAuthority);

function viewIdentity(identity: Awaited<ReturnType<typeof customerPortalService.getIdentity>>) {
  if (!identity) return undefined;
  return {
    id: identity.customerUserId,
    customer_id: identity.customerId,
    email: identity.email,
    display_name: identity.displayName,
  };
}

router.get('/', async (req, res, next) => {
  try {
    assertCustomerPortalQueryAuthority(req.customerPortalAuthority);
    const identity = await customerPortalService.getIdentity(req.customerPortalAuthority);
    if (!identity) return res.redirect('/customer-auth/login');
    return res.render('customer-portal/index', {
      customerUser: viewIdentity(identity),
      customerName: identity.customerName,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/aircraft', async (req, res, next) => {
  try {
    assertCustomerPortalQueryAuthority(req.customerPortalAuthority);
    const [identity, aircraftList] = await Promise.all([
      customerPortalService.getIdentity(req.customerPortalAuthority),
      customerPortalService.listAircraft(req.customerPortalAuthority),
    ]);
    if (!identity) return res.redirect('/customer-auth/login');
    return res.render('customer-portal/aircraft', {
      customerUser: viewIdentity(identity), customerName: identity.customerName, aircraftList,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/workpacks', async (req, res, next) => {
  try {
    assertCustomerPortalQueryAuthority(req.customerPortalAuthority);
    const [identity, workpacks] = await Promise.all([
      customerPortalService.getIdentity(req.customerPortalAuthority),
      customerPortalService.listWorkpacks(req.customerPortalAuthority),
    ]);
    if (!identity) return res.redirect('/customer-auth/login');
    return res.render('customer-portal/workpacks', {
      customerUser: viewIdentity(identity), customerName: identity.customerName, workpacks,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/documents', async (req, res, next) => {
  try {
    assertCustomerPortalQueryAuthority(req.customerPortalAuthority);
    const [identity, documents] = await Promise.all([
      customerPortalService.getIdentity(req.customerPortalAuthority),
      customerPortalService.listReleasedDocuments(req.customerPortalAuthority),
    ]);
    if (!identity) return res.redirect('/customer-auth/login');
    return res.render('customer-portal/documents', {
      customerUser: viewIdentity(identity), customerName: identity.customerName, documents,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/compliance', async (req, res, next) => {
  try {
    assertCustomerPortalQueryAuthority(req.customerPortalAuthority);
    const [identity, complianceSummaries] = await Promise.all([
      customerPortalService.getIdentity(req.customerPortalAuthority),
      customerPortalService.listCompletedCompliance(req.customerPortalAuthority),
    ]);
    if (!identity) return res.redirect('/customer-auth/login');
    return res.render('customer-portal/compliance', {
      customerUser: viewIdentity(identity), customerName: identity.customerName, complianceSummaries,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
