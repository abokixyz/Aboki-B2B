const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/database');
const config = require('./config');
const routes = require('./routes');
const { swaggerSetup } = require('./config/swagger');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Setup Swagger documentation
swaggerSetup(app);

// Health check route (important for Render)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Basic route
app.get('/', (req, res) => {
  res.json({
    message: 'ABOKI B2B API',
    status: 'running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    documentation: {
      swagger: '/api-docs',
      json: '/api-docs.json'
    },
    endpoints: {
      health: '/health',
      api: '/api/v1',
      auth: {
        signup: 'POST /api/v1/auth/signup',
        login: 'POST /api/v1/auth/login',
        forgotPassword: 'POST /api/v1/auth/forgot-password',
        resetPassword: 'POST /api/v1/auth/reset-password',
        changePassword: 'POST /api/v1/auth/change-password',
        profile: 'GET /api/v1/auth/profile',
        logout: 'POST /api/v1/auth/logout'
      },
      onramp: {
        quote: 'POST /api/v1/onramp/quote',
        initiate: 'POST /api/v1/onramp/initiate',
        status: 'GET /api/v1/onramp/status/:id'
      },
      offramp: {
        quote: 'POST /api/v1/offramp/quote',
        initiate: 'POST /api/v1/offramp/initiate',
        status: 'GET /api/v1/offramp/status/:id'
      },
      wallet: {
        generate: 'POST /api/v1/wallet/generate',
        balance: 'GET /api/v1/wallet/balance/:address'
      }
    }
  });
});

// API routes - Make sure routes is properly exported from ./routes/index.js
try {
  app.use('/api/v1', routes);
} catch (error) {
  console.error('Error mounting routes:', error);
  console.error('Make sure ./routes/index.js exports an Express router');
}

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Log detailed error in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error stack:', err.stack);
  }
  
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    requestedPath: req.originalUrl,
    method: req.method,
    availableRoutes: {
      health: 'GET /health',
      documentation: 'GET /api-docs',
      api: 'GET /api/v1',
      auth: '/api/v1/auth/*',
      onramp: '/api/v1/onramp/*',
      offramp: '/api/v1/offramp/*',
      wallet: '/api/v1/wallet/*',
      webhooks: '/api/v1/webhooks/*'
    }
  });
});

const PORT = process.env.PORT || config.port || 5002;

// Error handling for server startup
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ABOKI B2B API Server running on port ${PORT}`);
  console.log(`🔗 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🔗 Visit: http://localhost:${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/health`);
    console.log(`📚 Docs: http://localhost:${PORT}/api-docs`);
    console.log(`🔐 Auth: http://localhost:${PORT}/api/v1/auth`);
    console.log(`💰 Onramp: http://localhost:${PORT}/api/v1/onramp`);
    console.log(`💸 Offramp: http://localhost:${PORT}/api/v1/offramp`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

module.exports = app;