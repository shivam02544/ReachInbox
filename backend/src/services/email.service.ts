import { EmailStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { config } from '../config/env';
import { addEmailJob } from '../queues/email.queue';
import { generateIdempotencyKey } from '../utils/idempotency';
import { sanitizeRecipients } from '../utils/emailValidation';
import { logger } from '../utils/logger';

export interface ScheduleEmailsDTO {
  senderId: string;
  subject: string;
  body: string;
  startTime: string;
  delayMs: number;
  recipients: string[];
}

export interface ScheduledEmailItem {
  id: string;
  recipient: string;
  scheduledAt: string;
  status: string;
}

export interface ScheduleBatchResult {
  message: string;
  summary: {
    totalRequested: number;
    scheduledCount: number;
    alreadyExistsCount: number;
    invalidRecipientsCount: number;
    failedEnqueueCount: number;
  };
  scheduledEmails: ScheduledEmailItem[];
  skippedDuplicates: string[];
  invalidRecipients: string[];
  partialFailures: Array<{ emailId: string; recipient: string; error: string }>;
}

export class CustomServiceError extends Error {
  status: number;
  constructor(message: string, status: number = 400) {
    super(message);
    this.status = status;
  }
}

export async function scheduleEmailsBatch(dto: ScheduleEmailsDTO, userId: string): Promise<ScheduleBatchResult> {
  const { senderId, subject, body, startTime, delayMs, recipients } = dto;

  // 1. Sender Validation & Ownership Check
  if (!senderId || typeof senderId !== 'string') {
    throw new CustomServiceError('senderId is required and must be a valid string.', 400);
  }

  const sender = await prisma.sender.findFirst({
    where: { id: senderId, userId },
  });

  if (!sender) {
    throw new CustomServiceError(`Forbidden: Sender with ID '${senderId}' not found or does not belong to authenticated user.`, 403);
  }

  // 2. Input Field Validations
  if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
    throw new CustomServiceError('subject is required and cannot be empty.', 400);
  }
  if (subject.trim().length > 500) {
    throw new CustomServiceError('subject exceeds maximum length of 500 characters.', 400);
  }

  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    throw new CustomServiceError('body is required and cannot be empty.', 400);
  }

  if (!startTime || typeof startTime !== 'string') {
    throw new CustomServiceError('startTime is required and must be an ISO 8601 string.', 400);
  }

  const startDate = new Date(startTime);
  if (isNaN(startDate.getTime())) {
    throw new CustomServiceError('startTime must be a valid ISO 8601 timestamp.', 400);
  }

  if (delayMs === undefined || delayMs === null || typeof delayMs !== 'number') {
    throw new CustomServiceError('delayMs is required and must be a number.', 400);
  }

  if (!Number.isInteger(delayMs) || delayMs < 1000 || delayMs > 86400000) {
    throw new CustomServiceError('delayMs must be an integer between 1000ms and 86400000ms (24 hours).', 400);
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new CustomServiceError('recipients must be a non-empty array of email strings.', 400);
  }

  if (recipients.length > config.maxRecipientsPerRequest) {
    throw new CustomServiceError(
      `recipients array size (${recipients.length}) exceeds maximum limit of ${config.maxRecipientsPerRequest} per request.`,
      400
    );
  }

  // 3. Recipient Sanitization & Validation
  const { validRecipients, invalidRecipients } = sanitizeRecipients(recipients);
  if (validRecipients.length === 0) {
    throw new CustomServiceError(
      `No valid recipient email addresses found in request. Invalid emails provided: ${invalidRecipients.join(', ')}`,
      400
    );
  }

  const scheduledEmails: ScheduledEmailItem[] = [];
  const skippedDuplicates: string[] = [];
  const partialFailures: Array<{ emailId: string; recipient: string; error: string }> = [];

  // 4. Process Each Valid Recipient Independently
  for (let idx = 0; idx < validRecipients.length; idx++) {
    const recipient = validRecipients[idx];
    const scheduledAt = new Date(startDate.getTime() + idx * delayMs);
    const idempotencyKey = generateIdempotencyKey(senderId, recipient, subject, body, scheduledAt);

    // Check if matching logical email already exists in PostgreSQL
    const existingEmail = await prisma.email.findUnique({
      where: { idempotencyKey },
    });

    if (existingEmail) {
      logger.info(
        'API',
        `[Duplicate Batch Behavior] Skipping recipient '${recipient}' — email record already exists [ID: ${existingEmail.id}]`
      );
      skippedDuplicates.push(recipient);
      continue;
    }

    try {
      // Create PostgreSQL Email Record (status = SCHEDULED)
      const emailRecord = await prisma.email.create({
        data: {
          userId,
          senderId,
          recipient,
          subject: subject.trim(),
          body: body.trim(),
          status: EmailStatus.SCHEDULED,
          scheduledAt,
          idempotencyKey,
        },
      });

      // Enqueue BullMQ Delayed Job
      try {
        const enqueueResult = await addEmailJob(emailRecord.id, scheduledAt);

        // Update Email.bullJobId in PostgreSQL
        await prisma.email.update({
          where: { id: emailRecord.id },
          data: { bullJobId: enqueueResult.jobId },
        });

        scheduledEmails.push({
          id: emailRecord.id,
          recipient: emailRecord.recipient,
          scheduledAt: emailRecord.scheduledAt.toISOString(),
          status: EmailStatus.SCHEDULED,
        });
      } catch (queueError: any) {
        logger.error(
          'API',
          `[Partial Failure] Created Email row [ID: ${emailRecord.id}] but failed to enqueue BullMQ job`,
          queueError
        );
        partialFailures.push({
          emailId: emailRecord.id,
          recipient,
          error: queueError instanceof Error ? queueError.message : String(queueError),
        });
      }
    } catch (dbError: any) {
      // Prisma P2002 is unique constraint violation on idempotencyKey
      if (dbError.code === 'P2002') {
        logger.info('API', `[Race Condition] Idempotency conflict for recipient '${recipient}', skipping cleanly.`);
        skippedDuplicates.push(recipient);
      } else {
        logger.error('API', `Database error inserting email for recipient '${recipient}'`, dbError);
        throw dbError;
      }
    }
  }

  logger.info(
    'API',
    `Schedule batch complete for User ${userId}: ${scheduledEmails.length} scheduled, ${skippedDuplicates.length} duplicates skipped, ${partialFailures.length} partial failures.`
  );

  return {
    message: 'Email batch scheduling completed',
    summary: {
      totalRequested: recipients.length,
      scheduledCount: scheduledEmails.length,
      alreadyExistsCount: skippedDuplicates.length,
      invalidRecipientsCount: invalidRecipients.length,
      failedEnqueueCount: partialFailures.length,
    },
    scheduledEmails,
    skippedDuplicates,
    invalidRecipients,
    partialFailures,
  };
}

export async function getScheduledEmails(userId: string) {
  return prisma.email.findMany({
    where: { userId, status: EmailStatus.SCHEDULED },
    select: {
      id: true,
      senderId: true,
      recipient: true,
      subject: true,
      status: true,
      scheduledAt: true,
      attempts: true,
      bullJobId: true,
      createdAt: true,
    },
    orderBy: { scheduledAt: 'asc' },
  });
}

export async function getSentEmails(userId: string) {
  return prisma.email.findMany({
    where: { userId, status: EmailStatus.SENT },
    select: {
      id: true,
      senderId: true,
      recipient: true,
      subject: true,
      status: true,
      scheduledAt: true,
      sentAt: true,
      attempts: true,
      createdAt: true,
    },
    orderBy: { sentAt: 'desc' },
  });
}
