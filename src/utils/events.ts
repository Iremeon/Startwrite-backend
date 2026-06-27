import { EventEmitter } from 'events';

export enum AppEvent {
  USER_REGISTERED = 'user.registered',
  PASSWORD_RESET_REQUESTED = 'password.reset.requested',
  WALLET_TOPPED_UP = 'wallet.topped_up',
}

export interface UserRegisteredPayload {
  email: string;
  name: string;
  verificationToken: string;
}

export interface PasswordResetRequestedPayload {
  email: string;
  name: string;
  resetToken: string;
}

export interface WalletToppedUpPayload {
  email: string;
  name: string;
  amount: number | string;
  newBalance: number | string;
}

// Single shared emitter for the whole app. Listeners are registered once,
// in src/utils/mailer.ts, when the app boots.
export const appEvents = new EventEmitter();
