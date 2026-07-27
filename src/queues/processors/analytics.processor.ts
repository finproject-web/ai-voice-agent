import { Job } from 'bullmq';
import queueManager, { QueueName } from '../queue.manager';
import prisma from '../../config/database';
import logger from '../../config/logger';

export interface AnalyticsJobData {
  type: 'call' | 'campaign' | 'lead' | 'agent';
  tenantId: string;
  entityId: string;
  data: Record<string, any>;
}

export async function analyticsProcessor(job: Job<AnalyticsJobData>): Promise<void> {
  const { type, tenantId, entityId, data } = job.data;

  logger.info('Processing analytics job', { type, tenantId, entityId });

  try {
    switch (type) {
      case 'call':
        await processCallAnalytics(tenantId, entityId, data);
        break;
      case 'campaign':
        await processCampaignAnalytics(tenantId, entityId, data);
        break;
      case 'lead':
        await processLeadAnalytics(tenantId, entityId, data);
        break;
      case 'agent':
        await processAgentAnalytics(tenantId, entityId, data);
        break;
      default:
        throw new Error(`Unknown analytics type: ${type}`);
    }

    logger.info('Analytics processed successfully', { type, tenantId, entityId });
  } catch (error) {
    logger.error('Analytics job failed', { error, type, tenantId, entityId });
    throw error;
  }
}

async function processCallAnalytics(tenantId: string, callId: string, data: Record<string, any>): Promise<void> {
  // Update or create analytics record for the call
  await prisma.analytics.upsert({
    where: {
      id: callId,
    },
    create: {
      id: callId,
      tenantId,
      type: 'CALL',
      metrics: data,
      date: new Date(),
    },
    update: {
      metrics: {
        ...(await prisma.analytics.findUnique({ where: { id: callId } }))?.metrics || {},
        ...data,
      },
    },
  });
}

async function processCampaignAnalytics(tenantId: string, campaignId: string, data: Record<string, any>): Promise<void> {
  // Update campaign analytics
  await prisma.analytics.upsert({
    where: {
      id: campaignId,
    },
    create: {
      id: campaignId,
      tenantId,
      type: 'CAMPAIGN',
      metrics: data,
      date: new Date(),
    },
    update: {
      metrics: {
        ...(await prisma.analytics.findUnique({ where: { id: campaignId } }))?.metrics || {},
        ...data,
      },
    },
  });
}

async function processLeadAnalytics(tenantId: string, leadId: string, data: Record<string, any>): Promise<void> {
  // Update lead analytics
  await prisma.analytics.upsert({
    where: {
      id: leadId,
    },
    create: {
      id: leadId,
      tenantId,
      type: 'LEAD',
      metrics: data,
      date: new Date(),
    },
    update: {
      metrics: {
        ...(await prisma.analytics.findUnique({ where: { id: leadId } }))?.metrics || {},
        ...data,
      },
    },
  });
}

async function processAgentAnalytics(tenantId: string, agentId: string, data: Record<string, any>): Promise<void> {
  // Update agent analytics
  await prisma.analytics.upsert({
    where: {
      id: agentId,
    },
    create: {
      id: agentId,
      tenantId,
      type: 'AGENT',
      metrics: data,
      date: new Date(),
    },
    update: {
      metrics: {
        ...(await prisma.analytics.findUnique({ where: { id: agentId } }))?.metrics || {},
        ...data,
      },
    },
  });
}

// Register the processor
export function registerAnalyticsProcessor(): void {
  queueManager.processQueue(
    QueueName.ANALYTICS,
    analyticsProcessor,
    5 // Concurrency
  );
}
