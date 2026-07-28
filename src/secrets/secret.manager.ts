import prisma from '../config/database';
import { EncryptionService } from '../utils/encryption';
import logger from '../config/logger';
import { AuditService } from '../audit/audit.service';

export interface SecretData {
  provider: string;
  keyValue: string;
  metadata?: Record<string, any>;
}

export class SecretManager {
  async storeSecret(
    tenantId: string,
    userId: string,
    secretData: SecretData
  ): Promise<string> {
    try {
      const { provider, keyValue, metadata } = secretData;

      // Encrypt the secret
      const encryptedKey = EncryptionService.encrypt(keyValue);

      // Store in database
      const apiKey = await prisma.apiKey.create({
        data: {
          tenantId,
          provider,
          encryptedKey,
          status: 'ACTIVE',
          version: 1,
        },
      });

      // Log to audit
      await AuditService.logApiKeyUpdated(tenantId, userId, provider, {
        action: 'created',
        apiKeyId: apiKey.id,
      });

      logger.info('Secret stored successfully', { tenantId, provider, apiKeyId: apiKey.id });

      return apiKey.id;
    } catch (error) {
      logger.error('Failed to store secret', { error, tenantId, provider: secretData.provider });
      throw error;
    }
  }

  async getSecret(tenantId: string, provider: string): Promise<string> {
    try {
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          tenantId,
          provider,
          status: 'ACTIVE',
        },
        orderBy: {
          version: 'desc',
        },
      });

      if (!apiKey) {
        throw new Error('Secret not found');
      }

      // Decrypt the secret
      const decryptedKey = EncryptionService.decrypt(apiKey.encryptedKey);

      logger.info('Secret retrieved successfully', { tenantId, provider, apiKeyId: apiKey.id });

      return decryptedKey;
    } catch (error) {
      logger.error('Failed to get secret', { error, tenantId, provider });
      throw error;
    }
  }

  async rotateSecret(
    tenantId: string,
    userId: string,
    provider: string,
    newKeyValue: string
  ): Promise<void> {
    try {
      // Get current secret
      const currentApiKey = await prisma.apiKey.findFirst({
        where: {
          tenantId,
          provider,
          status: 'ACTIVE',
        },
        orderBy: {
          version: 'desc',
        },
      });

      if (!currentApiKey) {
        throw new Error('Current secret not found');
      }

      // Revoke current secret
      await prisma.apiKey.update({
        where: { id: currentApiKey.id },
        data: { status: 'REVOKED' },
      });

      // Encrypt and store new secret
      const encryptedKey = EncryptionService.encrypt(newKeyValue);

      await prisma.apiKey.create({
        data: {
          tenantId,
          provider,
          encryptedKey,
          status: 'ACTIVE',
          version: currentApiKey.version + 1,
        },
      });

      // Log to audit
      await AuditService.logApiKeyUpdated(tenantId, userId, provider, {
        action: 'rotated',
        previousVersion: currentApiKey.version,
        newVersion: currentApiKey.version + 1,
      });

      logger.info('Secret rotated successfully', { tenantId, provider });
    } catch (error) {
      logger.error('Failed to rotate secret', { error, tenantId, provider });
      throw error;
    }
  }

  async revokeSecret(tenantId: string, userId: string, provider: string): Promise<void> {
    try {
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          tenantId,
          provider,
          status: 'ACTIVE',
        },
      });

      if (!apiKey) {
        throw new Error('Secret not found');
      }

      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { status: 'REVOKED' },
      });

      // Log to audit
      await AuditService.logApiKeyUpdated(tenantId, userId, provider, {
        action: 'revoked',
        apiKeyId: apiKey.id,
      });

      logger.info('Secret revoked successfully', { tenantId, provider });
    } catch (error) {
      logger.error('Failed to revoke secret', { error, tenantId, provider });
      throw error;
    }
  }

  async deleteSecret(tenantId: string, userId: string, provider: string): Promise<void> {
    try {
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          tenantId,
          provider,
        },
      });

      if (!apiKey) {
        throw new Error('Secret not found');
      }

      await prisma.apiKey.delete({
        where: { id: apiKey.id },
      });

      // Log to audit
      await AuditService.logApiKeyUpdated(tenantId, userId, provider, {
        action: 'deleted',
        apiKeyId: apiKey.id,
      });

      logger.info('Secret deleted successfully', { tenantId, provider });
    } catch (error) {
      logger.error('Failed to delete secret', { error, tenantId, provider });
      throw error;
    }
  }

  async listSecrets(tenantId: string): Promise<any[]> {
    try {
      const apiKeys = await prisma.apiKey.findMany({
        where: { tenantId },
        select: {
          id: true,
          provider: true,
          status: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          // Never return the encrypted key
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return apiKeys;
    } catch (error) {
      logger.error('Failed to list secrets', { error, tenantId });
      throw error;
    }
  }

  async getSecretHistory(tenantId: string, provider: string): Promise<any[]> {
    try {
      const apiKeys = await prisma.apiKey.findMany({
        where: {
          tenantId,
          provider,
        },
        select: {
          id: true,
          provider: true,
          status: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          // Never return the encrypted key
        },
        orderBy: {
          version: 'desc',
        },
      });

      return apiKeys;
    } catch (error) {
      logger.error('Failed to get secret history', { error, tenantId, provider });
      throw error;
    }
  }

  async validateSecret(tenantId: string, provider: string): Promise<boolean> {
    try {
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          tenantId,
          provider,
          status: 'ACTIVE',
        },
      });

      if (!apiKey) {
        return false;
      }

      // Try to decrypt to validate
      EncryptionService.decrypt(apiKey.encryptedKey);

      return true;
    } catch (error) {
      logger.error('Secret validation failed', { error, tenantId, provider });
      return false;
    }
  }
}

export default new SecretManager();
