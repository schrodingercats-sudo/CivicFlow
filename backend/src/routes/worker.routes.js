import { Router } from 'express';
import {
  getWorkerTasks,
  submitWorkerUpdate
} from '../controllers/worker.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);
router.get('/tasks', authorize('worker'), getWorkerTasks);
router.post('/tasks/:id/update', authorize('worker'), submitWorkerUpdate);

export default router;
