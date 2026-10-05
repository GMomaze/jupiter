import { Router, type RequestHandler } from 'express';
import csrf from 'csurf';
import { AircraftController } from './aircraft.controller.js';
import { aircraftPhotoUpload } from '../../middleware/upload.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requirePermission, requireRole } from '../../middleware/rbac.middleware.js';
import { aircraftPhotoLifecycle } from './aircraft-photo-lifecycle.middleware.js';

const router = Router();
const csrfProtection = csrf();
let activeTenantGate: RequestHandler | null = null;

const requireAircraftTenant: RequestHandler = (req, res, next) => {
  if (!activeTenantGate) return next(new Error('TENANT_GATE_REQUIRED'));
  return activeTenantGate(req, res, next);
};

/**
 * Static routes MUST come before dynamic routes.
 */

// Index
router.get('/', requireAircraftTenant, AircraftController.index);

// Create page
router.get('/create', requireAircraftTenant, AircraftController.showCreate);

// ✅ MATCHING ROUTE: This handles /aircraft/manufacturer/:manufacturerId/models
router.get(
  '/manufacturer/:manufacturerId/models',
  AircraftController.getModelsByManufacturer
);

// UUID routes
router.get('/view/:id', requireAircraftTenant, AircraftController.showView);
router.get('/:id/applicability', requireAircraftTenant, AircraftController.showApplicability);
router.get('/:id/service-bulletins', requireAircraftTenant, AircraftController.getServiceBulletins);
router.post('/', requireAircraftTenant, aircraftPhotoLifecycle.begin, aircraftPhotoUpload.single('aircraft_photo'), aircraftPhotoLifecycle.track, csrfProtection, aircraftPhotoLifecycle.wrap(AircraftController.create));
router.post(
  '/:id/ad-applicability/:allocationId/create-compliance-assignment',
  requireAuth,
  requirePermission('AD_COMPLIANCE_ASSIGN_CREATE'),
  requireAircraftTenant,
  csrfProtection,
  AircraftController.createAdComplianceAssignment
);
router.post(
  '/:id/ad-compliance-assignments/:assignmentId/create-operational-record',
  requireAuth,
  requirePermission('AD_COMPLIANCE_RECORD_CREATE'),
  requireAircraftTenant,
  csrfProtection,
  AircraftController.createAdOperationalComplianceRecord
);
router.post(
  '/:id/ad-compliance/:complianceId/update-status',
  requireAuth,
  requirePermission('AD_COMPLIANCE_STATUS_UPDATE'),
  requireAircraftTenant,
  csrfProtection,
  AircraftController.updateAdOperationalComplianceStatus
);
router.post(
  '/:id/ad-compliance/:complianceId/update-due-data',
  requireAuth,
  requirePermission('AD_COMPLIANCE_DUE_UPDATE'),
  requireAircraftTenant,
  csrfProtection,
  AircraftController.updateAdOperationalComplianceDueData
);
router.post('/:id/utilisation/preview', requireAuth, requireRole('ADMIN'), requireAircraftTenant, csrfProtection, AircraftController.previewUtilisation);
router.post('/:id/utilisation', requireAuth, requireRole('ADMIN'), requireAircraftTenant, csrfProtection, AircraftController.updateUtilisation);
router.post('/:id', requireAuth, requireRole('ADMIN'), requireAircraftTenant, aircraftPhotoLifecycle.begin, aircraftPhotoUpload.single('aircraft_photo'), aircraftPhotoLifecycle.track, csrfProtection, aircraftPhotoLifecycle.wrap(AircraftController.update));
router.patch('/:id', requireAuth, requireRole('ADMIN'), requireAircraftTenant, aircraftPhotoLifecycle.begin, aircraftPhotoUpload.single('aircraft_photo'), aircraftPhotoLifecycle.track, csrfProtection, aircraftPhotoLifecycle.wrap(AircraftController.update));

// Transition
router.post('/:id/transition', requireAircraftTenant, AircraftController.transition);

// Components
router.post('/:id/components', requireAircraftTenant, AircraftController.installComponent);
router.post('/:id/serialized-components', requireAircraftTenant, AircraftController.installSerializedComponent);
router.post('/:id/serialized-components/baseline-capture', requireAircraftTenant, AircraftController.baselineCaptureSerializedComponent);
router.post('/:id/serialized-components/:installationId/remove', requireAircraftTenant, AircraftController.removeSerializedComponent);
router.post('/:id/customer-links', requireAircraftTenant, AircraftController.assignCustomer);
router.post('/:id/service-bulletins/:serviceBulletinId/compliance', requireAircraftTenant, AircraftController.updateServiceBulletinCompliance);
router.post('/:id/sb/:sbId/comply', requireAircraftTenant, AircraftController.complyServiceBulletin);
router.post('/:id/sb/:sbId/not-applicable', requireAircraftTenant, AircraftController.markServiceBulletinNotApplicable);

// Registration route LAST
router.get('/:registration', requireAircraftTenant, AircraftController.showByRegistration);

export function createAircraftRouter(requireValidActiveTenantContext: RequestHandler) {
  activeTenantGate = requireValidActiveTenantContext;
  return router;
}

export default router;
