import { ITool, ToolResult, ToolContext } from './tool.interface';
import { TelnyxProvider } from '../providers/telephony';
import prisma from '../config/database';
import logger from '../config/logger';
import eventBus, { EventType } from '../events';

export class TransferCallTool implements ITool {
  name = 'transfer_call';
  description = 'Transfer an active call to another number';

  async execute(context: ToolContext, params: {
    callId?: string;
    to: string;
    callerName?: string;
  }): Promise<ToolResult> {
    try {
      const callId = params.callId || context.callId;

      if (!callId) {
        return {
          success: false,
          error: 'Call ID is required',
        };
      }

      logger.info('Executing TransferCall tool', { context, callId, to: params.to });

      // Get call details
      const call = await prisma.call.findUnique({
        where: { id: callId },
      });

      if (!call) {
        return {
          success: false,
          error: 'Call not found',
        };
      }

      // Transfer call using telephony provider
      const telephonyProvider = new TelnyxProvider();
      const providerCallId = (call.metadata as any)?.providerCallId || callId;
      await telephonyProvider.transferCall(providerCallId, params.to, {
        callerName: params.callerName,
      });

      // Update call record
      await prisma.call.update({
        where: { id: callId },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
          outcome: 'transferred',
          metadata: {
            transferredTo: params.to,
            transferredAt: new Date().toISOString(),
          },
        },
      });

      // Emit event
      await eventBus.publish({
        type: EventType.CALL_TRANSFERRED,
        tenantId: context.tenantId,
        userId: context.userId,
        timestamp: new Date(),
        metadata: {
          callId,
          to: params.to,
        },
      });

      return {
        success: true,
        data: { message: 'Call transferred', to: params.to },
      };
    } catch (error) {
      logger.error('TransferCall tool failed', { error, context, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
