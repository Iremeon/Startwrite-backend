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

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

const sendEmail = async ({ to, subject, html }: SendEmailOptions): Promise<void> => {
  try {
    await sgMail.send({ to, from: FROM_EMAIL, subject, html });
  } catch (error) {
    console.error('Failed to send email:', error);
  }
};

export const registerMailerListeners = (): void => {
  appEvents.on(AppEvent.USER_REGISTERED, async (payload: UserRegisteredPayload) => {
    await sendEmail({
      to: payload.email,
      subject: 'Your Startwrite verification code',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Verify your email</h2>
          <p>Hi ${payload.name},</p>
          <p>Welcome to Startwrite! Enter the code below to verify your email address:</p>
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px;
                      text-align: center; padding: 24px; background: #f4f4f4;
                      border-radius: 8px; margin: 24px 0;">
            ${payload.code}
          </div>
          <p style="color: #666; font-size: 14px;">
            This code expires in <strong>10 minutes</strong>.
            If you didn't create a Startwrite account, you can safely ignore this email.
          </p>
        </div>`,
    });
  });

  appEvents.on(
    AppEvent.PASSWORD_RESET_REQUESTED,
    async (payload: PasswordResetRequestedPayload) => {
      await sendEmail({
        to: payload.email,
        subject: 'Your Startwrite password reset code',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Reset your password</h2>
            <p>Hi ${payload.name},</p>
            <p>Use the code below to reset your Startwrite password:</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px;
                        text-align: center; padding: 24px; background: #f4f4f4;
                        border-radius: 8px; margin: 24px 0;">
              ${payload.code}
            </div>
            <p style="color: #666; font-size: 14px;">
              This code expires in <strong>10 minutes</strong>.
              If you didn't request a password reset, you can safely ignore this email.
            </p>
          </div>`,
      });
    },
  );

  appEvents.on(AppEvent.WALLET_TOPPED_UP, async (payload: WalletToppedUpPayload) => {
    await sendEmail({
      to: payload.email,
      subject: 'Your Startwrite wallet has been topped up',
      html: `<p>Hi ${payload.name},</p>
             <p>Your wallet has been credited with <strong>${payload.amount} RWF</strong>. 
             Your new balance is <strong>${payload.newBalance} RWF</strong>.</p>`,
    });
  });
};