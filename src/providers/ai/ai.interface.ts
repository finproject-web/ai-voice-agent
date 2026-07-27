export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ConversationContext {
  messages: Message[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

export interface SummaryOptions {
  maxLength?: number;
  focus?: string;
}

export interface ExtractionResult {
  needs: string[];
  objections: string[];
  interestLevel: 'high' | 'medium' | 'low';
  nextSteps: string[];
}

export interface IAIProvider {
  /**
   * Generate AI response based on conversation context
   */
  generateResponse(context: ConversationContext, userMessage: string): Promise<AIResponse>;

  /**
   * Summarize conversation
   */
  summarizeConversation(messages: Message[], options?: SummaryOptions): Promise<string>;

  /**
   * Extract key information from conversation
   */
  extractKeyInformation(messages: Message[]): Promise<ExtractionResult>;

  /**
   * Generate follow-up message
   */
  generateFollowUpMessage(summary: string, prospectInfo: any): Promise<string>;

  /**
   * Generate custom instructions
   */
  generateInstructions(campaignGoal: string, productInfo: string, targetAudience: string): Promise<string>;

  /**
   * Optimize instructions based on performance
   */
  optimizeInstructions(
    currentInstructions: string,
    performanceData: any
  ): Promise<string>;

  /**
   * Test provider connection
   */
  testConnection(): Promise<boolean>;
}
