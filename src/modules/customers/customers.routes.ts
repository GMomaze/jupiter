import { Router } from 'express';
import { CustomersController } from './customers.controller.js';

const router = Router();

router.get('/', CustomersController.index);
router.get('/create', CustomersController.showCreate);
router.post('/', CustomersController.create);
router.get('/:id/edit', CustomersController.showEdit);
router.post('/:id', CustomersController.update);

export default router;
