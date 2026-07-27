import eventBus from '../event.bus';
import { EventType, UserLoginEvent } from '../event.types';
import prisma from '../../config/database';
import logger from '../../config/logger';

export function registerUserHandlers(): void {
  eventBus.subscribe(EventType.USER_LOGIN, handleUserLogin);
  eventBus.subscribe(EventType.USER_LOGOUT, handleUserLogout);
  eventBus.subscribe(EventType.USER_LOGIN_FAILED, handleUserLoginFailed);
  eventBus.subscribe(EventType.USER_CREATED, handleUserCreated);
}

async function handleUserLogin(event: UserLoginEvent): Promise<void> {
  try {
    logger.info('Handling UserLogin event', { userId: event.userId, email: event.email });

    // Update user last login
    await prisma.user.update({
      where: { id: event.userId },
      data: { lastLoginAt: new Date() },
    });

    // Log to audit trail
    await prisma.auditLog.create({
      data: {
        tenantId: event.tenantId,
        userId: event.userId,
        action: 'USER_LOGIN',
        entityType: 'User',
        entityId: event.userId,
        metadata: {
          email: event.email,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          timestamp: event.timestamp,
        },
      },
    });

  } catch (error) {
    logger.error('Failed to handle UserLogin event', { error, userId: event.userId });
  }
}

async function handleUserLogout(event: any): Promise<void> {
  try {
    logger.info('Handling UserLogout event', { userId: event.userId });

    // Log to audit trail
    await prisma.auditLog.create({
      data: {
        tenantId: event.tenantId,
        userId: event.userId,
        action: 'USER_LOGOUT',
        entityType: 'User',
        entityId: event.userId,
        metadata: {
          timestamp: event.timestamp,
        },
      },
    });

  } catch (error) {
    logger.error('Failed to handle UserLogout event', { error });
  }
}

async function handleUserLoginFailed(event: any): Promise<void> {
  try {
    logger.warn('Handling UserLoginFailed event', { email: event.metadata?.email });

    // Log failed login attempt for security monitoring
    await prisma.auditLog.create({
      data: {
        tenantId: event.tenantId,
        action: 'USER_LOGIN_FAILED',
        entityType: 'User',
        entityId: event.metadata?.userId || 'unknown',
        metadata: {
          email: event.metadata?.email,
          ipAddress: event.metadata?.ipAddress,
          reason: event.metadata?.reason,
          timestamp: event.timestamp,
        },
      },
    });

  } catch (error) {
    logger.error('Failed to handle UserLoginFailed event', { error });
  }
}

async function handleUserCreated(event: any): Promise<void> {
  try {
    logger.info('Handling UserCreated event', { userId: event.userId });

    // Log to audit trail
    await prisma.auditLog.create({
      data: {
        tenantId: event.tenantId,
        userId: event.userId,
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: event.userId,
        metadata: {
          createdBy: event.userId,
          timestamp: event.timestamp,
        },
      },
    });

  } catch (error) {
    logger.error('Failed to handle UserCreated event', { error });
  }
}
