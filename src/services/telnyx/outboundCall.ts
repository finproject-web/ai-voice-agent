import telnyxClient from './telnyxClient';
import config from '../../config';
import logger from '../../config/logger';

interface OutboundCallOptions {
  to: string;
  from?: string;
  connectionId?: string;
  webhookUrl?: string;
  callerName?: string;
  recordingEnabled?: boolean;
  timeout?: number;
}

interface CallResult {
  callId: string;
  status: string;
  direction: string;
  to: string;
  from: string;
  createdAt: Date;
}

export class OutboundCallService {
  static async createCall(options: OutboundCallOptions): Promise<CallResult> {
    try {
      const {
        to,
        from = config.telnyxPhoneNumber,
        connectionId = config.telnyxConnectionId,
        webhookUrl,
        callerName = 'AI Sales Agent',
        recordingEnabled = true,
        timeout = 30,
      } = options;

      const client = telnyxClient.getClient();

      const callPayload: any = {
        to,
        from,
        connection_id: connectionId,
        caller_name: callerName,
        recording_enabled: recordingEnabled,
        timeout,
      };

      if (webhookUrl) {
        callPayload.webhook_url = webhookUrl;
        callPayload.webhook_url_method = 'POST';
      }

      const call = await client.calls.create(callPayload);

      logger.info('Telnyx outbound call created', {
        callId: call.id,
        to,
        from,
      });

      return {
        callId: call.id,
        status: call.status,
        direction: call.direction,
        to: call.to,
        from: call.from,
        createdAt: new Date(call.created_at),
      };
    } catch (error) {
      logger.error('Failed to create Telnyx outbound call', { error, options });
      throw error;
    }
  }

  static async createCallWithAI(
    options: OutboundCallOptions & {
      script?: string;
      context?: any;
    }
  ): Promise<CallResult> {
    try {
      const { script, context, ...callOptions } = options;

      // Create the base call
      const callResult = await this.createCall(callOptions);

      // If script is provided, it will be handled by the AI agent
      // via webhook events when the call connects

      logger.info('Telnyx AI outbound call created', {
        callId: callResult.callId,
        hasScript: !!script,
        hasContext: !!context,
      });

      return callResult;
    } catch (error) {
      logger.error('Failed to create Telnyx AI outbound call', { error, options });
      throw error;
    }
  }

  static async endCall(callId: string): Promise<void> {
    try {
      const client = telnyxClient.getClient();
      await client.calls.hangup(callId);

      logger.info('Telnyx call ended', { callId });
    } catch (error) {
      logger.error('Failed to end Telnyx call', { error, callId });
      throw error;
    }
  }

  static async holdCall(callId: string, hold: boolean = true): Promise<void> {
    try {
      const client = telnyxClient.getClient();
      await client.calls.hold({ call_control_id: callId, hold });

      logger.info('Telnyx call hold status changed', { callId, hold });
    } catch (error) {
      logger.error('Failed to change Telnyx call hold status', { error, callId, hold });
      throw error;
    }
  }

  static async transferCall(
    callId: string,
    to: string,
    options?: {
      callerName?: string;
    }
  ): Promise<void> {
    try {
      const client = telnyxClient.getClient();
      await client.calls.transfer({
        call_control_id: callId,
        to,
        caller_name: options?.callerName,
      });

      logger.info('Telnyx call transferred', { callId, to });
    } catch (error) {
      logger.error('Failed to transfer Telnyx call', { error, callId, to });
      throw error;
    }
  }

  static async sendDtmf(callId: string, digits: string): Promise<void> {
    try {
      const client = telnyxClient.getClient();
      await client.calls.sendDtmf({ call_control_id: callId, digits });

      logger.info('DTMF sent via Telnyx', { callId, digits });
    } catch (error) {
      logger.error('Failed to send DTMF via Telnyx', { error, callId, digits });
      throw error;
    }
  }

  static async speakText(
    callId: string,
    text: string,
    options?: {
      language?: string;
      voice?: string;
      gender?: string;
    }
  ): Promise<void> {
    try {
      const client = telnyxClient.getClient();
      await client.calls.speak({
        call_control_id: callId,
        payload: text,
        language: options?.language || 'en-US',
        voice: options?.voice || 'google.en_US.standard',
        gender: options?.gender || 'female',
      });

      logger.info('Text spoken via Telnyx', { callId, textLength: text.length });
    } catch (error) {
      logger.error('Failed to speak text via Telnyx', { error, callId });
      throw error;
    }
  }
}

export default OutboundCallService;
