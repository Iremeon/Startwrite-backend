import { Router } from 'express';
import * as usersController from './users.controller';
import { authMiddleware } from '../../middlewares/authenticate';

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Missing or invalid token
 */
router.get('/me', authMiddleware, usersController.getMe);

export default router;
