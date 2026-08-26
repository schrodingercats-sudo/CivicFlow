import { Router } from 'express';
import {
  createComplaint,
  getComplaints,
  getComplaintById,
  updateComplaintStatus,
  withdrawComplaint,
  rateComplaint,
  deleteComplaint,
  assignWorkerToComplaint,
  getWorkerUpdatesForComplaint
} from '../controllers/complaint.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';

const router = Router();

// Authenticated Routes
router.use(authenticate);

router.post('/', authorize('citizen'), createComplaint);
router.get('/', getComplaints);
router.get('/:id', getComplaintById);
router.patch('/:id/status', authorize('officer', 'admin'), updateComplaintStatus);
router.patch('/:id', authorize('officer', 'admin'), updateComplaintStatus);
router.post('/:id/withdraw', authorize('citizen', 'admin'), withdrawComplaint);
router.post('/:id/rating', authorize('citizen'), rateComplaint);
router.delete('/:id', authorize('citizen', 'admin'), deleteComplaint);
router.patch('/:id/assign-worker', authorize('officer', 'admin'), assignWorkerToComplaint);
router.get('/:id/worker-updates', getWorkerUpdatesForComplaint);

export default router;
