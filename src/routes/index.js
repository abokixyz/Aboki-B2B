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

// Import new business off-ramp routes
const businessOfframpRoutes = require('./businessOfframpRoutes');

// Import admin routes
const adminAuthRoutes = require('./adminAuth');
const adminUserRoutes = require('./adminUsers'); // NEW: Admin user management routes

// Mount route modules
router.use('/auth', authRoutes);
router.use('/business', businessRoutes);
router.use('/tokens', tokensRoutes);
router.use('/validate', tokenValidationRoutes);

// Mount new business onramp routes
router.use('/business-onramp', businessOnrampRoutes);
router.use('/webhooks/liquidity', liquidityWebhookRoutes);

// Mount new business off-ramp routes
router.use('/business-offramp', businessOfframpRoutes);

// Mount admin routes
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin/users', adminUserRoutes); // NEW: Admin user management routes

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
      businessOfframp: 'active', // NEW
      liquidityWebhooks: 'active',
      admin: 'active',
      adminAuth: 'active',
      adminUserManagement: 'active'
    }
  });
});

// Root endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Complete Authentication, Business Management & Crypto Trading API with Business Onramp/Offramp and Admin System',
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

      // Admin User Management (NEW - available)
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

      // Business Off-ramp API (NEW - available for business integration)
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
      'Admin User Verification System', // available
      'Admin Dashboard and Management', // available
      'User Account Approval/Rejection', // available
      'API Access Control', // available
      'Verification History Tracking', // available
      'Bulk User Operations', // available
      'Admin Permission System', // available
      'Business Registration & Management',
      'Automatic API Key Generation',
      'Secure API Credentials Management', 
      'Business Verification System',
      'Token Selection & Management',
      'Multi-chain Token Validation',
      'Crypto-to-Fiat Pricing (Onramp)',
      'Fiat-to-Crypto Offramp Services',
      'Token-to-Fiat Offramp Services (NEW)', // NEW
      'Bank Account Verification',
      'Automatic Wallet Generation (NEW)', // NEW
      'Payment Order Management',
      'Webhook Support',
      'Business Token Configuration',
      'Fee Management System',
      'Multi-Network Wallet Support',
      'Trading Destination Token Setup',
      'Business Onramp Integration API',
      'Business Offramp Integration API (NEW)', // NEW
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
      adminAuth: 'JWT Bearer tokens for admin operations', // available
      businessAuth: 'API Key + Secret for token validation and trading services',
      businessOnrampAuth: 'API Key + Secret for business onramp integration',
      businessOfframpAuth: 'API Key + Secret for business offramp integration' // NEW
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

    // Admin System Documentation (UPDATED)
    adminSystem: {
      description: 'Complete admin system for user verification and management - FULLY IMPLEMENTED',
      status: 'ACTIVE',
      capabilities: [
        'User account verification and approval workflow',
        'API access management for approved users',
        'Bulk user operations (approve/reject/suspend multiple users)',
        'Dashboard analytics and comprehensive statistics',
        'Verification history tracking with audit trail',
        'Admin account management with role-based permissions',
        'Email notifications for all account changes',
        'Advanced user filtering and search',
        'Force password reset for users',
        'Account status management (active/suspended/deactivated)',
        'Permission-based admin access control',
        'IP whitelisting and security features',
        'Rate limiting for admin operations',
        'Comprehensive audit logging'
      ],
      availableEndpoints: {
        userManagement: 10, // Total endpoints for user management
        adminAuth: 7, // Admin authentication endpoints
        total: 17
      },
      userVerificationFlow: [
        '1. User registers account (pending status)',
        '2. Admin receives notification email',
        '3. Admin reviews user information via dashboard',
        '4. Admin approves/rejects with reason via API',
        '5. User receives notification email with decision',
        '6. API access enabled automatically for approved users',
        '7. Complete audit trail maintained for compliance'
      ],
      verificationStatuses: ['pending', 'approved', 'rejected', 'suspended'],
      accountStatuses: ['active', 'suspended', 'deactivated'],
      adminRoles: {
        super_admin: 'Full system access including admin management and system settings',
        admin: 'User verification, business management, API key management, analytics',
        moderator: 'User verification, basic analytics, limited admin functions'
      },
      adminPermissions: [
        'user_verification', 'user_management', 'business_verification',
        'business_management', 'api_key_management', 'system_settings',
        'analytics_view', 'bulk_operations', 'admin_management'
      ],
      security: [
        'Account lockout after 5 failed login attempts (2 hour lock)',
        'Shorter JWT token expiry for admins (8 hours vs 7 days for users)',
        'IP address logging and optional whitelist',
        'Admin action audit trails with full details',
        'Role-based permission system with granular control',
        'Session token validation and invalidation',
        'Rate limiting on admin endpoints',
        'Password strength requirements for admin accounts'
      ],
      bulkOperations: [
        'Bulk approve users', 'Bulk reject users', 'Bulk suspend accounts',
        'Bulk activate accounts', 'Bulk enable API access', 'Bulk disable API access'
      ],
      analytics: [
        'User verification statistics', 'Account status breakdown',
        'API access metrics', 'Admin activity monitoring',
        'Growth trends and user registration analytics',
        'Email verification rates', 'User activity tracking'
      ]
    },

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

    // Business Onramp API Documentation
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
        'Admin-approved user account', // ENFORCED
        'Supported token configuration',
        'Optional: webhook endpoint setup',
        'Optional: payment wallet configuration'
      ]
    },

    // Business Off-ramp API Documentation (NEW)
    businessOfframpAPI: {
      description: 'API for businesses to integrate token-to-fiat offramp services for their customers',
      status: 'ACTIVE',
      capabilities: [
        'Token-to-NGN conversion quotes',
        'Automatic wallet generation for deposits',
        'Nigerian bank account verification via Lenco',
        'Real-time order tracking and management',
        'Automatic NGN payout to customer bank accounts',
        'Comprehensive webhook notifications',
        'Multi-network support (Base, Solana, Ethereum)',
        'Business analytics and statistics',
        'Order cancellation and management',
        'Health monitoring and service status',
        'Expired order monitoring and cleanup'
      ],
      authentication: {
        method: 'API Key + Secret Key',
        headers: ['X-API-Key', 'X-Secret-Key'],
        rateLimit: {
          requestsPerMinute: 100
        }
      },
      orderStatuses: [
        'pending_deposit',     // Waiting for customer to send tokens
        'deposit_received',    // Tokens received, processing payout
        'processing',          // Processing payout to bank account
        'pending_payout',      // Payout initiated, waiting for confirmation
        'completed',           // NGN successfully sent to customer
        'failed',              // Order failed at any stage
        'expired',             // Order expired (24 hour limit)
        'cancelled'            // Order cancelled by business
      ],
      supportedNetworks: ['base', 'solana', 'ethereum'],
      supportedTokens: ['USDC', 'USDT', 'ETH', 'SOL'],
      minimumAmounts: {
        base: { USDC: 5, ETH: 0.003 },
        solana: { USDC: 5, SOL: 0.1 },
        ethereum: { USDC: 5, ETH: 0.003 }
      },
      orderExpiration: '24 hours',
      features: {
        automaticWalletGeneration: true,
        bankAccountVerification: true,
        realTimeWebhooks: true,
        multiNetworkSupport: true,
        encryptedWallets: true,
        automaticPayouts: true,
        orderCancellation: true,
        healthMonitoring: true
      },
      webhookEvents: [
        'offramp_order.created',
        'offramp_order.deposit_received',
        'offramp_order.processing',
        'offramp_order.payout_initiated',
        'offramp_order.completed',
        'offramp_order.failed',
        'offramp_order.expired',
        'offramp_order.cancelled'
      ],
      bankVerification: {
        provider: 'Lenco API',
        supportedBanks: 'All Nigerian banks',
        verification: 'Real-time account name resolution',
        format: {
          accountNumber: '10 digits',
          bankCode: '6 digits'
        }
      },
      walletGeneration: {
        automatic: true,
        encrypted: true,
        uniquePerOrder: true,
        expirationTime: '24 hours',
        supportedNetworks: ['base', 'solana', 'ethereum']
      },
      payoutProcess: [
        '1. Customer sends exact token amount to generated wallet',
        '2. Blockchain monitors detect deposit confirmation',
        '3. Order status updated to "deposit_received"',
        '4. NGN equivalent calculated with current rates',
        '5. Business fees deducted from total amount',
        '6. Payout initiated to verified bank account',
        '7. Customer receives NGN in their bank account',
        '8. Order marked as "completed"'
      ],
      businessRequirements: [
        'Valid business registration',
        'Active API credentials',
        'Admin-approved user account',
        'Supported token configuration with fees',
        'Optional: webhook endpoint setup for notifications'
      ],
      integrationFlow: [
        '1. Get quote for token-to-NGN conversion',
        '2. Verify customer bank account details',
        '3. Create offramp order with customer info',
        '4. Provide deposit wallet address to customer',
        '5. Monitor order status via webhooks or polling',
        '6. Handle completion/failure notifications'
      ],
      rateLimit: {
        quote: { requestsPerMinute: 100 },
        create: { requestsPerMinute: 10 },
        verifyAccount: { requestsPerMinute: 20 },
        general: { requestsPerMinute: 60 }
      }
    },

    // Settlement and Liquidity
    liquidityIntegration: {
      description: 'Integration with liquidity server for token settlement',
      capabilities: [
        'Automatic settlement initiation',
        'Settlement status tracking',
        'Error handling and retries',
        'Webhook notifications to businesses',
        'Multi-network token support',
        'Offramp settlement processing (NEW)' // NEW
      ],
      settlementFlow: [
        '1. Customer pays NGN via Monnify (Onramp)',
        '2. Payment verified and order marked as pending',
        '3. Settlement request sent to liquidity server',
        '4. Liquidity server processes token transfer',
        '5. Tokens sent to customer wallet',
        '6. Order marked as completed'
      ],
      offrampSettlementFlow: [ // NEW
        '1. Customer sends tokens to generated wallet address',
        '2. Blockchain monitors detect token deposit',
        '3. Order status updated to "deposit_received"',
        '4. NGN payout calculated and initiated',
        '5. Customer receives NGN in verified bank account',
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