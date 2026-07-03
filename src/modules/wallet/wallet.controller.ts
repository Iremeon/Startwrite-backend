import { Request, Response, NextFunction } from 'express';
import { ResponseService } from '../../utils/response';
import { IRequestUser } from '../../middlewares/authenticate';
import * as walletService from './wallet.service';
import stripe from '../../config/stripe';

export const listPackages = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const packages = await walletService.listPackages();
    return ResponseService({ data: packages, status: 200, success: true, res });
  } catch (error) {
    next(error);
  }
};

export const getMyWallet = async (req: IRequestUser, res: Response, next: NextFunction) => {
  try {
    const wallet = await walletService.getWallet(req.user!.id);
    return ResponseService({ data: wallet, status: 200, success: true, res });
  } catch (error) {
    next(error);
  }
};

export const createTopUp = async (req: IRequestUser, res: Response, next: NextFunction) => {
  try {
    const { packageId } = req.body;
    const result = await walletService.createTopUpCheckout(req.user!.id, packageId);
    return ResponseService({
      data: result,
      status: 200,
      success: true,
      message: 'Checkout session created',
      res,
    });
  } catch (error) {
    next(error);
  }
};

export const createDirectPay = async (req: IRequestUser, res: Response, next: NextFunction) => {
  try {
    const { templateId } = req.params;
    const result = await walletService.createDirectPayCheckout(req.user!.id, templateId);
    return ResponseService({
      data: result,
      status: 200,
      success: true,
      message: 'Direct payment checkout session created. Complete payment to download.',
      res,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Stripe webhook — must use the RAW request body for signature verification.
 * The route in wallet.routes.ts wires express.raw() specifically for this path,
 * bypassing the global JSON body parser (mirrored in app.ts).
 */
export const handleWebhook = async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    const message = (err as Error).message;
    console.error('Stripe webhook signature verification failed:', message);
    return res.status(400).send(`Webhook Error: ${message}`);
  }

  try {
    await walletService.handleStripeWebhookEvent(event);
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error processing Stripe webhook event:', err);
    return res.status(200).json({ received: true, processedWithError: true });
  }
};