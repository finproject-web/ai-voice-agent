import { ITool, ToolResult, ToolContext } from './tool.interface';
import prisma from '../config/database';
import logger from '../config/logger';
import eventBus, { EventType } from '../events';

const VALID_CAMPAIGN_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const;
type CampaignStatusType = typeof VALID_CAMPAIGN_STATUSES[number];

export class UpdateCampaignTool implements ITool {
  name = 'update_campaign';
  description = 'Update campaign status or settings';

  async execute(context: ToolContext, params: {
    campaignId: string;
    updates: {
      status?: string;
      priority?: number;
      settings?: Record<string, any>;
    };
  }): Promise<ToolResult> {
    try {
      logger.info('Executing UpdateCampaign tool', { context, campaignId: params.campaignId, updates: params.updates });

      // Build validated update data
      const updateData: Record<string, any> = {};

      if (params.updates.status) {
        const upperStatus = params.updates.status.toUpperCase() as CampaignStatusType;
        if (!VALID_CAMPAIGN_STATUSES.includes(upperStatus)) {
          return {
            success: false,
            error: `Invalid campaign status: ${params.updates.status}. Valid values: ${VALID_CAMPAIGN_STATUSES.join(', ')}`,
          };
        }
        updateData.status = upperStatus;
      }

      if (params.updates.priority !== undefined) {
        updateData.priority = params.updates.priority;
      }

      if (params.updates.settings !== undefined) {
        updateData.settings = params.updates.settings;
      }

      // Update campaign
      const campaign = await prisma.campaign.update({
        where: { id: params.campaignId },
        data: updateData,
      });

      // Emit event if status changed
      if (params.updates.status) {
        const eventType = this.getEventTypeForStatus(params.updates.status);
        if (eventType) {
          await eventBus.publish({
            type: eventType,
            tenantId: context.tenantId,
            userId: context.userId,
            timestamp: new Date(),
            metadata: {
              campaignId: params.campaignId,
              status: params.updates.status,
            },
          });
        }
      }

      return {
        success: true,
        data: { campaign },
      };
    } catch (error) {
      logger.error('UpdateCampaign tool failed', { error, context, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private getEventTypeForStatus(status: string): EventType | null {
    switch (status) {
      case 'ACTIVE':
        return EventType.CAMPAIGN_STARTED;
      case 'PAUSED':
        return EventType.CAMPAIGN_PAUSED;
      case 'COMPLETED':
        return EventType.CAMPAIGN_COMPLETED;
      default:
        return null;
    }
  }
}
