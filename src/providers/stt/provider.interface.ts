export interface STTOptions {
  language?: string;
  model?: string;
  punctuate?: boolean;
  profanityFilter?: boolean;
}

export interface STTResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export interface StreamingSTTOptions extends STTOptions {
  interimResults?: boolean;
}

export interface ISTTProvider {
  /**
   * Transcribe audio file
   */
  transcribe(audioBuffer: Buffer, options?: STTOptions): Promise<STTResult>;

  /**
   * Create streaming transcription session
   */
  createStream(options?: StreamingSTTOptions): any;

  /**
   * Test provider connection
   */
  testConnection(): Promise<boolean>;
}
