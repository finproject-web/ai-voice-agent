import queueManager, { QueueName } from './queue.manager';
import {
  registerOutboundCallProcessor,
  OutboundCallJobData,
} from './processors/outboundCall.processor';
import {
  registerWebhookProcessor,
  WebhookJobData,
} from './processors/webhook.processor';
import {
  registerEmailProcessor,
  EmailJobData,
} from './processors/email.processor';
import {
  registerAnalyticsProcessor,
  AnalyticsJobData,
} from './processors/analytics.processor';
import {
  registerAIProcessingProcessor,
  AIProcessingJobData,
} from './processors/aiProcessing.processor';

// Register all processors
export function registerAllProcessors(): void {
  registerOutboundCallProcessor();
  registerWebhookProcessor();
  registerEmailProcessor();
  registerAnalyticsProcessor();
  registerAIProcessingProcessor();
}

// Export queue manager and types
export {
  queueManager,
  QueueName,
  OutboundCallJobData,
  WebhookJobData,
  EmailJobData,
  AnalyticsJobData,
  AIProcessingJobData,
};

export default queueManager;
