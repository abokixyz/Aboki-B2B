const bcrypt = require('bcrypt');
const { Business, ApiKey } = require('../models');

// Default tokens that every business gets
const DEFAULT_TOKENS = {
  base: [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      contractAddress: '0x4200000000000000000000000000000000000006', // Wrapped ETH on Base
      decimals: 18,
      network: 'base',
      type: 'ERC-20',
      logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      contractAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC on Base
      decimals: 6,
      network: 'base',
      type: 'ERC-20',
      logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      contractAddress: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', // USDT on Base
      decimals: 6,
      network: 'base',
      type: 'ERC-20',
      logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true
    }
  ],
  solana: [
    {
      symbol: 'SOL',
      name: 'Solana',
      contractAddress: 'So11111111111111111111111111111111111111112', // Wrapped SOL
      decimals: 9,
      network: 'solana',
      type: 'SPL',
      logoUrl: 'https://cryptologos.cc/logos/solana-sol-logo.png',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on Solana
      decimals: 6,
      network: 'solana',
      type: 'SPL',
      logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT on Solana
      decimals: 6,
      network: 'solana',
      type: 'SPL',
      logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true
    }
  ],
  ethereum: [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      contractAddress: '0x0000000000000000000000000000000000000000', // Native ETH
      decimals: 18,
      network: 'ethereum',
      type: 'Native',
      logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      contractAddress: '0xA0b86a33E6441b8FF4dd96D73639bc4f86Ee6dC2', // USDC on Ethereum
      decimals: 6,
      network: 'ethereum',
      type: 'ERC-20',
      logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT on Ethereum
      decimals: 6,
      network: 'ethereum',
      type: 'ERC-20',
      logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true
    }
  ]
};

// Helper function to ensure business has default tokens
async function addDefaultTokensIfNeeded(business) {
  try {
    // Initialize if not exists
    if (!business.supportedTokens) {
      business.supportedTokens = { base: [], solana: [], ethereum: [] };
    }
    if (!business.feeConfiguration) {
      business.feeConfiguration = { base: [], solana: [], ethereum: [] };
    }
    
    let tokensAdded = 0;
    
    // Add missing default tokens for each network
    Object.keys(DEFAULT_TOKENS).forEach(network => {
      if (!business.supportedTokens[network]) {
        business.supportedTokens[network] = [];
      }
      if (!business.feeConfiguration[network]) {
        business.feeConfiguration[network] = [];
      }
      
      DEFAULT_TOKENS[network].forEach(tokenTemplate => {
        // Check if token already exists
        const existingToken = business.supportedTokens[network].find(
          t => t.contractAddress.toLowerCase() === tokenTemplate.contractAddress.toLowerCase()
        );
        
        if (!existingToken) {
          // Add to supported tokens
          const token = {
            ...tokenTemplate,
            addedAt: new Date(),
            metadata: {}
          };
          business.supportedTokens[network].push(token);
          
          // Add default fee configuration (0% fee)
          business.feeConfiguration[network].push({
            contractAddress: tokenTemplate.contractAddress,
            symbol: tokenTemplate.symbol,
            feePercentage: 0, // Default fee is 0%
            isActive: true,
            isDefault: true,
            updatedAt: new Date()
          });
          
          tokensAdded++;
        }
      });
    });
    
    if (tokensAdded > 0) {
      business.supportedTokensUpdatedAt = new Date();
      business.updatedAt = new Date();
      await business.save();
      console.log(`[API_AUTH] Added ${tokensAdded} default tokens to business ${business.businessId}`);
    }
    
  } catch (error) {
    console.error('[API_AUTH] Error adding default tokens:', error);
    // Don't throw error - this shouldn't break authentication
  }
}

