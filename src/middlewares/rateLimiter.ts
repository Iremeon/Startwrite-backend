import rateLimit from 'express-rate-limit';

/**
 * General-purpose rate limiter. Defaults suit auth endpoints (login,
 * register, password reset) where brute-force protection matters most.
 */
export const rateLimiting = (customLimit?: number, windowMinutes = 15) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: customLimit || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: `Too many requests from this IP, please try again after ${windowMinutes} minutes`,
    },
  });

// Stricter limiter specifically for auth endpoints (login/register/forgot-password)
export const authRateLimiter = rateLimiting(10, 15);

// Applied globally in app.ts — a generous ceiling so normal browsing/catalog
// traffic is never affected, but scripted abuse across any endpoint is capped.
export const globalRateLimiter = rateLimiting(300, 15);

// Template downloads — generous for legitimate use, but stops scraping/bulk-download abuse.
export const downloadRateLimiter = rateLimiting(60, 15);

// Stripe checkout session creation — prevents spamming Stripe with session creates.
export const checkoutRateLimiter = rateLimiting(20, 15);

// Admin file uploads — uploads are heavier (Cloudinary streaming), keep this tighter.
export const uploadRateLimiter = rateLimiting(30, 15);
