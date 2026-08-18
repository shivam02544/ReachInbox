import { Router } from 'express';
import {
  scheduleEmailsController,
  getScheduledEmailsController,
  getSentEmailsController,
} from '../controllers/email.controller';

const router = Router();

// Schedule email batch
router.post('/schedule', scheduleEmailsController);

// List scheduled emails (status = SCHEDULED)
router.get('/scheduled', getScheduledEmailsController);

// List sent emails (status = SENT)
router.get('/sent', getSentEmailsController);

export default router;
