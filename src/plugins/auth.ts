import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { config } from '../lib/config.js';
import { UnauthorizedError } from '../lib/errors.js';
import type { JwtPayload } from '../types/index.js';

/**
 * JWT authentication plugin.
 * Registers @fastify/jwt and decorates the Fastify instance with an
 * `authenticate` utility that verifies access tokens and attaches the
 * user to the request.
 */
async function authPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    sign: {
      expiresIn: config.JWT_EXPIRES_IN,
    },
  });

  /**
   * Reusable authenticate decorator.
   * Verifies the JWT from the Authorization header and populates `request.user`.
   */
  fastify.decorate('authenticate', async function (request: FastifyRequest) {
    try {
      const decoded = await request.jwtVerify<JwtPayload>();

      if (decoded.type !== 'access') {
        throw new UnauthorizedError('Invalid token type');
      }

      request.user = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
      };
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        throw err;
      }
      throw new UnauthorizedError('Invalid or expired token');
    }
  });
}

export default fp(authPlugin, {
  name: 'auth',
});
