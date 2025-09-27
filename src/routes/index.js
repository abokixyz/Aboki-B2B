const express = require('express');
const router = express.Router();

// Function to safely require route modules with detailed logging
function safeRequire(modulePath, fallbackName) {
  try {
    const module = require(modulePath);
    
    // Check if it's a valid Express router function
    if (typeof module === 'function') {
      console.log(`✅ Successfully loaded ${fallbackName} routes from ${modulePath}`);
      return module;
    } else if (module && typeof module === 'object' && module.default && typeof module.default === 'function') {
      console.log(`✅ Successfully loaded ${fallbackName} routes (ES6 default export) from ${modulePath}`);
      return module.default;
    } else {
      console.warn(`⚠️ ${fallbackName} routes export is not a function (got ${typeof module}), creating placeholder`);
      console.warn(`Module content:`, Object.keys(module || {}));
      return createPlaceholderRouter(fallbackName);
    }
  } catch (error) {
    console.warn(`⚠️ ${fallbackName} routes not found (${modulePath}):`, error.message);
    return createPlaceholderRouter(fallbackName);
  }
}

// Create placeholder router for missing or invalid modules
function createPlaceholderRouter(name) {
  const placeholderRouter = express.Router();
  
  placeholderRouter.get('/', (req, res) => {
    res.json({ 
      message: `${name} routes placeholder - module not implemented yet`,
      status: 'placeholder',
      timestamp: new Date().toISOString(),
      note: `Create /src/routes/${name.toLowerCase().replace(/([A-Z])/g, '$1').toLowerCase()}.js to implement this module`
    });
  });

  // Add common placeholder endpoints
  placeholderRouter.post('/', (req, res) => {
    res.json({ 
      message: `${name} POST endpoint placeholder`,
      status: 'placeholder',
      timestamp: new Date().toISOString()
    });
  });

  placeholderRouter.put('/:id', (req, res) => {
    res.json({ 
      message: `${name} PUT endpoint placeholder`,
      status: 'placeholder',
      id: req.params.id,
      timestamp: new Date().toISOString()
    });
  });

  placeholderRouter.delete('/:id', (req, res) => {
    res.json({ 
      message: `${name} DELETE endpoint placeholder`,
      status: 'placeholder',
      id: req.params.id,
      timestamp: new Date().toISOString()
    });
  });

  return placeholderRouter;
}

