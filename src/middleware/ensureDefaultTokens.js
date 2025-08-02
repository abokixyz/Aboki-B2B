const { Business } = require('../models');
const { DEFAULT_TOKENS } = require('../config/defaultTokens');

const ensureDefaultTokens = async (req, res, next) => {
  try {
    const business = req.business;
    
    if (!business) {
      console.log('[ENSURE_DEFAULT_TOKENS] No business found in request, skipping...');
      return next();
    }

    console.log(`[ENSURE_DEFAULT_TOKENS] Checking default tokens for business: ${business.businessId}`);

    let needsSave = false;

    // Initialize structures if missing
    if (!business.supportedTokens) {
      business.supportedTokens = { base: [], solana: [], ethereum: [] };
      needsSave = true;
      console.log('[ENSURE_DEFAULT_TOKENS] Initialized supportedTokens structure');
    }
    if (!business.feeConfiguration) {
      business.feeConfiguration = { base: [], solana: [], ethereum: [] };
      needsSave = true;
      console.log('[ENSURE_DEFAULT_TOKENS] Initialized feeConfiguration structure');
    }

    // Add missing default tokens for each network
    for (const [networkName, tokens] of Object.entries(DEFAULT_TOKENS)) {
      if (!business.supportedTokens[networkName]) {
        business.supportedTokens[networkName] = [];
        needsSave = true;
      }
      if (!business.feeConfiguration[networkName]) {
        business.feeConfiguration[networkName] = [];
        needsSave = true;
      }

      for (const tokenTemplate of tokens) {
        // Check if token already exists
        const existingToken = business.supportedTokens[networkName].find(
          t => t.contractAddress.toLowerCase() === tokenTemplate.contractAddress.toLowerCase()
        );

        if (!existingToken) {
          // Add to supported tokens
          business.supportedTokens[networkName].push({
            symbol: tokenTemplate.symbol,
            name: tokenTemplate.name,
            contractAddress: tokenTemplate.contractAddress,
            decimals: tokenTemplate.decimals,
            network: tokenTemplate.network,
            type: tokenTemplate.type,
            isActive: tokenTemplate.isActive,
            isTradingEnabled: tokenTemplate.isTradingEnabled,
            isDefault: tokenTemplate.isDefault,
            logoUrl: tokenTemplate.logoUrl,
            addedAt: new Date(),
            metadata: {}
          });

          // Add fee configuration
          business.feeConfiguration[networkName].push({
            contractAddress: tokenTemplate.contractAddress,
            symbol: tokenTemplate.symbol,
            feePercentage: 0, // Default 0% fee
            isActive: true,
            isDefault: true,
            updatedAt: new Date()
          });

          needsSave = true;
          console.log(`[ENSURE_DEFAULT_TOKENS] ✅ Auto-added ${tokenTemplate.symbol} to ${networkName} network for business ${business.businessId}`);
        }
      }
    }

    if (needsSave) {
      business.supportedTokensUpdatedAt = new Date();
      business.updatedAt = new Date();
      await business.save();
      console.log(`[ENSURE_DEFAULT_TOKENS] ✅ Default tokens updated for business ${business.businessId}`);
    } else {
      console.log(`[ENSURE_DEFAULT_TOKENS] ✅ All default tokens already exist for business ${business.businessId}`);
    }

    next();
  } catch (error) {
    console.error('[ENSURE_DEFAULT_TOKENS] Error ensuring default tokens:', error);
    // Don't block the request, just log the error and continue
    next();
  }
};

module.exports = ensureDefaultTokens;