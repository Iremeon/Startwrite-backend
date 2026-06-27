import prisma from '../../config/db';
import stripe from '../../config/stripe';
import { ApiError } from '../../utils/ApiError';
import { appEvents, AppEvent } from '../../utils/events';
import { Prisma } from '@prisma/client';
import type Stripe from 'stripe';

const FRONTEND_URL = process.env.FRONTEND_URL as string;

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

// ──────────────────────────────────────────────
// Webhook handler — the ONLY place allowed to credit users.walletBalance.
// Never trust a client-side call claiming a top-up succeeded.
// ──────────────────────────────────────────────

export const handleStripeWebhookEvent = async (event: Stripe.Event) => {
  if (event.type === 'checkout.session.completed') {
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
  }
  // Other event types are fine to ignore — one-time payments have no
  // renewal/cancellation lifecycle to track, unlike the old subscription model.
};

const handleCheckoutCompleted = async (session: Stripe.Checkout.Session) => {
  if (session.mode !== 'payment' || session.payment_status !== 'paid') return;

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