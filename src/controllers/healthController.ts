import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import redisClient from '../config/redis';
import { HealthCheckResponse } from '../types';

const prisma = new PrismaClient();

export const healthCheck = async (req: Request, res: Response) => {
  const response: HealthCheckResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'disconnected',
      redis: 'disconnected',
    },
  };

  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    response.services.database = 'connected';
  } catch (error) {
    console.error('Database health check failed:', error);
    response.status = 'unhealthy';
  }

  try {
    // Test Redis connection - check if client is ready first
    if (redisClient.isReady) {
      await redisClient.ping();
      response.services.redis = 'connected';
    } else {
      response.services.redis = 'disconnected';
      response.status = 'unhealthy';
    }
  } catch (error) {
    console.error('Redis health check failed:', error);
    response.services.redis = 'disconnected';
    response.status = 'unhealthy';
  }

  const statusCode = response.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(response);
};

export const basicHealth = (req: Request, res: Response) => {
  res.json({ 
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
};