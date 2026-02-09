import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { BadRequestError, UnauthorizedError } from '../lib/errors.js';
import {
  createUser,
  findUserByEmail,
  generateTokens,
  storeRefreshToken,
  validateRefreshToken,
  verifyPassword,
} from '../services/auth.service.js';

// ──────────────────────────────────────────────
// Request Schemas
// ──────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(255),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ──────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────

/**
 * Authentication routes.
 * Handles user registration, login, and token refresh.
 */
export async function authRoutes(fastify: FastifyInstance) {
  /**
   * POST /auth/register
   * Create a new user account and return tokens.
   */
  fastify.post('/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
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

    const { email, password, name } = parsed.data;
    const user = await createUser({ email, password, name });
    const tokens = generateTokens(fastify, {
      id: user.id,
      email: user.email,
      role: user.role,
    });

    await storeRefreshToken(user.id, tokens.refreshToken);

    return reply.status(201).send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        ...tokens,
      },
    });
  });

  /**
   * POST /auth/login
   * Authenticate an existing user and return tokens.
   */
  fastify.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError('Validation failed');
    }

    const { email, password } = parsed.data;
    const user = await findUserByEmail(email);

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const tokens = generateTokens(fastify, {
      id: user.id,
      email: user.email,
      role: user.role,
    });

    await storeRefreshToken(user.id, tokens.refreshToken);

    return reply.status(200).send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        ...tokens,
      },
    });
  });

  /**
   * POST /auth/refresh
   * Exchange a valid refresh token for a new token pair.
   * Implements token rotation: the old refresh token is revoked.
   */
  fastify.post('/auth/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError('Validation failed');
    }

    const { refreshToken } = parsed.data;
    const user = await validateRefreshToken(refreshToken);

    const tokens = generateTokens(fastify, {
      id: user.id,
      email: user.email,
      role: user.role,
    });

    await storeRefreshToken(user.id, tokens.refreshToken);

    return reply.status(200).send({
      success: true,
      data: tokens,
    });
  });
}
