import { Router, Request, Response } from 'express';
import { checkPrismaConnection } from '../config/prisma';
import { checkRedisConnection } from '../config/redis';

const router = Router();

// Process health check (basic process liveness)
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Dependency health check (PostgreSQL and Redis connectivity test)
router.get('/health/deps', async (_req: Request, res: Response) => {
  const dbConnected = await checkPrismaConnection();
  const redisConnected = await checkRedisConnection();

  const isHealthy = dbConnected && redisConnected;
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: isHealthy ? 'ok' : 'degraded',
    dependencies: {
      postgres: dbConnected ? 'connected' : 'disconnected',
      redis: redisConnected ? 'connected' : 'disconnected'
    }
  });
});

export default router;