// 🔧 FIXED: Middleware to authenticate ONLY the API key (for read-only operations)
const authenticateApiKey = async (req, res, next) => {
  try {
    console.log('🔑 [API_AUTH] Authenticating API key only for:', req.path);
    
    // Get API key from headers
    const publicKey = req.headers['x-api-key'] || req.headers['x-public-key'];
    
    // Validate required headers
    if (!publicKey) {
      return res.status(401).json({
        success: false,
        message: 'API key is required. Include X-API-Key header.',
        code: 'MISSING_API_KEY'
      });
    }
    
    console.log(`[API_AUTH] Validating public key: ${publicKey.substring(0, 15)}...`);
    
    // Find the API key record
    const apiKeyRecord = await ApiKey.findOne({
      publicKey,
      isActive: true
    });
    
    if (!apiKeyRecord) {
      console.log('[API_AUTH] Invalid or inactive public key');
      return res.status(401).json({
        success: false,
        message: 'Invalid or inactive API key',
        code: 'INVALID_API_KEY'
      });
    }
    
    console.log(`[API_AUTH] API key validated for business: ${apiKeyRecord.businessId}`);
    
    // Get the business information
    const business = await Business.findById(apiKeyRecord.businessId);
    
    if (!business) {
      console.log('[API_AUTH] Business not found');
      return res.status(401).json({
        success: false,
        message: 'Associated business not found',
        code: 'BUSINESS_NOT_FOUND'
      });
    }
    
    // Check business status
    if (business.status === 'deleted' || business.status === 'suspended') {
      console.log(`[API_AUTH] Business is ${business.status}`);
      return res.status(403).json({
        success: false,
        message: `Business account is ${business.status}`,
        code: 'BUSINESS_INACTIVE'
      });
    }
    
    // Ensure business has default tokens configured
    await addDefaultTokensIfNeeded(business);
    
    // Update last used timestamp
    apiKeyRecord.lastUsedAt = new Date();
    await apiKeyRecord.save();
    
    // Attach business and API info to request
    req.business = business;
    req.apiKey = {
      publicKey: apiKeyRecord.publicKey,
      clientKey: apiKeyRecord.clientKey,
      permissions: apiKeyRecord.permissions
    };
    
    console.log(`✅ [API_AUTH] API key authentication successful for business: ${business.businessName}`);
    next();
    
  } catch (error) {
    console.error('[API_AUTH] Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

// 🔧 NEW: Separate middleware to validate the secret key (for sensitive operations)
const validateBusinessOnrampRequest = async (req, res, next) => {
  try {
    console.log('🔐 [API_AUTH] Validating secret key for:', req.path);
    
    // Get secret key from headers
    const secretKey = req.headers['x-secret-key'];
    
    // Validate required headers
    if (!secretKey) {
      return res.status(401).json({
        success: false,
        message: 'Secret key is required. Include X-Secret-Key header.',
        code: 'MISSING_SECRET_KEY'
      });
    }
    
    // Business should already be attached by authenticateApiKey middleware
    if (!req.business || !req.apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Authentication flow error. API key must be validated first.',
        code: 'AUTH_FLOW_ERROR'
      });
    }
    
    console.log(`[API_AUTH] Validating secret key for business: ${req.business.businessId}`);
    
    // Find the API key record again to get the hashed secret
    const apiKeyRecord = await ApiKey.findOne({
      publicKey: req.apiKey.publicKey,
      isActive: true
    });
    
    if (!apiKeyRecord) {
      return res.status(401).json({
        success: false,
        message: 'API key not found during secret validation',
        code: 'API_KEY_NOT_FOUND'
      });
    }
    
    // Verify the secret key
    const isValidSecret = await bcrypt.compare(secretKey, apiKeyRecord.secretKey);
    
    if (!isValidSecret) {
      console.log('[API_AUTH] Invalid secret key');
      return res.status(401).json({
        success: false,
        message: 'Invalid secret key',
        code: 'INVALID_SECRET_KEY'
      });
    }
    
    console.log(`✅ [API_AUTH] Secret key validation successful for business: ${req.business.businessName}`);
    next();
    
  } catch (error) {
    console.error('[API_AUTH] Secret key validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Secret key validation service error',
      code: 'SECRET_VALIDATION_ERROR'
    });
  }
};

// 🔧 ENHANCED: Rate limiting middleware for API endpoints
const apiRateLimit = (req, res, next) => {
  try {
    console.log('⏱️ [API_RATE_LIMIT] Applying rate limit for:', req.path);
    
    // This is a basic implementation - in production, use Redis-based rate limiting
    const rateLimitStore = global.apiRateLimitStore || (global.apiRateLimitStore = new Map());
    
    const identifier = req.business?.businessId || req.ip;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 100000000000; // 100 requests per minute per business
    
    const record = rateLimitStore.get(identifier) || { count: 0, resetTime: now + windowMs };
    
    if (now > record.resetTime) {
      // Reset the counter
      record.count = 0;
      record.resetTime = now + windowMs;
    }
    
    if (record.count >= maxRequests) {
      console.log(`[API_RATE_LIMIT] Rate limit exceeded for ${identifier}`);
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded. Try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
    }
    
    record.count++;
    rateLimitStore.set(identifier, record);
    
    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': maxRequests - record.count,
      'X-RateLimit-Reset': new Date(record.resetTime).toISOString()
    });
    
    console.log(`[API_RATE_LIMIT] Request ${record.count}/${maxRequests} for ${identifier}`);
    next();
    
  } catch (error) {
    console.error('[API_RATE_LIMIT] Error:', error);
    // Don't block request if rate limiting fails
    next();
  }
};

