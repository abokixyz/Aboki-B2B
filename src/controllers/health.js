// src/controllers/health.js
const mongoose = require('mongoose');
const redisClient = require('../config/redis');

const healthCheck = async (req, res) => {
  const response = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'disconnected',
      redis: 'disconnected',
    },
  };

  try {
    // Test MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      response.services.database = 'connected';
    } else {
      response.services.database = 'disconnected';
      response.status = 'unhealthy';
    }
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

const basicHealth = (req, res) => {
  res.json({
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
};

module.exports = {
  healthCheck,
  basicHealth
};