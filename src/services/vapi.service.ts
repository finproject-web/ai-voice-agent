import axios from 'axios';
import config from '../config';
import logger from '../config/logger';

class VapiService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = config.vapiKey;
    this.baseUrl = 'https://api.vapi.ai';
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async createAssistant(data: {
    name: string;
    model?: {
      provider: string;
      model: string;
      temperature?: number;
    };
    voice?: {
      provider: string;
      voiceId: string;
    };
    firstMessage?: string;
    transcriber?: {
      provider: string;
      language: string;
    };
  }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/assistant`,
        data,
        { headers: this.getHeaders() }
      );

      logger.info('Vapi assistant created', { assistantId: response.data.id });

      return response.data;
    } catch (error) {
      logger.error('Failed to create Vapi assistant', { error });
      throw error;
    }
  }

  async getAssistant(assistantId: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/assistant/${assistantId}`,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Vapi assistant', { error, assistantId });
      throw error;
    }
  }

  async updateAssistant(assistantId: string, data: any) {
    try {
      const response = await axios.patch(
        `${this.baseUrl}/assistant/${assistantId}`,
        data,
        { headers: this.getHeaders() }
      );

      logger.info('Vapi assistant updated', { assistantId });

      return response.data;
    } catch (error) {
      logger.error('Failed to update Vapi assistant', { error, assistantId });
      throw error;
    }
  }

  async deleteAssistant(assistantId: string) {
    try {
      const response = await axios.delete(
        `${this.baseUrl}/assistant/${assistantId}`,
        { headers: this.getHeaders() }
      );

      logger.info('Vapi assistant deleted', { assistantId });

      return response.data;
    } catch (error) {
      logger.error('Failed to delete Vapi assistant', { error, assistantId });
      throw error;
    }
  }

  async createCall(data: {
    assistantId: string;
    phoneNumber: string;
    customer?: {
      number: string;
      name?: string;
    };
  }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/call`,
        data,
        { headers: this.getHeaders() }
      );

      logger.info('Vapi call created', { callId: response.data.id });

      return response.data;
    } catch (error) {
      logger.error('Failed to create Vapi call', { error });
      throw error;
    }
  }

  async getCall(callId: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/call/${callId}`,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Vapi call', { error, callId });
      throw error;
    }
  }

  async endCall(callId: string) {
    try {
      const response = await axios.delete(
        `${this.baseUrl}/call/${callId}`,
        { headers: this.getHeaders() }
      );

      logger.info('Vapi call ended', { callId });

      return response.data;
    } catch (error) {
      logger.error('Failed to end Vapi call', { error, callId });
      throw error;
    }
  }

  validateWebhookSignature(
    signature: string,
    payload: string
  ): boolean {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', config.vapiWebhookSecret)
        .update(payload)
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      logger.error('Failed to validate Vapi webhook signature', { error });
      return false;
    }
  }
}

export default new VapiService();
