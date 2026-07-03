import { Router } from 'express';
import * as usersController from './users.controller';
import { authMiddleware } from '../../middlewares/authenticate';
import { requireAdmin } from '../../middlewares/authorize';
import { ValidationMiddleware } from '../../middlewares/validate';
import { updateProfileSchema } from './users.validation';

// ── Self-service routes — mounted at /users ──
const router = Router();

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get the current authenticated user's profile
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Current user profile
 *       401:
 *         description: Missing or invalid token
 */
router.get('/me', authMiddleware, usersController.getMe);

/**
 * @swagger
 * /users/me:
 *   patch:
 *     summary: Update own profile (name and/or phone number only)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 150 }
 *               phoneNumber: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: No valid fields provided
 */
router.patch(
  '/me',
  authMiddleware,
  ValidationMiddleware({ type: 'body', schema: updateProfileSchema }),
  usersController.updateMe,
);

export default router;

// ── Admin user management — mounted at /admin/users in app.ts ──
export const adminUsersRouter = Router();

/**
 * @swagger
 * /admin/users/{id}:
 *   delete:
 *     summary: Soft-delete a user (admin) — sets isActive to false. Wallet transaction history is preserved. Admins cannot delete themselves or other admin accounts.
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       400:
 *         description: Cannot delete self or an admin account
 *       404:
 *         description: User not found
 */
adminUsersRouter.delete('/:id', authMiddleware, requireAdmin, usersController.deleteUser);