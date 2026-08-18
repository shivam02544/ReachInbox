import { Router } from 'express';
import multer from 'multer';
import { config } from '../config/env';
import {
  scheduleEmailsController,
  getScheduledEmailsController,
  getSentEmailsController,
  getFailedEmailsController,
  getEmailStatsController,
  parseCsvController,
  getSendersController,
} from '../controllers/email.controller';
import { requireAuth } from '../middleware/auth.middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxCsvFileSizeMb * 1024 * 1024,
  },
});

const router = Router();

// Parse CSV file for preview (Protected)
router.post('/parse-csv', requireAuth, upload.single('file'), parseCsvController);

// Get available senders for dropdown (Protected)
router.get('/senders', requireAuth, getSendersController);

// Schedule email batch (Protected)
router.post('/schedule', requireAuth, scheduleEmailsController);

// Get dashboard email analytics stats (Protected)
router.get('/stats', requireAuth, getEmailStatsController);

// List scheduled emails (Protected)
router.get('/scheduled', requireAuth, getScheduledEmailsController);

// List sent emails (Protected)
router.get('/sent', requireAuth, getSentEmailsController);

// List failed emails (Protected)
router.get('/failed', requireAuth, getFailedEmailsController);

export default router;
