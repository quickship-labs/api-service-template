import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Authentication preHandler hook.
 * Verifies the JWT token from the Authorization header and attaches
 * the authenticated user to the request object.
 *
 * Usage in route definitions:
 *   { preHandler: [authenticate] }
 */
export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  await request.server.authenticate(request);
}
