import jwt from 'jsonwebtoken';
import config from '../config';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class JwtService {
  private static accessTokenSecret = config.jwtSecret || 'default-secret';
  private static refreshTokenSecret = config.jwtRefreshSecret || 'default-refresh-secret';
  private static accessTokenExpiresIn = config.jwtExpiresIn;
  private static refreshTokenExpiresIn = config.jwtRefreshExpiresIn;

  static generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload as any, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiresIn as any,
    });
  }

  static generateRefreshToken(payload: JwtPayload): string {
    return jwt.sign(payload as any, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiresIn as any,
    });
  }

  static generateTokenPair(payload: JwtPayload): TokenPair {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  static verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.accessTokenSecret) as JwtPayload;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  static verifyRefreshToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.refreshTokenSecret) as JwtPayload;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  static decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch (error) {
      return null;
    }
  }
}
