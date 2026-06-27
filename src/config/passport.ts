import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface GoogleProfile {
  googleId: string;
  email: string;
  fullName: string;
  emailVerified: boolean;
}

/**
 * Verifies a Google ID token sent by the frontend (popup/SPA flow) and
 * extracts the profile fields we need to find-or-create a user.
 * This is the recommended flow per the implementation doc — simpler than
 * a server-side redirect, and works identically for web and mobile clients.
 */
export const verifyGoogleIdToken = async (idToken: string): Promise<GoogleProfile> => {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new Error('Invalid Google ID token payload');
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    fullName: payload.name || payload.email.split('@')[0],
    emailVerified: payload.email_verified ?? false,
  };
};
