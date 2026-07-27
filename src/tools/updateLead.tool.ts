import { ITool, ToolResult, ToolContext } from './tool.interface';
import prisma from '../config/database';
import logger from '../config/logger';
import eventBus, { EventType } from '../events';

export class UpdateLeadTool implements ITool {
  name = 'update_lead';
  description = 'Update lead information';

  async execute(context: ToolContext, params: {
    leadId?: string;
    updates: {
      status?: string;
      score?: number;
      notes?: string;
      customFields?: Record<string, any>;
      email?: string;
      phone?: string;
    };
  }): Promise<ToolResult> {
    try {
      const leadId = params.leadId || context.leadId;

      if (!leadId) {
        return {
          success: false,
          error: 'Lead ID is required',
        };
      }

      logger.info('Executing UpdateLead tool', { context, leadId, updates: params.updates });

      // Update lead in database
      const lead = await prisma.lead.update({
        where: { id: leadId },
        data: params.updates,
      });

      // Emit event if status changed
      if (params.updates.status) {
        await eventBus.publish({
          type: EventType.LEAD_UPDATED,
          tenantId: context.tenantId,
          userId: context.userId,
          timestamp: new Date(),
          metadata: {
            leadId,
            status: params.updates.status,
          },
        });
      }

      return {
        success: true,
        data: { lead },
      };
    } catch (error) {
      logger.error('UpdateLead tool failed', { error, context, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
