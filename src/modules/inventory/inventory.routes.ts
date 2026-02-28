import { Router } from 'express';
import { InventoryController } from './inventory.controller.js';

const router = Router();

// Movement actions
router.post('/remove/:componentId', InventoryController.handleRemoval);
router.post('/install/:componentId', InventoryController.handleInstallation);

export default router;