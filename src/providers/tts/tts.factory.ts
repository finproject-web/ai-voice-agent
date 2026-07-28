import { ITTSProvider } from './provider.interface';
import { ElevenLabsProvider } from './elevenlabs.provider';
import { OpenAITTSProvider } from './openai-tts.provider';
import logger from '../../config/logger';

/**
 * Create a TTS provider based on the TTS_PROVIDER environment variable.
 * 
 * Set TTS_PROVIDER=elevenlabs to use ElevenLabs (higher quality, more expensive)
 * Set TTS_PROVIDER=openai to use OpenAI TTS (good quality, much cheaper)
 * Default: openai
 */
export function createTTSProvider(): ITTSProvider {
  const provider = (process.env.TTS_PROVIDER || 'openai').toLowerCase();

  switch (provider) {
    case 'elevenlabs':
      logger.info('=== TTS PROVIDER: ElevenLabs ===');
      return new ElevenLabsProvider();

    case 'openai':
    default:
      logger.info('=== TTS PROVIDER: OpenAI TTS ===');
      return new OpenAITTSProvider();
  }
}
