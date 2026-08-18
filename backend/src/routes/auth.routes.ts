import { Router, Request, Response } from 'express';
import passport from 'passport';
import { User } from '@prisma/client';
import { config } from '../config/env';
import { sessionService } from '../services/session.service';
import { requireAuth } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

// 1. Initiate Google OAuth Login with CSRF State Protection
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: true as any,
    session: false,
  })
);

// 2. Google OAuth Callback Handler
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${config.frontendUrl}/login?error=auth_failed`,
    session: false,
  }),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      if (!user) {
        logger.error('API', '[OAuth Callback Error] User object missing on authenticated request');
        res.redirect(`${config.frontendUrl}/login?error=user_missing`);
        return;
      }

      // Create Redis-backed session and set HTTP-only cookie
      const sessionId = await sessionService.createSession(user.id);
      sessionService.setSessionCookie(res, sessionId);

      logger.info('API', `[OAuth Success] User ${user.email} authenticated. Session ${sessionId} issued. Redirecting to dashboard.`);
      res.redirect(`${config.frontendUrl}/dashboard`);
    } catch (err) {
      logger.error('API', '[OAuth Callback Exception] Exception in google callback handler', err);
      res.redirect(`${config.frontendUrl}/login?error=server_error`);
    }
  }
);

// 3. Get Authenticated User Details
router.get('/me', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  res.json({
    authenticated: true,
    user: {
      id: user.id,
      googleId: user.googleId,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
  });
});

// 4. Destroy Session & Logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies?.reachinbox_sid;
    if (sessionId) {
      await sessionService.destroySession(sessionId);
    }
    sessionService.clearSessionCookie(res);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    logger.error('API', 'Error during logout endpoint execution', err);
    sessionService.clearSessionCookie(res);
    res.json({ message: 'Logged out' });
  }
});

export default router;
