import { Job } from 'bullmq';
import queueManager, { QueueName } from '../queue.manager';
import { SMTPProvider } from '../../providers/email';
import logger from '../../config/logger';

export interface EmailJobData {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

export async function emailProcessor(job: Job<EmailJobData>): Promise<void> {
  const { to, subject, html, text, from, attachments } = job.data;

  logger.info('Processing email job', { to, subject });

  try {
    const emailProvider = new SMTPProvider();
    const result = await emailProvider.sendEmail({
      to,
      subject,
      html,
      text,
      from,
      attachments,
    });

    if (!result.success) {
      throw new Error(result.error || 'Email sending failed');
    }

    logger.info('Email sent successfully', { to, messageId: result.messageId });
  } catch (error) {
    logger.error('Email job failed', { error, to, subject });
    throw error;
  }
}

// Register the processor
export function registerEmailProcessor(): void {
  queueManager.processQueue(
    QueueName.EMAIL,
    emailProcessor,
    5 // Concurrency
  );
}
