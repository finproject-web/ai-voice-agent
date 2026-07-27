import { IAIProvider } from '../../providers/ai/ai.interface';
import { OpenAIProvider } from '../../providers/ai/openai.provider';
import { NVIDIAProvider } from '../../providers/ai/nvidia.provider';
import logger from '../../config/logger';
import config from '../../config';
import {
  ConversationContext,
  ConversationEngineOptions,
  ConversationMessage,
  AIResponse,
} from './types';

export class ConversationEngine {
  private aiProvider: IAIProvider;
  private contexts: Map<string, ConversationContext>;
  private options: ConversationEngineOptions;

  constructor(options?: ConversationEngineOptions) {
    // Use OpenAI if available, otherwise fall back to NVIDIA
    if (config.openaiApiKey) {
      this.aiProvider = new OpenAIProvider();
      this.options = {
        systemPrompt: options?.systemPrompt || 'You are a professional AI sales agent for Up Start Loans. Help customers with loan applications, answer questions, and guide them through the process.',
        model: options?.model || 'gpt-4o',
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 1000,
        enableMemory: options?.enableMemory ?? true,
        enableFunctionCalling: options?.enableFunctionCalling ?? true,
      };
    } else if (config.nvidiaApiKey) {
      this.aiProvider = new NVIDIAProvider();
      this.options = {
        systemPrompt: options?.systemPrompt || 'You are a professional AI sales agent for Up Start Loans. Help customers with loan applications, answer questions, and guide them through the process.',
        model: options?.model || 'meta/llama-3.1-405b-instruct',
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 1000,
        enableMemory: options?.enableMemory ?? true,
        enableFunctionCalling: options?.enableFunctionCalling ?? true,
      };
    } else {
      throw new Error('No AI provider configured (OpenAI or NVIDIA API key required)');
    }

    this.contexts = new Map();
  }

  async createContext(sessionId: string, initialData?: Partial<ConversationContext>): Promise<ConversationContext> {
    const context: ConversationContext = {
      sessionId,
      messages: [],
      currentStage: 'greeting',
      extractedData: {},
      lastActivity: new Date(),
      ...initialData,
    };

    // Build personalized system prompt with customer context
    if (initialData?.customerName) {
      this.options.systemPrompt = `You are Sophia, a professional AI sales agent for Up Start Loans.

Customer Information:
- Name: ${initialData.customerName}
- Email: ${initialData.customerEmail || 'Not provided'}
- Phone: ${initialData.customerPhone || 'Not provided'}

Your task:
1. Greet the customer by name
2. Mention they recently applied for a loan online
3. Ask if they're still looking for a loan today
4. If interested, qualify them (loan amount, email confirmation)
5. Guide them through the application process

Be friendly, professional, and conversational. Use the customer's name naturally in the conversation.`;
    }

    this.contexts.set(sessionId, context);
    logger.info('Conversation context created', { sessionId, customerName: initialData?.customerName });

    return context;
  }

  getContext(sessionId: string): ConversationContext | undefined {
    return this.contexts.get(sessionId);
  }

  async processMessage(
    sessionId: string,
    userMessage: string,
    metadata?: Record<string, any>
  ): Promise<AIResponse> {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw new Error(`No context found for session: ${sessionId}`);
    }

