import { Router } from 'express';
import { getSendersController } from '../controllers/email.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Get available senders for authenticated user (Protected)
router.get('/', requireAuth, getSendersController);

export default router;
