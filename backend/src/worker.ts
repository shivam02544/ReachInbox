import { config } from './config/env';
import { checkPrismaConnection } from './config/prisma';
import { checkRedisConnection } from './config/redis';
import { initializeEmailWorker, closeEmailWorker } from './queues/email.worker';
import { logger } from './utils/logger';

async function startWorkerProcess(): Promise<void> {
  logger.info('Worker', '==================================================');
  logger.info('Worker', 'ReachInbox BullMQ Worker Process Starting...');
  logger.info('Worker', `Environment: ${config.nodeEnv}`);
  logger.info('Worker', `Target Redis: ${config.redisHost}:${config.redisPort}`);
  logger.info('Worker', `Worker Concurrency: ${config.workerConcurrency}`);
  logger.info('Worker', '==================================================');

  // Verify DB & Redis connectivity for worker process
  const dbOk = await checkPrismaConnection();
  const redisOk = await checkRedisConnection();

  if (!dbOk || !redisOk) {
    logger.error('Worker', 'Worker failed infrastructure readiness check! Exiting process.');
    process.exit(1);
  }

  // Initialize BullMQ Worker listener
  initializeEmailWorker();

  // Handle graceful shutdown signals
  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info('Worker', `Received ${signal}. Starting graceful worker shutdown...`);
    try {
      await closeEmailWorker();
      logger.info('Worker', 'Worker process shutdown complete.');
      process.exit(0);
    } catch (err) {
      logger.error('Worker', 'Error during graceful worker shutdown', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startWorkerProcess().catch((error) => {
  logger.error('Worker', 'Fatal error during worker process startup', error);
  process.exit(1);
});
