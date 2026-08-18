import { config } from './config/env';
import { checkPrismaConnection } from './config/prisma';
import { checkRedisConnection } from './config/redis';
import { logger } from './utils/logger';

async function startWorker(): Promise<void> {
  logger.info('Worker', '==================================================');
  logger.info('Worker', 'ReachInbox BullMQ Worker Process Initializing...');
  logger.info('Worker', `Environment: ${config.nodeEnv}`);
  logger.info('Worker', `Target Redis: ${config.redisHost}:${config.redisPort}`);
  logger.info('Worker', '==================================================');

  // Verify DB & Redis connectivity for worker process
  const dbOk = await checkPrismaConnection();
  const redisOk = await checkRedisConnection();

  if (dbOk && redisOk) {
    logger.info('Worker', 'Worker process infrastructure connections verified successfully.');
    logger.info('Worker', 'Worker ready for BullMQ job queue initialization in subsequent steps.');
  } else {
    logger.error('Worker', 'Worker failed infrastructure readiness check!');
  }

  // Keep process active and handle shutdown signals
  const gracefulShutdown = async (signal: string) => {
    logger.info('Worker', `Received ${signal}. Shutting down worker process...`);
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startWorker().catch((error) => {
  logger.error('Worker', 'Fatal error during worker startup', error);
  process.exit(1);
});
