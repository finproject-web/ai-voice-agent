import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { ISTTProvider, STTOptions, STTResult, StreamingSTTOptions } from './provider.interface';
import logger from '../../config/logger';
import config from '../../config';

export class DeepgramProvider implements ISTTProvider {
  private client: any;

  constructor() {
    if (!config.deepgramApiKey) {
      throw new Error('Deepgram API key not configured');
    }
    this.client = createClient(config.deepgramApiKey);
  }

  async transcribe(audioBuffer: Buffer, options?: STTOptions): Promise<STTResult> {
    try {
      const { result, error } = await this.client.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: options?.model || 'nova-2',
          language: options?.language || 'en-US',
          punctuate: options?.punctuate ?? true,
          profanity_filter: options?.profanityFilter ?? true,
          smart_format: true,
        }
      );

      if (error) {
        throw new Error(`Deepgram transcription error: ${error}`);
      }

      const transcript = result.results?.channels[0]?.alternatives[0];
      
      return {
        transcript: transcript?.transcript || '',
        confidence: transcript?.confidence || 0,
        isFinal: true,
        words: transcript?.words?.map((word: any) => ({
          word: word.word,
          start: word.start,
          end: word.end,
          confidence: word.confidence,
        })),
      };
    } catch (error) {
      logger.error('Deepgram transcription failed', { error });
      throw error;
    }
  }

  createStream(options?: StreamingSTTOptions): any {
    try {
      const deepgramOptions = {
        model: options?.model || 'nova-2',
        language: options?.language || 'en-US',
        punctuate: options?.punctuate ?? true,
        profanity_filter: options?.profanityFilter ?? true,
        interim_results: options?.interimResults ?? true,
        smart_format: true,
      };

      const connection = this.client.listen.live(deepgramOptions);

      connection.on(LiveTranscriptionEvents.Open, () => {
        logger.info('Deepgram streaming connection opened');
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        logger.info('Deepgram streaming connection closed');
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        logger.debug('Deepgram transcript received', { isFinal: data.is_final });
      });

      connection.on(LiveTranscriptionEvents.Error, (error: any) => {
        logger.error('Deepgram streaming error', { error });
      });

      return connection;
    } catch (error) {
      logger.error('Deepgram stream creation failed', { error });
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.listen.prerecorded.transcribeFile(
        Buffer.from('test'),
        { model: 'nova-2', language: 'en-US' }
      );
      logger.info('Deepgram connection test successful');
      return true;
    } catch (error) {
      logger.error('Deepgram connection test failed', { error });
      return false;
    }
  }
}
