const express = require('express');
const router = express.Router();

// Import the new combined pricing routes
const pricingRoutes = require('./pricing'); // This is your combined onramp/offramp routes

// Import existing route modules
const authRoutes = require('./auth');
const businessRoutes = require('./business');
const tokensRoutes = require('./tokens');
const tokenValidationRoutes = require('./tokenValidation');

// Import new business onramp routes
const businessOnrampRoutes = require('./businessOnrampRoutes');
const liquidityWebhookRoutes = require('./liquidityWebhookRoutes');

// Mount route modules
router.use('/auth', authRoutes);
router.use('/business', businessRoutes);
router.use('/tokens', tokensRoutes);
router.use('/validate', tokenValidationRoutes);

// Mount new business onramp routes
router.use('/business-onramp', businessOnrampRoutes);
router.use('/webhooks/liquidity', liquidityWebhookRoutes);

// Use the combined pricing routes (contains both onramp-price and offramp-price)
router.use('/', pricingRoutes); // Mount directly to root since routes already have full paths

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
      validation: 'active',
      pricing: 'active',
      offramp: 'active',
      businessOnramp: 'active',
      liquidityWebhooks: 'active'
    }
  });
});

// Root endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Complete Authentication, Business Management & Crypto Trading API with Business Onramp',
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
        delete: 'DELETE /api/v1/business/delete',
        // Token Management
        tokenSupported: 'GET /api/v1/business/tokens/supported',
        tokenBreakdown: 'GET /api/v1/business/tokens/breakdown',
        tokenAdd: 'POST /api/v1/business/tokens/add',
        tokenUpdate: 'PUT /api/v1/business/tokens/update',
        tokenBulkUpdateFees: 'PUT /api/v1/business/tokens/bulk-update-fees',
        tokenRemove: 'DELETE /api/v1/business/tokens/remove',
        tokenClear: 'DELETE /api/v1/business/tokens/clear',
        setWallets: 'PUT /api/v1/business/tokens/wallets',
        setBankAccount: 'PUT /api/v1/business/tokens/bank-account',
        getConfiguration: 'GET /api/v1/business/tokens/configuration',
        tradingStatus: 'GET /api/v1/business/trading-status',
        validateForTrading: 'POST /api/v1/business/tokens/validate-for-trading'
      },

      // Business Onramp API (NEW - for business integration)
      businessOnramp: {
        create: 'POST /api/v1/business-onramp/create',
        getOrder: 'GET /api/v1/business-onramp/orders/{orderId}',
        getAllOrders: 'GET /api/v1/business-onramp/orders',
        supportedTokens: 'GET /api/v1/business-onramp/supported-tokens',
        quote: 'POST /api/v1/business-onramp/quote',
        stats: 'GET /api/v1/business-onramp/stats',
        webhook: 'POST /api/v1/business-onramp/webhook/monnify'
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
      },

      // Pricing (available)
      pricing: {
        onrampPrice: 'GET /api/v1/onramp-price',
        offrampPrice: 'GET /api/v1/offramp-price'
      },

      // Offramp Services (available - requires API keys)
      offramp: {
        verifyAccount: 'POST /api/v1/offramp/verify-account',
        institutions: 'GET /api/v1/offramp/institutions',
        currencies: 'GET /api/v1/offramp/currencies',
        tokens: 'GET /api/v1/offramp/tokens',
        createOrder: 'POST /api/v1/offramp/orders',
        getOrders: 'GET /api/v1/offramp/orders',
        getOrder: 'GET /api/v1/offramp/orders/{orderId}',
        webhook: 'POST /api/v1/offramp/webhook'
      },

      // Liquidity Webhooks (Internal)
      liquidityWebhooks: {
        settlement: 'POST /api/v1/webhooks/liquidity/settlement',
        update: 'POST /api/v1/webhooks/liquidity/update',
        error: 'POST /api/v1/webhooks/liquidity/error',
        ping: 'GET /api/v1/webhooks/liquidity/ping'
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
      'Crypto-to-Fiat Pricing (Onramp)',
      'Fiat-to-Crypto Offramp Services',
      'Bank Account Verification',
      'Payment Order Management',
      'Webhook Support',
      'Business Token Configuration',
      'Fee Management System',
      'Multi-Network Wallet Support',
      'Trading Destination Token Setup',
      'Business Onramp Integration API',
      'Live Pricing Integration',
      'Optional Webhook Delivery',
      'Comprehensive Order Management',
      'Business Analytics & Statistics',
      'Liquidity Server Integration',
      'Settlement Management',
      'Comprehensive API Documentation'
    ],
    
    supportedNetworks: ['base', 'ethereum', 'solana', 'base-sepolia', 'solana-devnet', 'tron', 'polygon', 'arbitrum-one', 'bnb-smart-chain'],
    
    tokenStandards: ['ERC-20', 'SPL', 'TRC-20'],
    
    supportedCryptocurrencies: ['BTC', 'ETH', 'USDT', 'USDC', 'ADA', 'SOL', 'BNB', 'MATIC'],
    
    supportedFiatCurrencies: ['NGN'],
    
    authenticationMethods: {
      userAuth: 'JWT Bearer tokens for user operations',
      businessAuth: 'API Key + Secret for token validation and trading services',
      businessOnrampAuth: 'API Key + Secret for business onramp integration'
    },
    
    apiKeyTypes: {
      publicKey: 'For API identification (pk_live_...)',
      clientKey: 'For frontend/client-side use (ck_...)',
      secretKey: 'For server-side authentication (***REMOVED***...)'
    },
    
    businessStatuses: ['pending_verification', 'verified', 'rejected', 'suspended', 'deleted'],
    
    businessTypes: ['LLC', 'Corporation', 'Partnership', 'Sole Proprietorship', 'Non-Profit', 'Other'],
    
    industries: [
      'Technology', 'Finance', 'Healthcare', 'Education', 'E-commerce',
      'Manufacturing', 'Real Estate', 'Consulting', 'Marketing',
      'Food & Beverage', 'Entertainment', 'Transportation', 'Energy',
      'Agriculture', 'Fintech', 'Cryptocurrency', 'Other'
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
    },

    pricing: {
      capabilities: [
        'Real-time crypto-to-NGN pricing',
        'Token-to-NGN rate calculation',
        'Multiple cryptocurrency support',
        'Exchange rate tracking',
        'Formatted price responses'
      ],
      supportedTokens: {
        onramp: ['BTC', 'ETH', 'USDT', 'USDC', 'ADA', 'SOL', 'BNB', 'MATIC'],
        offramp: ['USDT', 'USDC']
      },
      rateLimit: {
        requestsPerMinute: 100
      }
    },

    offramp: {
      capabilities: [
        'Bank account verification',
        'Multi-provider support',
        'Order tracking',
        'Webhook notifications',
        'Multiple payment networks'
      ],
      supportedNetworks: ['tron', 'base', 'polygon', 'arbitrum-one', 'bnb-smart-chain'],
      supportedTokens: ['USDT', 'USDC'],
      paymentMethods: ['Bank Transfer', 'Mobile Money'],
      rateLimit: {
        requestsPerMinute: 30
      }
    },

    businessTokenManagement: {
      capabilities: [
        'Multi-network token configuration',
        'Dynamic fee setting (0-10%)',
        'Crypto wallet management',
        'Bank account integration',
        'Real-time token validation',
        'Batch token operations',
        'Default token protection',
        'Custom token addition',
        'Bulk fee updates'
      ],
      supportedNetworks: ['base', 'solana', 'ethereum'],
      supportedTokenStandards: ['ERC-20', 'SPL'],
      feeRange: {
        minimum: 0,
        maximum: 10,
        unit: 'percentage'
      },
      walletSupport: ['Solana', 'Base', 'Ethereum'],
      fiatSupport: ['NGN Bank Accounts'],
      rateLimit: {
        requestsPerMinute: 60
      }
    },

    // NEW: Business Onramp API Documentation
    businessOnrampAPI: {
      description: 'API for businesses to integrate onramp services for their customers',
      capabilities: [
        'Customer onramp order creation',
        'Live pricing integration',
        'Business-specific fee application',
        'Order status tracking',
        'Comprehensive order filtering',
        'Business analytics and statistics',
        'Optional webhook notifications',
        'Monnify payment integration',
        'Liquidity server settlement',
        'Multi-token and multi-network support'
      ],
      authentication: {
        method: 'API Key + Secret Key',
        headers: ['X-API-Key', 'X-Secret-Key'],
        rateLimit: {
          requestsPerMinute: 100
        }
      },
      orderStatuses: ['initiated', 'pending', 'processing', 'completed', 'failed', 'cancelled', 'expired'],
      supportedNetworks: ['base', 'solana', 'ethereum'],
      supportedTokens: ['ETH', 'USDC', 'USDT', 'SOL'],
      minimumAmount: 1000, // NGN
      maximumAmount: 10000000, // NGN
      orderExpiration: '30 minutes',
      webhookEvents: [
        'order.created',
        'payment.completed', 
        'order.processing',
        'order.completed',
        'order.failed',
        'order.status_update'
      ],
      integrationOptions: {
        webhookBased: 'Real-time notifications to business webhook URL',
        pollingBased: 'Business fetches order status on-demand',
        hybrid: 'Combination of webhooks and polling'
      },
      businessRequirements: [
        'Valid business registration',
        'Active API credentials',
        'Supported token configuration',
        'Optional: webhook endpoint setup',
        'Optional: payment wallet configuration'
      ]
    },

    // Settlement and Liquidity
    liquidityIntegration: {
      description: 'Integration with liquidity server for token settlement',
      capabilities: [
        'Automatic settlement initiation',
        'Settlement status tracking',
        'Error handling and retries',
        'Webhook notifications to businesses',
        'Multi-network token support'
      ],
      settlementFlow: [
        '1. Customer pays NGN via Monnify',
        '2. Payment verified and order marked as pending',
        '3. Settlement request sent to liquidity server',
        '4. Liquidity server processes token transfer',
        '5. Tokens sent to customer wallet',
        '6. Order marked as completed'
      ],
      webhookSecurity: {
        signatureVerification: 'HMAC-SHA256',
        secretKeys: 'Environment variable based',
        retryMechanism: 'Automatic retries with exponential backoff'
      }
    }
  });
});

module.exports = router;