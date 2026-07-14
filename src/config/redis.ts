import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL as string);

redis.on('error', err => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Redis connected');
});

export const redisKeys = {
  // OTP codes — keyed by email so the verify endpoint only needs email + code,
  // no long token string for the user to copy.
  emailVerificationCode: (email: string) => `email-verify:${email}`,
  passwordResetCode: (email: string) => `password-reset:${email}`,

  refreshToken: (userId: string, tokenId: string) => `refresh:${userId}:${tokenId}`,
  refreshTokenIndex: (userId: string) => `refresh:${userId}:*`,
  directPurchaseToken: (userId: string, templateId: string) =>
    `direct-purchase:${userId}:${templateId}`,
  paypackRef: (ref: string) => `paypack:ref:${ref}`,
};

export default redis;