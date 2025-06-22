const express = require('express');
const router = express.Router();
const onrampRoutes = require('./onramp');
const offrampRoutes = require('./offramp');

// Import existing route modules
const authRoutes = require('./auth');
const businessRoutes = require('./business');
const tokensRoutes = require('./tokens');
const tokenValidationRoutes = require('./tokenValidation');

// Mount route modules
router.use('/auth', authRoutes);
router.use('/business', businessRoutes);
router.use('/tokens', tokensRoutes);
router.use('/validate', tokenValidationRoutes);
router.use('/onramp', onrampRoutes);
router.use('/offramp', offrampRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    services: {
      auth: 'active',
      business: 'active',
      tokens: 'active',
      validation: 'active'
    }
  });
});

// Root endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Complete Authentication & Business Management API',
    version: '1.0.0',
    documentation: {
      swagger: '/api-docs',
      json: '/api-docs.json'
    },
    endpoints: {
      // Authentication (available)
      auth: {
        signup: 'POST /api/v1/auth/signup',
        login: 'POST /api/v1/auth/login',
        forgotPassword: 'POST /api/v1/auth/forgot-password',
        resetPassword: 'POST /api/v1/auth/reset-password',
        changePassword: 'POST /api/v1/auth/change-password',
        profile: 'GET /api/v1/auth/profile',
        logout: 'POST /api/v1/auth/logout'
      },
      
      // Business Management (available)
      business: {
        create: 'POST /api/v1/business/create',
        profile: 'GET /api/v1/business/profile',
        update: 'PUT /api/v1/business/update',
        verificationStatus: 'GET /api/v1/business/verification-status',
        apiKeys: 'GET /api/v1/business/api-keys',
        regenerateApiKeys: 'POST /api/v1/business/regenerate-api-keys',
        delete: 'DELETE /api/v1/business/delete'
      },

      // Token Management (available)
      tokens: {
        available: 'GET /api/v1/tokens/available',
        select: 'POST /api/v1/tokens/select',
        selected: 'GET /api/v1/tokens/selected',
        update: 'PUT /api/v1/tokens/update',
        clear: 'DELETE /api/v1/tokens/clear'
      },
      
      // Token Validation (available - requires business API keys)
      validation: {
        token: 'POST /api/v1/validate/token',
        batch: 'POST /api/v1/validate/batch',
        networks: 'GET /api/v1/validate/networks',
        examples: 'GET /api/v1/validate/examples'
      }
    },
    
    features: [
      'User Authentication with JWT',
      'Business Registration & Management',
      'Automatic API Key Generation',
      'Secure API Credentials Management', 
      'Business Verification System',
      'Token Selection & Management',
      'Multi-chain Token Validation',
      'Comprehensive API Documentation'
    ],
    
    supportedNetworks: ['base', 'ethereum', 'solana', 'base-sepolia', 'solana-devnet'],
    
    tokenStandards: ['ERC-20', 'SPL'],
    
    authenticationMethods: {
      userAuth: 'JWT Bearer tokens for user operations',
      businessAuth: 'API Key + Secret for token validation services'
    },
    
    apiKeyTypes: {
      publicKey: 'For API identification (pk_live_...)',
      clientKey: 'For frontend/client-side use (ck_...)',
      secretKey: 'For server-side authentication (***REMOVED***...)'
    },
    
    businessStatuses: ['pending_verification', 'verified', 'rejected', 'deleted'],
    
    businessTypes: ['LLC', 'Corporation', 'Partnership', 'Sole Proprietorship', 'Non-Profit', 'Other'],
    
    industries: [
      'Technology', 'Finance', 'Healthcare', 'Education', 'E-commerce',
      'Manufacturing', 'Real Estate', 'Consulting', 'Marketing',
      'Food & Beverage', 'Entertainment', 'Transportation', 'Energy',
      'Agriculture', 'Other'
    ],

    validation: {
      capabilities: [
        'Token format validation',
        'Blockchain verification', 
        'Metadata retrieval',
        'Token list verification',
        'Batch processing (up to 20 tokens)',
        'Multi-network support'
      ],
      rateLimit: {
        requestsPerMinute: 60,
        batchLimit: 20
      }
    }
  });
});

module.exports = router;