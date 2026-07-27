import telnyxClient from './telnyxClient';
import logger from '../../config/logger';

interface CallStatus {
  callId: string;
  status: string;
  direction: string;
  to: string;
  from: string;
  duration: number;
  recordingUrl?: string;
  startedAt?: Date;
  endedAt?: Date;
  state: string;
}

export class CallStatusService {
  static async getCallStatus(callId: string): Promise<CallStatus> {
    try {
      const client = telnyxClient.getClient();
      const call = await client.calls.retrieve(callId);

      const callStatus: CallStatus = {
        callId: call.id,
        status: call.status,
        direction: call.direction,
        to: call.to,
        from: call.from,
        duration: call.duration || 0,
        recordingUrl: call.recording_url,
        startedAt: call.started_at ? new Date(call.started_at) : undefined,
        endedAt: call.ended_at ? new Date(call.ended_at) : undefined,
        state: call.state,
      };

      logger.info('Telnyx call status retrieved', { callId, status: call.status });

      return callStatus;
    } catch (error) {
      logger.error('Failed to retrieve Telnyx call status', { error, callId });
      throw error;
    }
  }

  static async listCalls(filters?: {
    status?: string;
    to?: string;
    from?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      const client = telnyxClient.getClient();
      const calls = await client.calls.list({
        filter_status: filters?.status,
        filter_to: filters?.to,
        filter_from: filters?.from,
        limit: filters?.limit || 20,
        offset: filters?.offset || 0,
      });

      logger.info('Telnyx calls listed', { count: calls.data.length });

      return calls.data;
    } catch (error) {
      logger.error('Failed to list Telnyx calls', { error, filters });
      throw error;
    }
  }

  static async getCallRecording(callId: string): Promise<string> {
    try {
      const client = telnyxClient.getClient();
      const call = await client.calls.retrieve(callId);

      if (!call.recording_url) {
        throw new Error('No recording available for this call');
      }

      logger.info('Telnyx call recording retrieved', { callId });

      return call.recording_url;
    } catch (error) {
      logger.error('Failed to retrieve Telnyx call recording', { error, callId });
      throw error;
    }
  }

  static async getCallTranscription(callId: string): Promise<any> {
    try {
      const client = telnyxClient.getClient();
      const call = await client.calls.retrieve(callId);

      if (!call.transcription) {
        throw new Error('No transcription available for this call');
      }

      logger.info('Telnyx call transcription retrieved', { callId });

      return call.transcription;
    } catch (error) {
      logger.error('Failed to retrieve Telnyx call transcription', { error, callId });
      throw error;
    }
  }

  static async isCallActive(callId: string): Promise<boolean> {
    try {
      const status = await this.getCallStatus(callId);
      const activeStates = ['in-progress', 'ringing', 'queued'];
      return activeStates.includes(status.state);
    } catch (error) {
      logger.error('Failed to check Telnyx call active status', { error, callId });
      return false;
    }
  }

  static async getCallAnalytics(callId: string): Promise<{
    duration: number;
    cost: number;
    qualityScore?: number;
  }> {
    try {
      const status = await this.getCallStatus(callId);
      
      // Calculate cost (Telnyx pricing varies by region and type)
      // This is a simplified calculation
      const cost = (status.duration / 60) * 0.013; // ~$0.013 per minute

      logger.info('Telnyx call analytics retrieved', { callId, duration: status.duration, cost });

      return {
        duration: status.duration,
        cost,
      };
    } catch (error) {
      logger.error('Failed to retrieve Telnyx call analytics', { error, callId });
      throw error;
    }
  }
}

export default CallStatusService;
