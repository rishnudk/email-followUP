import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      name?: string | null;
    };
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const cookie = request.cookies.session;

      if (!cookie) {
        return reply.status(401).send({ error: 'Unauthorized: No session found' });
      }

      const unsigned = request.unsignCookie(cookie);
      if (!unsigned.valid || !unsigned.value) {
        return reply.status(401).send({ error: 'Unauthorized: Invalid session cookie' });
      }

      const userId = unsigned.value;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true },
      });

      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized: User not found' });
      }

      request.user = user;
    }
  );
};

export default fp(authPlugin);
