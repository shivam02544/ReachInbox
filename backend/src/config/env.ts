import dotenv from 'dotenv';
import path from 'path';
import { logger } from '../utils/logger';

// Load environment variables from .env file if available
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  redisHost: string;
  redisPort: number;
  workerConcurrency: number;
  maxRecipientsPerRequest: number;
  frontendUrl: string;
}

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    logger.error('App', `Missing required environment variable: ${key}`);
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const config: AppConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  databaseUrl: getEnv('DATABASE_URL', 'postgresql://reachinbox_user:reachinbox_pass@postgres:5432/reachinbox_db?schema=public'),
  redisHost: getEnv('REDIS_HOST', 'redis'),
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  maxRecipientsPerRequest: parseInt(process.env.MAX_RECIPIENTS_PER_REQUEST || '1000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
};

logger.info('App', `Configuration initialized for ${config.nodeEnv} environment`);
