import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { EmailSyncService } from './email-sync.service';
import { EmailStatus } from '@email-followup/shared';

export const emailRoutes: FastifyPluginAsync = async (fastify) => {
  // All email routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * POST /emails/sync
   * Manually triggers a Gmail sent-email sync for the current user.
   */
  fastify.post('/sync', async (request, reply) => {
    try {
      const stats = await EmailSyncService.syncSentEmailsForUser(request.user!.id);
      return { success: true, stats };
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({
        error: err.message || 'Failed to sync sent emails from Gmail',
      });
    }
  });

  /**
   * GET /emails
   * Lists email threads with optional status filter and pagination.
   */
  fastify.get('/', async (request) => {
    const querySchema = z.object({
      status: z.nativeEnum(EmailStatus).optional(),
      page: z.string().default('1').transform((v) => Math.max(1, parseInt(v, 10))),
      limit: z.string().default('20').transform((v) => Math.min(100, Math.max(1, parseInt(v, 10)))),
    });

    const query = querySchema.parse(request.query);
    const skip = (query.page - 1) * query.limit;

    const where = {
      userId: request.user!.id,
      ...(query.status ? { status: query.status } : {}),
    };

    const [threads, totalCount] = await Promise.all([
      prisma.emailThread.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip,
        take: query.limit,
        include: {
          messages: {
            orderBy: { sentAt: 'asc' },
            take: 1, // First message snippet
          },
          followUps: {
            orderBy: { attempt: 'asc' },
          },
        },
      }),
      prisma.emailThread.count({ where }),
    ]);

    return {
      threads,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalCount,
        totalPages: Math.ceil(totalCount / query.limit),
      },
    };
  });

  /**
   * GET /emails/:id
   * Retrieves full details of a specific thread including all messages and follow-up attempts.
   */
  fastify.get('/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string() });
    const { id } = paramsSchema.parse(request.params);

    const thread = await prisma.emailThread.findFirst({
      where: {
        id,
        userId: request.user!.id,
      },
      include: {
        messages: {
          orderBy: { sentAt: 'asc' },
        },
        followUps: {
          orderBy: { attempt: 'asc' },
        },
      },
    });

    if (!thread) {
      return reply.status(404).send({ error: 'Email thread not found' });
    }

    return { thread };
  });

  /**
   * POST /emails/:id/enable
   * Enables automated follow-up for a thread and calculates nextFollowUpAt if not set.
   */
  fastify.post('/:id/enable', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string() });
    const { id } = paramsSchema.parse(request.params);

    const thread = await prisma.emailThread.findFirst({
      where: { id, userId: request.user!.id },
    });

    if (!thread) {
      return reply.status(404).send({ error: 'Email thread not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
    });

    const nextFollowUpAt = thread.nextFollowUpAt ||
      new Date(Date.now() + (user?.defaultFirstFollowUpDays || 3) * 24 * 60 * 60 * 1000);

    const updated = await prisma.emailThread.update({
      where: { id },
      data: {
        followUpEnabled: true,
        status: thread.status === EmailStatus.STOPPED ? EmailStatus.WAITING : thread.status,
        nextFollowUpAt,
      },
    });

    return { success: true, thread: updated };
  });

  /**
   * POST /emails/:id/disable
   * Disables automated follow-up for a thread.
   */
  fastify.post('/:id/disable', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string() });
    const { id } = paramsSchema.parse(request.params);

    const thread = await prisma.emailThread.findFirst({
      where: { id, userId: request.user!.id },
    });

    if (!thread) {
      return reply.status(404).send({ error: 'Email thread not found' });
    }

    const updated = await prisma.emailThread.update({
      where: { id },
      data: { followUpEnabled: false },
    });

    return { success: true, thread: updated };
  });

  /**
   * POST /emails/:id/stop
   * Permanently stops follow-ups and marks thread status as STOPPED.
   */
  fastify.post('/:id/stop', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string() });
    const { id } = paramsSchema.parse(request.params);

    const thread = await prisma.emailThread.findFirst({
      where: { id, userId: request.user!.id },
    });

    if (!thread) {
      return reply.status(404).send({ error: 'Email thread not found' });
    }

    const updated = await prisma.emailThread.update({
      where: { id },
      data: {
        followUpEnabled: false,
        status: EmailStatus.STOPPED,
        nextFollowUpAt: null,
      },
    });

    return { success: true, thread: updated };
  });
};
