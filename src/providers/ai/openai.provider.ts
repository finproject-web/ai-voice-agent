import OpenAI from 'openai';
import { IAIProvider, ConversationContext, Message, AIResponse, SummaryOptions, ExtractionResult } from './ai.interface';
import logger from '../../config/logger';
import config from '../../config';

export class OpenAIProvider implements IAIProvider {
  private client: OpenAI;

  constructor() {
    if (!config.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }
    this.client = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  async generateResponse(context: ConversationContext, userMessage: string): Promise<AIResponse> {
    try {
      const messages: Message[] = [
        { role: 'system', content: context.systemPrompt || 'You are a professional AI sales agent.' },
        ...context.messages,
        { role: 'user', content: userMessage },
      ];

      const completion = await this.client.chat.completions.create({
        model: context.model || config.openaiModel,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: context.temperature ?? config.openaiTemperature,
        max_tokens: context.maxTokens ?? config.openaiMaxTokens,
      });

      const response = completion.choices[0]?.message?.content || '';

      logger.info('OpenAI response generated', {
        messageCount: messages.length,
        responseLength: response.length,
      });

      return {
        content: response,
        model: completion.model,
        usage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      logger.error('OpenAI generate response failed', { error });
      throw error;
    }
  }

  async summarizeConversation(messages: Message[], options?: SummaryOptions): Promise<string> {
    try {
      const summaryPrompt = `
Summarize the following sales conversation in 2-3 sentences.
${options?.focus ? `Focus on: ${options.focus}.` : ''}
${options?.maxLength ? `Keep it under ${options.maxLength} characters.` : ''}

Conversation:
${messages.map((m) => `${m.role}: ${m.content}`).join('\n')}
`;

      const completion = await this.client.chat.completions.create({
        model: config.openaiModel,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that summarizes sales conversations.' },
          { role: 'user', content: summaryPrompt },
        ],
        temperature: 0.3,
        max_tokens: 200,
      });

      const summary = completion.choices[0]?.message?.content || '';

      logger.info('OpenAI conversation summarized', { summaryLength: summary.length });

      return summary;
    } catch (error) {
      logger.error('OpenAI summarize conversation failed', { error });
      throw error;
    }
  }

  async extractKeyInformation(messages: Message[]): Promise<ExtractionResult> {
    try {
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

      const completion = await this.client.chat.completions.create({
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

      logger.info('OpenAI key information extracted', {
        needsCount: extracted.prospectNeeds?.length || 0,
        objectionsCount: extracted.objections?.length || 0,
        interestLevel: extracted.interestLevel,
      });

      return {
        needs: extracted.prospectNeeds || [],
        objections: extracted.objections || [],
        interestLevel: extracted.interestLevel || 'medium',
        nextSteps: extracted.nextSteps || [],
      };
    } catch (error) {
      logger.error('OpenAI extract key information failed', { error });
      throw error;
    }
  }

  async generateFollowUpMessage(summary: string, prospectInfo: any): Promise<string> {
    try {
      const prompt = `
Generate a professional follow-up message for ${prospectInfo.name}${prospectInfo.company ? ` at ${prospectInfo.company}` : ''}.

Conversation summary: ${summary}

The message should:
- Be professional and courteous
- Reference key points from the conversation
- Include a clear call to action
- Be concise (under 150 words)
`;

      const completion = await this.client.chat.completions.create({
        model: config.openaiModel,
        messages: [
          { role: 'system', content: 'You are a professional sales assistant that writes follow-up messages.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 250,
      });

      const followUp = completion.choices[0]?.message?.content || '';

      logger.info('OpenAI follow-up message generated', { length: followUp.length });

      return followUp;
    } catch (error) {
      logger.error('OpenAI generate follow-up message failed', { error });
      throw error;
    }
  }

  async generateInstructions(campaignGoal: string, productInfo: string, targetAudience: string): Promise<string> {
    try {
      const prompt = `
Generate detailed AI agent instructions for an outbound sales campaign.

Campaign Goal: ${campaignGoal}
Product/Service: ${productInfo}
Target Audience: ${targetAudience}

The instructions should include:
1. Tone and style guidelines
2. Key talking points
3. Questions to ask prospects
4. How to handle common objections
5. When to escalate or transfer
6. Success criteria

Be specific and actionable.
`;

      const completion = await this.client.chat.completions.create({
        model: config.openaiModel,
        messages: [
          { role: 'system', content: 'You are an expert in sales training and AI agent instruction design.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const instructions = completion.choices[0]?.message?.content || '';

      logger.info('OpenAI custom instructions generated', { length: instructions.length });

      return instructions;
    } catch (error) {
      logger.error('OpenAI generate instructions failed', { error });
      throw error;
    }
  }

  async optimizeInstructions(currentInstructions: string, performanceData: any): Promise<string> {
    try {
      const prompt = `
Optimize the following AI agent instructions based on performance data.

Current Instructions:
${currentInstructions}

Performance Data:
- Average Call Duration: ${performanceData.averageCallDuration} seconds
- Conversion Rate: ${(performanceData.conversionRate * 100).toFixed(2)}%
- Common Objections: ${performanceData.commonObjections?.join(', ')}
- Successful Patterns: ${performanceData.successfulPatterns?.join(', ')}

Provide optimized instructions that:
1. Address common objections more effectively
2. Incorporate successful patterns
3. Improve conversion rate
4. Maintain appropriate call duration
`;

      const completion = await this.client.chat.completions.create({
        model: config.openaiModel,
        messages: [
          { role: 'system', content: 'You are an expert in sales optimization and AI agent training.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const optimizedInstructions = completion.choices[0]?.message?.content || '';

      logger.info('OpenAI instructions optimized', {
        originalLength: currentInstructions.length,
        optimizedLength: optimizedInstructions.length,
      });

      return optimizedInstructions;
    } catch (error) {
      logger.error('OpenAI optimize instructions failed', { error });
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: config.openaiModel,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      });
      logger.info('OpenAI connection test successful');
      return true;
    } catch (error) {
      logger.error('OpenAI connection test failed', { error });
      return false;
    }
  }
}
