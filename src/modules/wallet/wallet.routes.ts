import { Router } from 'express';
import * as walletController from './wallet.controller';
import { ValidationMiddleware } from '../../middlewares/validate';
import { authMiddleware } from '../../middlewares/authenticate';
import { checkoutRateLimiter } from '../../middlewares/rateLimiter';
import { topUpSchema, directPaySchema } from './wallet.validation';

export const packagesRouter = Router();

/**
 * @swagger
 * /wallet/packages:
 *   get:
 *     summary: List available fixed top-up packages
 *     tags: [Wallet]
 *     responses:
 *       200:
 *         description: List of packages with amounts
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
 *     summary: Top up wallet via mobile money (MTN/Airtel). User receives a USSD push to approve on their phone.
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [packageId, phoneNumber]
 *             properties:
 *               packageId: { type: string, format: uuid }
 *               phoneNumber: { type: string, example: "0789092847" }
 *     responses:
 *       200:
 *         description: Payment initiated — user must approve on their phone
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
 *     summary: Pay directly for one template via mobile money. No wallet balance needed. User receives a USSD push — after approval, retry the download endpoint.
 *     tags: [Wallet]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber]
 *             properties:
 *               phoneNumber: { type: string, example: "0789092847" }
 *     responses:
 *       200:
 *         description: Payment initiated — approve on phone, then retry the download
 *       404:
 *         description: Template not found
 */
walletRouter.post(
  '/pay-direct/:templateId',
  authMiddleware,
  checkoutRateLimiter,
  ValidationMiddleware({ type: 'body', schema: directPaySchema }),
  walletController.createDirectPay,
);

/**
 * @swagger
 * /wallet/webhook:
 *   post:
 *     summary: Paypack webhook — called by Paypack when a mobile money transaction is processed (do not call manually)
 *     tags: [Wallet]
 *     responses:
 *       200:
 *         description: Acknowledged
 */
export const webhookRouter = Router();
webhookRouter.post('/', walletController.handleWebhook);