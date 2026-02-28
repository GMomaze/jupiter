import { Router } from 'express';
import { ComponentController } from './component.controller.js';

const router = Router();

router.get('/create', ComponentController.renderCreate);
router.post('/', ComponentController.create);

// Lifecycle Actions - Clean mapping
router.post('/:id/install', ComponentController.install);
router.post('/:id/remove', ComponentController.remove);
router.post('/:id/quarantine', ComponentController.quarantine);

export default router;