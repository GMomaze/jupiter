import { Router } from 'express';
import { WorkpackController } from './workpack.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireAnyRole, requireRole } from '../../middleware/rbac.middleware.js';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/* ============================================================
    VIEW ROUTES
============================================================ */

router.get(
  '/',
  requireAuth,
  WorkpackController.renderIndex
);

router.get(
  '/planner',
  requireAuth,
  requireRole('PLANNER'),
  WorkpackController.renderPlanner
);

router.get(
  '/hangar',
  requireAuth,
  requireAnyRole('ENGINEER', 'MECHANIC'),
  WorkpackController.renderHangar
);

router.get(
  '/qa',
  requireAuth,
  requireRole('SUPERVISOR'),
  WorkpackController.renderQA
);

router.get(
  '/:id/snags',
  requireAuth,
  requireAnyRole('PLANNER', 'ENGINEER', 'MECHANIC'),
  WorkpackController.renderPackSnags
);

router.get(
  '/:id/tasks',
  requireAuth,
  requireAnyRole('PLANNER', 'ENGINEER', 'MECHANIC'),
  WorkpackController.renderPackTasks
);

router.get(
  '/:id/service-bulletins',
  requireAuth,
  requireAnyRole('PLANNER', 'ENGINEER', 'MECHANIC'),
  WorkpackController.renderPackServiceBulletins
);

router.get(
  '/:id/execution',
  requireAuth,
  requireAnyRole('ENGINEER', 'MECHANIC'),
  WorkpackController.renderExecution
);

router.get(
  '/:id/pdf/service',
  requireAuth,
  requireAnyRole('PLANNER', 'ENGINEER', 'MECHANIC', 'SUPERVISOR'),
  WorkpackController.handleServicePdf
);

router.get(
  '/:id/pdf/release',
  requireAuth,
  requireAnyRole('PLANNER', 'ENGINEER', 'MECHANIC', 'SUPERVISOR'),
  WorkpackController.handleReleasePdf
);

router.get(
  '/:id/pdf/crma',
  requireAuth,
  requireAnyRole('PLANNER', 'ENGINEER', 'MECHANIC', 'SUPERVISOR'),
  WorkpackController.handleCrmaPdf
);

/* ============================================================
    ACTION ROUTES
============================================================ */

router.post(
  '/',
  requireAuth,
  requireRole('PLANNER'),
  WorkpackController.handleCreate
);

router.post(
  '/templates/import',
  requireAuth,
  requireRole('PLANNER'),
  upload.single('task_csv'),
  WorkpackController.handleImportTemplates
);

router.post(
  '/:id/snags',
  requireAuth,
  requireRole('MECHANIC'),
  WorkpackController.handleCreateSnag
);

router.post(
  '/:id/execution/snags',
  requireAuth,
  requireAnyRole('ENGINEER', 'MECHANIC'),
  WorkpackController.handleCreateExecutionSnag
);

router.post(
  '/:id/snags/:snagId/start',
  requireAuth,
  requireRole('MECHANIC'),
  WorkpackController.handleStartSnag
);

router.post(
  '/:id/snags/:snagId/complete',
  requireAuth,
  requireRole('MECHANIC'),
  WorkpackController.handleCompleteSnag
);

router.post(
  '/:id/snags/:snagId/close',
  requireAuth,
  requireAnyRole('ENGINEER', 'SUPERVISOR', 'ADMIN'),
  WorkpackController.handleCloseSnag
);

router.post(
  '/:taskId/add',
  requireAuth,
  requireRole('PLANNER'),
  WorkpackController.handleAddTask
);

router.post(
  '/templates/:templateId/add',
  requireAuth,
  requireRole('PLANNER'),
  WorkpackController.handleAddTemplateTask
);

router.post(
  '/:id/service-bulletins/add',
  requireAuth,
  requireRole('PLANNER'),
  WorkpackController.handleAddServiceBulletins
);

router.post(
  '/:id/:taskId/remove',
  requireAuth,
  requireRole('PLANNER'),
  WorkpackController.handleRemoveTask
);

router.post(
  '/:id/delete',
  requireAuth,
  requireRole('PLANNER'),
  WorkpackController.handleDeleteDraft
);

router.post(
  '/:id/issue',
  requireAuth,
  requireRole('PLANNER'),
  WorkpackController.handleIssue
);

router.post(
  '/:id/start',
  requireAuth,
  requireAnyRole('ENGINEER', 'MECHANIC'),
  WorkpackController.handleStart
);

router.post(
  '/tasks/:taskId/start',
  requireAuth,
  requireRole('MECHANIC'),
  WorkpackController.handleTaskStart
);

router.post(
  '/tasks/:taskId/complete',
  requireAuth,
  requireRole('MECHANIC'),
  WorkpackController.handleTaskComplete
);

router.post(
  '/tasks/:taskId/work-note',
  requireAuth,
  requireRole('MECHANIC'),
  WorkpackController.handleTaskWorkNote
);

router.post(
  '/:id/close',
  requireAuth,
  requireRole('ENGINEER'),
  WorkpackController.handleClose
);

router.post(
  '/tasks/:taskId/sign',
  requireAuth,
  requireRole('ENGINEER'),
  WorkpackController.handleTaskSign
);

router.post(
  '/tasks/:taskId/lock',
  requireAuth,
  requireRole('SUPERVISOR'),
  WorkpackController.handleTaskLock
);

export default router;
