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
  generateOtpCode,
  AppJwtPayload,
} from '../../utils/helper';
import { verifyGoogleIdToken } from '../../config/passport';
import { IRegisterUser } from '../../interfaces/IAuth';
import crypto from 'crypto';

const EMAIL_VERIFICATION_TTL = Number(process.env.OTP_TTL_SECONDS) || 600; // 10 minutes
const PASSWORD_RESET_TTL = Number(process.env.OTP_TTL_SECONDS) || 600;     // 10 minutes
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const buildJwtPayload = (user: {
  id: string;
  email: string;
  role: string;
}): AppJwtPayload => ({
  id: user.id,
  email: user.email,
  role: user.role as 'user' | 'admin',
});

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

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, name: input.name, phoneNumber: input.phoneNumber, tinNumber: input.tinNumber },
      })
    : await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          phoneNumber: input.phoneNumber,
          tinNumber: input.tinNumber,
          authProvider: 'local',
          isEmailVerified: false,
        },
      });

  // Always issue a 6-digit OTP — no exceptions.
  const code = generateOtpCode();
  await redis.set(
    redisKeys.emailVerificationCode(user.email),
    code,
    'EX',
    EMAIL_VERIFICATION_TTL,
  );

  appEvents.emit(AppEvent.USER_REGISTERED, {
    email: user.email,
    name: user.name,
    code,
  });

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

  if (!user.isEmailVerified) {
    throw new ApiError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Please verify your email before logging in. Check your inbox for the 6-digit code.',
    );
  }

  const tokens = await issueTokenPair(user);
  return { user, ...tokens };
};

export const loginOrRegisterWithGoogle = async (idToken: string) => {
  const profile = await verifyGoogleIdToken(idToken);

  let user = await prisma.user.findUnique({ where: { email: profile.email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: profile.fullName,
        email: profile.email,
        authProvider: 'google',
        isEmailVerified: true,
      },
    });
  } else if (!user.isEmailVerified) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true },
    });
  }

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

  await redis.del(redisKeys.refreshToken(decoded.id, tokenId));
  return issueTokenPair(user);
};

export const logoutUser = async (userId: string, refreshToken: string) => {
  const tokenId = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await redis.del(redisKeys.refreshToken(userId, tokenId));
};

export const verifyEmail = async (email: string, code: string) => {
  const stored = await redis.get(redisKeys.emailVerificationCode(email));
  if (!stored || stored !== code) {
    throw new ApiError(
      400,
      'INVALID_OR_EXPIRED_CODE',
      'The verification code is incorrect or has expired. Request a new one.',
    );
  }

  await prisma.user.update({ where: { email }, data: { isEmailVerified: true } });
  await redis.del(redisKeys.emailVerificationCode(email));
};

export const resendVerificationCode = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // Don't leak whether the email exists

  if (user.isEmailVerified) {
    throw new ApiError(400, 'ALREADY_VERIFIED', 'This email is already verified.');
  }

  const code = generateOtpCode();
  await redis.set(
    redisKeys.emailVerificationCode(email),
    code,
    'EX',
    EMAIL_VERIFICATION_TTL,
  );

  appEvents.emit(AppEvent.USER_REGISTERED, {
    email: user.email,
    name: user.name,
    code,
  });
};

export const requestPasswordReset = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // Don't leak whether the email exists

  const code = generateOtpCode();
  await redis.set(
    redisKeys.passwordResetCode(email),
    code,
    'EX',
    PASSWORD_RESET_TTL,
  );

  appEvents.emit(AppEvent.PASSWORD_RESET_REQUESTED, {
    email: user.email,
    name: user.name,
    code,
  });
};

export const verifyResetCode = async (email: string, code: string): Promise<void> => {
  const stored = await redis.get(redisKeys.passwordResetCode(email));
  if (!stored || stored !== code) {
    throw new ApiError(
      400,
      'INVALID_OR_EXPIRED_CODE',
      'The reset code is incorrect or has expired. Request a new one.',
    );
  }
  // Intentionally does NOT delete — only verify-reset-code checks without consuming.
};

export const resetPassword = async (email: string, code: string, newPassword: string) => {
  const stored = await redis.get(redisKeys.passwordResetCode(email));
  if (!stored || stored !== code) {
    throw new ApiError(
      400,
      'INVALID_OR_EXPIRED_CODE',
      'The reset code is incorrect or has expired. Request a new one.',
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await redis.del(redisKeys.passwordResetCode(email));
};