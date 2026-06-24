import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  // Reconnect strategy: exponential backoff with jitter, max 30s between attempts
  reconnectOnError: () => false, // let ioredis handle reconnection automatically
  enableReadyCheck: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  retryStrategy: (times) => {
    const delay = Math.min(1000 * 2 ** times, 30000);
    console.warn(`[redis] connection lost (attempt ${times}), reconnecting in ${delay}ms`);
    return delay;
  },
});

redis.on('error', (err) => {
  console.error('[redis] connection error:', err.message);
});

redis.on('connect', () => {
  console.log('[redis] connected');
});

redis.on('ready', () => {
  console.log('[redis] ready for requests');
});

/**
 * Check if Redis is connected and ready. Returns false if disconnected
 * and not attempting to reconnect.
 */
export function isRedisReady(): boolean {
  return redis.status === 'ready' || redis.status === 'connecting';
}
