import { Router } from 'express';
import { getDepartments } from '../controllers/department.controller.js';

const router = Router();

router.get('/', getDepartments);

export default router;
