import OpenAI from 'openai';
import config from '../../config';
import logger from '../../config/logger';

class OpenAIClient {
  private client: OpenAI;

  constructor() {
    if (!config.openaiApiKey) {
      logger.warn('OpenAI API key not configured');
    }

    this.client = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  getClient(): OpenAI {
    return this.client;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: config.openaiModel,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      });
      logger.info('OpenAI connection test successful');
      return true;
    } catch (error) {
      logger.error('OpenAI connection test failed', { error });
      return false;
    }
  }
}

export default new OpenAIClient();
