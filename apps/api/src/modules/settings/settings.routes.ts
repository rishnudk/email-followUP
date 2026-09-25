import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { EmailStatus } from '@email-followup/shared';

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * GET /settings
   * Retrieves user follow-up automation settings.
   */
  fastify.get('/settings', async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        timezone: true,
        defaultFirstFollowUpDays: true,
        defaultSecondFollowUpDays: true,
        defaultMaxFollowUps: true,
        autoTrackSentEmails: true,
        autoEnableFollowUp: true,
        createAsDraft: true,
        lastSyncAt: true,
      },
    });

    return { settings: user };
  });

  /**
   * PATCH /settings
   * Updates user follow-up automation settings.
   */
  fastify.patch('/settings', async (request, reply) => {
    const bodySchema = z.object({
      defaultFirstFollowUpDays: z.number().int().min(1).max(30).optional(),
      defaultSecondFollowUpDays: z.number().int().min(1).max(30).optional(),
      defaultMaxFollowUps: z.number().int().min(1).max(10).optional(),
      autoTrackSentEmails: z.boolean().optional(),
      autoEnableFollowUp: z.boolean().optional(),
      createAsDraft: z.boolean().optional(),
      timezone: z.string().min(1).optional(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const updated = await prisma.user.update({
      where: { id: request.user!.id },
      data: parsed.data,
      select: {
        id: true,
        email: true,
        name: true,
        timezone: true,
        defaultFirstFollowUpDays: true,
        defaultSecondFollowUpDays: true,
        defaultMaxFollowUps: true,
        autoTrackSentEmails: true,
        autoEnableFollowUp: true,
        createAsDraft: true,
      },
    });

    return { settings: updated };
  });

  /**
   * GET /dashboard/stats
   * Computes aggregate metrics for the dashboard summary cards.
   */
  fastify.get('/dashboard/stats', async (request) => {
    const userId = request.user!.id;
    const now = new Date();
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [sentCount, waitingCount, repliedCount, bouncedCount, dueSoonCount] = await Promise.all([
      prisma.emailThread.count({ where: { userId } }),
      prisma.emailThread.count({ where: { userId, status: EmailStatus.WAITING } }),
      prisma.emailThread.count({ where: { userId, status: EmailStatus.REPLIED } }),
      prisma.emailThread.count({ where: { userId, status: EmailStatus.BOUNCED } }),
      prisma.emailThread.count({
        where: {
          userId,
          status: EmailStatus.WAITING,
          followUpEnabled: true,
          nextFollowUpAt: {
            gte: now,
            lte: next24Hours,
          },
        },
      }),
    ]);

    return {
      stats: {
        sentCount,
        waitingCount,
        repliedCount,
        bouncedCount,
        dueSoonCount,
      },
    };
  });
};
