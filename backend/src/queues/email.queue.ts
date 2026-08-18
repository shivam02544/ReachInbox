import { Queue, ConnectionOptions } from 'bullmq';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export const EMAIL_QUEUE_NAME = 'email-queue';

export const bullRedisConnectionOptions: ConnectionOptions = {
  host: config.redisHost,
  port: config.redisPort,
  maxRetriesPerRequest: null,
};

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: bullRedisConnectionOptions,
});

export interface TestJobPayload {
  type: string;
  message: string;
  delayMs: number;
  scheduledFor: string;
  createdAt: string;
}

export interface EnqueueTestJobResult {
  jobId: string;
  delayMs: number;
  scheduledFor: string;
  status: string;
}

export async function addTestJob(delayMs: number): Promise<EnqueueTestJobResult> {
  const now = new Date();
  const scheduledForDate = new Date(now.getTime() + delayMs);
  const scheduledFor = scheduledForDate.toISOString();

  const payload: TestJobPayload = {
    type: 'test',
    message: 'BullMQ queue foundation test job',
    delayMs,
    scheduledFor,
    createdAt: now.toISOString(),
  };

  const job = await emailQueue.add('test-email-job', payload, {
    delay: delayMs,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600, // Retain completed jobs up to 1 hour
      count: 100, // Retain max 100 recent completed jobs for inspection
    },
    removeOnFail: {
      age: 86400, // Retain failed jobs up to 24 hours
      count: 200, // Retain max 200 failed jobs for debugging
    },
  });

  logger.info('API', `Enqueued BullMQ test job [ID: ${job.id}] with ${delayMs}ms delay (scheduled for ${scheduledFor})`);

  return {
    jobId: job.id || 'unknown',
    delayMs,
    scheduledFor,
    status: 'enqueued',
  };
}
