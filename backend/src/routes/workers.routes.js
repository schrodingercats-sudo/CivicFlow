import { Router } from 'express';
import {
  listWorkers,
  updateWorker,
  toggleWorkerStatus,
  deleteWorker
} from '../controllers/worker.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);
router.get('/', authorize('admin', 'officer'), listWorkers);
router.patch('/:id', authorize('admin', 'officer'), updateWorker);
router.patch('/:id/status', authorize('admin', 'officer'), toggleWorkerStatus);
router.delete('/:id', authorize('admin'), deleteWorker);

export default router;
