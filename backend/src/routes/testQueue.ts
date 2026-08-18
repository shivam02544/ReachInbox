import { Router, Request, Response, NextFunction } from 'express';
import { addTestJob } from '../queues/email.queue';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Temporary Development Endpoint for Step 1B BullMQ Verification
 * POST /api/test/queue
 * Body: { "delayMs": 30000 }
 */
router.post('/queue', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { delayMs } = req.body;

    // Input Validation
    if (delayMs === undefined || delayMs === null || typeof delayMs !== 'number') {
      res.status(400).json({
        error: {
          message: 'Invalid request: delayMs is required and must be a number.',
          status: 400,
        },
      });
      return;
    }

    if (!Number.isInteger(delayMs) || delayMs < 1000 || delayMs > 86400000) {
      res.status(400).json({
        error: {
          message: 'Invalid delayMs: must be an integer between 1000ms (1 sec) and 86400000ms (24 hours).',
          status: 400,
        },
      });
      return;
    }

    // Enqueue BullMQ delayed job
    const result = await addTestJob(delayMs);

    logger.info('API', `Test queue endpoint enqueued job ${result.jobId} with delay ${delayMs}ms`);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
