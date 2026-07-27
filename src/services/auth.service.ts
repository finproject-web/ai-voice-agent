import prisma from '../config/database';
import { PasswordService } from '../utils/password';
import { JwtService, JwtPayload } from '../utils/jwt';
import { AppError } from '../middleware/error';
import logger from '../config/logger';

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantId?: string;
}

interface LoginData {
  email: string;
  password: string;
}

export class AuthService {
  static async register(data: RegisterData) {
    const { email, password, firstName, lastName, tenantId } = data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    // Validate password strength
    if (!PasswordService.validatePasswordStrength(password)) {
      throw new AppError(
        'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
        400
      );
    }

    // Hash password
    const hashedPassword = await PasswordService.hashPassword(password);

    // Create user (if tenantId not provided, create new tenant)
    let userTenantId = tenantId;

    if (!userTenantId) {
      const tenant = await prisma.tenant.create({
        data: {
          name: `${firstName} ${lastName}'s Organization`,
          slug: `${firstName.toLowerCase()}-${lastName.toLowerCase()}-${Date.now()}`,
          plan: 'FREE',
          status: 'ACTIVE',
        },
      });
      userTenantId = tenant.id;
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        tenantId: userTenantId,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        createdAt: true,
      },
    });

    logger.info('User registered successfully', { userId: user.id });

    return user;
  }

  static async login(data: LoginData) {
    const { email, password } = data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check user status
    if (user.status !== 'ACTIVE') {
      throw new AppError('Account is not active', 403);
    }

    // Check tenant status
    if (user.tenant.status !== 'ACTIVE') {
      throw new AppError('Tenant account is not active', 403);
    }

    // Verify password
    const isPasswordValid = await PasswordService.comparePassword(
      password,
      user.password
    );

    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const payload: JwtPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };

    const tokens = JwtService.generateTokenPair(payload);

    // Save refresh token
    const refreshTokenExpiresAt = new Date();
    refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: refreshTokenExpiresAt,
      },
    });

    logger.info('User logged in successfully', { userId: user.id });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
      },
      tokens,
    };
  }

  static async refreshToken(refreshToken: string) {
    // Verify refresh token
    const payload = JwtService.verifyRefreshToken(refreshToken);

    // Check if refresh token exists in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      throw new AppError('Invalid refresh token', 401);
    }

    // Check if token is revoked
    if (storedToken.revokedAt) {
      throw new AppError('Refresh token has been revoked', 401);
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      throw new AppError('Refresh token has expired', 401);
    }

    // Check user status
    if (storedToken.user.status !== 'ACTIVE') {
      throw new AppError('Account is not active', 403);
    }

    // Generate new tokens
    const newPayload: JwtPayload = {
      userId: storedToken.user.id,
      tenantId: storedToken.user.tenantId,
      email: storedToken.user.email,
      role: storedToken.user.role,
    };

    const newTokens = JwtService.generateTokenPair(newPayload);

    // Revoke old refresh token and create new one
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        revokedAt: new Date(),
        replacedBy: newTokens.refreshToken,
      },
    });

    const newRefreshTokenExpiresAt = new Date();
    newRefreshTokenExpiresAt.setDate(newRefreshTokenExpiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        userId: storedToken.user.id,
        token: newTokens.refreshToken,
        expiresAt: newRefreshTokenExpiresAt,
      },
    });

    logger.info('Token refreshed successfully', { userId: storedToken.user.id });

    return newTokens;
  }

  static async logout(userId: string, refreshToken: string) {
    // Revoke refresh token
    await prisma.refreshToken.updateMany({
      where: {
        userId,
        token: refreshToken,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    logger.info('User logged out successfully', { userId });

    return { success: true };
  }

  static async revokeAllUserTokens(userId: string) {
    await prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    logger.info('All user tokens revoked', { userId });

    return { success: true };
  }
}
