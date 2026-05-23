import { Router } from 'express';
import csrf from 'csurf';
import { AircraftController } from './aircraft.controller.js';
import { aircraftPhotoUpload } from '../../middleware/upload.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';

const router = Router();
const csrfProtection = csrf();

/**
 * Static routes MUST come before dynamic routes.
 */

// Index
router.get('/', AircraftController.index);

// Create page
router.get('/create', AircraftController.showCreate);

// ✅ MATCHING ROUTE: This handles /aircraft/manufacturer/:manufacturerId/models
router.get(
  '/manufacturer/:manufacturerId/models',
  AircraftController.getModelsByManufacturer
);

// UUID routes
router.get('/view/:id', AircraftController.showView);
router.get('/:id/applicability', AircraftController.showApplicability);
router.get('/:id/service-bulletins', AircraftController.getServiceBulletins);
router.post('/', aircraftPhotoUpload.single('aircraft_photo'), csrfProtection, AircraftController.create);
router.post('/:id', requireAuth, requireRole('ADMIN'), aircraftPhotoUpload.single('aircraft_photo'), csrfProtection, AircraftController.update);
router.patch('/:id', requireAuth, requireRole('ADMIN'), aircraftPhotoUpload.single('aircraft_photo'), csrfProtection, AircraftController.update);

// Transition
router.post('/:id/transition', AircraftController.transition);

// Components
router.post('/:id/components', AircraftController.installComponent);
router.post('/:id/serialized-components', AircraftController.installSerializedComponent);
router.post('/:id/serialized-components/baseline-capture', AircraftController.baselineCaptureSerializedComponent);
router.post('/:id/serialized-components/:installationId/remove', AircraftController.removeSerializedComponent);
router.post('/:id/customer-links', AircraftController.assignCustomer);
router.post('/:id/service-bulletins/:serviceBulletinId/compliance', AircraftController.updateServiceBulletinCompliance);
router.post('/:id/sb/:sbId/comply', AircraftController.complyServiceBulletin);
router.post('/:id/sb/:sbId/not-applicable', AircraftController.markServiceBulletinNotApplicable);

// Registration route LAST
router.get('/:registration', AircraftController.showByRegistration);

export default router;
