import { Worker, Job, DelayedError } from 'bullmq';
import { EmailStatus } from '@prisma/client';
import { config } from '../config/env';
import { prisma } from '../config/prisma';
import { EMAIL_QUEUE_NAME, SEND_EMAIL_JOB_NAME, bullRedisConnectionOptions, EmailJobPayload } from './email.queue';
import { sendMailWithSender } from '../services/mail.service';
import { rateLimitService } from '../services/rateLimit.service';
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

      if (job.name !== SEND_EMAIL_JOB_NAME) {
        logger.warn('Worker', `Ignoring unrecognized job name '${job.name}' (Job ID: ${job.id})`);
        return;
      }

      const { emailId } = job.data;
      if (!emailId) {
        logger.error('Worker', `Job [ID: ${job.id}] missing required payload 'emailId'!`);
        throw new Error(`Job missing required emailId`);
      }

      const currentAttempt = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = currentAttempt >= maxAttempts;

      logger.info('Worker', '==================================================');
      logger.info(
        'Worker',
        `[Job Claimed] BullMQ Job ID: ${job.id} | Email ID: ${emailId} | Attempt ${currentAttempt}/${maxAttempts}`
      );

      // 1. Fetch Email and Sender from PostgreSQL
      const emailRecord = await prisma.email.findUnique({
        where: { id: emailId },
        include: { sender: true },
      });

      if (!emailRecord) {
        logger.error('Worker', `[Job Error] Email record not found in PostgreSQL for ID: ${emailId}`);
        throw new Error(`Email record not found in database: ${emailId}`);
      }

      if (!emailRecord.sender) {
        logger.error('Worker', `[Job Error] Sender record missing for Email ID: ${emailId}`);
        throw new Error(`Sender record missing for Email ID: ${emailId}`);
      }

      // 2. Already-SENT Idempotency Guard (immediately before send)
      if (emailRecord.status === EmailStatus.SENT) {
        logger.info(
          'Worker',
          `[Idempotency Guard] Email ID ${emailId} is already SENT in PostgreSQL. Skipping SMTP send safely.`
        );
        logger.info('Worker', '==================================================');
        return;
      }

      // 3. Atomic Redis Rate Limit Reservation (Minimum Delay & Hourly Quota)
      const reservation = await rateLimitService.reserveSendSlot(emailRecord.senderId);

      if (!reservation.allowed) {
        logger.info(
          'RateLimit',
          `[RateLimit Rescheduled] Job ${job.id} (Email ${emailId}) denied reservation (${reservation.reason}). Delaying by ${reservation.rescheduleDelayMs}ms.`
        );
        logger.info('Worker', '==================================================');

        // Move job back to BullMQ delayed set in Redis and throw DelayedError
        await job.moveToDelayed(Date.now() + reservation.rescheduleDelayMs, job.token);
        throw new DelayedError();
      }

      // 4. Atomic State Transition: SCHEDULED -> PROCESSING (Increment attempts ONCE per SMTP attempt)
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
        // Atomic DB claim failed: Rollback Redis reservation safely via Authoritative Lua Rollback
        await rateLimitService.releaseReservationSlot(
          emailRecord.senderId,
          reservation.reservationToken!,
          reservation.hourWindow!
        );

        const currentRecord = await prisma.email.findUnique({ where: { id: emailId } });
        if (currentRecord?.status === EmailStatus.SENT) {
          logger.info(
            'Worker',
            `[Idempotency Guard] Email ID ${emailId} was marked SENT by another worker process. Skipping cleanly.`
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
        `[SMTP Sending] Attempting delivery for Email ID ${emailId} via Sender '${emailRecord.sender.email}' to '${emailRecord.recipient}'...`
      );

      try {
        // 4. Real Nodemailer Ethereal SMTP Delivery
        const sendResult = await sendMailWithSender(emailRecord.sender, emailRecord);

        // 5. Update PostgreSQL state to SENT
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
          `[SMTP Delivery Success] Email ID ${emailId} sent successfully via SMTP in ${durationMs}ms (MessageId: ${sendResult.messageId}).`
        );
        if (sendResult.previewUrl) {
          logger.info('Worker', `[Ethereal Preview URL] ${sendResult.previewUrl}`);
        }
        logger.info('Worker', '==================================================');
      } catch (err: any) {
        const safeErrorMessage = err instanceof Error ? err.message : String(err);
        logger.error(
          'Worker',
          `[SMTP Delivery Failed] Email ID ${emailId} (Attempt ${currentAttempt}/${maxAttempts}) failed: ${safeErrorMessage}`
        );

        if (!isFinalAttempt) {
          // Retryable SMTP failure: Reset status to SCHEDULED so PostgreSQL state remains retryable.
          // Note: Original scheduledAt is preserved without alteration!
          await prisma.email.update({
            where: { id: emailId },
            data: {
              status: EmailStatus.SCHEDULED,
              errorMessage: `Attempt ${currentAttempt}/${maxAttempts} failed: ${safeErrorMessage}`,
            },
          });

          logger.warn(
            'Worker',
            `[Retry Scheduled] Email ID ${emailId} reset to SCHEDULED state. Re-throwing error for BullMQ exponential backoff.`
          );
          logger.info('Worker', '==================================================');
          throw err; // Re-throw error so BullMQ schedules exponential retry
        } else {
          // Final attempt exhausted: Transition permanently to FAILED state
          await prisma.email.update({
            where: { id: emailId },
            data: {
              status: EmailStatus.FAILED,
              errorMessage: `Final attempt ${currentAttempt}/${maxAttempts} failed: ${safeErrorMessage}`,
            },
          });

          logger.error(
            'Worker',
            `[Retries Exhausted] Email ID ${emailId} permanently transitioned to FAILED state.`
          );
          logger.info('Worker', '==================================================');
        }
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
    logger.error('Worker', `BullMQ Job [ID: ${job?.id}] marked as FAILED: ${err.message}`);
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
