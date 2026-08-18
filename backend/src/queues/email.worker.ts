import { Worker, Job } from 'bullmq';
import { EmailStatus } from '@prisma/client';
import { config } from '../config/env';
import { prisma } from '../config/prisma';
import { EMAIL_QUEUE_NAME, SEND_EMAIL_JOB_NAME, bullRedisConnectionOptions, EmailJobPayload } from './email.queue';
import { logger } from '../utils/logger';

export let emailWorker: Worker<EmailJobPayload, void> | null = null;

export function initializeEmailWorker(): Worker<EmailJobPayload, void> {
  if (emailWorker) {
    return emailWorker;
  }

  logger.info(
    'Worker',
    `Initializing BullMQ Worker for queue '${EMAIL_QUEUE_NAME}' (Concurrency: ${config.workerConcurrency})...`
  );

  emailWorker = new Worker<EmailJobPayload, void>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobPayload, void>) => {
      const startTime = Date.now();

      // Only handle send-email jobs
      if (job.name !== SEND_EMAIL_JOB_NAME) {
        logger.warn('Worker', `Ignoring unrecognized job name '${job.name}' (Job ID: ${job.id})`);
        return;
      }

      const { emailId } = job.data;
      if (!emailId) {
        logger.error('Worker', `Job [ID: ${job.id}] missing required payload 'emailId'!`);
        throw new Error(`Job missing required emailId`);
      }

      logger.info('Worker', '==================================================');
      logger.info('Worker', `[Job Claimed] BullMQ Job ID: ${job.id} | Email ID: ${emailId}`);

      // 1. Fetch authoritative Email record from PostgreSQL
      const emailRecord = await prisma.email.findUnique({
        where: { id: emailId },
        include: { sender: true },
      });

      if (!emailRecord) {
        logger.error('Worker', `[Job Error] Email record not found in PostgreSQL for ID: ${emailId}`);
        throw new Error(`Email record not found in database: ${emailId}`);
      }

      // 2. Idempotency Safeguard: Skip if already SENT
      if (emailRecord.status === EmailStatus.SENT) {
        logger.info(
          'Worker',
          `[Idempotency Safeguard] Email ID ${emailId} is already SENT. Skipping processing safely.`
        );
        logger.info('Worker', '==================================================');
        return;
      }

      // 3. Atomic State Transition: SCHEDULED -> PROCESSING (Increment attempts ONCE)
      const updateResult = await prisma.email.updateMany({
        where: {
          id: emailId,
          status: EmailStatus.SCHEDULED,
        },
        data: {
          status: EmailStatus.PROCESSING,
          attempts: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        // Reload record to check current state
        const currentRecord = await prisma.email.findUnique({ where: { id: emailId } });
        if (currentRecord?.status === EmailStatus.SENT) {
          logger.info(
            'Worker',
            `[Idempotency Safeguard] Email ID ${emailId} was marked SENT by another worker. Skipping cleanly.`
          );
          return;
        }
        if (currentRecord?.status === EmailStatus.PROCESSING) {
          logger.warn(
            'Worker',
            `[Concurrency Guard] Email ID ${emailId} is currently being processed by another worker. Skipping duplicate attempt.`
          );
          return;
        }
      }

      logger.info(
        'Worker',
        `[Processing Email] ID: ${emailId} | Recipient: ${emailRecord.recipient} | ScheduledAt: ${emailRecord.scheduledAt.toISOString()}`
      );

      try {
        // 4. Simulated Email Delivery (NO real SMTP / Ethereal sending in Step 2)
        logger.info(
          'Worker',
          `[Simulated Send] Delivering email to ${emailRecord.recipient} (Subject: "${emailRecord.subject}")...`
        );

        // 5. State Transition: PROCESSING -> SENT
        const sentAt = new Date();
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: EmailStatus.SENT,
            sentAt,
          },
        });

        const durationMs = Date.now() - startTime;
        logger.info(
          'Worker',
          `[Simulated Send Success] Email ID ${emailId} (Recipient: ${emailRecord.recipient}) transitioned to SENT state in ${durationMs}ms.`
        );
        logger.info('Worker', '==================================================');
      } catch (err: any) {
        logger.error(
          'Worker',
          `[Processing Failed] Error sending Email ID ${emailId}: ${err.message}`,
          err
        );

        // Update database record to FAILED state
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: EmailStatus.FAILED,
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        });

        throw err; // Re-throw to inform BullMQ of job failure
      }
    },
    {
      connection: bullRedisConnectionOptions,
      concurrency: config.workerConcurrency,
    }
  );

  emailWorker.on('active', (job) => {
    logger.info('Worker', `BullMQ Job [ID: ${job.id}] transitioned to ACTIVE.`);
  });

  emailWorker.on('completed', (job) => {
    logger.info('Worker', `BullMQ Job [ID: ${job.id}] marked as COMPLETED.`);
  });

  emailWorker.on('failed', (job, err) => {
    logger.error('Worker', `BullMQ Job [ID: ${job?.id}] FAILED: ${err.message}`);
  });

  emailWorker.on('error', (err) => {
    logger.error('Worker', 'BullMQ Worker internal error', err);
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
