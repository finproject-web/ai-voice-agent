export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface FunctionCall {
  name: string;
  parameters: Record<string, any>;
}

export interface FunctionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface FunctionContext {
  sessionId: string;
  leadId?: string;
  phoneNumber?: string;
  conversationHistory: Array<{ role: string; content: string }>;
  extractedData: Record<string, any>;
}
