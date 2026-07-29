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
  state: ConversationState;
  toolLog?: { tool: string; params: Record<string, any>; result?: string }[];
}

export interface ConversationState {
  identity_confirmed?: boolean;
  interest_confirmed?: boolean;
  loan_amount?: string;
  email_confirmed?: boolean;
  email_sent?: boolean;
  application_started?: boolean;
  application_completed?: boolean;
  currentStage: string;
  last_question?: string;
  customer_language?: string;
  lastToolResult?: string;
  [key: string]: any;
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
