import { EventEmitter } from 'events';

export enum AppEvent {
  USER_REGISTERED = 'user.registered',
  PASSWORD_RESET_REQUESTED = 'password.reset.requested',
  WALLET_TOPPED_UP = 'wallet.topped_up',
}

export interface UserRegisteredPayload {
  email: string;
  name: string;
  code: string; // 6-digit OTP
}

export interface PasswordResetRequestedPayload {
  email: string;
  name: string;
  code: string; // 6-digit OTP
}

export interface WalletToppedUpPayload {
  email: string;
  name: string;
  amount: number | string;
  newBalance: number | string;
}

export const appEvents = new EventEmitter();