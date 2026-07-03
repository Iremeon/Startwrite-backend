import { Router } from 'express';
import * as walletController from './wallet.controller';
import { ValidationMiddleware } from '../../middlewares/validate';
import { authMiddleware } from '../../middlewares/authenticate';
import { checkoutRateLimiter } from '../../middlewares/rateLimiter';
import { topUpSchema } from './wallet.validation';

/**
 * @swagger
 * /wallet/packages:
 *   get:
 *     summary: List available fixed top-up packages
 *     tags: [Wallet]
 *     responses:
 *       200:
 *         description: List of packages
 */
export const packagesRouter = Router();
packagesRouter.get('/', walletController.listPackages);

export const walletRouter = Router();

/**
 * @swagger
 * /wallet/me:
 *   get:
 *     summary: Get current wallet balance and recent transaction history
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Wallet balance and transactions
 */
walletRouter.get('/me', authMiddleware, walletController.getMyWallet);

/**
 * @swagger
 * /wallet/topup:
 *   post:
 *     summary: Top up wallet with a fixed package via Stripe Checkout
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [packageId]
 *             properties:
 *               packageId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Returns a Stripe-hosted checkoutUrl to redirect to
 *       404:
 *         description: Package not found
 */
walletRouter.post(
  '/topup',
  authMiddleware,
  checkoutRateLimiter,
  ValidationMiddleware({ type: 'body', schema: topUpSchema }),
  walletController.createTopUp,
);

/**
 * @swagger
 * /wallet/pay-direct/{templateId}:
 *   post:
 *     summary: Pay directly for one specific template via Stripe Checkout — no wallet balance needed. On payment success, the Stripe webhook grants a one-time download token (15 min TTL) for that template.
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Returns a Stripe-hosted checkoutUrl, the template title, and the price
 *       404:
 *         description: Template not found
 */
walletRouter.post(
  '/pay-direct/:templateId',
  authMiddleware,
  checkoutRateLimiter,
  walletController.createDirectPay,
);

// NOTE: the webhook route is mounted separately in app.ts, BEFORE the global
// express.json() middleware, because Stripe signature verification requires
// the raw, unparsed request body.