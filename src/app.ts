import Fastify from 'fastify';
import type { FastifyError, FastifyInstance } from 'fastify';

import { AppError, ValidationError } from './lib/errors.js';
import { loggerConfig } from './lib/logger.js';
import authPlugin from './plugins/auth.js';
import corsPlugin from './plugins/cors.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { exampleRoutes } from './routes/v1/example.js';

/**
 * Build and configure the Fastify application.
 * Registers plugins, routes, and error handlers.
 *
 * Accepts an optional options object to override defaults (useful for testing).
 */
export async function buildApp(
  opts: { logger?: boolean | Record<string, unknown> } = {},
): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: opts.logger ?? loggerConfig,
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
  });

  // ── Plugins ──────────────────────────────────

  await fastify.register(corsPlugin);
  await fastify.register(authPlugin);
  await fastify.register(rateLimitPlugin);

  // ── Routes ───────────────────────────────────

  await fastify.register(healthRoutes);
  await fastify.register(authRoutes);
  await fastify.register(exampleRoutes);

  // ── Error Handler ────────────────────────────

  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    // Handle application errors
    if (error instanceof AppError) {
      const payload: Record<string, unknown> = {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      };

      if (error instanceof ValidationError && Object.keys(error.details).length > 0) {
        (payload.error as Record<string, unknown>).details = error.details;
      }

      return reply.status(error.statusCode).send(payload);
    }

    // Handle Fastify validation errors (from schema validation)
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.message,
        },
      });
    }

    // Handle rate limit errors from @fastify/rate-limit
    if (error.statusCode === 429) {
      return reply.status(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
        },
      });
    }

    // Log unexpected errors
    request.log.error(error, 'Unhandled error');

    // Generic internal server error
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : error.message,
      },
    });
  });

  // ── Not Found Handler ────────────────────────

  fastify.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
  });

  return fastify;
}
