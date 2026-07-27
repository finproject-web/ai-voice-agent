import Telnyx from 'telnyx';
import config from '../../config';
import logger from '../../config/logger';

class TelnyxClient {
  private client: Telnyx;

  constructor() {
    if (!config.telnyxApiKey) {
      logger.warn('Telnyx API key not configured');
    }

    this.client = new Telnyx(config.telnyxApiKey);
  }

  getClient(): Telnyx {
    return this.client;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.calls.list({ limit: 1 });
      logger.info('Telnyx connection test successful');
      return true;
    } catch (error) {
      logger.error('Telnyx connection test failed', { error });
      return false;
    }
  }

  validateWebhookSignature(
    payload: string,
    signature: string,
    timestamp: string
  ): boolean {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', config.telnyxWebhookSecret)
        .update(timestamp + payload)
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      logger.error('Failed to validate Telnyx webhook signature', { error });
      return false;
    }
  }
}

export default new TelnyxClient();
