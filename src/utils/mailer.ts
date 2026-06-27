import sgMail from '@sendgrid/mail';
import {
  appEvents,
  AppEvent,
  UserRegisteredPayload,
  PasswordResetRequestedPayload,
  WalletToppedUpPayload,
} from './events';

sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL as string;
const FRONTEND_URL = process.env.FRONTEND_URL as string;

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

const sendEmail = async ({ to, subject, html }: SendEmailOptions): Promise<void> => {
  try {
    await sgMail.send({ to, from: FROM_EMAIL, subject, html });
  } catch (error) {
    // Email failures should never crash the request that triggered them.
    // Log and move on — consider a retry queue if this becomes frequent.
    console.error('Failed to send email:', error);
  }
};

// ── Listeners — registered once at app boot (see src/app.ts) ──

export const registerMailerListeners = (): void => {
  appEvents.on(AppEvent.USER_REGISTERED, async (payload: UserRegisteredPayload) => {
    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${payload.verificationToken}`;
    await sendEmail({
      to: payload.email,
      subject: 'Verify your Startwrite account',
      html: `<p>Hi ${payload.name},</p>
             <p>Welcome to Startwrite! Please verify your email to activate your account:</p>
             <p><a href="${verifyUrl}">Verify my email</a></p>
             <p>This link expires in 24 hours.</p>`,
    });
  });

  appEvents.on(
    AppEvent.PASSWORD_RESET_REQUESTED,
    async (payload: PasswordResetRequestedPayload) => {
      const resetUrl = `${FRONTEND_URL}/reset-password?token=${payload.resetToken}`;
      await sendEmail({
        to: payload.email,
        subject: 'Reset your Startwrite password',
        html: `<p>Hi ${payload.name},</p>
             <p>We received a request to reset your password. Click below to set a new one:</p>
             <p><a href="${resetUrl}">Reset my password</a></p>
             <p>If you didn't request this, you can safely ignore this email. This link expires in 1 hour.</p>`,
      });
    },
  );

  appEvents.on(AppEvent.WALLET_TOPPED_UP, async (payload: WalletToppedUpPayload) => {
    await sendEmail({
      to: payload.email,
      subject: 'Your Startwrite wallet has been topped up',
      html: `<p>Hi ${payload.name},</p>
             <p>We've added <strong>$${payload.amount}</strong> to your wallet. Your new balance is <strong>$${payload.newBalance}</strong>.</p>`,
    });
  });
};
