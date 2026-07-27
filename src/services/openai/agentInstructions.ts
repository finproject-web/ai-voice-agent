import openaiClient from './openaiClient';
import config from '../../config';
import logger from '../../config/logger';

export interface AgentInstruction {
  type: 'greeting' | 'qualification' | 'presentation' | 'handling_objections' | 'closing' | 'follow_up';
  instruction: string;
  examples?: string[];
}

export class AgentInstructionService {
  static async generateCustomInstructions(
    campaignGoal: string,
    productInfo: string,
    targetAudience: string
  ): Promise<string> {
    try {
      const client = openaiClient.getClient();

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

      const completion = await client.chat.completions.create({
        model: config.openaiModel,
        messages: [
          { role: 'system', content: 'You are an expert in sales training and AI agent instruction design.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const instructions = completion.choices[0]?.message?.content || '';

      logger.info('Custom agent instructions generated', {
        length: instructions.length,
      });

      return instructions;
    } catch (error) {
      logger.error('Failed to generate custom agent instructions', { error });
      throw error;
    }
  }

  static async optimizeInstructions(
    currentInstructions: string,
    performanceData: {
      averageCallDuration: number;
      conversionRate: number;
      commonObjections: string[];
      successfulPatterns: string[];
    }
  ): Promise<string> {
    try {
      const client = openaiClient.getClient();

      const prompt = `
Optimize the following AI agent instructions based on performance data.

Current Instructions:
${currentInstructions}

Performance Data:
- Average Call Duration: ${performanceData.averageCallDuration} seconds
- Conversion Rate: ${(performanceData.conversionRate * 100).toFixed(2)}%
- Common Objections: ${performanceData.commonObjections.join(', ')}
- Successful Patterns: ${performanceData.successfulPatterns.join(', ')}

Provide optimized instructions that:
1. Address common objections more effectively
2. Incorporate successful patterns
3. Improve conversion rate
4. Maintain appropriate call duration
`;

      const completion = await client.chat.completions.create({
        model: config.openaiModel,
        messages: [
          { role: 'system', content: 'You are an expert in sales optimization and AI agent training.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const optimizedInstructions = completion.choices[0]?.message?.content || '';

      logger.info('Agent instructions optimized', {
        originalLength: currentInstructions.length,
        optimizedLength: optimizedInstructions.length,
      });

      return optimizedInstructions;
    } catch (error) {
      logger.error('Failed to optimize agent instructions', { error });
      throw error;
    }
  }

  static async generateResponseForStage(
    stage: AgentInstruction['type'],
    context: {
      prospectName: string;
      prospectCompany?: string;
      previousContext?: string;
      specificSituation?: string;
    }
  ): Promise<string> {
    try {
      const client = openaiClient.getClient();

      const stageInstructions = this.getStageInstructions(stage);

      const prompt = `
Generate a response for the ${stage} stage of a sales call.

Stage Instructions: ${stageInstructions.instruction}

Context:
- Speaking with: ${context.prospectName}${context.prospectCompany ? ` at ${context.prospectCompany}` : ''}
- Previous context: ${context.previousContext || 'None'}
- Specific situation: ${context.specificSituation || 'Standard call'}

${stageInstructions.examples ? `Examples to follow: ${stageInstructions.examples.join('\n')}` : ''}

Generate a natural, conversational response appropriate for phone communication.
`;

      const completion = await client.chat.completions.create({
        model: config.openaiModel,
        messages: [
          { role: 'system', content: 'You are a professional sales agent having a phone conversation.' },
          { role: 'user', content: prompt },
        ],
        temperature: config.openaiTemperature,
        max_tokens: 300,
      });

      const response = completion.choices[0]?.message?.content || '';

      logger.info('Stage-specific response generated', { stage, length: response.length });

      return response;
    } catch (error) {
      logger.error('Failed to generate stage-specific response', { error, stage });
      throw error;
    }
  }

  private static getStageInstructions(stage: AgentInstruction['type']): AgentInstruction {
    const instructions: Record<AgentInstruction['type'], AgentInstruction> = {
      greeting: {
        type: 'greeting',
        instruction: 'Start with a warm, professional greeting. Introduce yourself and the company. State the purpose of the call clearly but briefly. Ask if it\'s a good time to talk.',
        examples: [
          'Hi, this is John from ABC Company. I\'m calling to discuss how we can help streamline your operations. Do you have a quick moment to chat?',
        ],
      },
      qualification: {
        type: 'qualification',
        instruction: 'Ask open-ended questions to understand the prospect\'s needs, pain points, and current situation. Listen actively and probe deeper into their responses.',
        examples: [
          'Can you tell me about your current process for handling this?',
          'What challenges are you facing with your current solution?',
        ],
      },
      presentation: {
        type: 'presentation',
        instruction: 'Present your solution as a direct response to the prospect\'s stated needs. Focus on benefits rather than features. Use simple language and avoid jargon.',
        examples: [
          'Based on what you mentioned about the challenges with your current process, our solution can help by...',
        ],
      },
      handling_objections: {
        type: 'handling_objections',
        instruction: 'Acknowledge the objection empathetically. Ask clarifying questions to understand the root concern. Address the concern directly with evidence or examples. Confirm if the objection is resolved.',
        examples: [
          'I understand your concern about cost. Let me show you how the ROI typically works out within the first 3 months...',
        ],
      },
      closing: {
        type: 'closing',
        instruction: 'Summarize the key benefits discussed. Propose a clear next step with a specific timeline. Ask for commitment to the next step.',
        examples: [
          'So to recap, we can help you reduce costs by 20% and improve efficiency. Would you be available for a demo next Tuesday at 2pm?',
        ],
      },
      follow_up: {
        type: 'follow_up',
        instruction: 'Reference previous conversation points. Provide additional value or information requested. Reiterate the proposed next step. Express appreciation for their time.',
        examples: [
          'Following up on our conversation last week, I wanted to share the case study we discussed...',
        ],
      },
    };

    return instructions[stage];
  }

  static async analyzeConversationQuality(
    conversation: Array<{ role: string; content: string }>
  ): Promise<{
    overallScore: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  }> {
    try {
      const client = openaiClient.getClient();

      const prompt = `
Analyze the quality of this sales conversation and provide:
1. Overall score (1-10)
2. Strengths (JSON array)
3. Weaknesses (JSON array)
4. Recommendations for improvement (JSON array)

Respond in JSON format only.

Conversation:
${conversation.map((m) => `${m.role}: ${m.content}`).join('\n')}
`;

      const completion = await client.chat.completions.create({
        model: config.openaiModel,
        messages: [
          { role: 'system', content: 'You are an expert sales coach analyzing conversation quality. Always respond in valid JSON format.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(response);

      logger.info('Conversation quality analyzed', {
        overallScore: analysis.overallScore,
        strengthsCount: analysis.strengths?.length || 0,
      });

      return {
        overallScore: analysis.overallScore || 5,
        strengths: analysis.strengths || [],
        weaknesses: analysis.weaknesses || [],
        recommendations: analysis.recommendations || [],
      };
    } catch (error) {
      logger.error('Failed to analyze conversation quality', { error });
      throw error;
    }
  }
}

export default AgentInstructionService;
