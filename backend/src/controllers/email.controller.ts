import { Request, Response, NextFunction } from 'express';
import { scheduleEmailsBatch, getScheduledEmails, getSentEmails, CustomServiceError } from '../services/email.service';

export async function scheduleEmailsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await scheduleEmailsBatch(req.body);
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
    const emails = await getScheduledEmails();
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
    const emails = await getSentEmails();
    res.status(200).json({
      count: emails.length,
      emails,
    });
  } catch (error) {
    next(error);
  }
}
