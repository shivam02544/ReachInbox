import Redis from 'ioredis';
import { config } from './env';
import { logger } from '../utils/logger';

export const redis = new Redis({
  host: config.redisHost,
  port: config.redisPort,
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redis.on('connect', () => {
  logger.info('Redis', `Connected to Redis at ${config.redisHost}:${config.redisPort}`);
});

redis.on('error', (err) => {
  logger.error('Redis', 'Redis connection error', err);
});

export async function checkRedisConnection(): Promise<boolean> {
  try {
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect();
    }
    const pong = await redis.ping();
    const isOk = pong === 'PONG';
    if (isOk) {
      logger.info('Redis', 'Redis connection verified successfully');
    }
    return isOk;
  } catch (error) {
    logger.error('Redis', 'Redis connection check failed', error);
    return false;
  }
}
