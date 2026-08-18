import { Request, Response, NextFunction } from 'express';
import { scheduleEmailsBatch, getScheduledEmails, getSentEmails, CustomServiceError } from '../services/email.service';
import { parseCsvBuffer } from '../utils/csvParser';
import { sanitizeRecipients } from '../utils/emailValidation';
import { prisma } from '../config/prisma';
import { config } from '../config/env';

export async function parseCsvController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: { message: 'No CSV file provided in request.' } });
      return;
    }

    const { rawEmails, totalRows } = parseCsvBuffer(req.file.buffer);
    const { validRecipients, invalidRecipients } = sanitizeRecipients(rawEmails);

    // Calculate in-file duplicates
    const seen = new Set<string>();
    const duplicateRecipients: string[] = [];
    for (const raw of rawEmails) {
      const normalized = raw.trim().toLowerCase();
      if (seen.has(normalized)) {
        if (!duplicateRecipients.includes(normalized)) {
          duplicateRecipients.push(normalized);
        }
      } else {
        seen.add(normalized);
      }
    }

    if (validRecipients.length > config.maxRecipientsPerRequest) {
      res.status(400).json({
        error: {
          message: `Recipient count (${validRecipients.length}) exceeds maximum limit of ${config.maxRecipientsPerRequest} per request.`,
        },
      });
      return;
    }

    res.status(200).json({
      filename: req.file.originalname,
      summary: {
        totalRows,
        validRecipientsCount: validRecipients.length,
        invalidRecipientsCount: invalidRecipients.length,
        duplicateRecipientsCount: duplicateRecipients.length,
        skippedRowsCount: totalRows - (validRecipients.length + invalidRecipients.length),
      },
      validRecipients,
      invalidRecipients,
      duplicateRecipients,
    });
  } catch (error: any) {
    res.status(400).json({
      error: {
        message: error.message || 'Failed to parse CSV file.',
      },
    });
  }
}

export async function getSendersController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const senders = await prisma.sender.findMany({
      where: { userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.status(200).json({ senders });
  } catch (error) {
    next(error);
  }
}

export async function scheduleEmailsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const result = await scheduleEmailsBatch(req.body, userId);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof CustomServiceError) {
      res.status(error.status).json({
        error: {
          message: error.message,
          status: error.status,
        },
      });
      return;
    }
    next(error);
  }
}

export async function getScheduledEmailsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const emails = await getScheduledEmails(userId);
    res.status(200).json({
      count: emails.length,
      emails,
    });
  } catch (error) {
    next(error);
  }
}

export async function getSentEmailsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const emails = await getSentEmails(userId);
    res.status(200).json({
      count: emails.length,
      emails,
    });
  } catch (error) {
    next(error);
  }
}
