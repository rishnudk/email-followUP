import Redis from 'ioredis';
import { env } from '../config/env';

/**
 * Shared Redis connection instance.
 * Note: BullMQ requires maxRetriesPerRequest: null.
 */
export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

redisConnection.on('connect', () => {
  console.log('[Redis] Connected to Redis at', env.REDIS_URL);
});
