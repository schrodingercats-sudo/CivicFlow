import { Router } from 'express';
import { getDepartments } from '../controllers/department.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getDepartments);

export default router;
