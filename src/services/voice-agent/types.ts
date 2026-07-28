export interface VoiceAgentConfig {
  sessionId: string;
  leadId?: string;
  phoneNumber?: string;
  systemPrompt?: string;
  enableSTT?: boolean;
  enableTTS?: boolean;
  enableFunctionCalling?: boolean;
}

export interface CustomerContext {
  name?: string;
  email?: string;
  phone?: string;
  leadId?: string;
  leadData?: Record<string, any>;
}

export interface VoiceAgentState {
  sessionId: string;
  isActive: boolean;
  currentStage: string;
  lastActivity: Date;
  callId?: string;
  customerContext?: CustomerContext;
  greetingSent?: boolean;
  greetingAudioBuffer?: Buffer;
  greetingAudioPromise?: Promise<Buffer>;
}

export interface AudioStream {
  sessionId: string;
  audioData: Buffer;
  timestamp: Date;
}
