export interface CallOptions {
  to: string;
  from?: string;
  webhookUrl?: string;
  metadata?: Record<string, any>;
}

export interface CallResult {
  callId: string;
  status: string;
  direction: string;
  to: string;
  from: string;
  createdAt: Date;
}

export interface CallStatus {
  callId: string;
  status: string;
  state: string;
  to: string;
  from: string;
  duration: number;
  recordingUrl?: string;
  startedAt?: Date;
  endedAt?: Date;
}

export interface ITelephonyProvider {
  /**
   * Create an outbound call
   */
  createCall(options: CallOptions): Promise<CallResult>;

  /**
   * End an active call
   */
  endCall(callId: string): Promise<void>;

  /**
   * Hold or unhold a call
   */
  holdCall(callId: string, hold: boolean): Promise<void>;

  /**
   * Transfer a call to another number
   */
  transferCall(callId: string, to: string, options?: any): Promise<void>;

  /**
   * Send DTMF tones
   */
  sendDtmf(callId: string, digits: string): Promise<void>;

  /**
   * Speak text using TTS
   */
  speakText(callId: string, text: string, options?: any): Promise<void>;

  /**
   * Get call status
   */
  getCallStatus(callId: string): Promise<CallStatus>;

  /**
   * List calls with filters
   */
  listCalls(filters?: any): Promise<any[]>;

  /**
   * Get call recording URL
   */
  getRecording(callId: string): Promise<string>;

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: string, signature: string, timestamp: string): boolean;

  /**
   * Test provider connection
   */
  testConnection(): Promise<boolean>;
}
