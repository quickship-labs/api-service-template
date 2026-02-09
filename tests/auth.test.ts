import { describe, expect, it, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Store mock references so we can control behavior per test
const mockUsersQuery = { findFirst: vi.fn() };
const mockRefreshTokensQuery = { findFirst: vi.fn() };
const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
const mockUpdateSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

// Mock Redis before any imports that use it
vi.mock('../src/lib/redis.js', () => ({
  getRedisClient: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    quit: vi.fn().mockResolvedValue('OK'),
    on: vi.fn(),
  })),
  createRedisClient: vi.fn(),
  closeRedisClient: vi.fn().mockResolvedValue(undefined),
  cacheGet: vi.fn(),
  cacheInvalidate: vi.fn(),
}));

// Mock database
vi.mock('../src/db/client.js', () => ({
  db: {
    query: {
      users: mockUsersQuery,
      items: { findFirst: vi.fn() },
      refreshTokens: mockRefreshTokensQuery,
    },
    select: vi.fn().mockReturnThis(),
    insert: mockInsert,
    update: mockUpdate,
    delete: vi.fn().mockReturnThis(),
  },
  closeDatabase: vi.fn().mockResolvedValue(undefined),
  checkDatabaseHealth: vi.fn().mockResolvedValue(true),
}));

import { buildApp } from '../src/app.js';

describe('POST /auth/register', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register a new user and return 201 with tokens', async () => {
    // No existing user
    mockUsersQuery.findFirst.mockResolvedValueOnce(undefined);

    // Return created user from insert
    mockInsertReturning.mockResolvedValueOnce([
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        passwordHash: 'hashed',
        isActive: true,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Store refresh token
    mockInsertReturning.mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'test@example.com',
        password: 'securepassword123',
        name: 'Test User',
      },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('accessToken');
    expect(body.data).toHaveProperty('refreshToken');
    expect(body.data.user).toHaveProperty('email', 'test@example.com');
    expect(body.data.user).toHaveProperty('name', 'Test User');
    expect(body.data.user).not.toHaveProperty('passwordHash');
  });

  it('should return 400 for invalid email', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'not-an-email',
        password: 'securepassword123',
        name: 'Test User',
      },
    });

    expect(response.statusCode).toBe(400);

    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('should return 400 for short password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'test@example.com',
        password: '123',
        name: 'Test User',
      },
    });

    expect(response.statusCode).toBe(400);

    const body = response.json();
    expect(body.success).toBe(false);
  });

  it('should return 400 for missing name', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'test@example.com',
        password: 'securepassword123',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 409 when email is already registered', async () => {
    // Existing user found
    mockUsersQuery.findFirst.mockResolvedValueOnce({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'existing@example.com',
      name: 'Existing User',
      role: 'user',
      passwordHash: 'hashed',
      isActive: true,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'existing@example.com',
        password: 'securepassword123',
        name: 'Test User',
      },
    });

    expect(response.statusCode).toBe(409);

    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('CONFLICT');
  });
});

describe('POST /auth/login', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 for non-existent user', async () => {
    mockUsersQuery.findFirst.mockResolvedValueOnce(undefined);

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'nonexistent@example.com',
        password: 'somepassword123',
      },
    });

    expect(response.statusCode).toBe(401);

    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 400 for missing email', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        password: 'somepassword123',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 for missing password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'test@example.com',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 401 for deactivated user', async () => {
    // Use the hash/verify functions to create a valid hash
    const { hashPassword } = await import('../src/services/auth.service.js');
    const passwordHash = await hashPassword('correctpassword');

    mockUsersQuery.findFirst.mockResolvedValueOnce({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'deactivated@example.com',
      name: 'Deactivated User',
      role: 'user',
      passwordHash,
      isActive: false,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'deactivated@example.com',
        password: 'correctpassword',
      },
    });

    expect(response.statusCode).toBe(401);

    const body = response.json();
    expect(body.error.message).toContain('deactivated');
  });
});
