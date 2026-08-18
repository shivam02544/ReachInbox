import { randomUUID } from 'node:crypto';
import { Response } from 'express';
import { redis } from '../config/redis';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export interface UserSessionData {
  userId: string;
  createdAt: string;
  lastSeenAt: string;
}

export class SessionService {
  /**
   * Creates a new Redis-backed session for a user and returns the sessionId.
   */
  async createSession(userId: string): Promise<string> {
    const sessionId = randomUUID();
    const sessionKey = `auth:session:${sessionId}`;
    const now = new Date().toISOString();

    const data: UserSessionData = {
      userId,
      createdAt: now,
      lastSeenAt: now,
    };

    await redis.set(sessionKey, JSON.stringify(data), 'EX', config.session.ttlSeconds);
    logger.info('API', `[Session Created] Session ${sessionId} created for User ${userId} (TTL: ${config.session.ttlSeconds}s)`);

    return sessionId;
  }

  /**
   * Retrieves an active session from Redis.
   */
  async getSession(sessionId: string): Promise<UserSessionData | null> {
    if (!sessionId) return null;
    const sessionKey = `auth:session:${sessionId}`;
    const raw = await redis.get(sessionKey);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as UserSessionData;
    } catch (err) {
      logger.error('API', `Failed to parse session data for session ${sessionId}`, err);
      return null;
    }
  }

  /**
   * Destroys an active session in Redis.
   */
  async destroySession(sessionId: string): Promise<boolean> {
    if (!sessionId) return false;
    const sessionKey = `auth:session:${sessionId}`;
    const deletedCount = await redis.del(sessionKey);
    logger.info('API', `[Session Destroyed] Session ${sessionId} destroyed.`);
    return deletedCount > 0;
  }

  /**
   * Sets the HTTP-only authentication cookie on the HTTP response.
   */
  setSessionCookie(res: Response, sessionId: string): void {
    res.cookie('reachinbox_sid', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
      maxAge: config.session.ttlSeconds * 1000,
    });
  }

  /**
   * Clears the HTTP-only authentication cookie from the HTTP response.
   */
  clearSessionCookie(res: Response): void {
    res.clearCookie('reachinbox_sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
    });
  }
}

export const sessionService = new SessionService();
