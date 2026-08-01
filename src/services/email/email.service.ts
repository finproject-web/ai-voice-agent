import axios from 'axios';
import nodemailer from 'nodemailer';
import logger from '../../config/logger';
import config from '../../config';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  template?: string;
  templateData?: Record<string, string>;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Prefer an explicit SMTP_* config (useful on Render/hosted environments).
    // Fall back to the Gmail App-Password defaults for local/dev setups.
    const host = config.smtpHost && config.smtpHost !== 'localhost' ? config.smtpHost : 'smtp.gmail.com';
    const port = config.smtpHost && config.smtpHost !== 'localhost' ? config.smtpPort : 587;
    const secure = config.smtpHost && config.smtpHost !== 'localhost' ? config.smtpSecure : false;
    const user = config.smtpUser || config.gmailUser;
    const pass = config.smtpPassword || config.gmailAppPassword;
    const from = config.smtpFrom && config.smtpFrom !== 'noreply@example.com' ? config.smtpFrom : (user || 'noreply@example.com');

    if (!user || !pass) {
      const msg = 'Email credentials not configured: set GMAIL_USER + GMAIL_APP_PASSWORD, or SMTP_USER + SMTP_PASSWORD';
      logger.error(msg, { user: !!user, hasPass: !!pass });
      throw new Error(msg);
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });

      logger.info('Initializing email transporter', { host, port, secure, user, from });
      await this.transporter.verify();
      this.initialized = true;
      logger.info('Email SMTP service initialized', { host, port, user });
    } catch (error) {
      logger.error('Failed to initialize email SMTP service', { host, port, user, error });
      throw error;
    }
  }

  async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async sendEmail(options: EmailOptions, maxRetries: number = 3): Promise<EmailResult> {
    if (config.brevoApiKey) {
      logger.info('Using Brevo API for email', { to: options.to, subject: options.subject });
      return this.sendBrevoEmail(options);
    }

    await this.ensureInitialized();

    if (!this.transporter) {
      return {
        success: false,
        error: 'Email transporter not initialized',
      };
    }

    const from = config.smtpFrom && config.smtpFrom !== 'noreply@example.com'
      ? config.smtpFrom
      : (config.smtpUser || config.gmailUser || 'noreply@example.com');
    let lastError: Error | null = null;

    logger.info('Starting email send', { to: options.to, subject: options.subject, from });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const mailOptions = {
          from,
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html,
        };

        const info = await this.transporter.sendMail(mailOptions);

        logger.info('Email sent successfully', {
          to: options.to,
          messageId: info.messageId,
          attempt,
        });

        return {
          success: true,
          messageId: info.messageId,
        };
      } catch (error) {
        lastError = error as Error;
        logger.error('Email send attempt failed', {
          to: options.to,
          attempt,
          error: lastError.message,
        });

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          logger.info(`Retrying email send in ${delay}ms`, { attempt: attempt + 1 });
          await this.sleep(delay);
        }
      }
    }

    logger.error('Email send failed after all retries', {
      to: options.to,
      maxRetries,
      error: lastError?.message,
    });

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
    };
  }

  private async sendBrevoEmail(options: EmailOptions): Promise<EmailResult> {
    const fromEmail =
      config.smtpFrom && config.smtpFrom !== 'noreply@example.com'
        ? config.smtpFrom
        : (config.smtpUser || config.gmailUser || 'noreply@example.com');

    try {
      const response = await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: {
            name: config.brevoSenderName,
            email: fromEmail,
          },
          to: [{ email: options.to }],
          subject: options.subject,
          ...(options.html ? { htmlContent: options.html } : {}),
          ...(options.text ? { textContent: options.text } : {}),
        },
        {
          headers: {
            'api-key': config.brevoApiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      const messageId = response.data?.messageId || response.data?.messageIds?.[0];
      logger.info('Email sent successfully via Brevo API', { to: options.to, messageId });

      return { success: true, messageId };
    } catch (error) {
      const err = error as any;
      const brevoError =
        err?.response?.data?.message ||
        err?.response?.data?.code ||
        err?.message ||
        'Brevo API error';
      logger.error('Brevo API email send failed', {
        to: options.to,
        status: err?.response?.status,
        error: brevoError,
      });

      return { success: false, error: brevoError };
    }
  }

  async sendApplicationEmail(
    customerName: string,
    email: string,
    loanAmount?: string | number
  ): Promise<EmailResult> {
    logger.info('Preparing application email', { customerName, to: email, loanAmount, applicationUrl: config.applicationUrl });
    const applicationUrl = config.applicationUrl;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Hello ${customerName},</h2>
        
        <p>Thank you for speaking with Up Start Loans.</p>
        
        <p>Based on our conversation, you can continue your loan application using the secure link below:</p>
        
        <p style="margin: 20px 0;">
          <a href="${applicationUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Complete Your Application
          </a>
        </p>
        
        <p>Please complete the application to continue the review process.</p>
        
        ${loanAmount ? `<p><strong>Loan Amount:</strong> ${loanAmount}</p>` : ''}
        
        <p>If you need assistance, our team is available to help.</p>
        
        <p>Thank you,<br><strong>Up Start Loans Team</strong></p>
      </div>
    `;

    const text = `
      Hello ${customerName},

      Thank you for speaking with Up Start Loans.

      Based on our conversation, you can continue your loan application using the secure link below:

      ${applicationUrl}

      Please complete the application to continue the review process.

      ${loanAmount ? `Loan Amount: ${loanAmount}` : ''}

      If you need assistance, our team is available to help.

      Thank you,
      Up Start Loans Team
    `;

    return this.sendEmail({
      to: email,
      subject: 'Your Up Start Loans Application Link',
      text,
      html,
    });
  }

  async sendSMSEmail(
    _customerName: string,
    email: string,
    _phoneNumber?: string
  ): Promise<EmailResult> {
    const applicationUrl = config.applicationUrl;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Up Start Loans</h2>
        
        <p>Complete your secure loan application here:</p>
        
        <p style="margin: 20px 0;">
          <a href="${applicationUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            ${applicationUrl}
          </a>
        </p>
        
        <p>Reply STOP to opt out.</p>
      </div>
    `;

    const text = `
      Up Start Loans:
      Complete your secure loan application here:

      ${applicationUrl}

      Reply STOP to opt out.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Up Start Loans Application',
      text,
      html,
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default new EmailService();
