export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ConversationContext {
  sessionId: string;
  leadId?: string;
  phoneNumber?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  messages: ConversationMessage[];
  currentStage: string;
  extractedData: Record<string, any>;
  customerIntent?: string;
  lastActivity: Date;
}

export interface ConversationEngineOptions {
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enableMemory?: boolean;
  enableFunctionCalling?: boolean;
}

export interface FunctionCall {
  name: string;
  parameters: Record<string, any>;
}

export interface AIResponse {
  content: string;
  functionCalls?: FunctionCall[];
  metadata?: Record<string, any>;
}
