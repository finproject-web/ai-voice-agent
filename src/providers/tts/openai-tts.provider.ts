import OpenAI from 'openai';
import { ITTSProvider, TTSOptions, TTSResult } from './provider.interface';
import logger from '../../config/logger';
import config from '../../config';

export class OpenAITTSProvider implements ITTSProvider {
  private client: OpenAI;

  constructor() {
    if (!config.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }
    this.client = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    try {
      const voice = (options?.voiceId || 'nova') as any;

      const response = await this.client.audio.speech.create({
        model: 'tts-1',
        voice,
        input: text,
        response_format: 'pcm',
        speed: 0.9,
      });

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      logger.info('OpenAI TTS synthesis completed', {
        textLength: text.length,
        audioSize: audioBuffer.length,
        voice,
      });

      return {
        audioBuffer,
        contentType: 'audio/pcm',
      };
    } catch (error) {
      logger.error('OpenAI TTS synthesis failed', { error });
      throw error;
    }
  }

  async getVoices(): Promise<any[]> {
    // OpenAI has fixed voices
    return [
      { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
      { id: 'echo', name: 'Echo', description: 'Warm and clear' },
      { id: 'fable', name: 'Fable', description: 'Expressive and dynamic' },
      { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
      { id: 'nova', name: 'Nova', description: 'Friendly and warm - best for female agent' },
      { id: 'shimmer', name: 'Shimmer', description: 'Soft and pleasant' },
    ];
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.synthesize('Test.');
      logger.info('OpenAI TTS connection test successful');
      return true;
    } catch (error) {
      logger.error('OpenAI TTS connection test failed', { error });
      return false;
    }
  }
}
