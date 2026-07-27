import telnyxClient from './telnyxClient';
import prisma from '../../config/database';
import logger from '../../config/logger';

interface TelnyxWebhookEvent {
  data: {
    event_type: string;
    id: string;
    occurred_at: string;
    payload: {
      call_id: string;
      call_session_id: string;
      call_status: string;
      call_state: string;
      direction: string;
      to: string;
      from: string;
      duration?: number;
      recording_url?: string;
      transcription?: any;
      client_state?: string;
    };
  };
}

export class TelnyxWebhookService {
  static async handleWebhook(event: TelnyxWebhookEvent): Promise<void> {
    try {
      const { event_type, payload } = event.data;

      logger.info('Telnyx webhook received', { eventType: event_type, callId: payload.call_id });

      switch (event_type) {
        case 'call.initiated':
          await this.handleCallInitiated(payload);
          break;
        case 'call.answered':
          await this.handleCallAnswered(payload);
          break;
        case 'call.ended':
          await this.handleCallEnded(payload);
          break;
        case 'call.recording':
          await this.handleCallRecording(payload);
          break;
        case 'call.transcription':
          await this.handleCallTranscription(payload);
          break;
        case 'call.hangup':
          await this.handleCallHangup(payload);
          break;
        case 'call.no-answer':
          await this.handleCallNoAnswer(payload);
          break;
        case 'call.busy':
          await this.handleCallBusy(payload);
          break;
        default:
          logger.warn('Unhandled Telnyx webhook event type', { eventType: event_type });
      }
    } catch (error) {
      logger.error('Failed to process Telnyx webhook', { error, event });
      throw error;
    }
  }

  private static async handleCallInitiated(payload: any): Promise<void> {
    logger.info('Telnyx call initiated', { callId: payload.call_id });

    // Update call status in database
    await prisma.call.updateMany({
      where: { id: payload.call_id },
      data: {
        status: 'RINGING',
        startedAt: new Date(),
      },
    });
  }

  private static async handleCallAnswered(payload: any): Promise<void> {
    logger.info('Telnyx call answered', { callId: payload.call_id });

    // Update call status in database
    await prisma.call.updateMany({
      where: { id: payload.call_id },
      data: {
        status: 'IN_PROGRESS',
      },
    });

    // Trigger AI agent to start conversation
    // This would call the OpenAI service to generate the first response
  }

  private static async handleCallEnded(payload: any): Promise<void> {
    logger.info('Telnyx call ended', {
      callId: payload.call_id,
      duration: payload.duration,
    });

    // Update call status in database
    await prisma.call.updateMany({
      where: { id: payload.call_id },
      data: {
        status: 'COMPLETED',
        duration: payload.duration || 0,
        endedAt: new Date(),
      },
    });
  }

  private static async handleCallRecording(payload: any): Promise<void> {
    logger.info('Telnyx call recording available', {
      callId: payload.call_id,
      recordingUrl: payload.recording_url,
    });

    // Update call with recording URL
    await prisma.call.updateMany({
      where: { id: payload.call_id },
      data: {
        recordingUrl: payload.recording_url,
      },
    });
  }

  private static async handleCallTranscription(payload: any): Promise<void> {
    logger.info('Telnyx call transcription available', {
      callId: payload.call_id,
    });

    // Update or create conversation with transcription
    const call = await prisma.call.findFirst({
      where: { id: payload.call_id },
    });

    if (call) {
      await prisma.conversation.upsert({
        where: { callId: payload.call_id },
        create: {
          tenantId: call.tenantId,
          callId: payload.call_id,
          messages: payload.transcription || [],
        },
        update: {
          messages: payload.transcription || [],
        },
      });
    }
  }

  private static async handleCallHangup(payload: any): Promise<void> {
    logger.info('Telnyx call hangup', { callId: payload.call_id });

    // Update call status
    await prisma.call.updateMany({
      where: { id: payload.call_id },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
      },
    });
  }

  private static async handleCallNoAnswer(payload: any): Promise<void> {
    logger.info('Telnyx call no answer', { callId: payload.call_id });

    // Update call status
    await prisma.call.updateMany({
      where: { id: payload.call_id },
      data: {
        status: 'NO_ANSWER',
        endedAt: new Date(),
      },
    });
  }

  private static async handleCallBusy(payload: any): Promise<void> {
    logger.info('Telnyx call busy', { callId: payload.call_id });

    // Update call status
    await prisma.call.updateMany({
      where: { id: payload.call_id },
      data: {
        status: 'BUSY',
        endedAt: new Date(),
      },
    });
  }

  static async storeCallEvent(
    callId: string,
    eventType: string,
    eventData: any
  ): Promise<void> {
    try {
      // Store call event for analytics and debugging
      logger.info('Telnyx call event stored', { callId, eventType });

      // This could be stored in a separate CallEvent table if needed
      // For now, we're logging and updating the main call record
    } catch (error) {
      logger.error('Failed to store Telnyx call event', { error, callId, eventType });
      throw error;
    }
  }

  static validateWebhookSignature(
    payload: string,
    signature: string,
    timestamp: string
  ): boolean {
    return telnyxClient.validateWebhookSignature(payload, signature, timestamp);
  }
}

export default TelnyxWebhookService;
