import { Router } from 'express';
import * as authController from './auth.controller';
import { ValidationMiddleware } from '../../middlewares/validate';
import { authMiddleware } from '../../middlewares/authenticate';
import { authRateLimiter } from '../../middlewares/rateLimiter';
import {
  registerSchema,
  loginSchema,
  googleTokenSchema,
  refreshSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  verifyResetTokenSchema,
  resetPasswordSchema,
} from './auth.validation';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register an organization account. tinNumber (Rwanda RRA 9-digit format) is optional — providing it identifies the account as an organization. A verification email is always sent regardless.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: "Computer Rwanda Ltd" }
 *               email: { type: string, format: email }
 *               password: { type: string, format: password, minLength: 8 }
 *               phoneNumber: { type: string }
 *               tinNumber: { type: string, example: "102134442", description: "Exactly 9 digits (Rwanda RRA format). Optional — marks the account as an organization." }
 *     responses:
 *       201:
 *         description: Registration successful — verification email sent, check inbox before logging in
 *       409:
 *         description: Email or TIN already in use
 */
router.post(
  '/register',
  authRateLimiter,
  ValidationMiddleware({ type: 'body', schema: registerSchema }),
  authController.register,
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Login successful — returns accessToken, refreshToken, and user
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account disabled or email not verified
 */
router.post(
  '/login',
  authRateLimiter,
  ValidationMiddleware({ type: 'body', schema: loginSchema }),
  authController.login,
);

/**
 * @swagger
 * /auth/google/token:
 *   post:
 *     summary: Sign in or register using a Google ID token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken: { type: string }
 *     responses:
 *       200:
 *         description: Login successful — returns accessToken, refreshToken, and user
 */
router.post(
  '/google/token',
  authRateLimiter,
  ValidationMiddleware({ type: 'body', schema: googleTokenSchema }),
  authController.googleLogin,
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Exchange a refresh token for a new access/refresh token pair
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: New token pair issued
 *       401:
 *         description: Refresh token invalid or revoked
 */
router.post(
  '/refresh',
  ValidationMiddleware({ type: 'body', schema: refreshSchema }),
  authController.refresh,
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Revoke a refresh token (log out)
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', authMiddleware, authController.logout);

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify an email using the token sent after registration
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Token invalid or expired
 */
router.post(
  '/verify-email',
  ValidationMiddleware({ type: 'body', schema: verifyEmailSchema }),
  authController.verifyEmail,
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset link
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Reset link sent if the account exists (response is always success-shaped)
 */
router.post(
  '/forgot-password',
  authRateLimiter,
  ValidationMiddleware({ type: 'body', schema: forgotPasswordSchema }),
  authController.forgotPassword,
);

/**
 * @swagger
 * /auth/verify-reset-token:
 *   post:
 *     summary: Check whether a password reset token is still valid (does NOT consume the token — call this before showing the "set new password" form)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: Token is valid
 *       400:
 *         description: Token invalid or expired
 */
router.post(
  '/verify-reset-token',
  ValidationMiddleware({ type: 'body', schema: verifyResetTokenSchema }),
  authController.verifyResetToken,
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Set a new password using a reset token (consumes the token)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: { type: string }
 *               newPassword: { type: string, format: password, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Token invalid or expired
 */
router.post(
  '/reset-password',
  ValidationMiddleware({ type: 'body', schema: resetPasswordSchema }),
  authController.resetPassword,
);

export default router;