import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { config } from '../lib/config.js';

/**
 * CORS plugin.
 * Configures Cross-Origin Resource Sharing based on environment variables.
 */
async function corsPlugin(fastify: FastifyInstance) {
  const origins = config.CORS_ORIGIN.split(',').map((o) => o.trim());

  await fastify.register(cors, {
    origin: origins.length === 1 ? origins[0]! : origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    credentials: true,
    maxAge: 86400,
  });
}

export default fp(corsPlugin, {
  name: 'cors',
});
