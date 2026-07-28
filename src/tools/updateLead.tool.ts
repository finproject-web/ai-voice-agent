import { ITool, ToolResult, ToolContext } from './tool.interface';
import prisma from '../config/database';
import logger from '../config/logger';
import eventBus, { EventType } from '../events';

const VALID_LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST', 'DO_NOT_CONTACT'] as const;
type LeadStatusType = typeof VALID_LEAD_STATUSES[number];

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

      // Build validated update data
      const updateData: Record<string, any> = {};

      if (params.updates.status) {
        const upperStatus = params.updates.status.toUpperCase() as LeadStatusType;
        if (!VALID_LEAD_STATUSES.includes(upperStatus)) {
          return {
            success: false,
            error: `Invalid lead status: ${params.updates.status}. Valid values: ${VALID_LEAD_STATUSES.join(', ')}`,
          };
        }
        updateData.status = upperStatus;
      }

      if (params.updates.score !== undefined) updateData.score = params.updates.score;
      if (params.updates.notes !== undefined) updateData.notes = params.updates.notes;
      if (params.updates.customFields !== undefined) updateData.customFields = params.updates.customFields;
      if (params.updates.email !== undefined) updateData.email = params.updates.email;
      if (params.updates.phone !== undefined) updateData.phone = params.updates.phone;

      // Update lead in database
      const lead = await prisma.lead.update({
        where: { id: leadId },
        data: updateData,
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
