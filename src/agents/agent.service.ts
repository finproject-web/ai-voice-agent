import prisma from '../config/database';
import { AppError } from '../middleware/error';
import logger from '../config/logger';
import { Agent, AgentConfig, AgentStatus, AgentVoice, AgentLanguage } from './agent.types';

export class AgentService {
  static async createAgent(
    tenantId: string,
    name: string,
    config: AgentConfig,
    createdById: string,
    description?: string
  ): Promise<Agent> {
    try {
      // Verify tenant exists
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        throw new AppError('Tenant not found', 404);
      }

      // Verify creator exists and belongs to tenant
      const creator = await prisma.user.findFirst({
        where: {
          id: createdById,
          tenantId,
        },
      });

      if (!creator) {
        throw new AppError('Creator not found', 404);
      }

      // Create agent record
      const agent = await prisma.agent.create({
        data: {
          tenantId,
          name,
          description,
          version: 1,
          status: AgentStatus.INACTIVE,
          config: config as any,
          createdById,
        },
      });

      logger.info('Agent created', { agentId: agent.id, tenantId, name });

      return agent as unknown as Agent;
    } catch (error) {
      logger.error('Failed to create agent', { error, tenantId, name });
      throw error;
    }
  }

  static async getAgents(tenantId: string, filters: {
    status?: AgentStatus;
    createdById?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ agents: Agent[]; pagination: any }> {
    try {
      const { status, createdById, page = 1, limit = 50 } = filters;

      const where: any = {
        tenantId,
      };

      if (status) {
        where.status = status;
      }

      if (createdById) {
        where.createdById = createdById;
      }

      const [agents, total] = await Promise.all([
        prisma.agent.findMany({
          where,
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.agent.count({ where }),
      ]);

      return {
        agents: agents as unknown as Agent[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to get agents', { error, tenantId });
      throw error;
    }
  }

  static async getAgentById(agentId: string, tenantId: string): Promise<Agent> {
    try {
      const agent = await prisma.agent.findFirst({
        where: {
          id: agentId,
          tenantId,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      if (!agent) {
        throw new AppError('Agent not found', 404);
      }

      return agent as unknown as Agent;
    } catch (error) {
      logger.error('Failed to get agent', { error, agentId, tenantId });
      throw error;
    }
  }

  static async updateAgent(
    agentId: string,
    tenantId: string,
    updates: Partial<Agent>
  ): Promise<Agent> {
    try {
      const agent = await prisma.agent.findFirst({
        where: {
          id: agentId,
          tenantId,
        },
      });

      if (!agent) {
        throw new AppError('Agent not found', 404);
      }

      // If updating config, increment version
      const updateData: any = { ...updates };
      if (updates.config) {
        updateData.version = { increment: 1 };
      }

      const updatedAgent = await prisma.agent.update({
        where: { id: agentId },
        data: updateData,
      });

      logger.info('Agent updated', { agentId, tenantId });

      return updatedAgent as unknown as Agent;
    } catch (error) {
      logger.error('Failed to update agent', { error, agentId, tenantId });
      throw error;
    }
  }

  static async deleteAgent(agentId: string, tenantId: string): Promise<void> {
    try {
      const agent = await prisma.agent.findFirst({
        where: {
          id: agentId,
          tenantId,
        },
      });

      if (!agent) {
        throw new AppError('Agent not found', 404);
      }

      await prisma.agent.delete({
        where: { id: agentId },
      });

      logger.info('Agent deleted', { agentId, tenantId });
    } catch (error) {
      logger.error('Failed to delete agent', { error, agentId, tenantId });
      throw error;
    }
  }

  static async activateAgent(agentId: string, tenantId: string): Promise<Agent> {
    return this.updateAgent(agentId, tenantId, { status: AgentStatus.ACTIVE });
  }

  static async deactivateAgent(agentId: string, tenantId: string): Promise<Agent> {
    return this.updateAgent(agentId, tenantId, { status: AgentStatus.INACTIVE });
  }

  static async archiveAgent(agentId: string, tenantId: string): Promise<Agent> {
    return this.updateAgent(agentId, tenantId, { status: AgentStatus.ARCHIVED });
  }

  static async duplicateAgent(agentId: string, tenantId: string, newName: string, createdById: string): Promise<Agent> {
    try {
      const originalAgent = await this.getAgentById(agentId, tenantId);

      const newAgent = await this.createAgent(
        tenantId,
        newName,
        originalAgent.config,
        createdById,
        `${originalAgent.description} (Copy)`
      );

      logger.info('Agent duplicated', { originalAgentId: agentId, newAgentId: newAgent.id });

      return newAgent;
    } catch (error) {
      logger.error('Failed to duplicate agent', { error, agentId, tenantId });
      throw error;
    }
  }
}

export default AgentService;
