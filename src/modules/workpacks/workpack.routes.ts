import { Router } from 'express';
import { WorkpackController } from './workpack.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';

const router = Router();

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
  requireRole('ENGINEER'),
  WorkpackController.renderHangar
);

router.get(
  '/qa',
  requireAuth,
  requireRole('SUPERVISOR'),
  WorkpackController.renderQA
);

router.get(
  '/:id/tasks',
  requireAuth,
  requireRole('PLANNER'),
  WorkpackController.renderPackTasks
);

router.get(
  '/:id/execution',
  requireAuth,
  requireRole('ENGINEER'),
  WorkpackController.renderExecution
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
  '/:taskId/add',
  requireAuth,
  requireRole('PLANNER'),
  WorkpackController.handleAddTask
);

router.post(
  '/:id/:taskId/remove',
  requireAuth,
  requireRole('PLANNER'),
  WorkpackController.handleRemoveTask
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
  requireRole('ENGINEER'),
  WorkpackController.handleStart
);

router.post(
  '/:id/close',
  requireAuth,
  requireRole('SUPERVISOR'),
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