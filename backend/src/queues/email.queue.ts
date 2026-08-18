import { Queue, ConnectionOptions } from 'bullmq';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export const EMAIL_QUEUE_NAME = 'email-queue';
export const SEND_EMAIL_JOB_NAME = 'send-email';

export const bullRedisConnectionOptions: ConnectionOptions = {
  host: config.redisHost,
  port: config.redisPort,
  maxRetriesPerRequest: null,
};

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: bullRedisConnectionOptions,
});

export interface EmailJobPayload {
  emailId: string;
}

export interface EnqueueEmailJobResult {
  jobId: string;
  delayMs: number;
  scheduledFor: string;
  status: string;
}

/**
 * Enqueues a production delayed email job into BullMQ.
 * 
 * BullMQ jobId matches PostgreSQL Email.id for deterministic identification.
 */
export async function addEmailJob(emailId: string, scheduledAt: Date): Promise<EnqueueEmailJobResult> {
  const now = Date.now();
  const scheduledTime = scheduledAt.getTime();
  const delayMs = Math.max(0, scheduledTime - now);

  const payload: EmailJobPayload = {
    emailId,
  };

  const job = await emailQueue.add(SEND_EMAIL_JOB_NAME, payload, {
    jobId: emailId, // Deterministic matching: BullMQ jobId = Email.id
    delay: delayMs,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600,   // Keep completed jobs up to 1 hour
      count: 100,  // Keep max 100 recent completed jobs
    },
    removeOnFail: {
      age: 86400,  // Keep failed jobs up to 24 hours
      count: 200,  // Keep max 200 failed jobs
    },
  });

  logger.info(
    'API',
    `Enqueued BullMQ job [Job ID: ${job.id}] for Email [ID: ${emailId}] with ${delayMs}ms delay (Scheduled for ${scheduledAt.toISOString()})`
  );

  return {
    jobId: job.id || emailId,
    delayMs,
    scheduledFor: scheduledAt.toISOString(),
    status: 'enqueued',
  };
}
