import bcrypt from 'bcryptjs';
import jwt, { JwtPayload as DefaultJwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;
const ACCESS_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN ||
  '15m') as jwt.SignOptions['expiresIn'];
const REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN ||
  '7d') as jwt.SignOptions['expiresIn'];

export interface AppJwtPayload extends DefaultJwtPayload {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

// ── Password hashing ──

export const hashPassword = async (plain: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(plain, saltRounds);
};

export const comparePassword = async (plain: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(plain, hash);
};

// ── JWT — access & refresh tokens ──

export const signAccessToken = (payload: AppJwtPayload): string => {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
};

export const signRefreshToken = (payload: Pick<AppJwtPayload, 'id'>): string => {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
};

export const verifyToken = async (token: string): Promise<AppJwtPayload> => {
  return jwt.verify(token, ACCESS_SECRET) as AppJwtPayload;
};

export const verifyRefreshToken = async (token: string): Promise<{ id: string }> => {
  return jwt.verify(token, REFRESH_SECRET) as { id: string };
};

// ── Random tokens for email verification / password reset (stored in Redis) ──

export const generateSecureToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};
