import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export const prisma = new PrismaClient();

export async function checkPrismaConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database', 'PostgreSQL connection verified via Prisma');
    return true;
  } catch (error) {
    logger.error('Database', 'PostgreSQL connection failed via Prisma', error);
    return false;
  }
}
