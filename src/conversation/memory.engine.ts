import prisma from '../config/database';
import { AgentMemory } from '../agents/agent.types';
import logger from '../config/logger';

export interface ConversationMemory {
  customerName: string;
  phone: string;
  email?: string;
  currentStage: string;
  interestLevel: 'high' | 'medium' | 'low';
  objections: string[];
  loanAmount?: number;
  transferStatus?: string;
  appointmentStatus?: string;
  previousCalls: string[];
  conversationSummary: string;
  customFields: Record<string, any>;
}

export class MemoryEngine {
  static async createMemory(
    agentId: string,
    callId: string,
    initialData: Partial<ConversationMemory>
  ): Promise<AgentMemory> {
    try {
      const memory = await prisma.agentMemory.create({
        data: {
          agentId,
          callId,
          customerName: initialData.customerName || 'Unknown',
          phone: initialData.phone || '',
          email: initialData.email,
          currentStage: initialData.currentStage || 'INITIAL',
          interestLevel: initialData.interestLevel || 'medium',
          objections: initialData.objections || [],
          customFields: initialData.customFields || {},
          previousCalls: initialData.previousCalls || [],
          conversationSummary: initialData.conversationSummary || '',
        },
      });

      logger.info('Conversation memory created', { agentId, callId });

      return memory as AgentMemory;
    } catch (error) {
      logger.error('Failed to create conversation memory', { error, agentId, callId });
      throw error;
    }
  }

  static async getMemory(callId: string): Promise<AgentMemory | null> {
    try {
      const memory = await prisma.agentMemory.findUnique({
        where: { callId },
      });

      return memory as AgentMemory | null;
    } catch (error) {
      logger.error('Failed to get conversation memory', { error, callId });
      throw error;
    }
  }

  static async updateMemory(
    callId: string,
    updates: Partial<ConversationMemory>
  ): Promise<AgentMemory> {
    try {
      const memory = await prisma.agentMemory.update({
        where: { callId },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
      });

      logger.info('Conversation memory updated', { callId });

      return memory as AgentMemory;
    } catch (error) {
      logger.error('Failed to update conversation memory', { error, callId });
      throw error;
    }
  }

  static async updateStage(callId: string, stage: string): Promise<AgentMemory> {
    return this.updateMemory(callId, { currentStage: stage });
  }

  static async addObjection(callId: string, objection: string): Promise<AgentMemory> {
    const memory = await this.getMemory(callId);
    if (!memory) {
      throw new Error('Memory not found');
    }

    const objections = [...memory.objections, objection];
    return this.updateMemory(callId, { objections });
  }

  static async updateInterestLevel(
    callId: string,
    interestLevel: 'high' | 'medium' | 'low'
  ): Promise<AgentMemory> {
    return this.updateMemory(callId, { interestLevel });
  }

  static async updateSummary(callId: string, summary: string): Promise<AgentMemory> {
    return this.updateMemory(callId, { conversationSummary: summary });
  }

  static async addCustomField(
    callId: string,
    key: string,
    value: any
  ): Promise<AgentMemory> {
    const memory = await this.getMemory(callId);
    if (!memory) {
      throw new Error('Memory not found');
    }

    const customFields = { ...memory.customFields, [key]: value };
    return this.updateMemory(callId, { customFields });
  }

  static async addPreviousCall(callId: string, previousCallId: string): Promise<AgentMemory> {
    const memory = await this.getMemory(callId);
    if (!memory) {
      throw new Error('Memory not found');
    }

    const previousCalls = [...memory.previousCalls, previousCallId];
    return this.updateMemory(callId, { previousCalls });
  }

  static async deleteMemory(callId: string): Promise<void> {
    try {
      await prisma.agentMemory.delete({
        where: { callId },
      });

      logger.info('Conversation memory deleted', { callId });
    } catch (error) {
      logger.error('Failed to delete conversation memory', { error, callId });
      throw error;
    }
  }

  static async getMemoryByAgent(agentId: string): Promise<AgentMemory[]> {
    try {
      const memories = await prisma.agentMemory.findMany({
        where: { agentId },
        orderBy: { updatedAt: 'desc' },
      });

      return memories as AgentMemory[];
    } catch (error) {
      logger.error('Failed to get memories by agent', { error, agentId });
      throw error;
    }
  }

  static async searchMemories(
    agentId: string,
    filters: {
      customerName?: string;
      phone?: string;
      interestLevel?: string;
      currentStage?: string;
    }
  ): Promise<AgentMemory[]> {
    try {
      const where: any = { agentId };

      if (filters.customerName) {
        where.customerName = { contains: filters.customerName, mode: 'insensitive' };
      }

      if (filters.phone) {
        where.phone = filters.phone;
      }

      if (filters.interestLevel) {
        where.interestLevel = filters.interestLevel;
      }

      if (filters.currentStage) {
        where.currentStage = filters.currentStage;
      }

      const memories = await prisma.agentMemory.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
      });

      return memories as AgentMemory[];
    } catch (error) {
      logger.error('Failed to search memories', { error, agentId, filters });
      throw error;
    }
  }

  static async getMemoryStats(agentId: string): Promise<{
    total: number;
    byInterestLevel: Record<string, number>;
    byStage: Record<string, number>;
  }> {
    try {
      const memories = await this.getMemoryByAgent(agentId);

      const byInterestLevel: Record<string, number> = {
        high: 0,
        medium: 0,
        low: 0,
      };

      const byStage: Record<string, number> = {};

      for (const memory of memories) {
        byInterestLevel[memory.interestLevel]++;
        byStage[memory.currentStage] = (byStage[memory.currentStage] || 0) + 1;
      }

      return {
        total: memories.length,
        byInterestLevel,
        byStage,
      };
    } catch (error) {
      logger.error('Failed to get memory stats', { error, agentId });
      throw error;
    }
  }
}

export default MemoryEngine;
