import { Router } from 'express';
import telnyxController from '../controllers/telnyx.controller';

const router = Router();

// Webhook endpoint for Telnyx events
router.post('/webhook', telnyxController.handleWebhook.bind(telnyxController));

// Audio streaming endpoint
router.post('/audio/:sessionId', telnyxController.handleAudioStream.bind(telnyxController));

// Call management endpoints
router.post('/call/initiate', telnyxController.initiateCall.bind(telnyxController));
router.post('/call/end/:sessionId', telnyxController.endCall.bind(telnyxController));

// Agent status endpoints
router.get('/agent/:sessionId', telnyxController.getAgentStatus.bind(telnyxController));
router.get('/agents', telnyxController.getAllAgents.bind(telnyxController));

// Production call endpoint (Google Sheets auto-fetch)
router.post('/call/production', telnyxController.initiateProductionCall.bind(telnyxController));

export default router;
