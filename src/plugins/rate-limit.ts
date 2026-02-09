import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { config } from '../lib/config.js';
import { getRedisClient } from '../lib/redis.js';

/**
 * Rate limiting plugin.
 * Wraps @fastify/rate-limit with Redis as the backing store for
 * distributed rate limiting across multiple instances.
 */
async function rateLimitPlugin(fastify: FastifyInstance) {
  const redis = getRedisClient();

  await fastify.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    redis,
    nameSpace: 'rl:',
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    keyGenerator: (request) => {
      return request.ip;
    },
  });
}

export default fp(rateLimitPlugin, {
  name: 'rate-limit',
});
