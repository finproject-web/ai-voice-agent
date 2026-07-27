export interface TTSOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speakerBoost?: boolean;
}

export interface TTSResult {
  audioBuffer: Buffer;
  contentType: string;
  duration?: number;
}

export interface ITTSProvider {
  /**
   * Convert text to speech
   */
  synthesize(text: string, options?: TTSOptions): Promise<TTSResult>;

  /**
   * Get available voices
   */
  getVoices(): Promise<any[]>;

  /**
   * Test provider connection
   */
  testConnection(): Promise<boolean>;
}
