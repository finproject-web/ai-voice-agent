import { ITool, ToolResult, ToolContext } from './tool.interface';
import prisma from '../config/database';
import logger from '../config/logger';

export class ScheduleCallbackTool implements ITool {
  name = 'schedule_callback';
  description = 'Schedule a callback for a lead';

  async execute(context: ToolContext, params: {
    leadId?: string;
    scheduledAt: Date;
    notes?: string;
    assignedToId?: string;
  }): Promise<ToolResult> {
    try {
      const leadId = params.leadId || context.leadId;

      if (!leadId) {
        return {
          success: false,
          error: 'Lead ID is required',
        };
      }

      logger.info('Executing ScheduleCallback tool', { context, leadId, scheduledAt: params.scheduledAt });

      // Update lead with callback information
      const lead = await prisma.lead.update({
        where: { id: leadId },
        data: {
          customFields: {
            ...(await prisma.lead.findUnique({ where: { id: leadId } }))?.customFields as any || {},
            scheduledCallback: params.scheduledAt.toISOString(),
            callbackNotes: params.notes,
            callbackAssignedTo: params.assignedToId,
          },
        },
      });

      return {
        success: true,
        data: { lead, scheduledAt: params.scheduledAt },
      };
    } catch (error) {
      logger.error('ScheduleCallback tool failed', { error, context, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
