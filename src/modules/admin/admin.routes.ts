import { Router } from 'express';
import * as adminController from './admin.controller';
import { ValidationMiddleware } from '../../middlewares/validate';
import { authMiddleware } from '../../middlewares/authenticate';
import { requireAdmin } from '../../middlewares/authorize';
import { listUsersQuerySchema, updateUserStatusSchema } from './admin.validation';

const router = Router();

router.use(authMiddleware, requireAdmin);

router.get(
  '/users',
  ValidationMiddleware({ type: 'query', schema: listUsersQuerySchema }),
  adminController.listUsers,
);

router.patch(
  '/users/:id/status',
  ValidationMiddleware({ type: 'body', schema: updateUserStatusSchema }),
  adminController.updateUserStatus,
);

router.get('/dashboard/stats', adminController.getDashboardStats);

export default router;
