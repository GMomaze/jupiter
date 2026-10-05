import { Router, type RequestHandler } from 'express';
import { CustomersController } from './customers.controller.js';

const router = Router();
let activeTenantGate: RequestHandler | null = null;

const requireCustomerTenant: RequestHandler = (req, res, next) => {
  if (!activeTenantGate) return next(new Error('TENANT_GATE_REQUIRED'));
  return activeTenantGate(req, res, next);
};

router.use(requireCustomerTenant);

router.get('/', CustomersController.index);
router.get('/create', CustomersController.showCreate);
router.post('/', CustomersController.create);
router.get('/:id/edit', CustomersController.showEdit);
router.post('/:id', CustomersController.update);

export function createCustomersRouter(requireValidActiveTenantContext: RequestHandler) {
  activeTenantGate = requireValidActiveTenantContext;
  return router;
}

export default router;
