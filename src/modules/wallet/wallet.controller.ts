import { Request, Response, NextFunction } from 'express';
import { ResponseService } from '../../utils/response';
import { IRequestUser } from '../../middlewares/authenticate';
import * as walletService from './wallet.service';
import { PaypackWebhookPayload } from '../../interfaces/IWallet';

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
    const { packageId, phoneNumber } = req.body;
    const result = await walletService.initiateTopUp(req.user!.id, packageId, phoneNumber);
    return ResponseService({
      data: result,
      status: 200,
      success: true,
      message: result.message,
      res,
    });
  } catch (error) {
    next(error);
  }
};

export const createDirectPay = async (req: IRequestUser, res: Response, next: NextFunction) => {
  try {
    const { templateId } = req.params;
    const { phoneNumber } = req.body;
    const result = await walletService.initiateDirectPay(req.user!.id, templateId, phoneNumber);
    return ResponseService({
      data: result,
      status: 200,
      success: true,
      message: result.message,
      res,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Paypack webhook — called by Paypack on every transaction:processed event.
 * No signature verification (Paypack doesn't provide one) — security is
 * handled by re-verifying the transaction ref directly with Paypack's API
 * inside the service before crediting any balance.
 * Always returns 200 to prevent Paypack retries, even on internal errors.
 */
export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const payload = req.body as PaypackWebhookPayload;
    await walletService.handlePaypackWebhook(payload);
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error processing Paypack webhook:', err);
    // Still return 200 — internal errors shouldn't cause Paypack retries.
    return res.status(200).json({ received: true, processedWithError: true });
  }
};