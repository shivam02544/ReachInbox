import { Router } from 'express';
import {
  scheduleEmailsController,
  getScheduledEmailsController,
  getSentEmailsController,
} from '../controllers/email.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Schedule email batch (Protected)
router.post('/schedule', requireAuth, scheduleEmailsController);

// List scheduled emails (Protected)
router.get('/scheduled', requireAuth, getScheduledEmailsController);

// List sent emails (Protected)
router.get('/sent', requireAuth, getSentEmailsController);

export default router;
