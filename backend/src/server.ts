import app from './app';
import { config } from './config/env';
import { checkPrismaConnection } from './config/prisma';
import { checkRedisConnection } from './config/redis';
import { logger } from './utils/logger';

async function startServer(): Promise<void> {
  logger.info('API', `Starting Express API Server on port ${config.port}...`);

  // Verify infrastructure connections on startup
  await checkPrismaConnection();
  await checkRedisConnection();

  const server = app.listen(config.port, () => {
    logger.info('API', `ReachInbox Backend API is running on port ${config.port}`);
  });

  const gracefulShutdown = async (signal: string) => {
    logger.info('API', `Received ${signal}. Shutting down API server gracefully...`);
    server.close(() => {
      logger.info('API', 'HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer().catch((error) => {
  logger.error('API', 'Fatal error during server startup', error);
  process.exit(1);
});
