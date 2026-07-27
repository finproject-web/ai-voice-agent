import axios from 'axios';
import { ITTSProvider, TTSOptions, TTSResult } from './provider.interface';
import logger from '../../config/logger';
import config from '../../config';

export class ElevenLabsProvider implements ITTSProvider {
  private apiKey: string;
  private baseUrl: string = 'https://api.elevenlabs.io/v1';

  constructor() {
    if (!config.elevenlabsApiKey) {
      throw new Error('ElevenLabs API key not configured');
    }
    this.apiKey = config.elevenlabsApiKey;
  }

  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    try {
      const voiceId = options?.voiceId || config.elevenlabsVoiceId;
      
      if (!voiceId) {
        throw new Error('Voice ID not configured');
      }

      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voiceId}`,
        {
          text,
          model_id: options?.modelId || 'eleven_multilingual_v2',
          voice_settings: {
            stability: options?.stability ?? 0.5,
            similarity_boost: options?.similarityBoost ?? 0.75,
            style: options?.style ?? 0.0,
            use_speaker_boost: options?.speakerBoost ?? true,
          },
        },
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          responseType: 'arraybuffer',
        }
      );

      const audioBuffer = Buffer.from(response.data);

      logger.info('ElevenLabs TTS synthesis completed', {
        textLength: text.length,
        audioSize: audioBuffer.length,
      });

      return {
        audioBuffer,
        contentType: 'audio/mpeg',
      };
    } catch (error) {
      logger.error('ElevenLabs synthesis failed', { error });
      throw error;
    }
  }

  async getVoices(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      return response.data.voices || [];
    } catch (error) {
      logger.error('ElevenLabs get voices failed', { error });
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getVoices();
      logger.info('ElevenLabs connection test successful');
      return true;
    } catch (error) {
      logger.error('ElevenLabs connection test failed', { error });
      return false;
    }
  }
}
