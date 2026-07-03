import prisma from '../../config/db';
import stripe from '../../config/stripe';
import redis, { redisKeys } from '../../config/redis';
import { ApiError } from '../../utils/ApiError';
import { appEvents, AppEvent } from '../../utils/events';
import { Prisma } from '@prisma/client';
import type Stripe from 'stripe';

const FRONTEND_URL = process.env.FRONTEND_URL as string;
// One-time download token TTL — 15 minutes to complete the download after paying.
const DIRECT_PURCHASE_TTL_SECONDS = 15 * 60;

export const listPackages = async () => {
  return prisma.walletPackage.findMany({ where: { isActive: true }, orderBy: { amount: 'asc' } });
};

export const getWallet = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const transactions = await prisma.walletTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return { balance: user.walletBalance, transactions };
};

/**
 * Creates a Stripe Checkout Session in ONE-TIME PAYMENT mode (not
 * subscription) for a fixed top-up package. No pre-created Stripe Price
 * needed — the amount is built inline via price_data since packages are
 * simple fixed amounts, not recurring plans.
 */
export const createTopUpCheckout = async (userId: string, packageId: string) => {
  const pkg = await prisma.walletPackage.findUnique({ where: { id: packageId } });
  if (!pkg || !pkg.isActive) {
    throw new ApiError(404, 'PACKAGE_NOT_FOUND', 'This top-up package is not available.');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: userId,
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: `Startwrite Wallet Top-Up — ${pkg.label}` },
          unit_amount: Math.round(Number(pkg.amount) * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${FRONTEND_URL}/wallet/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${FRONTEND_URL}/wallet/cancelled`,
    metadata: { userId, packageId, amount: pkg.amount.toString() },
  });

  return { checkoutUrl: session.url };
};

/**
 * Pay-direct flow: creates a Stripe Checkout for the exact price of ONE
 * specific template. On webhook success, grants a one-time download token
 * in Redis — no wallet balance is modified.
 */
export const createDirectPayCheckout = async (userId: string, templateId: string) => {
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template || !template.isActive) {
    throw new ApiError(404, 'TEMPLATE_NOT_FOUND', 'Template not found.');
  }

  const pricing = await prisma.pricingTier.findUnique({
    where: { templateClass: template.templateClass },
  });
  if (!pricing) {
    throw new ApiError(
      500,
      'PRICING_NOT_CONFIGURED',
      "This template's class has no price configured.",
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const amount = Number(pricing.price);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: userId,
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Startwrite — ${template.title}`,
            description: `Class ${template.templateClass} template — one-time download`,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${FRONTEND_URL}/templates/${template.slug}/download?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${FRONTEND_URL}/templates/${template.slug}`,
    metadata: {
      userId,
      templateId,
      amount: amount.toString(),
      paymentType: 'DIRECT_PURCHASE',
    },
  });

  return { checkoutUrl: session.url, templateTitle: template.title, price: amount };
};

// ──────────────────────────────────────────────
// Webhook handler — the ONLY place allowed to credit users.walletBalance.
// Never trust a client-side call claiming a top-up succeeded.
// ──────────────────────────────────────────────

export const handleStripeWebhookEvent = async (event: Stripe.Event) => {
  if (event.type === 'checkout.session.completed') {
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
  }
};

const handleCheckoutCompleted = async (session: Stripe.Checkout.Session) => {
  if (session.mode !== 'payment' || session.payment_status !== 'paid') return;

  const paymentType = session.metadata?.paymentType;

  if (paymentType === 'DIRECT_PURCHASE') {
    await handleDirectPurchaseCompleted(session);
  } else {
    await handleTopUpCompleted(session);
  }
};

/**
 * Top-up flow: credits the user's wallet balance and logs a WalletTransaction.
 */
const handleTopUpCompleted = async (session: Stripe.Checkout.Session) => {
  const userId = session.client_reference_id || (session.metadata?.userId as string);
  const amount = Number(session.metadata?.amount);
  if (!userId || !amount) return;

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    const newBalance = Number((Number(user.walletBalance) + amount).toFixed(2));
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { walletBalance: newBalance },
    });

    await tx.walletTransaction.create({
      data: {
        userId,
        type: 'TOP_UP',
        amount,
        balanceAfter: updatedUser.walletBalance,
        stripeSessionId: session.id,
        stripePaymentIntentId: (session.payment_intent as string) || undefined,
      },
    });

    return updatedUser;
  });

  if (!result) return;

  appEvents.emit(AppEvent.WALLET_TOPPED_UP, {
    email: result.email,
    name: result.name,
    amount,
    newBalance: result.walletBalance,
  });
};

/**
 * Direct purchase flow: stores a one-time download token in Redis (15 min TTL).
 * The download endpoint checks for this token before requiring wallet balance.
 * No wallet balance is changed — this is a pure pay-per-download path.
 */
const handleDirectPurchaseCompleted = async (session: Stripe.Checkout.Session) => {
  const userId = session.client_reference_id || (session.metadata?.userId as string);
  const templateId = session.metadata?.templateId as string;
  if (!userId || !templateId) return;

  // Grant a one-time download token for this exact user + template combination.
  await redis.set(
    redisKeys.directPurchaseToken(userId, templateId),
    session.id, // Stripe session ID as proof
    'EX',
    DIRECT_PURCHASE_TTL_SECONDS,
  );

  // Log as a wallet transaction for audit purposes — amount is negative-equivalent
  // but we use a separate type so reporting stays clean.
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  const pricing = template
    ? await prisma.pricingTier.findUnique({ where: { templateClass: template.templateClass } })
    : null;

  if (pricing) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await prisma.walletTransaction.create({
        data: {
          userId,
          type: 'DOWNLOAD_DEDUCTION',
          amount: Number(pricing.price),
          balanceAfter: user.walletBalance, // balance unchanged for direct purchases
          templateId,
          stripeSessionId: session.id,
          stripePaymentIntentId: (session.payment_intent as string) || undefined,
        },
      });
    }
  }
};