import prisma from '../../config/db';
import redis, { redisKeys } from '../../config/redis';
import { ApiError } from '../../utils/ApiError';
import { appEvents, AppEvent } from '../../utils/events';
import { Prisma } from '@prisma/client';
import { PaypackRefMeta, PaypackWebhookPayload } from '../../interfaces/IWallet';

const PAYPACK_BASE = 'https://payments.paypack.rw/api';
const PAYPACK_ENV = process.env.PAYPACK_ENVIRONMENT || 'production';

// Paypack ref TTL: 30 minutes for the user to approve on their phone.
const PAYPACK_REF_TTL_SECONDS = 30 * 60;
// Direct purchase token TTL: 15 minutes to complete download after approval.
const DIRECT_PURCHASE_TTL_SECONDS = 15 * 60;

// ── Paypack auth token cache ──
// Avoids a round-trip auth call on every cashin/verify.
let cachedToken: { access: string; expiresAt: number } | null = null;

const getPaypackToken = async (): Promise<string> => {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.access;
  }

  const res = await fetch(`${PAYPACK_BASE}/auth/agents/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.PAYPACK_CLIENT_ID,
      client_secret: process.env.PAYPACK_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    throw new ApiError(502, 'PAYPACK_AUTH_ERROR', 'Failed to authenticate with Paypack.');
  }

  const data = await res.json() as { access: string; refresh: string };
  // Cache for 50 minutes (buffer against typical 1-hour token lifetime).
  cachedToken = { access: data.access, expiresAt: Date.now() + 50 * 60 * 1000 };
  return data.access;
};

/**
 * Initiates a Paypack CASHIN. Sends a USSD push to the user's phone.
 * Returns the transaction ref — stored in Redis so the webhook can
 * identify the user and action when Paypack calls back.
 */
const initiatePaypackCashin = async (phone: string, amount: number): Promise<string> => {
  const token = await getPaypackToken();

  const res = await fetch(`${PAYPACK_BASE}/transactions/cashin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ amount, number: phone, environment: PAYPACK_ENV }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Paypack cashin error:', err);
    throw new ApiError(
      502,
      'PAYPACK_CASHIN_ERROR',
      'Failed to initiate mobile money payment. Please check the phone number and try again.',
    );
  }

  const data = await res.json() as { ref: string; status: string };
  return data.ref;
};

/**
 * Re-verifies a transaction directly with Paypack API before crediting the wallet.
 * This is the security layer — prevents fake webhook payloads from crediting accounts.
 */
const verifyPaypackTransaction = async (ref: string): Promise<boolean> => {
  try {
    const token = await getPaypackToken();
    const res = await fetch(`${PAYPACK_BASE}/transactions/find/${ref}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    });
    if (!res.ok) return false;
    const tx = await res.json() as { status: string };
    return tx.status === 'successful';
  } catch {
    return false;
  }
};

// ── Public service functions ──

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
 * Wallet top-up: initiates a Paypack CASHIN for a fixed package amount.
 * User receives a USSD push on their phone to approve.
 */
export const initiateTopUp = async (
  userId: string,
  packageId: string,
  phoneNumber: string,
) => {
  const pkg = await prisma.walletPackage.findUnique({ where: { id: packageId } });
  if (!pkg || !pkg.isActive) {
    throw new ApiError(404, 'PACKAGE_NOT_FOUND', 'This top-up package is not available.');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const amount = Number(pkg.amount);
  const ref = await initiatePaypackCashin(phoneNumber, amount);

  // Store ref → user/package mapping so the webhook knows what to process.
  const meta: PaypackRefMeta = { userId, type: 'TOP_UP', packageId };
  await redis.set(redisKeys.paypackRef(ref), JSON.stringify(meta), 'EX', PAYPACK_REF_TTL_SECONDS);

  return {
    ref,
    status: 'pending',
    amount,
    message: 'Check your phone and approve the payment to complete the top-up.',
  };
};

/**
 * Direct pay: initiates a Paypack CASHIN for the exact price of one template.
 * No wallet balance is modified — on webhook success, a one-time download
 * token is granted in Redis instead.
 */
export const initiateDirectPay = async (
  userId: string,
  templateId: string,
  phoneNumber: string,
) => {
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template || !template.isActive) {
    throw new ApiError(404, 'TEMPLATE_NOT_FOUND', 'Template not found.');
  }

  const pricing = await prisma.pricingTier.findUnique({
    where: { templateClass: template.templateClass },
  });
  if (!pricing) {
    throw new ApiError(500, 'PRICING_NOT_CONFIGURED', "This template's class has no price configured.");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const amount = Number(pricing.price);
  const ref = await initiatePaypackCashin(phoneNumber, amount);

  const meta: PaypackRefMeta = { userId, type: 'DIRECT_PURCHASE', templateId };
  await redis.set(redisKeys.paypackRef(ref), JSON.stringify(meta), 'EX', PAYPACK_REF_TTL_SECONDS);

  return {
    ref,
    status: 'pending',
    amount,
    templateTitle: template.title,
    message: 'Check your phone and approve the payment. Then retry the download.',
  };
};

// ──────────────────────────────────────────────
// Webhook handler — called by Paypack on every transaction:processed event.
// Fires for both successful AND failed transactions.
// The ONLY place allowed to modify walletBalance or grant download tokens.
// ──────────────────────────────────────────────

export const handlePaypackWebhook = async (payload: PaypackWebhookPayload) => {
  // We only initiate CASHIN — ignore anything else.
  if (payload.data.kind !== 'CASHIN') return;

  const { ref, status } = payload.data;

  // Clean up Redis for failed transactions and stop processing.
  if (status === 'failed') {
    await redis.del(redisKeys.paypackRef(ref));
    return;
  }

  if (status !== 'successful') return;

  // Re-verify directly with Paypack API — prevents fake webhook spoofing.
  const isVerified = await verifyPaypackTransaction(ref);
  if (!isVerified) {
    console.error(`Paypack webhook: ref ${ref} failed re-verification. Ignoring.`);
    return;
  }

  // Look up what this transaction was for.
  const stored = await redis.get(redisKeys.paypackRef(ref));
  if (!stored) {
    // Already processed (idempotent second delivery) or unknown ref.
    return;
  }

  const meta = JSON.parse(stored) as PaypackRefMeta;
  // Consume immediately to prevent duplicate processing on retry.
  await redis.del(redisKeys.paypackRef(ref));

  if (meta.type === 'TOP_UP' && meta.packageId) {
    await processTopUp(meta.userId, ref, payload.data.amount);
  } else if (meta.type === 'DIRECT_PURCHASE' && meta.templateId) {
    await processDirectPurchase(meta.userId, meta.templateId, ref, payload.data.amount);
  }
};

const processTopUp = async (
  userId: string,
  ref: string,
  amount: number,
) => {
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
        paymentRef: ref,
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

const processDirectPurchase = async (
  userId: string,
  templateId: string,
  ref: string,
  amount: number,
) => {
  // Grant a one-time download token — balance is not modified for direct purchases.
  await redis.set(
    redisKeys.directPurchaseToken(userId, templateId),
    ref,
    'EX',
    DIRECT_PURCHASE_TTL_SECONDS,
  );

  // Log for audit trail — balance unchanged, so balanceAfter = current balance.
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    await prisma.walletTransaction.create({
      data: {
        userId,
        type: 'DOWNLOAD_DEDUCTION',
        amount,
        balanceAfter: user.walletBalance,
        templateId,
        paymentRef: ref,
      },
    });
  }
};