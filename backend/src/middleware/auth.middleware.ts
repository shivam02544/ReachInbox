import { Request, Response, NextFunction } from 'express';
import { sessionService } from '../services/session.service';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionId = req.cookies?.reachinbox_sid;
    if (!sessionId) {
      res.status(401).json({ error: { message: 'Unauthorized: Missing authentication cookie' } });
      return;
    }

    const session = await sessionService.getSession(sessionId);
    if (!session) {
      res.status(401).json({ error: { message: 'Unauthorized: Session expired or invalid' } });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      res.status(401).json({ error: { message: 'Unauthorized: User record no longer exists' } });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    logger.error('API', 'Error in requireAuth middleware', err);
    res.status(500).json({ error: { message: 'Internal server error during authentication check' } });
  }
}
