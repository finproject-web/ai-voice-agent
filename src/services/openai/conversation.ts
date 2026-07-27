import openaiClient from './openaiClient';
import config from '../../config';
import logger from '../../config/logger';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface ConversationContext {
  messages: Message[];
  leadInfo?: {
    name: string;
    company?: string;
    industry?: string;
    previousInteractions?: string[];
  };
  campaignContext?: {
    script: string;
    goal: string;
    product?: string;
  };
  customInstructions?: string;
}

export class ConversationService {
  static async generateResponse(
    context: ConversationContext,
    userMessage: string
  ): Promise<string> {
    try {
      const client = openaiClient.getClient();

      // Build system message with context
      const systemMessage = this.buildSystemMessage(context);

      // Build conversation history
      const messages: Message[] = [
        { role: 'system', content: systemMessage },
        ...context.messages,
        { role: 'user', content: userMessage },
      ];

      const completion = await client.chat.completions.create({
        model: config.openaiModel,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: config.openaiTemperature,
        max_tokens: config.openaiMaxTokens,
      });

      const response = completion.choices[0]?.message?.content || '';

      logger.info('OpenAI response generated', {
        messageCount: messages.length,
        responseLength: response.length,
      });

      return response;
    } catch (error) {
      logger.error('Failed to generate OpenAI response', { error });
      throw error;
    }
  }

  private static buildSystemMessage(context: ConversationContext): string {
    let systemMessage = 'You are a professional AI sales agent for an outbound calling system. ';

    // Add campaign context
    if (context.campaignContext) {
      systemMessage += `Your goal is: ${context.campaignContext.goal}. `;
      systemMessage += `Use this script as a guide: ${context.campaignContext.script}. `;
      if (context.campaignContext.product) {
        systemMessage += `You are selling: ${context.campaignContext.product}. `;
      }
    }

    // Add lead information
    if (context.leadInfo) {
      systemMessage += `You are speaking with ${context.leadInfo.name}. `;
      if (context.leadInfo.company) {
        systemMessage += `They work at ${context.leadInfo.company}. `;
      }
      if (context.leadInfo.industry) {
        systemMessage += `Industry: ${context.leadInfo.industry}. `;
      }
      if (context.leadInfo.previousInteractions?.length) {
        systemMessage += `Previous interactions: ${context.leadInfo.previousInteractions.join(', ')}. `;
      }
    }

    // Add custom instructions
    if (context.customInstructions) {
      systemMessage += `Additional instructions: ${context.customInstructions}. `;
    }

    systemMessage += `
Be professional, courteous, and conversational. 
Ask relevant questions to understand the prospect's needs.
Adapt your approach based on their responses.
Keep responses concise and natural for phone conversations.
Avoid being overly salesy or aggressive.
If the prospect is not interested, politely end the conversation.
`;

    return systemMessage;
  }

  static async manageConversationContext(
    currentContext: ConversationContext,
    newMessage: Message,
    aiResponse: string
  ): Promise<ConversationContext> {
    try {
      // Add user message and AI response to context
      const updatedMessages: Message[] = [
        ...currentContext.messages,
        newMessage,
        {
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date(),
        },
      ];

      // Keep only last 10 messages to manage token usage
      const recentMessages = updatedMessages.slice(-10);

      const updatedContext: ConversationContext = {
        ...currentContext,
        messages: recentMessages,
      };

      logger.info('Conversation context updated', {
        messageCount: recentMessages.length,
      });

      return updatedContext;
    } catch (error) {
      logger.error('Failed to manage conversation context', { error });
      throw error;
    }
  }

  static async summarizeConversation(messages: Message[]): Promise<string> {
    try {
      const client = openaiClient.getClient();

      const summaryPrompt = `
Summarize the following sales conversation in 2-3 sentences. 
Focus on the prospect's needs, objections, and next steps.

Conversation:
${messages.map((m) => `${m.role}: ${m.content}`).join('\n')}
`;

      const completion = await client.chat.completions.create({
        model: config.openaiModel,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that summarizes sales conversations.' },
          { role: 'user', content: summaryPrompt },
        ],
        temperature: 0.3,
        max_tokens: 200,
      });

      const summary = completion.choices[0]?.message?.content || '';

      logger.info('Conversation summarized', { summaryLength: summary.length });

      return summary;
    } catch (error) {
      logger.error('Failed to summarize conversation', { error });
      throw error;
    }
  }

  static async extractKeyInformation(messages: Message[]): Promise<{
    prospectNeeds: string[];
    objections: string[];
    interestLevel: 'high' | 'medium' | 'low';
    nextSteps: string[];
  }> {
    try {
      const client = openaiClient.getClient();

      const extractionPrompt = `
Analyze the following sales conversation and extract:
1. Prospect needs (as a JSON array)
2. Objections raised (as a JSON array)
3. Interest level (high, medium, or low)
4. Next steps (as a JSON array)

Respond in JSON format only.

Conversation:
${messages.map((m) => `${m.role}: ${m.content}`).join('\n')}
`;

      const completion = await client.chat.completions.create({
        model: config.openaiModel,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that extracts information from sales conversations. Always respond in valid JSON format.' },
          { role: 'user', content: extractionPrompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content || '{}';
      const extracted = JSON.parse(response);

      logger.info('Key information extracted', {
        needsCount: extracted.prospectNeeds?.length || 0,
        objectionsCount: extracted.objections?.length || 0,
        interestLevel: extracted.interestLevel,
      });

      return {
        prospectNeeds: extracted.prospectNeeds || [],
        objections: extracted.objections || [],
        interestLevel: extracted.interestLevel || 'medium',
        nextSteps: extracted.nextSteps || [],
      };
    } catch (error) {
      logger.error('Failed to extract key information', { error });
      throw error;
    }
  }

  static async generateFollowUpMessage(
    conversationSummary: string,
    prospectInfo: {
      name: string;
      company?: string;
    }
  ): Promise<string> {
    try {
      const client = openaiClient.getClient();

      const prompt = `
Generate a professional follow-up message for ${prospectInfo.name}${prospectInfo.company ? ` at ${prospectInfo.company}` : ''}.

Conversation summary: ${conversationSummary}

The message should:
- Be professional and courteous
- Reference key points from the conversation
- Include a clear call to action
- Be concise (under 150 words)
`;

      const completion = await client.chat.completions.create({
        model: config.openaiModel,
        messages: [
          { role: 'system', content: 'You are a professional sales assistant that writes follow-up messages.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 250,
      });

      const followUp = completion.choices[0]?.message?.content || '';

      logger.info('Follow-up message generated', { length: followUp.length });

      return followUp;
    } catch (error) {
      logger.error('Failed to generate follow-up message', { error });
      throw error;
    }
  }
}

export default ConversationService;
