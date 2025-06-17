// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const prisma = new PrismaClient();

// Extend Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        companyId?: string;
      };
      company?: {
        id: string;
        name: string;
        email: string;
      };
      apiKey?: {
        id: string;
        publicKey: string;
        permissions: string[];
      };
    }
  }
}

// JWT Authentication Middleware
export const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
    
    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or inactive user'
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId || undefined
    };

    if (user.company) {
      req.company = user.company;
    }

    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

// API Key Authentication Middleware (for both user and company API keys)
export const authenticateApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const publicKey = req.headers['x-api-key'] as string;
    const secretKey = req.headers['x-api-secret'] as string;

    if (!publicKey || !secretKey) {
      return res.status(401).json({
        success: false,
        error: 'API key and secret are required. Use X-API-Key and X-API-Secret headers.'
      });
    }

    // Check if it's a user API key
    const userApiKey = await prisma.apiKey.findUnique({
      where: { publicKey },
      include: {
        user: {
          include: {
            company: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (userApiKey) {
      // Verify user API key
      if (!userApiKey.isActive) {
        return res.status(401).json({
          success: false,
          error: 'API key is inactive'
        });
      }

      const isValidSecret = await bcrypt.compare(secretKey, userApiKey.secretKey);
      if (!isValidSecret) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API secret'
        });
      }

      // Update last used timestamp
      await prisma.apiKey.update({
        where: { id: userApiKey.id },
        data: { lastUsedAt: new Date() }
      });

      req.user = {
        id: userApiKey.user.id,
        email: userApiKey.user.email,
        role: userApiKey.user.role,
        companyId: userApiKey.user.companyId || undefined
      };

      req.apiKey = {
      id: userApiKey.id,
      publicKey: userApiKey.publicKey,
      permissions: userApiKey.permissions.split(',')
      };

      if (userApiKey.user.company) {
        req.company = userApiKey.user.company;
      }

      return next();
    }

    // Check if it's a company API key (your existing system)
    const company = await prisma.company.findUnique({
      where: { apiKey: publicKey }
    });

    if (company) {
      // For company API keys, you might want to implement your own validation logic
      // For now, we'll assume the secretKey should match some company secret
      // You can modify this based on your existing company API key system
      
      if (!company.isActive) {
        return res.status(401).json({
          success: false,
          error: 'Company is inactive'
        });
      }

      req.company = {
        id: company.id,
        name: company.name,
        email: company.email
      };

      return next();
    }

    // No valid API key found
    return res.status(401).json({
      success: false,
      error: 'Invalid API key'
    });

  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

// Role-based authorization middleware
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Permission-based authorization for API keys
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key authentication required'
      });
    }

    const userPermissions = req.apiKey.permissions;
    if (!userPermissions.includes(permission) && !userPermissions.includes('ADMIN')) {
      return res.status(403).json({
        success: false,
        error: `Insufficient permissions. Required: ${permission}`
      });
    }

    next();
  };
};