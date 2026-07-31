import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead, getNtfyTopic } from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', getNotifications);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.get('/ntfy-topics', getNtfyTopic);

export default router;
