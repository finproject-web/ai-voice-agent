import { ITool, ToolResult, ToolContext } from './tool.interface';
import queueManager, { QueueName } from '../queues';
import logger from '../config/logger';

export class SendEmailTool implements ITool {
  name = 'send_email';
  description = 'Send an email to a lead or contact';

  async execute(context: ToolContext, params: {
    to: string;
    subject: string;
    html?: string;
    text?: string;
    from?: string;
  }): Promise<ToolResult> {
    try {
      logger.info('Executing SendEmail tool', { context, params });

      // Queue the email job
      await queueManager.addJob(
        QueueName.EMAIL,
        'send-email',
        {
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text,
          from: params.from,
        }
      );

      return {
        success: true,
        data: { message: 'Email queued for sending', to: params.to },
      };
    } catch (error) {
      logger.error('SendEmail tool failed', { error, context, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
