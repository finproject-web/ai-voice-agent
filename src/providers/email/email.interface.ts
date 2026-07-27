export interface EmailOptions {
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

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IEmailProvider {
  /**
   * Send an email
   */
  sendEmail(options: EmailOptions): Promise<EmailResult>;

  /**
   * Send bulk emails
   */
  sendBulkEmail(emails: EmailOptions[]): Promise<EmailResult[]>;

  /**
   * Test provider connection
   */
  testConnection(): Promise<boolean>;
}
