import { ITool, ToolResult, ToolContext } from './tool.interface';
import queueManager, { QueueName } from '../queues';
import logger from '../config/logger';

export class GenerateSummaryTool implements ITool {
  name = 'generate_summary';
  description = 'Generate AI summary of conversation';

  async execute(context: ToolContext, params: {
    callId?: string;
    conversationId?: string;
    messages: any[];
  }): Promise<ToolResult> {
    try {
      const callId = params.callId || context.callId;

      logger.info('Executing GenerateSummary tool', { context, callId });

      // Queue AI processing job
      await queueManager.addJob(
        QueueName.AI_PROCESSING,
        'generate-summary',
        {
          type: 'summary',
          tenantId: context.tenantId,
          conversationId: params.conversationId,
          callId,
          messages: params.messages,
        }
      );

      return {
        success: true,
        data: { message: 'Summary generation queued' },
      };
    } catch (error) {
      logger.error('GenerateSummary tool failed', { error, context, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
