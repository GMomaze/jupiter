import { Router } from 'express';
import { AircraftController } from './aircraft.controller.ts';

const router = Router();

/**
 * Static routes MUST come before dynamic routes.
 */

// Index
router.get('/', AircraftController.index);

// Create page
router.get('/create', AircraftController.showCreate);

// 🔹 NEW — Load models by manufacturer (HTMX)
router.get(
  '/manufacturer/:manufacturerId/models',
  AircraftController.getModelsByManufacturer
);

// UUID routes
router.get('/view/:id', AircraftController.showView);
router.post('/', AircraftController.create);
router.patch('/:id', AircraftController.update);

// Transition
router.post('/:id/transition', AircraftController.transition);

// Components
router.post('/:id/components', AircraftController.installComponent);

// Registration route LAST
router.get('/:registration', AircraftController.showByRegistration);

export default router;
