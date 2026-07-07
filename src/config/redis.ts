import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL as string);

redis.on('error', err => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Redis connected');
});

export const redisKeys = {
  emailVerification: (token: string) => `email-verify:${token}`,
  passwordReset: (token: string) => `password-reset:${token}`,
  refreshToken: (userId: string, tokenId: string) => `refresh:${userId}:${tokenId}`,
  refreshTokenIndex: (userId: string) => `refresh:${userId}:*`,
  directPurchaseToken: (userId: string, templateId: string) =>
    `direct-purchase:${userId}:${templateId}`,
  // Maps a Paypack transaction ref → { userId, type, packageId?, templateId? }
  // so the webhook knows what to do when Paypack calls back.
  paypackRef: (ref: string) => `paypack:ref:${ref}`,
};

export default redis;