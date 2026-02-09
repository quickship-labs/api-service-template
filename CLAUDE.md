# CLAUDE.md

## Project Overview
Fastify API service template with PostgreSQL, Redis, JWT auth, and rate limiting. Generic backend starter for microservices and API backends.

## Tech Stack
- Fastify with TypeScript
- PostgreSQL (Drizzle ORM)
- Redis (ioredis) for caching and rate limiting
- JWT authentication
- Zod for request/response validation
- Pino for structured logging

## Commands
- `npm run dev` - Start dev server with watch mode
- `npm run build` - Compile TypeScript
- `npm run start` - Start production server
- `npm run test` - Run Vitest tests
- `npm run lint` - Run ESLint
- `npm run format` - Run Prettier
- `npm run db:push` - Push schema to database
- `npm run db:generate` - Generate migrations
- `npm run docker:up` - Start local Postgres + Redis
- `npm run docker:down` - Stop local services

## Architecture
- Routes define HTTP endpoints and request/response schemas
- Services contain business logic (no HTTP concerns)
- Plugins register Fastify plugins (auth, rate limit, CORS)
- Middleware contains reusable preHandler hooks
- Database queries go through Drizzle ORM in db/client.ts

## Code Conventions
- Use Zod schemas for all request validation
- Services return data, routes handle HTTP concerns
- All errors use custom error classes from lib/errors.ts
- Environment variables validated at startup
- Use dependency injection via Fastify decorators

## Important
- Never commit .env files
- Always validate input with Zod
- Use parameterized queries (Drizzle handles this)
- Run docker-compose up before local development
- JWT_SECRET must be strong (32+ characters)
