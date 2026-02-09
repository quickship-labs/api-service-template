import type { JWT } from '@fastify/jwt';

// ──────────────────────────────────────────────
// JWT Payload
// ──────────────────────────────────────────────

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

// ──────────────────────────────────────────────
// Auth Types
// ──────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

// ──────────────────────────────────────────────
// API Response Types
// ──────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ──────────────────────────────────────────────
// Fastify Augmentations
// ──────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    jwt: JWT;
    authenticate: (request: FastifyRequest) => Promise<void>;
  }

  interface FastifyRequest {
    user: AuthUser;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: AuthUser;
  }
}
