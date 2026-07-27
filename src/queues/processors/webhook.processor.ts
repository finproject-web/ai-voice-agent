import { Job } from 'bullmq';
import queueManager, { QueueName } from '../queue.manager';
import axios from 'axios';
import logger from '../../config/logger';

export interface WebhookJobData {
  url: string;
  payload: any;
  headers?: Record<string, string>;
  retries?: number;
}

export async function webhookProcessor(job: Job<WebhookJobData>): Promise<void> {
  const { url, payload, headers, retries = 3 } = job.data;

  logger.info('Processing webhook job', { url });

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        timeout: 10000,
      });

      if (response.status >= 200 && response.status < 300) {
        logger.info('Webhook delivered successfully', { url, attempt, status: response.status });
        return;
      }

      throw new Error(`Webhook returned status ${response.status}`);
    } catch (error) {
      lastError = error as Error;
      logger.warn(`Webhook delivery attempt ${attempt} failed`, { url, error });

      if (attempt < retries) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  logger.error('Webhook delivery failed after all retries', { url, retries });
  throw lastError || new Error('Webhook delivery failed');
}

// Register the processor
export function registerWebhookProcessor(): void {
  queueManager.processQueue(
    QueueName.WEBHOOK,
    webhookProcessor,
    20 // Higher concurrency for webhooks
  );
}
