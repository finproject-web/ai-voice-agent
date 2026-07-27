import nodemailer from 'nodemailer';
import { IEmailProvider, EmailOptions, EmailResult } from './email.interface';
import logger from '../../config/logger';
import config from '../../config';

export class SMTPProvider implements IEmailProvider {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost || 'localhost',
      port: config.smtpPort || 587,
      secure: config.smtpSecure || false,
      auth: config.smtpUser && config.smtpPassword ? {
        user: config.smtpUser,
        pass: config.smtpPassword,
      } : undefined,
    });
  }

  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      const mailOptions = {
        from: options.from || config.smtpFrom || 'noreply@example.com',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      };

      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', { to: options.to, messageId: info.messageId });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      logger.error('Failed to send email', { error, to: options.to });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendBulkEmail(emails: EmailOptions[]): Promise<EmailResult[]> {
    const results = await Promise.all(
      emails.map((email) => this.sendEmail(email))
    );

    const successCount = results.filter((r) => r.success).length;
    logger.info('Bulk email sent', { total: emails.length, success: successCount });

    return results;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('SMTP connection test successful');
      return true;
    } catch (error) {
      logger.error('SMTP connection test failed', { error });
      return false;
    }
  }
}
