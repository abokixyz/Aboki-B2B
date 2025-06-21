const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const businessRoutes = require('./business');
const tokensRoutes = require('./tokens');
const tokenValidationRoutes = require('./tokenValidation');

// Mount route modules
router.use('/auth', authRoutes);
router.use('/business', businessRoutes);
router.use('/tokens', tokensRoutes);
router.use('/validate', tokenValidationRoutes);

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
    message: 'Business & Token Management API with Validation',
    version: '1.0.0',
    endpoints: {
      // Authentication
      auth: {
        signup: 'POST /api/v1/auth/signup',
        login: 'POST /api/v1/auth/login',
        forgotPassword: 'POST /api/v1/auth/forgot-password',
        resetPassword: 'POST /api/v1/auth/reset-password',
        changePassword: 'POST /api/v1/auth/change-password',
        profile: 'GET /api/v1/auth/profile',
        logout: 'POST /api/v1/auth/logout'
      },
      // Business Management
      business: {
        create: 'POST /api/v1/business/create',
        profile: 'GET /api/v1/business/profile',
        update: 'PUT /api/v1/business/update',
        verificationStatus: 'GET /api/v1/business/verification-status',
        delete: 'DELETE /api/v1/business/delete'
      },
      // Token Management
      tokens: {
        available: 'GET /api/v1/tokens/available',
        select: 'POST /api/v1/tokens/select',
        selected: 'GET /api/v1/tokens/selected',
        update: 'PUT /api/v1/tokens/update',
        clear: 'DELETE /api/v1/tokens/clear'
      },
      // Token Validation
      validation: {
        address: 'POST /api/v1/validate/address',
        batch: 'POST /api/v1/validate/batch',
        format: 'GET /api/v1/validate/format/:network/:address',
        customToken: 'POST /api/v1/validate/custom-token',
        networks: 'GET /api/v1/validate/networks',
        examples: 'GET /api/v1/validate/examples'
      }
    },
    supportedNetworks: ['base', 'ethereum', 'solana'],
    features: [
      'User Authentication',
      'Business Registration',
      'Multi-chain Token Support',
      'Base Network Integration',
      'Solana Network Integration',
      'Real-time Token Validation',
      'Blockchain RPC Verification',
      'Token Metadata Retrieval',
      'Token List Verification',
      'Batch Address Validation'
    ],
    validation: {
      supportedNetworks: ['base', 'ethereum', 'solana', 'base-sepolia', 'solana-devnet'],
      addressFormats: ['ethereum (0x...)', 'solana (base58)'],
      tokenStandards: ['ERC-20', 'SPL'],
      features: ['Format validation', 'Blockchain verification', 'Metadata retrieval', 'Token list checking']
    }
  });
});

module.exports = router;