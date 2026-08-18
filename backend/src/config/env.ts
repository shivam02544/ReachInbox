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
  minEmailDelayMs: number;
  maxEmailsPerHourPerSender: number;
  frontendUrl: string;
  ethereal: {
    host: string;
    port: number;
    user: string;
    pass: string;
    secure: boolean;
  };
  google: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };
  session: {
    ttlSeconds: number;
    secret: string;
  };
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
  minEmailDelayMs: parseInt(process.env.MIN_EMAIL_DELAY_MS || '2000', 10),
  maxEmailsPerHourPerSender: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '200', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  ethereal: {
    host: process.env.ETHEREAL_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.ETHEREAL_PORT || '587', 10),
    user: process.env.ETHEREAL_USER || 'x6wf6elp3ert62r3@ethereal.email',
    pass: process.env.ETHEREAL_PASSWORD || 'jREstXBKhb1Rjw1txP',
    secure: process.env.ETHEREAL_SECURE === 'true',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || 'google_client_id_placeholder',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'google_client_secret_placeholder',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
  },
  session: {
    ttlSeconds: parseInt(process.env.SESSION_TTL_SECONDS || '86400', 10),
    secret: process.env.SESSION_SECRET || 'reachinbox_dev_session_secret_change_in_prod',
  },
};

logger.info('App', `Configuration initialized for ${config.nodeEnv} environment`);
