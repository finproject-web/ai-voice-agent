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
  greeted?: boolean;
  identity_confirmed?: boolean;
  interest_confirmed?: boolean;
  loan_interest_confirmed?: boolean;
  loan_amount?: string;
  email_confirmed?: boolean;
  email_sent?: boolean;
  website_opened?: boolean;
  application_started?: boolean;
  application_completed?: boolean;
  current_application_step?: string;
  customer_support_mode?: 'FULL_GUIDANCE' | 'SELF_SERVICE' | 'FAQ_SUPPORT' | 'HESITANT';
  currentStage: string;
  last_question?: string;
  customer_language?: string;
  lastToolResult?: string;
  [key: string]: any;
}

export interface StructuredCustomerContext {
  name?: string;
  email?: string;
  phone?: string;
  leadId?: string;
}

export interface StructuredStateContext {
  greeted: boolean;
  loanInterestConfirmed: boolean;
  loanAmount?: string;
  emailConfirmed: boolean;
  emailSent: boolean;
  websiteOpened: boolean;
  currentApplicationStep?: string;
  customerSupportMode?: string;
  transferRequired: boolean;
  currentStage: string;
}

// Structured internal representation of everything fed into an LLM request.
// The deterministic sophia-flow.ts state machine is the sole authority over
// `state` — the LLM is only ever given this object to read from and never
// allowed to write back into it directly.
export interface StructuredAIContext {
  system: string;
  customer: StructuredCustomerContext;
  state: StructuredStateContext;
  history: { role: 'system' | 'user' | 'assistant'; content: string }[];
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
