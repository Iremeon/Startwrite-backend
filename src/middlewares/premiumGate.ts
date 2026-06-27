import { Response, NextFunction } from 'express';
import { ResponseService } from '../utils/response';
import { IRequestUser } from './authenticate';
import prisma from '../config/db';

/**
 * The single gatekeeping check for template downloads (§6 of the spec).
 * Must run AFTER authMiddleware. Looks up the template's access_tier;
 * if it's premium, requires req.user.isPremium to be true.
 *
 * isPremium is only ever set by the Stripe webhook handler — never trust
 * any other source for it.
 */
export const premiumGate = async (req: IRequestUser, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const template = await prisma.template.findUnique({
      where: { id },
      select: { id: true, accessTier: true, isActive: true },
    });

    if (!template || !template.isActive) {
      return ResponseService({
        data: null,
        status: 404,
        success: false,
        message: 'Template not found',
        res,
      });
    }

    if (template.accessTier === 'premium' && !req.user?.isPremium) {
      return ResponseService({
        data: { code: 'PREMIUM_REQUIRED' },
        status: 403,
        success: false,
        message: 'This template requires premium access. Upgrade to download it.',
        res,
      });
    }

    next();
  } catch (error) {
    const { message } = error as Error;
    return ResponseService({
      data: { message },
      status: 500,
      success: false,
      message: 'Failed to verify template access',
      res,
    });
  }
};
