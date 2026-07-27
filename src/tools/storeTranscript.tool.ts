import { ITool, ToolResult, ToolContext } from './tool.interface';
import prisma from '../config/database';
import logger from '../config/logger';

export class StoreTranscriptTool implements ITool {
  name = 'store_transcript';
  description = 'Store call transcript in database';

  async execute(context: ToolContext, params: {
    callId?: string;
    transcript: string;
    metadata?: Record<string, any>;
  }): Promise<ToolResult> {
    try {
      const callId = params.callId || context.callId;

      if (!callId) {
        return {
          success: false,
          error: 'Call ID is required',
        };
      }

      logger.info('Executing StoreTranscript tool', { context, callId, transcriptLength: params.transcript.length });

      // Store transcript in conversation
      const conversation = await prisma.conversation.upsert({
        where: { callId },
        create: {
          tenantId: context.tenantId,
          callId,
          messages: [{ role: 'system', content: 'Transcript stored' }],
          analysis: params.metadata,
        },
        update: {
          messages: [{ role: 'system', content: params.transcript }],
          analysis: params.metadata,
        },
      });

      // Update call with transcription
      await prisma.call.update({
        where: { id: callId },
        data: {
          transcription: params.transcript,
        },
      });

      return {
        success: true,
        data: { conversationId: conversation.id },
      };
    } catch (error) {
      logger.error('StoreTranscript tool failed', { error, context, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