// Safe route mounting function
function mountRoute(router, path, routeHandler, routeName) {
  try {
    if (typeof routeHandler === 'function') {
      router.use(path, routeHandler);
      console.log(`✅ Successfully mounted ${routeName} routes at ${path}`);
      return true;
    } else {
      console.error(`❌ Cannot mount ${routeName} routes: handler is not a function (got ${typeof routeHandler})`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Failed to mount ${routeName} routes at ${path}:`, error.message);
    return false;
  }
}

console.log('🚀 Loading route modules...');

// Import route modules with safe loading
const pricingRoutes = safeRequire('./pricing', 'pricing');
const authRoutes = safeRequire('./auth', 'auth');
const businessRoutes = safeRequire('./business', 'business');
const tokensRoutes = safeRequire('./tokens', 'tokens');
const tokenValidationRoutes = safeRequire('./tokenValidation', 'tokenValidation');
const businessOnrampRoutes = safeRequire('./businessOnrampRoutes', 'businessOnramp');
const liquidityWebhookRoutes = safeRequire('./liquidityWebhookRoutes', 'liquidityWebhooks');
const businessOfframpRoutes = safeRequire('./businessOfframpRoutes', 'businessOfframp');
const adminAuthRoutes = safeRequire('./adminAuth', 'adminAuth');
const adminUserRoutes = safeRequire('./adminUsers', 'adminUsers');

console.log('📋 Route modules loaded, mounting endpoints...');

// Health check endpoint (before other routes)
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
      businessOnramp: 'active',
      businessOfframp: 'active',
      liquidityWebhooks: 'active',
      admin: 'active',
      adminAuth: 'active',
      adminUserManagement: 'active'
    },
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Mount route modules with error handling
const mountedRoutes = [];

if (mountRoute(router, '/auth', authRoutes, 'auth')) {
  mountedRoutes.push('auth');
}

if (mountRoute(router, '/business', businessRoutes, 'business')) {
  mountedRoutes.push('business');
}

if (mountRoute(router, '/tokens', tokensRoutes, 'tokens')) {
  mountedRoutes.push('tokens');
}

if (mountRoute(router, '/validate', tokenValidationRoutes, 'tokenValidation')) {
  mountedRoutes.push('validation');
}

if (mountRoute(router, '/business-onramp', businessOnrampRoutes, 'businessOnramp')) {
  mountedRoutes.push('businessOnramp');
}

if (mountRoute(router, '/webhooks/liquidity', liquidityWebhookRoutes, 'liquidityWebhooks')) {
  mountedRoutes.push('liquidityWebhooks');
}

if (mountRoute(router, '/business-offramp', businessOfframpRoutes, 'businessOfframp')) {
  mountedRoutes.push('businessOfframp');
}

if (mountRoute(router, '/admin/auth', adminAuthRoutes, 'adminAuth')) {
  mountedRoutes.push('adminAuth');
}

if (mountRoute(router, '/admin/users', adminUserRoutes, 'adminUsers')) {
  mountedRoutes.push('adminUsers');
}

// Mount pricing routes last (they have root-level paths)
if (mountRoute(router, '/', pricingRoutes, 'pricing')) {
  mountedRoutes.push('pricing');
}

console.log(`✅ Successfully mounted ${mountedRoutes.length} route modules:`, mountedRoutes.join(', '));

// Root endpoint with comprehensive API documentation
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Complete Authentication, Business Management & Crypto Trading API with Business Onramp/Offramp and Admin System',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    mountedRoutes: mountedRoutes,
    documentation: {
      swagger: '/api-docs',
      json: '/api-docs.json'
    },
    endpoints: {
      // Core System
      health: 'GET /api/v1/health',
      root: 'GET /api/v1/',

      // Authentication (available)
      auth: {
        signup: 'POST /api/v1/auth/signup',
        login: 'POST /api/v1/auth/login',
        forgotPassword: 'POST /api/v1/auth/forgot-password',
        resetPassword: 'POST /api/v1/auth/reset-password',
        changePassword: 'POST /api/v1/auth/change-password',
        profile: 'GET /api/v1/auth/profile',
        verificationStatus: 'GET /api/v1/auth/verification-status',
        verifyEmail: 'POST /api/v1/auth/verify-email',
        logout: 'POST /api/v1/auth/logout'
      },

      // Admin Authentication (available)
      adminAuth: {
        login: 'POST /api/v1/admin/auth/login',
        profile: 'GET /api/v1/admin/auth/profile',
        changePassword: 'POST /api/v1/admin/auth/change-password',
        createAdmin: 'POST /api/v1/admin/auth/create-admin',
        getAdmins: 'GET /api/v1/admin/auth/admins',
        toggleAdminStatus: 'PUT /api/v1/admin/auth/admins/{adminId}/toggle-status',
        logout: 'POST /api/v1/admin/auth/logout'
      },

      // Admin User Management
      adminUserManagement: {
        getAllUsers: 'GET /api/v1/admin/users',
        getUserDetails: 'GET /api/v1/admin/users/{userId}',
        getPendingVerification: 'GET /api/v1/admin/users/pending-verification',
        verifyUser: 'POST /api/v1/admin/users/{userId}/verify',
        manageUser: 'PUT /api/v1/admin/users/{userId}/manage',
        toggleApiAccess: 'PUT /api/v1/admin/users/{userId}/api-access',
        resetUserPassword: 'POST /api/v1/admin/users/{userId}/reset-password',
        getUserStats: 'GET /api/v1/admin/users/stats',
        bulkUserActions: 'POST /api/v1/admin/users/bulk-actions',
        getUserHistory: 'GET /api/v1/admin/users/{userId}/history'
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

      // Business Onramp API (available - for business integration)
      businessOnramp: {
        create: 'POST /api/v1/business-onramp/create',
        getOrder: 'GET /api/v1/business-onramp/orders/{orderId}',
        getAllOrders: 'GET /api/v1/business-onramp/orders',
        supportedTokens: 'GET /api/v1/business-onramp/supported-tokens',
        quote: 'POST /api/v1/business-onramp/quote',
        stats: 'GET /api/v1/business-onramp/stats',
        webhook: 'POST /api/v1/business-onramp/webhook/monnify'
      },

      // Business Off-ramp API (available for business integration)
      businessOfframp: {
        quote: 'POST /api/v1/business-offramp/quote',
        create: 'POST /api/v1/business-offramp/create',
        getOrder: 'GET /api/v1/business-offramp/orders/{orderId}',
        getAllOrders: 'GET /api/v1/business-offramp/orders',
        cancelOrder: 'POST /api/v1/business-offramp/orders/{orderId}/cancel',
        stats: 'GET /api/v1/business-offramp/stats',
        supportedTokens: 'GET /api/v1/business-offramp/supported-tokens',
        banks: 'GET /api/v1/business-offramp/banks',
        verifyAccount: 'POST /api/v1/business-offramp/verify-account',
        config: 'GET /api/v1/business-offramp/config',
        health: 'GET /api/v1/business-offramp/health',
        webhookDepositConfirmation: 'POST /api/v1/business-offramp/webhook/deposit-confirmation',
        webhookPayoutStatus: 'POST /api/v1/business-offramp/webhook/payout-status',
        monitorExpiredOrders: 'POST /api/v1/business-offramp/monitor/expired-orders'
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
      'Admin User Verification System',
      'Admin Dashboard and Management',
      'User Account Approval/Rejection',
      'API Access Control',
      'Verification History Tracking',
      'Bulk User Operations',
      'Admin Permission System',
      'Business Registration & Management',
      'Automatic API Key Generation',
      'Secure API Credentials Management', 
      'Business Verification System',
      'Token Selection & Management',
      'Multi-chain Token Validation',
      'Crypto-to-Fiat Pricing (Onramp)',
      'Fiat-to-Crypto Offramp Services',
      'Token-to-Fiat Offramp Services',
      'Bank Account Verification',
      'Automatic Wallet Generation',
      'Payment Order Management',
      'Webhook Support',
      'Business Token Configuration',
      'Fee Management System',
      'Multi-Network Wallet Support',
      'Trading Destination Token Setup',
      'Business Onramp Integration API',
      'Business Offramp Integration API',
      'Live Pricing Integration',
      'Optional Webhook Delivery',
      'Comprehensive Order Management',
      'Business Analytics & Statistics',
      'Liquidity Server Integration',
      'Settlement Management',
      'Comprehensive API Documentation'
    ],
    
    supportedNetworks: [
      'base', 'ethereum', 'solana', 'base-sepolia', 'solana-devnet', 
      'tron', 'polygon', 'arbitrum-one', 'bnb-smart-chain'
    ],
    
    tokenStandards: ['ERC-20', 'SPL', 'TRC-20'],
    
    supportedCryptocurrencies: ['BTC', 'ETH', 'USDT', 'USDC', 'ADA', 'SOL', 'BNB', 'MATIC'],
    
    supportedFiatCurrencies: ['NGN'],
    
    authenticationMethods: {
      userAuth: 'JWT Bearer tokens for user operations',
      adminAuth: 'JWT Bearer tokens for admin operations',
      businessAuth: 'API Key + Secret for token validation and trading services',
      businessOnrampAuth: 'API Key + Secret for business onramp integration',
      businessOfframpAuth: 'API Key + Secret for business offramp integration'
    },
    
    apiKeyTypes: {
      publicKey: 'For API identification (pk_live_...)',
      clientKey: 'For frontend/client-side use (ck_...)',
      secretKey: 'For server-side authentication (sk_live_...)'
    },
    
    businessStatuses: ['pending_verification', 'verified', 'rejected', 'suspended', 'deleted'],
    
    businessTypes: ['LLC', 'Corporation', 'Partnership', 'Sole Proprietorship', 'Non-Profit', 'Other'],
    
    industries: [
      'Technology', 'Finance', 'Healthcare', 'Education', 'E-commerce',
      'Manufacturing', 'Real Estate', 'Consulting', 'Marketing',
      'Food & Beverage', 'Entertainment', 'Transportation', 'Energy',
      'Agriculture', 'Fintech', 'Cryptocurrency', 'Other'
    ],

    // System Status
    systemStatus: {
      api: 'operational',
      database: 'operational',
      webhooks: 'operational',
      liquidityProvider: 'operational',
      emailService: 'operational',
      adminSystem: 'operational'
    },

    // Rate Limits
    rateLimits: {
      general: { requestsPerMinute: 100 },
      authentication: { requestsPerMinute: 10 },
      admin: { requestsPerMinute: 60 },
      businessOnramp: { requestsPerMinute: 100 },
      businessOfframp: { requestsPerMinute: 100 },
      validation: { requestsPerMinute: 60 },
      pricing: { requestsPerMinute: 100 }
    },

    // Security Features
    security: {
      jwtTokens: 'Secure JWT authentication with configurable expiry',
      passwordHashing: 'bcrypt with salt rounds',
      apiKeyEncryption: 'Environment-based encryption keys',
      rateLimiting: 'Express rate limiting middleware',
      corsProtection: 'Configurable CORS policies',
      helmetSecurity: 'Security headers via Helmet.js',
      webhookSecurity: 'HMAC signature verification',
      adminSecurity: 'Role-based access control with audit trails'
    }
  });
});

// Catch-all route for undefined endpoints
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    requestedPath: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableRoutes: mountedRoutes,
    suggestion: 'Check the root endpoint (GET /api/v1/) for available endpoints',
    documentation: {
      swagger: '/api-docs',
      json: '/api-docs.json'
    }
  });
});

console.log('✅ Routes configuration completed');

module.exports = router;