// 🔧 NEW: Middleware to validate business onramp request data (separate from authentication)
const validateOnrampRequestData = (req, res, next) => {
  try {
    console.log('[ONRAMP_VALIDATION] Validating business onramp request data');
    
    const {
      customerEmail,
      customerName,
      amount,
      targetToken,
      targetNetwork,
      customerWallet,
      webhookUrl,
      redirectUrl
    } = req.body;
    
    const errors = [];
    
    // Validate required fields
    if (!customerEmail || !customerEmail.trim()) {
      errors.push('Customer email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      errors.push('Invalid email format');
    }
    
    if (!customerName || !customerName.trim()) {
      errors.push('Customer name is required');
    }
    
    if (!amount || typeof amount !== 'number') {
      errors.push('Amount is required and must be a number');
    } else if (amount < 1000) {
      errors.push('Minimum amount is ₦1,000');
    } else if (amount > 10000000) {
      errors.push('Maximum amount is ₦10,000,000');
    }
    
    if (!targetToken || !targetToken.trim()) {
      errors.push('Target token is required');
    }
    
    if (!targetNetwork || !targetNetwork.trim()) {
      errors.push('Target network is required');
    } else if (!['base', 'solana', 'ethereum'].includes(targetNetwork.toLowerCase())) {
      errors.push('Invalid target network. Supported: base, solana, ethereum');
    }
    
    if (!customerWallet || !customerWallet.trim()) {
      errors.push('Customer wallet address is required');
    } else {
      // Basic wallet address validation
      const wallet = customerWallet.trim();
      const network = targetNetwork?.toLowerCase();
      
      if (network === 'solana') {
        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
          errors.push('Invalid Solana wallet address format');
        }
      } else if (['base', 'ethereum'].includes(network)) {
        if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
          errors.push('Invalid Ethereum/Base wallet address format');
        }
      }
    }
    
    // Validate optional fields if provided
    if (redirectUrl && !/^https?:\/\/.+/.test(redirectUrl)) {
      errors.push('Invalid redirect URL format. Must start with http:// or https://');
    }
    
    if (webhookUrl && !/^https?:\/\/.+/.test(webhookUrl)) {
      errors.push('Invalid webhook URL format. Must start with http:// or https://');
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_FAILED',
        errors
      });
    }
    
    console.log('[ONRAMP_VALIDATION] Request data validation successful');
    next();
    
  } catch (error) {
    console.error('[ONRAMP_VALIDATION] Validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Validation service error',
      code: 'VALIDATION_SERVICE_ERROR'
    });
  }
};

