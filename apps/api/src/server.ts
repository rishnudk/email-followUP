import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { env } from './config/env';

import authPlugin from './plugins/auth.plugin';
import { authRoutes } from './modules/auth/auth.routes';
import { emailRoutes } from './modules/emails/email.routes';
import { followUpRoutes } from './modules/followups/followup.routes';
import { EmailSyncService } from './modules/emails/email-sync.service';
import { startFollowUpWorker, stopFollowUpWorker } from './workers/followup.worker';

async function bootstrap() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: [env.WEB_URL, 'http://localhost:3000'],
    credentials: true,
  });

  await app.register(cookie, {
    secret: env.SESSION_SECRET,
  });

  // Register authentication plugin
  await app.register(authPlugin);

  // Register routes
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(emailRoutes, { prefix: '/emails' });
  await app.register(followUpRoutes, { prefix: '/followups' });

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`🚀 API server running on port ${env.PORT}`);

    // Start BullMQ background worker
    startFollowUpWorker();

    // Setup periodic email sync every 5 minutes
    const SYNC_INTERVAL_MS = 5 * 60 * 1000;
    setInterval(async () => {
      try {
        app.log.info('[PeriodicSync] Running scheduled sent-email check...');
        await EmailSyncService.syncAllActiveUsers();
      } catch (err: any) {
        app.log.error('[PeriodicSync] Error in scheduled email sync:', err);
      }
    }, SYNC_INTERVAL_MS);

    // Graceful shutdown hooks
    const shutdown = async () => {
      app.log.info('Shutting down API server...');
      await stopFollowUpWorker();
      await app.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
