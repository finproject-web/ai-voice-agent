import { WebSocket } from 'ws';
import { DeepgramProvider } from '../../providers/stt/deepgram.provider';
import { ElevenLabsProvider } from '../../providers/tts/elevenlabs.provider';
import { LiveTranscriptionEvents } from '@deepgram/sdk';
import { Resampler } from 'audio-resampler';
import logger from '../../config/logger';

export class AudioStreamingService {
  private deepgramProvider: DeepgramProvider;
  private elevenLabsProvider: ElevenLabsProvider;
  private activeStreams: Map<string, WebSocket> = new Map();

  constructor() {
    this.deepgramProvider = new DeepgramProvider();
    this.elevenLabsProvider = new ElevenLabsProvider();
  }

  async createStream(sessionId: string): Promise<WebSocket> {
    try {
      // Create Deepgram streaming connection
      const deepgramConnection = this.deepgramProvider.createStream({
        model: 'nova-2',
        language: 'en-US',
        punctuate: true,
        interimResults: true,
      });

      // Create WebSocket for client
      const ws = new WebSocket(null);
      
      this.activeStreams.set(sessionId, ws);

      // Handle incoming audio from client
      ws.on('message', async (data: Buffer) => {
        try {
          // Send audio to Deepgram
          deepgramConnection.send(data);

          // Get transcription
          deepgramConnection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
            const transcript = data.channel.alternatives[0].transcript;
            if (transcript && !data.is_final) {
              // Send interim transcript to client
              ws.send(JSON.stringify({ type: 'transcript', text: transcript, is_final: false }));
            } else if (transcript && data.is_final) {
              // Send final transcript to client
              ws.send(JSON.stringify({ type: 'transcript', text: transcript, is_final: true }));
            }
          });
        } catch (error) {
          logger.error('Error processing audio stream', { error, sessionId });
        }
      });

      ws.on('close', () => {
        this.closeStream(sessionId);
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error', { error, sessionId });
        this.closeStream(sessionId);
      });

      logger.info('Audio stream created', { sessionId });
      return ws;
    } catch (error) {
      logger.error('Failed to create audio stream', { error, sessionId });
      throw error;
    }
  }

  async synthesizeAndStream(text: string, sessionId: string): Promise<void> {
    try {
      const ttsResult = await this.elevenLabsProvider.synthesize(text);
      const audioBuffer = ttsResult.audioBuffer;
      
      // Convert audio to Telnyx-compatible format (8000Hz)
      const convertedAudio = await this.convertAudioFormat(audioBuffer, 8000);
      
      const ws = this.activeStreams.get(sessionId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'audio', data: convertedAudio.toString('base64') }));
      }
    } catch (error) {
      logger.error('Failed to synthesize and stream audio', { error, sessionId });
      throw error;
    }
  }

  private async convertAudioFormat(audioBuffer: Buffer, targetSampleRate: number): Promise<Buffer> {
    try {
      // Assume input is 16kHz (common for ElevenLabs output)
      const inputSampleRate = 16000;
      
      if (inputSampleRate === targetSampleRate) {
        return audioBuffer;
      }

      // Convert Buffer to Float32Array
      const float32Array = new Float32Array(audioBuffer.buffer);
      
      // Create resampler
      const resampler = new Resampler(inputSampleRate, targetSampleRate, 1);
      
      // Resample audio
      const resampled = resampler.resample(float32Array);
      
      // Convert back to Buffer (16-bit PCM)
      const pcmBuffer = new Int16Array(resampled.length);
      for (let i = 0; i < resampled.length; i++) {
        pcmBuffer[i] = Math.max(-32768, Math.min(32767, resampled[i] * 32768));
      }
      
      logger.info('Audio format conversion completed', { 
        originalSize: audioBuffer.length, 
        convertedSize: pcmBuffer.length,
        inputSampleRate,
        targetSampleRate
      });
      
      return Buffer.from(pcmBuffer.buffer);
    } catch (error) {
      logger.error('Audio format conversion failed', { error });
      // Return original buffer if conversion fails
      return audioBuffer;
    }
  }

  closeStream(sessionId: string): void {
    const ws = this.activeStreams.get(sessionId);
    if (ws) {
      ws.close();
      this.activeStreams.delete(sessionId);
      logger.info('Audio stream closed', { sessionId });
    }
  }

  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  getAllActiveStreams(): string[] {
    return Array.from(this.activeStreams.keys());
  }
}

export default new AudioStreamingService();
