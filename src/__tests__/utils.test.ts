import { describe, it, expect } from '@jest/globals';
import { PasswordService } from '../utils/password';
import { JwtService } from '../utils/jwt';
import { EncryptionService } from '../utils/encryption';

describe('PasswordService', () => {
  describe('validatePasswordStrength', () => {
    it('should validate strong password', () => {
      const strongPassword = 'Strong@123';
      expect(PasswordService.validatePasswordStrength(strongPassword)).toBe(true);
    });

    it('should reject weak password - too short', () => {
      const weakPassword = 'Short1!';
      expect(PasswordService.validatePasswordStrength(weakPassword)).toBe(false);
    });

    it('should reject weak password - no uppercase', () => {
      const weakPassword = 'weak@1234';
      expect(PasswordService.validatePasswordStrength(weakPassword)).toBe(false);
    });

    it('should reject weak password - no lowercase', () => {
      const weakPassword = 'WEAK@1234';
      expect(PasswordService.validatePasswordStrength(weakPassword)).toBe(false);
    });

    it('should reject weak password - no number', () => {
      const weakPassword = 'Weak@Password';
      expect(PasswordService.validatePasswordStrength(weakPassword)).toBe(false);
    });

    it('should reject weak password - no special character', () => {
      const weakPassword = 'WeakPassword123';
      expect(PasswordService.validatePasswordStrength(weakPassword)).toBe(false);
    });
  });

  describe('hashPassword', () => {
    it('should hash password successfully', async () => {
      const password = 'Test@1234';
      const hashedPassword = await PasswordService.hashPassword(password);

      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
    });
  });

  describe('comparePassword', () => {
    it('should compare passwords successfully', async () => {
      const password = 'Test@1234';
      const hashedPassword = await PasswordService.hashPassword(password);

      const isValid = await PasswordService.comparePassword(password, hashedPassword);
      expect(isValid).toBe(true);

      const isInvalid = await PasswordService.comparePassword('Wrong@1234', hashedPassword);
      expect(isInvalid).toBe(false);
    });
  });
});

describe('JwtService', () => {
  const mockPayload = {
    userId: '123',
    tenantId: '456',
    email: 'test@example.com',
    role: 'ADMIN',
  };

  describe('generateAccessToken', () => {
    it('should generate access token', () => {
      const token = JwtService.generateAccessToken(mockPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token', () => {
      const token = JwtService.generateRefreshToken(mockPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both tokens', () => {
      const tokens = JwtService.generateTokenPair(mockPayload);

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
    });
  });
});

describe('EncryptionService', () => {
  describe('hash', () => {
    it('should hash data consistently', () => {
      const data = 'test-data';
      const hash1 = EncryptionService.hash(data);
      const hash2 = EncryptionService.hash(data);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA256 produces 64 character hex string
    });
  });

  describe('generateRandomToken', () => {
    it('should generate random token', () => {
      const token = EncryptionService.generateRandomToken(32);

      expect(token).toBeDefined();
      expect(token.length).toBe(64); // 32 bytes = 64 hex characters
    });

    it('should generate different tokens', () => {
      const token1 = EncryptionService.generateRandomToken(32);
      const token2 = EncryptionService.generateRandomToken(32);

      expect(token1).not.toBe(token2);
    });
  });
});
