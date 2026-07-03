import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL as string);

redis.on('error', err => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Redis connected');
});

// ── Key helpers — keep naming consistent across the app ──

export const redisKeys = {
  emailVerification: (token: string) => `email-verify:${token}`,
  passwordReset: (token: string) => `password-reset:${token}`,
  refreshToken: (userId: string, tokenId: string) => `refresh:${userId}:${tokenId}`,
  refreshTokenIndex: (userId: string) => `refresh:${userId}:*`,
  // Granted after a successful direct-pay Stripe checkout — one-time use, 15min TTL.
  directPurchaseToken: (userId: string, templateId: string) =>
    `direct-purchase:${userId}:${templateId}`,
};

export default redis;