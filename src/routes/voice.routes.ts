import { Router } from 'express';
import telnyxController from '../controllers/telnyx.controller';

const router = Router();

// Telnyx Voice Answer Webhook - Returns Call Control JSON
router.post('/answer', telnyxController.handleAnswerWebhook.bind(telnyxController));

// Telnyx Voice Status Webhook - Handles all call status events
router.post('/status', telnyxController.handleWebhook.bind(telnyxController));

export default router;
