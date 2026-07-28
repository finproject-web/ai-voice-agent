import eventBus from '../event.bus';
import { EventType, LeadCreatedEvent } from '../event.types';
import prisma from '../../config/database';
import logger from '../../config/logger';

export function registerLeadHandlers(): void {
  eventBus.subscribe(EventType.LEAD_CREATED, handleLeadCreated);
  eventBus.subscribe(EventType.LEAD_IMPORTED, handleLeadImported);
  eventBus.subscribe(EventType.LEAD_ASSIGNED, handleLeadAssigned);
  eventBus.subscribe(EventType.LEAD_QUALIFIED, handleLeadQualified);
  eventBus.subscribe(EventType.LEAD_REJECTED, handleLeadRejected);
}

async function handleLeadCreated(event: LeadCreatedEvent): Promise<void> {
  try {
    logger.info('Handling LeadCreated event', { leadId: event.leadId, tenantId: event.tenantId });

    // Update lead creation analytics
    await prisma.analytics.create({
      data: {
        tenantId: event.tenantId,
        metric: 'lead_created',
        value: 1,
        dimensions: {
          leadId: event.leadId,
          userId: event.userId,
          timestamp: event.timestamp,
        },
        date: new Date(),
      },
    });

    // Trigger notification queue job if needed
    // await queueManager.addJob(QueueName.NOTIFICATION, 'lead-created', { ... });

  } catch (error) {
    logger.error('Failed to handle LeadCreated event', { error, leadId: event.leadId });
  }
}

async function handleLeadImported(event: any): Promise<void> {
  try {
    logger.info('Handling LeadImported event', { tenantId: event.tenantId, count: event.metadata?.count });

    // Update import analytics
    await prisma.analytics.create({
      data: {
        tenantId: event.tenantId,
        metric: 'lead_imported',
        value: event.metadata?.count || 1,
        dimensions: {
          userId: event.userId,
          timestamp: event.timestamp,
        },
        date: new Date(),
      },
    });

  } catch (error) {
    logger.error('Failed to handle LeadImported event', { error });
  }
}

async function handleLeadAssigned(event: any): Promise<void> {
  try {
    logger.info('Handling LeadAssigned event', { leadId: event.leadId, assignedTo: event.metadata?.assignedTo });

    // Send notification to assigned user
    // await queueManager.addJob(QueueName.NOTIFICATION, 'lead-assigned', { ... });

  } catch (error) {
    logger.error('Failed to handle LeadAssigned event', { error });
  }
}

async function handleLeadQualified(event: any): Promise<void> {
  try {
    logger.info('Handling LeadQualified event', { leadId: event.leadId });

    // Update lead status and trigger follow-up
    await prisma.lead.update({
      where: { id: event.leadId },
      data: { status: 'QUALIFIED' },
    });

  } catch (error) {
    logger.error('Failed to handle LeadQualified event', { error });
  }
}

async function handleLeadRejected(event: any): Promise<void> {
  try {
    logger.info('Handling LeadRejected event', { leadId: event.leadId });

    // Update lead status
    await prisma.lead.update({
      where: { id: event.leadId },
      data: { status: 'DO_NOT_CONTACT' },
    });

  } catch (error) {
    logger.error('Failed to handle LeadRejected event', { error });
  }
}
