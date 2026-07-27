import { Job } from 'bullmq';
import queueManager, { QueueName } from '../queue.manager';
import { OpenAIProvider } from '../../providers/ai';
import { Message } from '../../providers/ai/ai.interface';
import prisma from '../../config/database';
import logger from '../../config/logger';

export interface AIProcessingJobData {
  type: 'response' | 'summary' | 'extraction' | 'followup';
  tenantId: string;
  conversationId?: string;
  callId?: string;
  messages: Message[];
  context?: Record<string, any>;
}

export async function aiProcessingProcessor(job: Job<AIProcessingJobData>): Promise<void> {
  const { type, tenantId, conversationId, callId, messages, context } = job.data;

  logger.info('Processing AI job', { type, tenantId, conversationId, callId });

  try {
    const aiProvider = new OpenAIProvider();

    switch (type) {
      case 'response':
        await processAIResponse(aiProvider, tenantId, conversationId, messages, context);
        break;
      case 'summary':
        await processAISummary(aiProvider, tenantId, conversationId, callId, messages);
        break;
      case 'extraction':
        await processAIExtraction(aiProvider, tenantId, conversationId, callId, messages);
        break;
      case 'followup':
        await processAIFollowUp(aiProvider, tenantId, conversationId, callId, messages, context);
        break;
      default:
        throw new Error(`Unknown AI processing type: ${type}`);
    }

    logger.info('AI processing completed successfully', { type, tenantId });
  } catch (error) {
    logger.error('AI processing job failed', { error, type, tenantId });
    throw error;
  }
}

async function processAIResponse(
  aiProvider: OpenAIProvider,
  tenantId: string,
  conversationId: string | undefined,
  messages: Message[],
  context?: Record<string, any>
): Promise<void> {
  const userMessage = messages[messages.length - 1]?.content || '';
  const conversationContext = {
    messages: messages.slice(0, -1),
    systemPrompt: context?.systemPrompt,
    temperature: context?.temperature,
    maxTokens: context?.maxTokens,
  };

  const response = await aiProvider.generateResponse(conversationContext, userMessage);

  // Update conversation with AI response
  if (conversationId) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        messages: [
          ...messages,
          { role: 'assistant', content: response.content },
        ],
      },
    });
  }

  logger.info('AI response generated', { conversationId, responseLength: response.content.length });
}

async function processAISummary(
  aiProvider: OpenAIProvider,
  tenantId: string,
  conversationId: string | undefined,
  callId: string | undefined,
  messages: Message[]
): Promise<void> {
  const summary = await aiProvider.summarizeConversation(messages);

  // Update conversation or call with summary
  if (conversationId) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { summary },
    });
  }

  if (callId) {
    await prisma.call.update({
      where: { id: callId },
      data: { summary },
    });
  }

  logger.info('AI summary generated', { conversationId, callId, summaryLength: summary.length });
}

async function processAIExtraction(
  aiProvider: OpenAIProvider,
  tenantId: string,
  conversationId: string | undefined,
  callId: string | undefined,
  messages: Message[]
): Promise<void> {
  const extraction = await aiProvider.extractKeyInformation(messages);

  // Update conversation with extracted information
  if (conversationId) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        metadata: {
          needs: extraction.needs,
          objections: extraction.objections,
          interestLevel: extraction.interestLevel,
          nextSteps: extraction.nextSteps,
        },
      },
    });
  }

  logger.info('AI extraction completed', { conversationId, callId, interestLevel: extraction.interestLevel });
}

async function processAIFollowUp(
  aiProvider: OpenAIProvider,
  tenantId: string,
  conversationId: string | undefined,
  callId: string | undefined,
  messages: Message[],
  context?: Record<string, any>
): Promise<void> {
  const summary = await aiProvider.summarizeConversation(messages);
  const followUp = await aiProvider.generateFollowUpMessage(summary, context?.prospectInfo || {});

  // Store follow-up message
  if (conversationId) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        metadata: {
          followUpMessage: followUp,
        },
      },
    });
  }

  logger.info('AI follow-up generated', { conversationId, callId });
}

// Register the processor
export function registerAIProcessingProcessor(): void {
  queueManager.processQueue(
    QueueName.AI_PROCESSING,
    aiProcessingProcessor,
    3 // Lower concurrency for AI processing (API limits)
  );
}
