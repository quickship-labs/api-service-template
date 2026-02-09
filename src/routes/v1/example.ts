import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { authenticate } from '../../middleware/authenticate.js';
import { BadRequestError } from '../../lib/errors.js';
import * as exampleService from '../../services/example.service.js';

// ──────────────────────────────────────────────
// Request Schemas
// ──────────────────────────────────────────────

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['title', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  status: z.string().optional(),
});

const createSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(5000).optional(),
  status: z.enum(['active', 'archived', 'draft']).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(['active', 'archived', 'draft']).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

// ──────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────

/**
 * Example CRUD routes under /v1/examples.
 * All routes require authentication.
 */
export async function exampleRoutes(fastify: FastifyInstance) {
  /**
   * GET /v1/examples
   * List all items for the authenticated user with pagination.
   */
  fastify.get(
    '/v1/examples',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const parsed = paginationSchema.safeParse(request.query);
      if (!parsed.success) {
        throw new BadRequestError('Invalid query parameters');
      }

      const result = await exampleService.list(request.user.id, parsed.data);

      return reply.status(200).send({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    },
  );

  /**
   * GET /v1/examples/:id
   * Get a single item by ID.
   */
  fastify.get(
    '/v1/examples/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        throw new BadRequestError('Invalid ID format');
      }

      const item = await exampleService.getById(request.user.id, params.data.id);

      return reply.status(200).send({
        success: true,
        data: item,
      });
    },
  );

  /**
   * POST /v1/examples
   * Create a new item.
   */
  fastify.post(
    '/v1/examples',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) {
        const details: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path.join('.');
          if (!details[field]) {
            details[field] = [];
          }
          details[field].push(issue.message);
        }
        throw new BadRequestError('Validation failed');
      }

      const item = await exampleService.create(request.user.id, parsed.data);

      return reply.status(201).send({
        success: true,
        data: item,
      });
    },
  );

  /**
   * PUT /v1/examples/:id
   * Update an existing item.
   */
  fastify.put(
    '/v1/examples/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        throw new BadRequestError('Invalid ID format');
      }

      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new BadRequestError('Validation failed');
      }

      const item = await exampleService.update(request.user.id, params.data.id, parsed.data);

      return reply.status(200).send({
        success: true,
        data: item,
      });
    },
  );

  /**
   * DELETE /v1/examples/:id
   * Delete an item.
   */
  fastify.delete(
    '/v1/examples/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        throw new BadRequestError('Invalid ID format');
      }

      await exampleService.remove(request.user.id, params.data.id);

      return reply.status(204).send();
    },
  );
}
