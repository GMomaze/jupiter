import { Router } from 'express';
import { ProjectionController } from './projection.controller.js';

const router = Router();

// This maps the URL path '/' (which will be /projection/fleet-health) 
// to the controller method.
router.get('/fleet-health', ProjectionController.renderFleetStatus);
router.get('/summary', ProjectionController.getSummary);

export default router;