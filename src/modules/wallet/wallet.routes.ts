import { Router } from 'express';
import * as walletController from './wallet.controller';
import { ValidationMiddleware } from '../../middlewares/validate';
import { authMiddleware } from '../../middlewares/authenticate';
import { checkoutRateLimiter } from '../../middlewares/rateLimiter';
import { topUpSchema } from './wallet.validation';

export const packagesRouter = Router();

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
 *     summary: Start a Stripe Checkout session to top up the wallet with a fixed package
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

// NOTE: the webhook route is mounted separately in app.ts, BEFORE the global
// express.json() middleware, because Stripe signature verification requires
// the raw, unparsed request body.