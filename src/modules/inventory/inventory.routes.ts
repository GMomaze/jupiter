import { Router, type RequestHandler } from 'express';
import { InventoryController } from './inventory.controller.js';

const router = Router();
let activeTenantGate: RequestHandler | null = null;

const requireInventoryTenant: RequestHandler = (req, res, next) => {
  if (!activeTenantGate) return next(new Error('TENANT_GATE_REQUIRED'));
  return activeTenantGate(req, res, next);
};

router.use(requireInventoryTenant);

// Movement actions
router.post('/remove/:componentId', InventoryController.handleRemoval);
router.post('/install/:componentId', InventoryController.handleInstallation);

export function createInventoryRouter(requireValidActiveTenantContext: RequestHandler) {
  activeTenantGate = requireValidActiveTenantContext;
  return router;
}

export default router;
