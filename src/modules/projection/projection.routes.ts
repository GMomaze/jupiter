import { Router, type RequestHandler } from 'express';
import { ProjectionController } from './projection.controller.js';
import { fleetProjectionService } from './projection.service.live.js';

export function createProjectionRouter(requireValidActiveTenantContext: RequestHandler) {
  const router = Router();
  const controller = new ProjectionController(fleetProjectionService);

  router.get('/fleet-health', requireValidActiveTenantContext, controller.renderFleetStatus);
  router.get('/summary', requireValidActiveTenantContext, controller.getSummary);

  return router;
}

export default createProjectionRouter;
