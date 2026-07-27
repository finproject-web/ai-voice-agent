import { Job } from 'bullmq';
import queueManager, { QueueName } from '../queue.manager';
import { TelnyxProvider } from '../../providers/telephony';
import prisma from '../../config/database';
import logger from '../../config/logger';

export interface OutboundCallJobData {
  leadId: string;
  campaignId: string;
  tenantId: string;
  phoneNumber: string;
  agentId?: string;
  script?: string;
  metadata?: Record<string, any>;
}

export async function outboundCallProcessor(job: Job<OutboundCallJobData>): Promise<void> {
  const { leadId, campaignId, tenantId, phoneNumber, agentId, script, metadata } = job.data;

  logger.info('Processing outbound call job', { leadId, campaignId, phoneNumber });

  try {
    // Get campaign details
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Get lead details
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    // Create call record
    const call = await prisma.call.create({
      data: {
        tenantId,
        leadId,
        campaignId,
        agentId,
        status: 'INITIATED',
        direction: 'OUTBOUND',
        to: phoneNumber,
        from: process.env.TELNYX_PHONE_NUMBER || '',
      },
    });

    // Initialize telephony provider
    const telephonyProvider = new TelnyxProvider();

    // Make the call
    const callResult = await telephonyProvider.createCall({
      to: phoneNumber,
      webhookUrl: `${process.env.WEBHOOK_URL}/webhooks/telnyx`,
      metadata: {
        callId: call.id,
        leadId,
        campaignId,
        tenantId,
        agentId,
        script,
      },
    });

    // Update call with provider call ID
    await prisma.call.update({
      where: { id: call.id },
      data: {
        providerCallId: callResult.callId,
        status: 'RINGING',
        startedAt: new Date(),
      },
    });

    // Update campaign-lead status
    await prisma.campaignLead.updateMany({
      where: {
        campaignId,
        leadId,
      },
      data: {
        status: 'IN_PROGRESS',
        lastCallAt: new Date(),
      },
    });

    logger.info('Outbound call initiated successfully', {
      callId: call.id,
      providerCallId: callResult.callId,
      leadId,
    });

  } catch (error) {
    logger.error('Outbound call job failed', { error, leadId, campaignId });

    // Update call status to failed
    await prisma.call.updateMany({
      where: {
        leadId,
        campaignId,
        status: 'INITIATED',
      },
      data: {
        status: 'FAILED',
        endedAt: new Date(),
      },
    });

    throw error;
  }
}

// Register the processor
export function registerOutboundCallProcessor(): void {
  queueManager.processQueue(
    QueueName.OUTBOUND_CALL,
    outboundCallProcessor,
    10 // Concurrency
  );
}
