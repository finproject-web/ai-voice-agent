import Telnyx from 'telnyx';
import { ITelephonyProvider, CallOptions, CallResult, CallStatus } from './provider.interface';
import logger from '../../config/logger';
import config from '../../config';

export class TelnyxProvider implements ITelephonyProvider {
  private client: Telnyx;

  constructor() {
    if (!config.telnyxApiKey) {
      throw new Error('Telnyx API key not configured');
    }
    this.client = new Telnyx(config.telnyxApiKey);
  }

  async createCall(options: CallOptions): Promise<CallResult> {
    try {
      const { to, from = config.telnyxPhoneNumber, webhookUrl, metadata } = options;

      const callPayload: any = {
        to,
        from,
        connection_id: config.telnyxConnectionId,
        caller_name: 'AI Sales Agent',
        recording_enabled: true,
        timeout: 30,
      };

      if (webhookUrl) {
        callPayload.webhook_url = webhookUrl;
        callPayload.webhook_url_method = 'POST';
      }

      // Remove client_state as it causes validation error
      // if (metadata) {
      //   callPayload.client_state = JSON.stringify(metadata);
      // }

      const call = await this.client.calls.create(callPayload);
      const callId = call.call_control_id || call.call_control_id || call.id || call.call_leg_id;

      logger.info('Telnyx outbound call created', { callId, rawCall: JSON.stringify(call).substring(0, 500) });

      return {
        callId,
        status: call.status,
        direction: call.direction,
        to: call.to,
        from: call.from,
        createdAt: new Date(call.created_at),
      };
    } catch (error) {
      logger.error('Telnyx create call failed', { error, options });
      throw error;
    }
  }

  async endCall(callId: string): Promise<void> {
    try {
      await this.client.calls.hangup(callId);
      logger.info('Telnyx call ended', { callId });
    } catch (error) {
      logger.error('Telnyx end call failed', { error, callId });
      throw error;
    }
  }

  async holdCall(callId: string, hold: boolean): Promise<void> {
    try {
      await this.client.calls.hold(callId, { hold });
      logger.info('Telnyx call hold changed', { callId, hold });
    } catch (error) {
      logger.error('Telnyx hold call failed', { error, callId, hold });
      throw error;
    }
  }

  async transferCall(callId: string, to: string, options?: any): Promise<void> {
    try {
      await this.client.calls.transfer(callId, {
        to,
        caller_name: options?.callerName,
      });
      logger.info('Telnyx call transferred', { callId, to });
    } catch (error) {
      logger.error('Telnyx transfer call failed', { error, callId, to });
      throw error;
    }
  }

  async sendDtmf(callId: string, digits: string): Promise<void> {
    try {
      await this.client.calls.sendDtmf(callId, { digits });
      logger.info('Telnyx DTMF sent', { callId, digits });
    } catch (error) {
      logger.error('Telnyx send DTMF failed', { error, callId, digits });
      throw error;
    }
  }

  async startMediaStreaming(callId: string, streamUrl: string): Promise<void> {
    try {
      logger.info('=== STARTING TELNYX MEDIA STREAMING ===', { callId, streamUrl });
      
      // Use raw HTTP request to Telnyx API (SDK doesn't support startStreaming)
      const response = await fetch(`https://api.telnyx.com/v2/calls/${callId}/actions/streaming_start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.telnyxApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stream_url: streamUrl,
          track: 'both',
          format: 'PCMU',
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Telnyx API error: ${response.status} ${errorData}`);
      }
      
      const responseData = await response.json();
      logger.info('=== TELNYX MEDIA STREAMING STARTED ===', { callId, response: responseData });
    } catch (error: any) {
      logger.error('=== TELNYX MEDIA STREAMING START FAILED ===', { 
        error: error?.message || error,
        callId,
        streamUrl
      });
      throw error;
    }
  }

  async getCallStatus(callId: string): Promise<CallStatus> {
    try {
      const call = await this.client.calls.retrieve(callId);

      return {
        callId: call.id,
        status: call.status,
        state: call.state,
        to: call.to,
        from: call.from,
        duration: call.duration || 0,
        recordingUrl: call.recording_url,
        startedAt: call.started_at ? new Date(call.started_at) : undefined,
        endedAt: call.ended_at ? new Date(call.ended_at) : undefined,
      };
    } catch (error) {
      logger.error('Telnyx get call status failed', { error, callId });
      throw error;
    }
  }

  async listCalls(filters?: any): Promise<any[]> {
    try {
      const calls = await this.client.calls.list({
        filter_status: filters?.status,
        filter_to: filters?.to,
        filter_from: filters?.from,
        limit: filters?.limit || 20,
        offset: filters?.offset || 0,
      });

      return calls.data;
    } catch (error) {
      logger.error('Telnyx list calls failed', { error, filters });
      throw error;
    }
  }

  async getRecording(callId: string): Promise<string> {
    try {
      const call = await this.client.calls.retrieve(callId);

      if (!call.recording_url) {
        throw new Error('No recording available');
      }

      return call.recording_url;
    } catch (error) {
      logger.error('Telnyx get recording failed', { error, callId });
      throw error;
    }
  }

  validateWebhookSignature(payload: string, signature: string, timestamp: string): boolean {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', config.telnyxWebhookSecret)
        .update(timestamp + payload)
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      logger.error('Telnyx webhook signature validation failed', { error });
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.calls.list({ limit: 1 });
      logger.info('Telnyx connection test successful');
      return true;
    } catch (error) {
      logger.error('Telnyx connection test failed', { error });
      return false;
    }
  }

  async speakText(callId: string, text: string, options?: any): Promise<void> {
    try {
      await this.client.calls.speak(callId, { payload: text, ...options });
    } catch (error) {
      logger.error('Telnyx speakText failed', { error, callId });
      throw error;
    }
  }
}
