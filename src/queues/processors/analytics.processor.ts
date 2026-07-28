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
  // Create analytics record for the call
  await prisma.analytics.create({
    data: {
      tenantId,
      metric: 'call_analytics',
      value: data.duration || 0,
      dimensions: { callId, ...data },
      date: new Date(),
    },
  });
}

async function processCampaignAnalytics(tenantId: string, campaignId: string, data: Record<string, any>): Promise<void> {
  // Create campaign analytics record
  await prisma.analytics.create({
    data: {
      tenantId,
      metric: 'campaign_analytics',
      value: 1,
      dimensions: { campaignId, ...data },
      date: new Date(),
    },
  });
}

async function processLeadAnalytics(tenantId: string, leadId: string, data: Record<string, any>): Promise<void> {
  // Create lead analytics record
  await prisma.analytics.create({
    data: {
      tenantId,
      metric: 'lead_analytics',
      value: 1,
      dimensions: { leadId, ...data },
      date: new Date(),
    },
  });
}

async function processAgentAnalytics(tenantId: string, agentId: string, data: Record<string, any>): Promise<void> {
  // Create agent analytics record
  await prisma.analytics.create({
    data: {
      tenantId,
      metric: 'agent_analytics',
      value: 1,
      dimensions: { agentId, ...data },
      date: new Date(),
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
