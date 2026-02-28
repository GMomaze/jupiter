import { Router } from 'express';
import { TaskController } from './task.controller.js';

const router = Router();

/**
 * CREATE TASK (UNASSIGNED)
 * Needed for Planner + E2E
 */
router.post('/', TaskController.create);

/**
 * SIGN OFF TASK
 */
router.post('/:id/sign-off', TaskController.signOff);

export default router;
