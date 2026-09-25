import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';

export const templateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * GET /templates
   * Lists all follow-up templates for the authenticated user.
   */
  fastify.get('/', async (request) => {
    const templates = await prisma.followUpTemplate.findMany({
      where: { userId: request.user!.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return { templates };
  });

  /**
   * POST /templates
   * Creates a new follow-up template.
   */
  fastify.post('/', async (request, reply) => {
    const bodySchema = z.object({
      name: z.string().min(1, 'Template name is required'),
      subject: z.string().min(1, 'Subject is required'),
      body: z.string().min(1, 'Body is required'),
      isDefault: z.boolean().optional().default(false),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { name, subject, body, isDefault } = parsed.data;

    // If setting as default, unset existing defaults first
    if (isDefault) {
      await prisma.followUpTemplate.updateMany({
        where: { userId: request.user!.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.followUpTemplate.create({
      data: {
        userId: request.user!.id,
        name,
        subject,
        body,
        isDefault,
      },
    });

    return reply.status(201).send({ template });
  });

  /**
   * PATCH /templates/:id
   * Updates an existing follow-up template.
   */
  fastify.patch('/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string() });
    const { id } = paramsSchema.parse(request.params);

    const bodySchema = z.object({
      name: z.string().min(1).optional(),
      subject: z.string().min(1).optional(),
      body: z.string().min(1).optional(),
      isDefault: z.boolean().optional(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const existing = await prisma.followUpTemplate.findFirst({
      where: { id, userId: request.user!.id },
    });

    if (!existing) {
      return reply.status(404).send({ error: 'Template not found' });
    }

    if (parsed.data.isDefault) {
      await prisma.followUpTemplate.updateMany({
        where: { userId: request.user!.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.followUpTemplate.update({
      where: { id },
      data: parsed.data,
    });

    return { template: updated };
  });

  /**
   * DELETE /templates/:id
   * Deletes a template.
   */
  fastify.delete('/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string() });
    const { id } = paramsSchema.parse(request.params);

    const existing = await prisma.followUpTemplate.findFirst({
      where: { id, userId: request.user!.id },
    });

    if (!existing) {
      return reply.status(404).send({ error: 'Template not found' });
    }

    await prisma.followUpTemplate.delete({
      where: { id },
    });

    return { success: true };
  });

  /**
   * POST /templates/:id/set-default
   * Marks a template as the user's default template.
   */
  fastify.post('/:id/set-default', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string() });
    const { id } = paramsSchema.parse(request.params);

    const existing = await prisma.followUpTemplate.findFirst({
      where: { id, userId: request.user!.id },
    });

    if (!existing) {
      return reply.status(404).send({ error: 'Template not found' });
    }

    await prisma.followUpTemplate.updateMany({
      where: { userId: request.user!.id, isDefault: true },
      data: { isDefault: false },
    });

    const updated = await prisma.followUpTemplate.update({
      where: { id },
      data: { isDefault: true },
    });

    return { success: true, template: updated };
  });
};
