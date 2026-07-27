import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../utils/jwt';
import logger from '../config/logger';

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Access token is required',
      });
      return;
    }

    const token = authHeader.substring(7);
    const payload = JwtService.verifyAccessToken(token);

    req.user = payload;
    req.tenantId = payload.tenantId;

    next();
  } catch (error) {
    logger.error('Authentication failed', { error });
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
};

export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = JwtService.verifyAccessToken(token);
      req.user = payload;
      req.tenantId = payload.tenantId;
    }

    next();
  } catch (error) {
    // Continue without authentication for optional routes
    next();
  }
};
