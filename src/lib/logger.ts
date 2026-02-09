import type { FastifyBaseLogger } from 'fastify';

import { config } from './config.js';

/**
 * Pino logger configuration for Fastify.
 * Fastify uses Pino internally, so we configure it through Fastify's logger option.
 * This module exports the logger options to be used when creating the Fastify instance.
 */
export const loggerConfig: Record<string, unknown> = {
  level: config.LOG_LEVEL,
  ...(config.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      }
    : {
        // Production: JSON logging for log aggregation systems
        formatters: {
          level: (label: string) => ({ level: label }),
          bindings: (bindings: Record<string, unknown>) => ({
            pid: bindings.pid,
            host: bindings.hostname,
            node_version: process.version,
          }),
        },
        timestamp: () => `,"time":"${new Date().toISOString()}"`,
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie', 'body.password'],
          censor: '[REDACTED]',
        },
      }),
};

/**
 * Create a child logger from the Fastify instance logger.
 * Use this in services that need their own logger context.
 */
export function createServiceLogger(logger: FastifyBaseLogger, serviceName: string) {
  return logger.child({ service: serviceName });
}
