import { buildApp } from './app.js';
import { closeDatabase } from './db/client.js';
import { config } from './lib/config.js';
import { closeRedisClient } from './lib/redis.js';

/**
 * Start the Fastify server and set up graceful shutdown handlers.
 */
async function start() {
  const app = await buildApp();

  try {
    await app.listen({ host: config.HOST, port: config.PORT });
    app.log.info(`Server listening on http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    app.log.fatal(err, 'Failed to start server');
    process.exit(1);
  }

  // ── Graceful Shutdown ──────────────────────────

  async function shutdown(signal: string) {
    app.log.info(`Received ${signal}. Shutting down gracefully...`);

    try {
      // Stop accepting new connections
      await app.close();
      app.log.info('Fastify server closed');

      // Close database connections
      await closeDatabase();
      app.log.info('Database connections closed');

      // Close Redis connections
      await closeRedisClient();
      app.log.info('Redis connections closed');

      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during graceful shutdown');
      process.exit(1);
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught errors
  process.on('unhandledRejection', (reason) => {
    app.log.error(reason, 'Unhandled promise rejection');
  });

  process.on('uncaughtException', (err) => {
    app.log.fatal(err, 'Uncaught exception');
    process.exit(1);
  });
}

start();
