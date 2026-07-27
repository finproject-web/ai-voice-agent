import prisma from '../config/database';
import logger from '../config/logger';

export enum AuditAction {
  // User Actions
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_LOGIN_FAILED = 'USER_LOGIN_FAILED',
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_PASSWORD_CHANGED = 'USER_PASSWORD_CHANGED',

  // Lead Actions
  LEAD_CREATED = 'LEAD_CREATED',
  LEAD_UPDATED = 'LEAD_UPDATED',
  LEAD_DELETED = 'LEAD_DELETED',
  LEAD_IMPORTED = 'LEAD_IMPORTED',
  LEAD_EXPORTED = 'LEAD_EXPORTED',
  LEAD_ASSIGNED = 'LEAD_ASSIGNED',
  LEAD_QUALIFIED = 'LEAD_QUALIFIED',
  LEAD_REJECTED = 'LEAD_REJECTED',

  // Campaign Actions
  CAMPAIGN_CREATED = 'CAMPAIGN_CREATED',
  CAMPAIGN_UPDATED = 'CAMPAIGN_UPDATED',
  CAMPAIGN_DELETED = 'CAMPAIGN_DELETED',
  CAMPAIGN_STARTED = 'CAMPAIGN_STARTED',
  CAMPAIGN_PAUSED = 'CAMPAIGN_PAUSED',
  CAMPAIGN_RESUMED = 'CAMPAIGN_RESUMED',
  CAMPAIGN_COMPLETED = 'CAMPAIGN_COMPLETED',

  // Call Actions
  CALL_STARTED = 'CALL_STARTED',
  CALL_ENDED = 'CALL_ENDED',
  CALL_FAILED = 'CALL_FAILED',
  CALL_TRANSFERRED = 'CALL_TRANSFERRED',
  CALL_RECORDING_ACCESSED = 'CALL_RECORDING_ACCESSED',

  // Agent Actions
  AGENT_CREATED = 'AGENT_CREATED',
  AGENT_UPDATED = 'AGENT_UPDATED',
  AGENT_DELETED = 'AGENT_DELETED',
  AGENT_ACTIVATED = 'AGENT_ACTIVATED',
  AGENT_DEACTIVATED = 'AGENT_DEACTIVATED',

  // Permission Actions
  PERMISSION_CHANGED = 'PERMISSION_CHANGED',
  ROLE_CHANGED = 'ROLE_CHANGED',

  // Settings Actions
  SETTINGS_CHANGED = 'SETTINGS_CHANGED',
  API_KEY_UPDATED = 'API_KEY_UPDATED',
  API_KEY_DELETED = 'API_KEY_DELETED',
  WEBHOOK_CONFIGURED = 'WEBHOOK_CONFIGURED',

  // Company Actions
  COMPANY_CREATED = 'COMPANY_CREATED',
  COMPANY_UPDATED = 'COMPANY_UPDATED',
  COMPANY_DELETED = 'COMPANY_DELETED',

  // System Actions
  EXPORT_DOWNLOADED = 'EXPORT_DOWNLOADED',
  DATA_PURGED = 'DATA_PURGED',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
}

