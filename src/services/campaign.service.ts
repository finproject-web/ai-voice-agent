import prisma from '../config/database';
import { AppError } from '../middleware/error';
import logger from '../config/logger';

interface CreateCampaignData {
  tenantId: string;
  name: string;
  description?: string;
  type?: string;
  script?: string;
  voiceAgentId?: string;
  schedule?: any;
  settings?: any;
  priority?: number;
  startDate?: Date;
  endDate?: Date;
  createdById: string;
}

interface UpdateCampaignData {
  name?: string;
  description?: string;
  status?: string;
  type?: string;
  script?: string;
  voiceAgentId?: string;
  schedule?: any;
  settings?: any;
  priority?: number;
  startDate?: Date;
  endDate?: Date;
}

export class CampaignService {
  static async createCampaign(data: CreateCampaignData) {
    const {
      tenantId,
      name,
      description,
      type,
      script,
      voiceAgentId,
      schedule,
      settings,
      priority,
      startDate,
      endDate,
      createdById,
    } = data;

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

    const campaign = await prisma.campaign.create({
      data: {
        tenantId,
        name,
        description,
        status: 'DRAFT',
        type: type || 'OUTBOUND',
        script,
        voiceAgentId,
        schedule,
        settings,
        priority: priority || 0,
        startDate,
        endDate,
        createdById,
      },
    });

    logger.info('Campaign created', { campaignId: campaign.id, tenantId });

    return campaign;
  }

  static async getCampaigns(tenantId: string, filters: {
    status?: string;
    type?: string;
    createdById?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { status, type, createdById, page = 1, limit = 50 } = filters;

    const where: any = {
      tenantId,
    };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (createdById) {
      where.createdById = createdById;
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
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
          _count: {
            select: {
              campaignLeads: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.campaign.count({ where }),
    ]);

    return {
      campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getCampaignById(campaignId: string, tenantId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
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
        campaignLeads: {
          include: {
            lead: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    return campaign;
  }

  static async updateCampaign(campaignId: string, tenantId: string, data: UpdateCampaignData) {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        tenantId,
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data,
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

    logger.info('Campaign updated', { campaignId, tenantId });

    return updatedCampaign;
  }

  static async deleteCampaign(campaignId: string, tenantId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        tenantId,
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    await prisma.campaign.delete({
      where: { id: campaignId },
    });

    logger.info('Campaign deleted', { campaignId, tenantId });

    return { success: true };
  }

  static async addLeadsToCampaign(campaignId: string, tenantId: string, leadIds: string[]) {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        tenantId,
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    // Verify all leads belong to tenant
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        tenantId,
      },
    });

    if (leads.length !== leadIds.length) {
      throw new AppError('Some leads not found or do not belong to tenant', 404);
    }

    // Create campaign-lead relationships
    const campaignLeads = await Promise.all(
      leadIds.map(leadId =>
        prisma.campaignLead.upsert({
          where: {
            campaignId_leadId: {
              campaignId,
              leadId,
            },
          },
          update: {},
          create: {
            campaignId,
            leadId,
            status: 'PENDING',
          },
        })
      )
    );

    logger.info('Leads added to campaign', { campaignId, count: campaignLeads.length });

    return campaignLeads;
  }

  static async removeLeadFromCampaign(campaignId: string, tenantId: string, leadId: string) {
    const campaignLead = await prisma.campaignLead.findFirst({
      where: {
        campaignId,
        leadId,
        campaign: {
          tenantId,
        },
      },
    });

    if (!campaignLead) {
      throw new AppError('Campaign-lead relationship not found', 404);
    }

    await prisma.campaignLead.delete({
      where: { id: campaignLead.id },
    });

    logger.info('Lead removed from campaign', { campaignId, leadId });

    return { success: true };
  }
}
