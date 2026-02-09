import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import { db } from '../db/client.js';
import { refreshTokens, users } from '../db/schema.js';
import type { NewUser, User } from '../db/schema.js';
import { config } from '../lib/config.js';
import { ConflictError, NotFoundError, UnauthorizedError } from '../lib/errors.js';
import type { JwtPayload, TokenPair } from '../types/index.js';

const scryptAsync = promisify(scrypt);

const SALT_LENGTH = 32;
const KEY_LENGTH = 64;

// ──────────────────────────────────────────────
// Password Utilities
// ──────────────────────────────────────────────

/**
 * Hash a password using scrypt with a random salt.
 * Returns the salt and hash combined as `salt:hash` (both hex-encoded).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

/**
 * Verify a password against a stored hash.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, hashHex] = storedHash.split(':');
  if (!saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const storedKey = Buffer.from(hashHex, 'hex');
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

  return timingSafeEqual(storedKey, derived);
}

// ──────────────────────────────────────────────
// User Queries
// ──────────────────────────────────────────────

/**
 * Find a user by their email address.
 */
export async function findUserByEmail(email: string): Promise<User | undefined> {
  const result = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });
  return result;
}

/**
 * Find a user by their ID.
 */
export async function findUserById(id: string): Promise<User | undefined> {
  const result = await db.query.users.findFirst({
    where: eq(users.id, id),
  });
  return result;
}

/**
 * Create a new user.
 * Throws ConflictError if the email is already registered.
 */
export async function createUser(data: {
  email: string;
  password: string;
  name: string;
}): Promise<User> {
  const existing = await findUserByEmail(data.email);
  if (existing) {
    throw new ConflictError('A user with this email already exists');
  }

  const passwordHash = await hashPassword(data.password);

  const [user] = await db
    .insert(users)
    .values({
      email: data.email.toLowerCase(),
      name: data.name,
      passwordHash,
    } satisfies Omit<NewUser, 'id' | 'role' | 'isActive' | 'emailVerified' | 'createdAt' | 'updatedAt'>)
    .returning();

  return user!;
}

// ──────────────────────────────────────────────
// Token Management
// ──────────────────────────────────────────────

/**
 * Generate an access token and a refresh token for a given user.
 */
export function generateTokens(
  fastify: FastifyInstance,
  user: { id: string; email: string; role: string },
): TokenPair {
  const accessPayload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    type: 'access',
  };

  const refreshPayload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    type: 'refresh',
  };

  const accessToken = fastify.jwt.sign(accessPayload, {
    expiresIn: config.JWT_EXPIRES_IN,
  });

  const refreshToken = fastify.jwt.sign(refreshPayload, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN,
  });

  return { accessToken, refreshToken };
}

/**
 * Store a refresh token in the database.
 */
export async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const expiresAt = new Date();
  // Parse refresh expiry (e.g. "7d" -> 7 days)
  const match = config.JWT_REFRESH_EXPIRES_IN.match(/^(\d+)([smhd])$/);
  if (match) {
    const value = parseInt(match[1]!, 10);
    const unit = match[2];
    switch (unit) {
      case 's':
        expiresAt.setSeconds(expiresAt.getSeconds() + value);
        break;
      case 'm':
        expiresAt.setMinutes(expiresAt.getMinutes() + value);
        break;
      case 'h':
        expiresAt.setHours(expiresAt.getHours() + value);
        break;
      case 'd':
        expiresAt.setDate(expiresAt.getDate() + value);
        break;
    }
  } else {
    // Default to 7 days if parsing fails
    expiresAt.setDate(expiresAt.getDate() + 7);
  }

  await db.insert(refreshTokens).values({
    userId,
    token,
    expiresAt,
  });
}

/**
 * Validate and consume a refresh token.
 * Revokes the old token and returns the associated user.
 */
export async function validateRefreshToken(token: string): Promise<User> {
  const stored = await db.query.refreshTokens.findFirst({
    where: eq(refreshTokens.token, token),
  });

  if (!stored) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  if (stored.revokedAt) {
    throw new UnauthorizedError('Refresh token has been revoked');
  }

  if (new Date() > stored.expiresAt) {
    throw new UnauthorizedError('Refresh token has expired');
  }

  // Revoke the consumed token (rotation)
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, stored.id));

  const user = await findUserById(stored.userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
}