    // Add user message to context
    const userMsg: ConversationMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      metadata,
    };

    context.messages.push(userMsg);
    context.lastActivity = new Date();

    // Generate AI response
    const aiContext = {
      systemPrompt: this.options.systemPrompt,
      model: this.options.model,
      temperature: this.options.temperature,
      maxTokens: this.options.maxTokens,
      messages: context.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    let response;
    try {
      response = await this.aiProvider.generateResponse(aiContext, userMessage);
    } catch (error) {
      logger.warn('AI generation failed, using fallback response', { sessionId, error });
      response = this.getFallbackResponse(context, userMessage);
    }

    // Add assistant response to context
    const assistantMsg: ConversationMessage = {
      role: 'assistant',
      content: response.content,
      timestamp: new Date(),
      metadata: response.metadata,
    };

    context.messages.push(assistantMsg);

    // Update context
    this.contexts.set(sessionId, context);

    logger.info('Message processed', {
      sessionId,
      messageCount: context.messages.length,
      responseLength: response.content.length,
    });

    return {
      content: response.content,
      functionCalls: response.metadata?.functionCalls,
      metadata: response.metadata,
    };
  }

  updateContext(sessionId: string, updates: Partial<ConversationContext>): void {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw new Error(`No context found for session: ${sessionId}`);
    }

    Object.assign(context, updates);
    context.lastActivity = new Date();
    this.contexts.set(sessionId, context);

    logger.info('Context updated', { sessionId, updates: Object.keys(updates) });
  }

  extractInformation(sessionId: string, fields: string[]): Record<string, any> {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw new Error(`No context found for session: ${sessionId}`);
    }

    const extracted: Record<string, any> = {};

    // Simple extraction based on patterns (can be enhanced with AI)
    for (const field of fields) {
      const pattern = this.getExtractionPattern(field);
      const match = context.messages
        .map((m) => m.content)
        .join(' ')
        .match(pattern);

      if (match) {
        extracted[field] = match[1] || match[0];
      }
    }

    context.extractedData = { ...context.extractedData, ...extracted };
    this.contexts.set(sessionId, context);

    return extracted;
  }

  private getExtractionPattern(field: string): RegExp {
    const patterns: Record<string, RegExp> = {
      email: /[\w.-]+@[\w.-]+\.\w+/,
      phone: /\+?[\d\s-()]{10,}/,
      name: /(?:my name is|i am|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      company: /(?:at|from|work at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      amount: /\$?\s*[\d,]+(?:\.\d{2})?/,
    };

    return patterns[field] || new RegExp(field, 'gi');
  }

  detectIntent(sessionId: string): string {
    const context = this.contexts.get(sessionId);

    if (!context) {
      return 'unknown';
    }

    const lastMessage = context.messages[context.messages.length - 1];
    const content = lastMessage?.content.toLowerCase() || '';

    // Intent detection based on keywords
    if (content.includes('interested') || content.includes('yes') || content.includes('sure')) {
      return 'interest';
    }

    if (content.includes('not interested') || content.includes('no thank') || content.includes('not now')) {
      return 'not_interested';
    }

    if (content.includes('question') || content.includes('how') || content.includes('what') || content.includes('why')) {
      return 'question';
    }

    if (content.includes('expensive') || content.includes('cost') || content.includes('price')) {
      return 'price_concern';
    }

    if (content.includes('credit') || content.includes('score') || content.includes('bad credit')) {
      return 'credit_concern';
    }

    return 'unknown';
  }

  getConversationSummary(sessionId: string): string {
    const context = this.contexts.get(sessionId);

    if (!context) {
      return '';
    }

    return context.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');
  }

  clearContext(sessionId: string): void {
    this.contexts.delete(sessionId);
    logger.info('Context cleared', { sessionId });
  }

  cleanupInactiveSessions(maxAgeMinutes: number = 30): void {
    const now = new Date();
    const maxAge = maxAgeMinutes * 60 * 1000;

    for (const [sessionId, context] of this.contexts.entries()) {
      const age = now.getTime() - context.lastActivity.getTime();
      if (age > maxAge) {
        this.contexts.delete(sessionId);
        logger.info('Inactive session cleaned up', { sessionId, age });
      }
    }
  }

  getActiveSessionCount(): number {
    return this.contexts.size;
  }

  private getFallbackResponse(context: ConversationContext, userMessage: string): AIResponse {
    const messageCount = context.messages.length;
    const lowerMessage = userMessage.toLowerCase();

    // First message - greeting
    if (messageCount <= 1) {
      return {
        content: "Hi, this is Sophia from Up Start Loans. Am I speaking with the right person?",
        metadata: { fallback: true, stage: 'greeting' }
      };
    }

    // Customer confirmed identity
    if (lowerMessage.includes('yes') || lowerMessage.includes('yeah') || lowerMessage.includes('correct')) {
      if (messageCount <= 3) {
        return {
          content: "Just a quick call because you recently applied for a loan online. Are you still looking for a loan today?",
          metadata: { fallback: true, stage: 'interest_check' }
        };
      }
      // Email confirmation
      return {
        content: "Perfect, I'll send your secure application link right now.",
        metadata: { fallback: true, stage: 'email_confirmation' }
      };
    }

    // Customer interested in loan
    if (lowerMessage.includes('interested') || lowerMessage.includes('looking') || lowerMessage.includes('want')) {
      return {
        content: "What loan amount are you looking for today?",
        metadata: { fallback: true, stage: 'loan_amount' }
      };
    }

    // Loan amount provided
    if (lowerMessage.includes('$') || /\d+/.test(lowerMessage)) {
      return {
        content: "Okay, I see we have your email on file. Is this still correct?",
        metadata: { fallback: true, stage: 'email_verification' }
      };
    }

    // Objections
    if (lowerMessage.includes('not interested') || lowerMessage.includes('don\'t need') || lowerMessage.includes('not looking')) {
      return {
        content: "That's completely okay. I just wanted to make sure you had the information available if your situation changes.",
        metadata: { fallback: true, stage: 'objection_handled' }
      };
    }

    if (lowerMessage.includes('busy') || lowerMessage.includes('not now') || lowerMessage.includes('bad time')) {
      return {
        content: "No problem. I can send the application link so you can review it when convenient.",
        metadata: { fallback: true, stage: 'follow_up' }
      };
    }

    if (lowerMessage.includes('human') || lowerMessage.includes('person') || lowerMessage.includes('agent')) {
      return {
        content: "I'll transfer you to a human agent right away.",
        metadata: { fallback: true, stage: 'transfer' }
      };
    }

    // Default fallback
    return {
      content: "I understand. Let me help you with your loan application. What loan amount are you looking for?",
      metadata: { fallback: true, stage: 'default' }
    };
  }
}
