import { ITool, ToolResult, ToolContext } from './tool.interface';
import prisma from '../config/database';
import logger from '../config/logger';
import eventBus, { EventType } from '../events';

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

      // Update campaign
      const campaign = await prisma.campaign.update({
        where: { id: params.campaignId },
        data: params.updates,
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
