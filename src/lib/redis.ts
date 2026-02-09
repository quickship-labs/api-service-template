import Redis from 'ioredis';

import { config } from './config.js';

let redisClient: Redis | null = null;

/**
 * Get or create the Redis client singleton.
 * Supports lazy initialization for testing scenarios.
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
}

/**
 * Create a new Redis client with standard configuration.
 */
export function createRedisClient(): Redis {
  const client = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 10) {
        return null; // Stop retrying after 10 attempts
      }
      return Math.min(times * 200, 5000); // Exponential backoff, max 5s
    },
    enableReadyCheck: true,
    lazyConnect: false,
  });

  client.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Redis connection error:', err.message);
  });

  client.on('connect', () => {
    // eslint-disable-next-line no-console
    console.log('Redis connected');
  });

  return client;
}

/**
 * Close the Redis connection gracefully.
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Cache helper: get a value from Redis, or compute and cache it.
 */
export async function cacheGet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const redis = getRedisClient();
  const cached = await redis.get(key);

  if (cached) {
    return JSON.parse(cached) as T;
  }

  const value = await fetcher();
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
  return value;
}

/**
 * Invalidate a cache key or pattern.
 */
export async function cacheInvalidate(pattern: string): Promise<void> {
  const redis = getRedisClient();

  if (pattern.includes('*')) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } else {
    await redis.del(pattern);
  }
}
