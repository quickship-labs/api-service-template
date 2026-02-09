import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { config } from '../lib/config.js';

import * as schema from './schema.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Get or create the PostgreSQL connection pool.
 */
function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('Unexpected PostgreSQL pool error:', err.message);
    });
  }
  return pool;
}

/**
 * Drizzle ORM instance with schema.
 * Uses the singleton connection pool.
 */
export const db = drizzle(getPool(), {
  schema,
  logger: config.NODE_ENV === 'development',
});

/**
 * Close the database connection pool gracefully.
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Check database connectivity.
 * Returns true if the database is reachable, false otherwise.
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await getPool().connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}
