import { Router } from 'express';
import { BaseReferenceService } from './BaseReferenceService.js';
import { defineAbilitiesFor } from '../auth/ability.js';

const router = Router();

/**
 * 2.3: Authorization Middleware
 * Attaches the user's specific CASL abilities to the request object.
 */
const attachAbility = (req: any, res: any, next: any) => {
  req.ability = defineAbilitiesFor(req.user);
  next();
};

/**
 * 1.6: Dropdown Options Reload Endpoint
 */
router.get('/:tableName/options', async (req, res) => {
  const { tableName } = req.params;
  const selectedId = req.query.selectedId as string;
  
  const service = new BaseReferenceService(tableName);
  const items = await service.getAllActive();

  res.render('partials/rf-options', { items, selectedId });
});

/**
 * 1.6 & 2.3: Gap Modal Creation Endpoint
 * Now uses real req.user abilities instead of mock data.
 */
router.post('/:tableName/gap-create', attachAbility, async (req: any, res) => {
  const { tableName } = req.params;
  const service = new BaseReferenceService(tableName);
  
  try {
    // Controller passes the ability to the service for enforcement
    const newRecord = await service.create(req.body, req.ability);

    res.setHeader('HX-Trigger', JSON.stringify({
      [`refresh-${tableName}`]: { selectedId: newRecord.id }
    }));

    res.status(201).send(); 
  } catch (error) {
    res.status(403).send((error as Error).message);
  }
});

/**
 * 1.4, 1.5 & 2.3: Deactivate Reference
 * Enforces both system_locked rules and CASL permissions.
 */
router.delete('/:tableName/:id', attachAbility, async (req: any, res) => {
  const { tableName, id } = req.params;
  const service = new BaseReferenceService(tableName);

  try {
    await service.deactivate(id, req.ability);
    res.status(204).send();
  } catch (error) {
    res.status(400).send((error as Error).message);
  }
});

/**
 * 1.5: Admin List View
 */
router.get('/:tableName', async (req, res) => {
  const { tableName } = req.params;
  const service = new BaseReferenceService(tableName);
  const items = await service.getAllActive();
  
  res.render('reference/list', { items, tableName });
});

export default router;