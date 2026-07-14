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
  verifyResetCodeSchema,
  resetPasswordSchema,
} from './auth.validation';
import Joi from 'joi';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register an organization account. A 6-digit verification code is always sent to the email provided.
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
 *               tinNumber: { type: string, example: "102134442" }
 *     responses:
 *       201:
 *         description: Registration successful — check email for 6-digit verification code
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
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Email not verified or account disabled
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
 *         description: Login successful
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
 *     summary: Revoke refresh token (log out)
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
 *     summary: Verify email using the 6-digit code sent after registration
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email: { type: string, format: email }
 *               code: { type: string, example: "847291", description: "6-digit code from email" }
 *     responses:
 *       200:
 *         description: Email verified — can now log in
 *       400:
 *         description: Code incorrect or expired
 */
router.post(
  '/verify-email',
  ValidationMiddleware({ type: 'body', schema: verifyEmailSchema }),
  authController.verifyEmail,
);

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     summary: Resend a new 6-digit verification code to an unverified email
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
 *         description: New code sent (response is always success-shaped to avoid leaking email existence)
 */
router.post(
  '/resend-verification',
  authRateLimiter,
  ValidationMiddleware({
    type: 'body',
    schema: Joi.object({ email: Joi.string().email().required() }),
  }),
  authController.resendVerificationCode,
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a 6-digit password reset code via email
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
 *         description: Reset code sent if account exists (always success-shaped)
 */
router.post(
  '/forgot-password',
  authRateLimiter,
  ValidationMiddleware({ type: 'body', schema: forgotPasswordSchema }),
  authController.forgotPassword,
);

/**
 * @swagger
 * /auth/verify-reset-code:
 *   post:
 *     summary: Verify a password reset code without consuming it — call before showing the new password form
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email: { type: string, format: email }
 *               code: { type: string, example: "391847" }
 *     responses:
 *       200:
 *         description: Code is valid
 *       400:
 *         description: Code incorrect or expired
 */
router.post(
  '/verify-reset-code',
  ValidationMiddleware({ type: 'body', schema: verifyResetCodeSchema }),
  authController.verifyResetCode,
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Set a new password using the 6-digit reset code (consumes the code)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code, newPassword]
 *             properties:
 *               email: { type: string, format: email }
 *               code: { type: string, example: "391847" }
 *               newPassword: { type: string, format: password, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Code incorrect or expired
 */
router.post(
  '/reset-password',
  ValidationMiddleware({ type: 'body', schema: resetPasswordSchema }),
  authController.resetPassword,
);

export default router;