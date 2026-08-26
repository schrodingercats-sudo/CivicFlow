import { Router } from 'express';
import { getAdminStats } from '../controllers/analytics.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';

const router = Router();

router.get('/summary', authenticate, authorize('admin'), getAdminStats);
router.get('/stats', authenticate, authorize('admin'), getAdminStats);

export default router;
