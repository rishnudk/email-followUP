import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { GoogleService } from './google.service';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { DEFAULT_TEMPLATES } from '../../lib/constants';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Initiates Google OAuth flow by redirecting the user to Google
   */
  fastify.get('/google', async (_request, reply) => {
    try {
      const authUrl = GoogleService.getAuthUrl();
      return reply.redirect(authUrl);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: err.message || 'Failed to initiate Google OAuth' });
    }
  });

  /**
   * Dev-mode one-click login for local UI testing
   */
  fastify.get('/dev-login', async (_request, reply) => {
    let demoUser = await prisma.user.findFirst({ where: { email: 'demo@example.com' } });
    if (!demoUser) {
      demoUser = await prisma.user.create({
        data: {
          email: 'demo@example.com',
          name: 'Demo User',
          autoTrackSentEmails: true,
          autoEnableFollowUp: true,
          createAsDraft: true,
        },
      });
    }

    reply.setCookie('session', demoUser.id, {
      path: '/',
      httpOnly: true,
      signed: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return reply.redirect(`${env.WEB_URL}?auth=success`);
  });

  /**
   * Handles Google OAuth callback redirect
   */
  fastify.get('/google/callback', async (request, reply) => {
    const querySchema = z.object({
      code: z.string().optional(),
      error: z.string().optional(),
    });

    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success || !parsed.data.code) {
      const errorMessage = parsed.success && parsed.data.error ? parsed.data.error : 'Invalid OAuth callback';
      return reply.redirect(`${env.WEB_URL}?auth_error=${encodeURIComponent(errorMessage)}`);
    }

    try {
      const { user } = await GoogleService.handleCallback(parsed.data.code);

      // Check if user has any templates; if not, populate with default templates
      const templateCount = await prisma.followUpTemplate.count({
        where: { userId: user.id },
      });

      if (templateCount === 0) {
        await prisma.followUpTemplate.createMany({
          data: DEFAULT_TEMPLATES.map((tmpl) => ({
            userId: user.id,
            name: tmpl.name,
            subject: tmpl.subject,
            body: tmpl.body,
            isDefault: tmpl.isDefault,
          })),
        });
      }

      // Set signed session cookie (valid for 30 days)
      reply.setCookie('session', user.id, {
        path: '/',
        httpOnly: true,
        signed: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return reply.redirect(`${env.WEB_URL}?auth=success`);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.redirect(
        `${env.WEB_URL}?auth_error=${encodeURIComponent(err.message || 'OAuth authentication failed')}`
      );
    }
  });

  /**
   * Retrieves current authenticated user session
   */
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        timezone: true,
        autoTrackSentEmails: true,
        autoEnableFollowUp: true,
        defaultFirstFollowUpDays: true,
        defaultSecondFollowUpDays: true,
        defaultMaxFollowUps: true,
        createAsDraft: true,
        createdAt: true,
        refreshToken: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        timezone: user.timezone,
        autoTrackSentEmails: user.autoTrackSentEmails,
        autoEnableFollowUp: user.autoEnableFollowUp,
        defaultFirstFollowUpDays: user.defaultFirstFollowUpDays,
        defaultSecondFollowUpDays: user.defaultSecondFollowUpDays,
        defaultMaxFollowUps: user.defaultMaxFollowUps,
        createAsDraft: user.createAsDraft,
        googleConnected: Boolean(user.refreshToken),
        createdAt: user.createdAt,
      },
    };
  });

  /**
   * Logs out the user by clearing the session cookie
   */
  fastify.post('/logout', async (_request, reply) => {
    reply.clearCookie('session', { path: '/' });
    return { success: true };
  });
};
