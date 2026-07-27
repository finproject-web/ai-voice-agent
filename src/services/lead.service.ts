import prisma from '../config/database';
import { AppError } from '../middleware/error';
import logger from '../config/logger';

interface CreateLeadData {
  tenantId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  company?: string;
  title?: string;
  industry?: string;
  source?: string;
  tags?: string[];
  customFields?: any;
  notes?: string;
  assignedToId?: string;
}

interface UpdateLeadData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  industry?: string;
  status?: string;
  source?: string;
  score?: number;
  tags?: string[];
  customFields?: any;
  notes?: string;
  assignedToId?: string;
}

export class LeadService {
  static async createLead(data: CreateLeadData) {
    const {
      tenantId,
      firstName,
      lastName,
      email,
      phone,
      company,
      title,
      industry,
      source,
      tags,
      customFields,
      notes,
      assignedToId,
    } = data;

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    // If assignedToId is provided, verify user exists and belongs to tenant
    if (assignedToId) {
      const user = await prisma.user.findFirst({
        where: {
          id: assignedToId,
          tenantId,
        },
      });

      if (!user) {
        throw new AppError('Assigned user not found', 404);
      }
    }

    const lead = await prisma.lead.create({
      data: {
        tenantId,
        firstName,
        lastName,
        email,
        phone,
        company,
        title,
        industry,
        status: 'NEW',
        source,
        tags: tags || [],
        customFields,
        notes,
        assignedToId,
      },
    });

    logger.info('Lead created', { leadId: lead.id, tenantId });

    return lead;
  }

  static async getLeads(tenantId: string, filters: {
    status?: string;
    source?: string;
    assignedToId?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { status, source, assignedToId, search, page = 1, limit = 50 } = filters;

    const where: any = {
      tenantId,
    };

    if (status) {
      where.status = status;
    }

    if (source) {
      where.source = source;
    }

    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          assignedTo: {
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
      prisma.lead.count({ where }),
    ]);

    return {
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getLeadById(leadId: string, tenantId: string) {
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        tenantId,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        calls: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!lead) {
      throw new AppError('Lead not found', 404);
    }

    return lead;
  }

  static async updateLead(leadId: string, tenantId: string, data: UpdateLeadData) {
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        tenantId,
      },
    });

    if (!lead) {
      throw new AppError('Lead not found', 404);
    }

    // If assignedToId is being updated, verify user exists
    if (data.assignedToId) {
      const user = await prisma.user.findFirst({
        where: {
          id: data.assignedToId,
          tenantId,
        },
      });

      if (!user) {
        throw new AppError('Assigned user not found', 404);
      }
    }

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data,
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    logger.info('Lead updated', { leadId, tenantId });

    return updatedLead;
  }

  static async deleteLead(leadId: string, tenantId: string) {
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        tenantId,
      },
    });

    if (!lead) {
      throw new AppError('Lead not found', 404);
    }

    await prisma.lead.delete({
      where: { id: leadId },
    });

    logger.info('Lead deleted', { leadId, tenantId });

    return { success: true };
  }

  static async bulkImportLeads(tenantId: string, leads: CreateLeadData[]) {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const leadData of leads) {
      try {
        await this.createLead({ ...leadData, tenantId });
        results.successful++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${leadData.email || leadData.phone}: ${error.message}`);
      }
    }

    logger.info('Bulk lead import completed', { tenantId, results });

    return results;
  }
}
