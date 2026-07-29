import { Request, Response } from 'express';
import crypto from 'crypto';
import { VoiceAgentService } from '../services/voice-agent/voice-agent.service';
import { GoogleSheetsService } from '../services/google-sheets/google-sheets.service';
import logger from '../config/logger';
import config from '../config';

const voiceAgentService = new VoiceAgentService();
const googleSheetsService = new GoogleSheetsService();

export class TelnyxController {
  private validateWebhookSignature(req: Request): boolean {
    const signature = req.headers['telnyx-signature-ed25519'] as string;
    const timestamp = req.headers['telnyx-timestamp'] as string;
    
    if (!signature || !timestamp) {
      logger.warn('Webhook missing signature headers');
      return false;
    }

    const webhookSecret = config.telnyxWebhookSecret;
    if (!webhookSecret) {
      logger.warn('Webhook secret not configured');
      return false;
    }

    const payload = timestamp + JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const webhookData = req.body;

      // Parse Telnyx webhook structure
      const eventType = webhookData.data?.event_type || webhookData.event_type || webhookData.event;
      const payload = webhookData.data?.payload || webhookData.data;
      const callControlId = payload?.call_control_id || payload?.call_id || webhookData.call_id;
      const callLegId = payload?.call_leg_id;
      const callSessionId = payload?.call_session_id;
      const occurredAt = webhookData.data?.occurred_at || webhookData.occurred_at;
      const callState = payload?.state;

      // Comprehensive webhook logging
      logger.info('=== TELNYX WEBHOOK RECEIVED ===', {
        eventType,
        callControlId,
        callLegId,
        callSessionId,
        occurredAt,
        callState,
        rawWebhookData: webhookData,
        headers: {
          'telnyx-signature-ed25519': req.headers['telnyx-signature-ed25519'],
          'telnyx-timestamp': req.headers['telnyx-timestamp'],
          'user-agent': req.headers['user-agent'],
        }
      });

      // Temporarily disable signature validation for testing
      // if (!this.validateWebhookSignature(req)) {
      //   logger.warn('Invalid webhook signature');
      //   res.status(401).json({ success: false, error: 'Invalid signature' });
      //   return;
      // }

      await voiceAgentService.handleWebhook(webhookData);
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Telnyx webhook handling failed', { error });
      res.status(500).json({ success: false, error: 'Webhook processing failed' });
    }
  }

  async handleAnswerWebhook(req: Request, res: Response): Promise<void> {
    try {
      const webhookData = req.body;

      // Parse Telnyx webhook structure
      const eventType = webhookData.data?.event_type || webhookData.event_type || webhookData.event;
      const payload = webhookData.data?.payload || webhookData.data;
      const callControlId = payload?.call_control_id || payload?.call_id || webhookData.call_id;
      const callLegId = payload?.call_leg_id;
      const callSessionId = payload?.call_session_id;
      const occurredAt = webhookData.data?.occurred_at || webhookData.occurred_at;
      const callState = payload?.state;

      // Comprehensive webhook logging
      logger.info('=== TELNYX ANSWER WEBHOOK RECEIVED ===', {
        eventType,
        callControlId,
        callLegId,
        callSessionId,
        occurredAt,
        callState,
        rawWebhookData: webhookData,
        headers: {
          'telnyx-signature-ed25519': req.headers['telnyx-signature-ed25519'],
          'telnyx-timestamp': req.headers['telnyx-timestamp'],
          'user-agent': req.headers['user-agent'],
        }
      });

      // Temporarily disable signature validation for testing
      // if (!this.validateWebhookSignature(req)) {
      //   logger.warn('Invalid webhook signature');
      //   res.status(401).json({ success: false, error: 'Invalid signature' });
      //   return;
      // }

      // Process the webhook
      await voiceAgentService.handleWebhook(webhookData);

      // Get media stream URL from config
      // TELNYX_MEDIA_STREAM_URL is already in wss:// format with /media-stream path
      const mediaStreamUrl = config.telnyxMediaStreamUrl;
      let wsUrl = '';
      if (mediaStreamUrl) {
        // Already has correct format: wss://domain/media-stream
        wsUrl = mediaStreamUrl;
      } else if (config.ngrokUrl) {
        // Fallback: build from ngrok URL
        wsUrl = config.ngrokUrl.replace(/^https:\/\//, 'wss://').replace(/\/$/, '') + '/media-stream';
      }

      logger.info('=== RETURNING CALL CONTROL COMMANDS ===', {
        callControlId,
        mediaStreamUrl: wsUrl,
        hasMediaStreamUrl: !!wsUrl
      });

      // Return Telnyx Call Control JSON to answer the call and start media streaming
      const commands: any[] = [
        {
          command: 'answer'
        }
      ];

      // Add streaming_start command if media stream URL is configured
      if (wsUrl) {
        commands.push({
          command: 'streaming_start',
          params: {
            stream_url: wsUrl,
            track: 'both',
            format: 'PCMU'
          }
        });
        logger.info('=== STREAMING_START COMMAND ADDED ===', { streamUrl: wsUrl });
      } else {
        logger.warn('=== NO MEDIA STREAM URL CONFIGURED - SKIPPING STREAMING_START ===');
      }

      res.status(200).json({ commands });
    } catch (error) {
      logger.error('Telnyx answer webhook handling failed', { error });
      res.status(500).json({ error: 'Answer webhook processing failed' });
    }
  }

  async handleAudioStream(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const audioData = req.body;

      if (!sessionId) {
        res.status(400).json({ error: 'Session ID required' });
        return;
      }

      const responseAudio = await voiceAgentService.processAudio(
        sessionId,
        Buffer.from(audioData)
      );

      res.set('Content-Type', 'audio/mpeg');
      res.send(responseAudio);
    } catch (error) {
      logger.error('Audio stream processing failed', { error });
      res.status(500).json({ error: 'Audio processing failed' });
    }
  }

  async initiateCall(req: Request, res: Response): Promise<void> {
    try {
      const { phoneNumber, sessionId, customerContext: providedCustomerContext } = req.body;

      if (!phoneNumber || !sessionId) {
        res.status(400).json({ error: 'Phone number and session ID required' });
        return;
      }

      logger.info('Initiating call', { phoneNumber, sessionId, hasProvidedContext: !!providedCustomerContext });

      // Start with manually provided context, then merge Google Sheets lead data
      let customerContext: any = {
        phone: phoneNumber,
        ...(providedCustomerContext || {}),
        leadData: providedCustomerContext?.leadData || {},
      };

      try {
        const leadData = await googleSheetsService.findLeadByPhone(phoneNumber);
        if (leadData) {
          customerContext = {
            ...customerContext,
            name: (leadData.name as string) || customerContext.name,
            email: (leadData.email as string) || customerContext.email,
            leadId: (leadData.lead_id as string) || phoneNumber,
            leadData: { ...leadData, ...customerContext.leadData },
          };
          logger.info('=== CUSTOMER DATA FROM GOOGLE SHEETS ===', { customerContext });
        } else {
          logger.info('No lead found in Google Sheets for phone', { phoneNumber });
        }
      } catch (sheetError) {
        logger.warn('Google Sheets lookup failed, using provided or default customer context', { error: sheetError });
      }
      
      await voiceAgentService.initializeAgent({ sessionId, phoneNumber, leadId: customerContext.leadId }, customerContext);
      const callId = await voiceAgentService.makeCall(phoneNumber, sessionId);

      res.status(200).json({ success: true, callId, sessionId });
    } catch (error) {
      logger.error('Call initiation failed', { error });
      res.status(500).json({ success: false, error: (error as Error).message || 'Call initiation failed' });
    }
  }

  async endCall(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        res.status(400).json({ error: 'Session ID required' });
        return;
      }

      await voiceAgentService.endCall(sessionId);
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Call ending failed', { error });
      res.status(500).json({ success: false, error: 'Call ending failed' });
    }
  }

  async getAgentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        res.status(400).json({ error: 'Session ID required' });
        return;
      }

      const agentState = voiceAgentService.getAgentState(sessionId);

      if (!agentState) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      res.status(200).json({ success: true, agent: agentState });
    } catch (error) {
      logger.error('Agent status retrieval failed', { error });
      res.status(500).json({ success: false, error: 'Status retrieval failed' });
    }
  }

  async getAllAgents(_req: Request, res: Response): Promise<void> {
    try {
      const agents = voiceAgentService.getAllAgents();
      const activeCount = voiceAgentService.getActiveAgentCount();

      res.status(200).json({
        success: true,
        agents,
        activeCount,
        totalCount: agents.length,
      });
    } catch (error) {
      logger.error('All agents retrieval failed', { error });
      res.status(500).json({ success: false, error: 'Agents retrieval failed' });
    }
  }

  async initiateProductionCall(_req: Request, res: Response): Promise<void> {
    try {
      logger.info('=== PRODUCTION CALL INITIATED - FETCHING FROM GOOGLE SHEETS ===');
      
      // Fetch next unprocessed lead from Google Sheets
      const lead = await voiceAgentService.makeCallFromGoogleSheets();
      
      if (!lead) {
        logger.info('=== NO UNPROCESSED LEADS FOUND ===');
        res.status(200).json({ success: true, message: 'No unprocessed leads found' });
        return;
      }
      
      logger.info('=== PRODUCTION CALL INITIATED SUCCESSFULLY ===', { lead });
      res.status(200).json({ success: true, lead });
    } catch (error) {
      logger.error('Production call initiation failed', { error });
      res.status(500).json({ success: false, error: 'Production call initiation failed' });
    }
  }
}

export default new TelnyxController();
