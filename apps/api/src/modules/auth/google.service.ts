import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { encrypt, decrypt } from '../../lib/crypto';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

export class GoogleService {
  private static createOAuthClient(): OAuth2Client {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new Error(
        'Google OAuth credentials are missing. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env'
      );
    }

    return new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Generates the Google OAuth2 consent URL.
   * Forces offline access and consent prompt to ensure a refresh_token is always returned.
   */
  static getAuthUrl(): string {
    const client = this.createOAuthClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GMAIL_SCOPES,
      include_granted_scopes: true,
    });
  }

  /**
   * Exchanges an authorization code for access and refresh tokens,
   * retrieves the user's profile, and persists the user into the database.
   */
  static async handleCallback(code: string) {
    const client = this.createOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.email) {
      throw new Error('Failed to retrieve user email from Google');
    }

    // Encrypt tokens before storing at rest
    const encryptedRefreshToken = tokens.refresh_token
      ? encrypt(tokens.refresh_token)
      : undefined;

    const encryptedAccessToken = tokens.access_token
      ? encrypt(tokens.access_token)
      : undefined;

    const expiryDate = tokens.expiry_date ? new Date(tokens.expiry_date) : undefined;

    // Upsert user in the database
    const user = await prisma.user.upsert({
      where: { email: profile.email },
      update: {
        name: profile.name || undefined,
        googleId: profile.id || undefined,
        accessToken: encryptedAccessToken,
        ...(encryptedRefreshToken ? { refreshToken: encryptedRefreshToken } : {}),
        tokenExpiry: expiryDate,
      },
      create: {
        email: profile.email,
        name: profile.name || undefined,
        googleId: profile.id || undefined,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiry: expiryDate,
      },
    });

    return { user, profile };
  }

  /**
   * Returns an authenticated OAuth2Client for a given user.
   * Automatically refreshes expired access tokens and updates the database.
   */
  static async getAuthenticatedClient(userId: string): Promise<OAuth2Client> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshToken) {
      throw new Error(`User ${userId} does not have a connected Google account with a refresh token.`);
    }

    const client = this.createOAuthClient();
    const plainRefreshToken = decrypt(user.refreshToken);
    const plainAccessToken = user.accessToken ? decrypt(user.accessToken) : undefined;

    client.setCredentials({
      refresh_token: plainRefreshToken,
      access_token: plainAccessToken,
      expiry_date: user.tokenExpiry ? user.tokenExpiry.getTime() : undefined,
    });

    // Auto-update database whenever tokens are refreshed
    client.on('tokens', async (newTokens) => {
      const updates: {
        accessToken?: string;
        tokenExpiry?: Date;
        refreshToken?: string;
      } = {};

      if (newTokens.access_token) {
        updates.accessToken = encrypt(newTokens.access_token);
      }
      if (newTokens.expiry_date) {
        updates.tokenExpiry = new Date(newTokens.expiry_date);
      }
      if (newTokens.refresh_token) {
        updates.refreshToken = encrypt(newTokens.refresh_token);
      }

      await prisma.user.update({
        where: { id: userId },
        data: updates,
      });
    });

    return client;
  }
}
