import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { FollowUpDispatcherService } from './followup-dispatcher.service';
import { cancelFollowUpJob } from '../../queues/followup.queue';
import { FollowUpStatus } from '@email-followup/shared';

export const followUpRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * GET /followups/upcoming
   * Retrieves upcoming scheduled follow-ups for the current user.
   */
  fastify.get('/upcoming', async (request) => {
    const upcoming = await prisma.emailThread.findMany({
      where: {
        userId: request.user!.id,
        followUpEnabled: true,
        nextFollowUpAt: { not: null },
      },
      orderBy: { nextFollowUpAt: 'asc' },
      take: 20,
      include: {
        followUps: {
          where: { status: FollowUpStatus.SCHEDULED },
        },
      },
    });

    return { upcoming };
  });

  /**
   * POST /followups/:threadId/send-now
   * Manually sends the next follow-up immediately.
   */
  fastify.post('/:threadId/send-now', async (request, reply) => {
    const paramsSchema = z.object({ threadId: z.string() });
    const { threadId } = paramsSchema.parse(request.params);

    const thread = await prisma.emailThread.findFirst({
      where: { id: threadId, userId: request.user!.id },
    });

    if (!thread) {
      return reply.status(404).send({ error: 'Email thread not found' });
    }

    const nextAttempt = thread.followUpCount + 1;
    if (nextAttempt > thread.maxFollowUps) {
      return reply.status(400).send({
        error: `Maximum follow-up limit (${thread.maxFollowUps}) already reached.`,
      });
    }

    // Cancel any delayed job queued for this attempt
    await cancelFollowUpJob(thread.id, nextAttempt);

    // Dispatch immediately
    const result = await FollowUpDispatcherService.dispatchFollowUp(thread.id, nextAttempt);

    return { success: true, result };
  });
};
