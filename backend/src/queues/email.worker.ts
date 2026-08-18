import { Worker, Job } from 'bullmq';
import { config } from '../config/env';
import { EMAIL_QUEUE_NAME, bullRedisConnectionOptions, TestJobPayload } from './email.queue';
import { logger } from '../utils/logger';

export let emailWorker: Worker<TestJobPayload, void> | null = null;

export function initializeEmailWorker(): Worker<TestJobPayload, void> {
  if (emailWorker) {
    return emailWorker;
  }

  logger.info('Worker', `Initializing BullMQ Worker for queue '${EMAIL_QUEUE_NAME}' (Concurrency: ${config.workerConcurrency})...`);

  emailWorker = new Worker<TestJobPayload, void>(
    EMAIL_QUEUE_NAME,
    async (job: Job<TestJobPayload, void>) => {
      const startTime = Date.now();
      const payload = job.data;
      const scheduledTime = new Date(payload.scheduledFor).getTime();
      const delayDiffMs = startTime - scheduledTime;

      logger.info('Worker', '==================================================');
      logger.info('Worker', `[Job Received] ID: ${job.id} | Name: ${job.name} | Attempt: ${job.attemptsMade + 1}`);
      logger.info('Worker', `[Job Payload] Type: ${payload.type} | ScheduledFor: ${payload.scheduledFor}`);
      logger.info('Worker', `[Execution Timing] Current Time: ${new Date(startTime).toISOString()} (Timing Delta: ${delayDiffMs >= 0 ? '+' : ''}${delayDiffMs}ms)`);
      if (delayDiffMs > 1000) {
        logger.info('Worker', `[Notice] Job executed ${Math.round(delayDiffMs / 1000)}s after scheduled time (worker reconnect/restart window)`);
      }
      logger.info('Worker', `[Message] ${payload.message}`);

      // Isolated test processing (NO email sending or DB writes in Step 1B)
      await new Promise((resolve) => setTimeout(resolve, 50));

      logger.info('Worker', `[Job Completed] ID: ${job.id} successfully processed in ${Date.now() - startTime}ms.`);
      logger.info('Worker', '==================================================');
    },
    {
      connection: bullRedisConnectionOptions,
      concurrency: config.workerConcurrency,
    }
  );

  emailWorker.on('active', (job) => {
    logger.info('Worker', `Job [ID: ${job.id}] transitioned to ACTIVE state.`);
  });

  emailWorker.on('completed', (job) => {
    logger.info('Worker', `Job [ID: ${job.id}] marked as COMPLETED.`);
  });

  emailWorker.on('failed', (job, err) => {
    logger.error('Worker', `Job [ID: ${job?.id}] FAILED with error: ${err.message}`, err);
  });

  emailWorker.on('error', (err) => {
    logger.error('Worker', 'BullMQ Worker internal error encountered', err);
  });

  logger.info('Worker', `BullMQ Worker active and listening on '${EMAIL_QUEUE_NAME}'`);

  return emailWorker;
}

export async function closeEmailWorker(): Promise<void> {
  if (emailWorker) {
    logger.info('Worker', 'Closing BullMQ Worker gracefully...');
    await emailWorker.close();
    emailWorker = null;
    logger.info('Worker', 'BullMQ Worker closed successfully.');
  }
}
