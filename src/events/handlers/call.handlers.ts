import eventBus from '../event.bus';
import { EventType, CallInitiatedEvent, CallAnsweredEvent, CallEndedEvent } from '../event.types';
import prisma from '../../config/database';
import queueManager, { QueueName } from '../../queues';
import logger from '../../config/logger';

export function registerCallHandlers(): void {
  eventBus.subscribe(EventType.CALL_INITIATED, handleCallInitiated);
  eventBus.subscribe(EventType.CALL_ANSWERED, handleCallAnswered);
  eventBus.subscribe(EventType.CALL_CONNECTED, handleCallConnected);
  eventBus.subscribe(EventType.CALL_TRANSFERRED, handleCallTransferred);
  eventBus.subscribe(EventType.CALL_ENDED, handleCallEnded);
  eventBus.subscribe(EventType.CALL_FAILED, handleCallFailed);
}

async function handleCallInitiated(event: CallInitiatedEvent): Promise<void> {
  try {
    logger.info('Handling CallInitiated event', { callId: event.callId, leadId: event.leadId });

    // Update call status in database
    await prisma.call.update({
      where: { id: event.callId },
      data: { status: 'RINGING' },
    });

    // Emit real-time update via WebSocket
    // eventBus.publish({ type: EventType.WEBSOCKET_UPDATE, ... });

  } catch (error) {
    logger.error('Failed to handle CallInitiated event', { error, callId: event.callId });
  }
}

async function handleCallAnswered(event: CallAnsweredEvent): Promise<void> {
  try {
    logger.info('Handling CallAnswered event', { callId: event.callId });

    // Update call status
    await prisma.call.update({
      where: { id: event.callId },
      data: { status: 'IN_PROGRESS', startedAt: event.answeredAt },
    });

    // Trigger AI agent to start conversation
    await queueManager.addJob(
      QueueName.AI_PROCESSING,
      'start-conversation',
      {
        type: 'response',
        tenantId: event.tenantId,
        callId: event.callId,
        leadId: event.leadId,
        messages: [],
        context: { action: 'start' },
      }
    );

  } catch (error) {
    logger.error('Failed to handle CallAnswered event', { error, callId: event.callId });
  }
}

async function handleCallConnected(event: any): Promise<void> {
  try {
    logger.info('Handling CallConnected event', { callId: event.callId });

    // Update analytics
    await prisma.analytics.create({
      data: {
        tenantId: event.tenantId,
        metric: 'call_connected',
        value: 1,
        dimensions: {
          callId: event.callId,
          leadId: event.leadId,
          timestamp: event.timestamp,
        },
        date: new Date(),
      },
    });

  } catch (error) {
    logger.error('Failed to handle CallConnected event', { error });
  }
}

async function handleCallTransferred(event: any): Promise<void> {
  try {
    logger.info('Handling CallTransferred event', { callId: event.callId, to: event.metadata?.to });

    // Update call record
    await prisma.call.update({
      where: { id: event.callId },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
        outcome: 'transferred',
        metadata: {
          transferredTo: event.metadata?.to,
          transferredAt: new Date().toISOString(),
        },
      },
    });

  } catch (error) {
    logger.error('Failed to handle CallTransferred event', { error });
  }
}

async function handleCallEnded(event: CallEndedEvent): Promise<void> {
  try {
    logger.info('Handling CallEnded event', { callId: event.callId, duration: event.duration });

    // Update call record
    await prisma.call.update({
      where: { id: event.callId },
      data: {
        status: (event.status as any) || 'COMPLETED',
        duration: event.duration,
        endedAt: event.endedAt,
      },
    });

    // Queue AI processing for summary and extraction
    const conversation = await prisma.conversation.findFirst({
      where: { callId: event.callId },
    });

    if (conversation && conversation.messages.length > 0) {
      await queueManager.addJob(
        QueueName.AI_PROCESSING,
        'process-call-end',
        {
          type: 'summary',
          tenantId: event.tenantId,
          conversationId: conversation.id,
          callId: event.callId,
          messages: conversation.messages as any[],
        }
      );

      await queueManager.addJob(
        QueueName.AI_PROCESSING,
        'extract-call-info',
        {
          type: 'extraction',
          tenantId: event.tenantId,
          conversationId: conversation.id,
          callId: event.callId,
          messages: conversation.messages as any[],
        }
      );
    }

    // Queue analytics processing
    await queueManager.addJob(
      QueueName.ANALYTICS,
      'call-analytics',
      {
        type: 'call',
        tenantId: event.tenantId,
        entityId: event.callId,
        data: {
          duration: event.duration,
          status: event.status,
          endedAt: event.endedAt,
        },
      }
    );

  } catch (error) {
    logger.error('Failed to handle CallEnded event', { error, callId: event.callId });
  }
}

async function handleCallFailed(event: any): Promise<void> {
  try {
    logger.info('Handling CallFailed event', { callId: event.callId, reason: event.metadata?.reason });

    // Update call status
    await prisma.call.update({
      where: { id: event.callId },
      data: {
        status: 'FAILED',
        endedAt: new Date(),
        notes: event.metadata?.reason ? `Failure: ${event.metadata.reason}` : undefined,
      },
    });

  } catch (error) {
    logger.error('Failed to handle CallFailed event', { error });
  }
}
