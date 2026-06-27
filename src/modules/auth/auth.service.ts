import prisma from '../../config/db';
import redis, { redisKeys } from '../../config/redis';
import { ApiError } from '../../utils/ApiError';
import { appEvents, AppEvent } from '../../utils/events';
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  generateSecureToken,
  AppJwtPayload,
} from '../../utils/helper';
import { verifyGoogleIdToken } from '../../config/passport';
import { IRegisterUser } from '../../interfaces/IAuth';
import crypto from 'crypto';

const EMAIL_VERIFICATION_TTL = Number(process.env.EMAIL_VERIFICATION_TOKEN_TTL_SECONDS) || 86400;
const PASSWORD_RESET_TTL = Number(process.env.PASSWORD_RESET_TOKEN_TTL_SECONDS) || 3600;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // matches JWT_REFRESH_EXPIRES_IN default

const buildJwtPayload = (user: { id: string; email: string; role: string }): AppJwtPayload => ({
  id: user.id,
  email: user.email,
  role: user.role as 'user' | 'admin',
});

/** Issues access + refresh tokens, and stores the refresh token in Redis (revocable on logout). */
const issueTokenPair = async (user: { id: string; email: string; role: string }) => {
  const accessToken = signAccessToken(buildJwtPayload(user));
  const refreshToken = signRefreshToken({ id: user.id });

  const tokenId = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await redis.set(
    redisKeys.refreshToken(user.id, tokenId),
    refreshToken,
    'EX',
    REFRESH_TOKEN_TTL_SECONDS,
  );

  return { accessToken, refreshToken };
};

export const registerUser = async (input: IRegisterUser) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });

  if (existing && existing.passwordHash) {
    throw new ApiError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
  }

  if (input.tinNumber) {
    const tinTaken = await prisma.user.findUnique({ where: { tinNumber: input.tinNumber } });
    if (tinTaken) {
      throw new ApiError(409, 'TIN_IN_USE', 'An account with this TIN number already exists.');
    }
  }

  const passwordHash = await hashPassword(input.password);

  // TIN provided → organization → trusted, auto-verified, no email step.
  // No TIN → individual → must verify their email (existing flow).
  const isOrganization = Boolean(input.tinNumber);

  // If a Google-only account already exists for this email, link it
  // (per the "one user, multiple login methods" design) rather than
  // creating a duplicate row.
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          name: input.name,
          phoneNumber: input.phoneNumber,
          tinNumber: input.tinNumber,
          isEmailVerified: existing.isEmailVerified || isOrganization,
        },
      })
    : await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          phoneNumber: input.phoneNumber,
          tinNumber: input.tinNumber,
          authProvider: 'local',
          isEmailVerified: isOrganization,
        },
      });

  // Only individuals (no TIN) need the verification email — organizations
  // are trusted via their TIN and can log in immediately.
  if (!isOrganization) {
    const verificationToken = generateSecureToken();
    await redis.set(
      redisKeys.emailVerification(verificationToken),
      user.id,
      'EX',
      EMAIL_VERIFICATION_TTL,
    );

    appEvents.emit(AppEvent.USER_REGISTERED, {
      email: user.email,
      name: user.name,
      verificationToken,
    });
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isEmailVerified: user.isEmailVerified,
  };
};

export const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const isValid = await comparePassword(password, user.passwordHash);
  if (!isValid) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been disabled.');
  }

  // Hard block per the agreed verification flow — no login until verified.
  if (!user.isEmailVerified) {
    throw new ApiError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Please verify your email before logging in. Check your inbox for the verification link.',
    );
  }

  const tokens = await issueTokenPair(user);
  return { user, ...tokens };
};

export const loginOrRegisterWithGoogle = async (idToken: string) => {
  const profile = await verifyGoogleIdToken(idToken);

  let user = await prisma.user.findUnique({ where: { email: profile.email } });

  if (!user) {
    // New user via Google — auto-verified, no password set.
    user = await prisma.user.create({
      data: {
        name: profile.fullName,
        email: profile.email,
        authProvider: 'google',
        isEmailVerified: true,
      },
    });
  } else if (!user.isEmailVerified) {
    // Existing local account, not yet verified — Google's verification covers it.
    user = await prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true },
    });
  }

  // Link the OAuth identity if this is the first time signing in via Google.
  await prisma.userOAuthAccount.upsert({
    where: { provider_providerUserId: { provider: 'google', providerUserId: profile.googleId } },
    update: {},
    create: { userId: user.id, provider: 'google', providerUserId: profile.googleId },
  });

  if (!user.isActive) {
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been disabled.');
  }

  const tokens = await issueTokenPair(user);
  return { user, ...tokens };
};

export const refreshAccessToken = async (refreshToken: string) => {
  const decoded = await verifyRefreshToken(refreshToken);
  const tokenId = crypto.createHash('sha256').update(refreshToken).digest('hex');

  const stored = await redis.get(redisKeys.refreshToken(decoded.id, tokenId));
  if (!stored || stored !== refreshToken) {
    throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or revoked.');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user || !user.isActive) {
    throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or revoked.');
  }

  // Rotate: revoke the old refresh token, issue a new pair.
  await redis.del(redisKeys.refreshToken(decoded.id, tokenId));
  return issueTokenPair(user);
};

export const logoutUser = async (userId: string, refreshToken: string) => {
  const tokenId = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await redis.del(redisKeys.refreshToken(userId, tokenId));
};

export const verifyEmail = async (token: string) => {
  const userId = await redis.get(redisKeys.emailVerification(token));
  if (!userId) {
    throw new ApiError(
      400,
      'INVALID_OR_EXPIRED_TOKEN',
      'This verification link is invalid or has expired.',
    );
  }

  await prisma.user.update({ where: { id: userId }, data: { isEmailVerified: true } });
  await redis.del(redisKeys.emailVerification(token));
};

export const requestPasswordReset = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  // Don't leak whether the email exists — always respond success-shaped from the controller.
  if (!user) return;

  const resetToken = generateSecureToken();
  await redis.set(redisKeys.passwordReset(resetToken), user.id, 'EX', PASSWORD_RESET_TTL);

  appEvents.emit(AppEvent.PASSWORD_RESET_REQUESTED, {
    email: user.email,
    name: user.name,
    resetToken,
  });
};

export const verifyResetToken = async (token: string): Promise<void> => {
  const userId = await redis.get(redisKeys.passwordReset(token));
  if (!userId) {
    throw new ApiError(
      400,
      'INVALID_OR_EXPIRED_TOKEN',
      'This reset link is invalid or has expired.',
    );
  }
  // Intentionally does NOT delete the token here — only confirms it's still
  // valid so the frontend can show the "set new password" form. The token
  // is only consumed when resetPassword() below actually changes the password.
};

export const resetPassword = async (token: string, newPassword: string) => {
  const userId = await redis.get(redisKeys.passwordReset(token));
  if (!userId) {
    throw new ApiError(
      400,
      'INVALID_OR_EXPIRED_TOKEN',
      'This reset link is invalid or has expired.',
    );
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await redis.del(redisKeys.passwordReset(token));
};