export class AuditService {
  static async log({
    tenantId,
    userId,
    action,
    entityType,
    entityId,
    metadata,
  }: {
    tenantId: string;
    userId?: string;
    action: AuditAction | string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action,
          entityType,
          entityId,
          metadata,
        },
      });

      logger.info('Audit log created', { tenantId, userId, action, entityType, entityId });
    } catch (error) {
      logger.error('Failed to create audit log', { error, tenantId, action });
      // Don't throw - audit logging should not break the application
    }
  }

  static async getAuditLogs(tenantId: string, filters: {
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  } = {}): Promise<{ logs: any[]; pagination: any }> {
    try {
      const {
        userId,
        action,
        entityType,
        entityId,
        startDate,
        endDate,
        page = 1,
        limit = 100,
      } = filters;

      const where: any = { tenantId };

      if (userId) {
        where.userId = userId;
      }

      if (action) {
        where.action = action;
      }

      if (entityType) {
        where.entityType = entityType;
      }

      if (entityId) {
        where.entityId = entityId;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = startDate;
        }
        if (endDate) {
          where.createdAt.lte = endDate;
        }
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.auditLog.count({ where }),
      ]);

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to get audit logs', { error, tenantId });
      throw error;
    }
  }

  static async getAuditLogById(logId: string, tenantId: string): Promise<any> {
    try {
      const log = await prisma.auditLog.findFirst({
        where: {
          id: logId,
          tenantId,
        },
      });

      if (!log) {
        throw new Error('Audit log not found');
      }

      return log;
    } catch (error) {
      logger.error('Failed to get audit log', { error, logId, tenantId });
      throw error;
    }
  }

  static async getAuditStats(tenantId: string, filters: {
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<{
    total: number;
    byAction: Record<string, number>;
    byEntityType: Record<string, number>;
    byUser: Record<string, number>;
  }> {
    try {
      const { startDate, endDate } = filters;

      const where: any = { tenantId };

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = startDate;
        }
        if (endDate) {
          where.createdAt.lte = endDate;
        }
      }

      const logs = await prisma.auditLog.findMany({
        where,
        select: {
          action: true,
          entityType: true,
          userId: true,
        },
      });

      const byAction: Record<string, number> = {};
      const byEntityType: Record<string, number> = {};
      const byUser: Record<string, number> = {};

      for (const log of logs) {
        byAction[log.action] = (byAction[log.action] || 0) + 1;
        byEntityType[log.entityType] = (byEntityType[log.entityType] || 0) + 1;
        if (log.userId) {
          byUser[log.userId] = (byUser[log.userId] || 0) + 1;
        }
      }

      return {
        total: logs.length,
        byAction,
        byEntityType,
        byUser,
      };
    } catch (error) {
      logger.error('Failed to get audit stats', { error, tenantId });
      throw error;
    }
  }

  // Convenience methods for common actions
  static async logUserLogin(tenantId: string, userId: string, metadata?: Record<string, any>): Promise<void> {
    return this.log({
      tenantId,
      userId,
      action: AuditAction.USER_LOGIN,
      entityType: 'User',
      entityId: userId,
      metadata,
    });
  }

  static async logUserLogout(tenantId: string, userId: string): Promise<void> {
    return this.log({
      tenantId,
      userId,
      action: AuditAction.USER_LOGOUT,
      entityType: 'User',
      entityId: userId,
    });
  }

  static async logUserLoginFailed(tenantId: string, email: string, metadata?: Record<string, any>): Promise<void> {
    return this.log({
      tenantId,
      action: AuditAction.USER_LOGIN_FAILED,
      entityType: 'User',
      entityId: 'unknown',
      metadata: { email, ...metadata },
    });
  }

  static async logLeadCreated(tenantId: string, userId: string, leadId: string, metadata?: Record<string, any>): Promise<void> {
    return this.log({
      tenantId,
      userId,
      action: AuditAction.LEAD_CREATED,
      entityType: 'Lead',
      entityId: leadId,
      metadata,
    });
  }

  static async logCampaignCreated(tenantId: string, userId: string, campaignId: string, metadata?: Record<string, any>): Promise<void> {
    return this.log({
      tenantId,
      userId,
      action: AuditAction.CAMPAIGN_CREATED,
      entityType: 'Campaign',
      entityId: campaignId,
      metadata,
    });
  }

  static async logCallStarted(tenantId: string, userId: string, callId: string, metadata?: Record<string, any>): Promise<void> {
    return this.log({
      tenantId,
      userId,
      action: AuditAction.CALL_STARTED,
      entityType: 'Call',
      entityId: callId,
      metadata,
    });
  }

  static async logSettingsChanged(tenantId: string, userId: string, metadata?: Record<string, any>): Promise<void> {
    return this.log({
      tenantId,
      userId,
      action: AuditAction.SETTINGS_CHANGED,
      entityType: 'Settings',
      entityId: tenantId,
      metadata,
    });
  }

  static async logApiKeyUpdated(tenantId: string, userId: string, provider: string, metadata?: Record<string, any>): Promise<void> {
    return this.log({
      tenantId,
      userId,
      action: AuditAction.API_KEY_UPDATED,
      entityType: 'ApiKey',
      entityId: provider,
      metadata: { provider, ...metadata },
    });
  }

  static async logPermissionChanged(tenantId: string, userId: string, targetUserId: string, metadata?: Record<string, any>): Promise<void> {
    return this.log({
      tenantId,
      userId,
      action: AuditAction.PERMISSION_CHANGED,
      entityType: 'User',
      entityId: targetUserId,
      metadata,
    });
  }
}

export default AuditService;
