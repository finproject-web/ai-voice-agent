import axios from 'axios';
import { IAIProvider, ConversationContext, Message, AIResponse, SummaryOptions, ExtractionResult } from './ai.interface';
import logger from '../../config/logger';
import config from '../../config';

export class NVIDIAProvider implements IAIProvider {
  private apiKey: string;
  private baseUrl: string = 'https://integrate.api.nvidia.com/v1';

  constructor() {
    if (!config.nvidiaApiKey) {
      throw new Error('NVIDIA API key not configured');
    }
    this.apiKey = config.nvidiaApiKey;
  }

  async generateResponse(context: ConversationContext, userMessage: string): Promise<AIResponse> {
    try {
      const messages: Message[] = [
        { role: 'system', content: context.systemPrompt || 'You are a professional AI sales agent.' },
        ...context.messages,
        { role: 'user', content: userMessage },
      ];

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: context.model || 'meta/llama-3.1-405b-instruct',
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: context.temperature ?? 0.7,
          max_tokens: context.maxTokens ?? 1000,
          stream: false,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data.choices[0]?.message?.content || '';

      logger.info('NVIDIA response generated', {
        messageCount: messages.length,
        responseLength: content.length,
      });

      return {
        content,
        model: response.data.model,
        usage: response.data.usage ? {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      logger.error('NVIDIA generate response failed', { error });
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

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'meta/llama-3.1-405b-instruct',
          messages: [
            { role: 'system', content: 'You are a helpful assistant that summarizes sales conversations.' },
            { role: 'user', content: summaryPrompt },
          ],
          temperature: 0.3,
          max_tokens: 200,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const summary = response.data.choices[0]?.message?.content || '';

      logger.info('NVIDIA conversation summarized', { summaryLength: summary.length });

      return summary;
    } catch (error) {
      logger.error('NVIDIA summarize conversation failed', { error });
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

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'meta/llama-3.1-405b-instruct',
          messages: [
            { role: 'system', content: 'You are a helpful assistant that extracts information from sales conversations. Always respond in valid JSON format.' },
            { role: 'user', content: extractionPrompt },
          ],
          temperature: 0.3,
          max_tokens: 300,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data.choices[0]?.message?.content || '{}';
      const extracted = JSON.parse(content);

      logger.info('NVIDIA key information extracted', {
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
      logger.error('NVIDIA extract key information failed', { error });
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

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'meta/llama-3.1-405b-instruct',
          messages: [
            { role: 'system', content: 'You are a professional sales assistant that writes follow-up messages.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 250,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const followUp = response.data.choices[0]?.message?.content || '';

      logger.info('NVIDIA follow-up message generated', { length: followUp.length });

      return followUp;
    } catch (error) {
      logger.error('NVIDIA generate follow-up message failed', { error });
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

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'meta/llama-3.1-405b-instruct',
          messages: [
            { role: 'system', content: 'You are an expert in sales training and AI agent instruction design.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const instructions = response.data.choices[0]?.message?.content || '';

      logger.info('NVIDIA custom instructions generated', { length: instructions.length });

      return instructions;
    } catch (error) {
      logger.error('NVIDIA generate instructions failed', { error });
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

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'meta/llama-3.1-405b-instruct',
          messages: [
            { role: 'system', content: 'You are an expert in sales optimization and AI agent training.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const optimizedInstructions = response.data.choices[0]?.message?.content || '';

      logger.info('NVIDIA instructions optimized', {
        originalLength: currentInstructions.length,
        optimizedLength: optimizedInstructions.length,
      });

      return optimizedInstructions;
    } catch (error) {
      logger.error('NVIDIA optimize instructions failed', { error });
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'meta/llama-3.1-405b-instruct',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      logger.info('NVIDIA connection test successful');
      return true;
    } catch (error) {
      logger.error('NVIDIA connection test failed', { error });
      return false;
    }
  }
}