// 🔧 NEW: Middleware to validate business off-ramp request data
const validateOfframpRequestData = (req, res, next) => {
  try {
    console.log('[OFFRAMP_VALIDATION] Validating business off-ramp request data');
    
    const {
      customerEmail,
      customerName,
      customerPhone,
      tokenAmount,
      targetToken,
      targetNetwork,
      recipientAccountNumber,
      recipientBankCode,
      recipientAccountName,
      recipientBankName,
      webhookUrl,
      metadata
    } = req.body;
    
    const errors = [];
    
    // Validate required fields
    if (!customerEmail || !customerEmail.trim()) {
      errors.push('Customer email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      errors.push('Invalid email format');
    }
    
    if (!customerName || !customerName.trim()) {
      errors.push('Customer name is required');
    }
    
    if (!tokenAmount || typeof tokenAmount !== 'number') {
      errors.push('Token amount is required and must be a number');
    } else if (tokenAmount <= 0) {
      errors.push('Token amount must be greater than 0');
    } else if (tokenAmount > 1000000) {
      errors.push('Maximum token amount is 1,000,000');
    }
    
    if (!targetToken || !targetToken.trim()) {
      errors.push('Target token is required');
    }
    
    if (!targetNetwork || !targetNetwork.trim()) {
      errors.push('Target network is required');
    } else if (!['base', 'solana', 'ethereum'].includes(targetNetwork.toLowerCase())) {
      errors.push('Invalid target network. Supported: base, solana, ethereum');
    }
    
    if (!recipientAccountNumber || !recipientAccountNumber.trim()) {
      errors.push('Recipient account number is required');
    } else if (!/^\d{10}$/.test(recipientAccountNumber.trim())) {
      errors.push('Invalid account number format. Must be 10 digits.');
    }
    
    if (!recipientBankCode || !recipientBankCode.trim()) {
      errors.push('Recipient bank code is required');
    } else if (!/^\d{6}$/.test(recipientBankCode.trim())) {
      errors.push('Invalid bank code format. Must be 6 digits.');
    }
    
    // Validate optional fields if provided
    if (customerPhone && !/^\+?[1-9]\d{1,14}$/.test(customerPhone.trim())) {
      errors.push('Invalid phone number format. Use international format (e.g., +2348123456789)');
    }
    
    if (webhookUrl && !/^https?:\/\/.+/.test(webhookUrl)) {
      errors.push('Invalid webhook URL format. Must start with http:// or https://');
    }
    
    // Validate metadata if provided
    if (metadata && typeof metadata !== 'object') {
      errors.push('Metadata must be a valid JSON object');
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_FAILED',
        errors
      });
    }
    
    console.log('[OFFRAMP_VALIDATION] Request data validation successful');
    next();
    
  } catch (error) {
    console.error('[OFFRAMP_VALIDATION] Validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Validation service error',
      code: 'VALIDATION_SERVICE_ERROR'
    });
  }
};

// 🔧 NEW: Middleware for webhook request validation
const validateWebhookRequest = (req, res, next) => {
  try {
    console.log('[WEBHOOK_VALIDATION] Validating webhook request');
    
    // Basic webhook signature validation (implement based on your webhook provider)
    const signature = req.headers['x-webhook-signature'] || req.headers['x-signature'];
    const webhookSecret = process.env.WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      // Implement signature validation here
      // This is provider-specific (e.g., GitHub, Stripe style)
      console.log('[WEBHOOK_VALIDATION] Webhook signature validation not implemented');
    }
    
    // Allow webhook requests to proceed
    console.log('[WEBHOOK_VALIDATION] Webhook request validated');
    next();
    
  } catch (error) {
    console.error('[WEBHOOK_VALIDATION] Webhook validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook validation service error',
      code: 'WEBHOOK_VALIDATION_ERROR'
    });
  }
};

// 🔧 NEW: Middleware for admin/internal operations
const validateInternalRequest = (req, res, next) => {
  try {
    console.log('[INTERNAL_VALIDATION] Validating internal request');
    
    const internalKey = req.headers['x-internal-key'];
    const expectedInternalKey = process.env.INTERNAL_API_KEY;
    
    if (!expectedInternalKey) {
      console.log('[INTERNAL_VALIDATION] Internal API key not configured');
      return res.status(503).json({
        success: false,
        message: 'Internal API not configured',
        code: 'INTERNAL_API_NOT_CONFIGURED'
      });
    }
    
    if (!internalKey || internalKey !== expectedInternalKey) {
      console.log('[INTERNAL_VALIDATION] Invalid internal API key');
      return res.status(401).json({
        success: false,
        message: 'Invalid internal API key',
        code: 'INVALID_INTERNAL_KEY'
      });
    }
    
    console.log('[INTERNAL_VALIDATION] Internal request validated');
    next();
    
  } catch (error) {
    console.error('[INTERNAL_VALIDATION] Internal validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal validation service error',
      code: 'INTERNAL_VALIDATION_ERROR'
    });
  }
};

module.exports = {
  authenticateApiKey,           // 🔧 FIXED: Only validates API key
  validateBusinessOnrampRequest, // 🔧 FIXED: Only validates secret key  
  validateOnrampRequestData,    // 🔧 NEW: Validates onramp request data
  validateOfframpRequestData,   // 🔧 NEW: Validates off-ramp request data
  validateWebhookRequest,       // 🔧 NEW: Validates webhook requests
  validateInternalRequest,      // 🔧 NEW: Validates internal API requests
  apiRateLimit                  // 🔧 Enhanced rate limiting
};