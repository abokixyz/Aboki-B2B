const { Business, ApiKey } = require('../models');
// Remove TokenValidationService import if it's causing issues
// const TokenValidationService = require('../services/tokenValidationService');

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
  ]
};

// Helper function to add default tokens to existing businesses
async function addDefaultTokensToExistingBusiness(business) {
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
    }

    return tokensAdded;
  } catch (error) {
    console.error('Error adding default tokens to existing business:', error);
    throw error;
  }
}

// Helper function to get token breakdown
function getTokenBreakdown(supportedTokens) {
  const breakdown = { base: {}, solana: {}, ethereum: {} };
  
  Object.keys(supportedTokens || {}).forEach(network => {
    const tokens = supportedTokens[network] || [];
    breakdown[network] = {
      total: tokens.length,
      default: tokens.filter(t => t.isDefault).length,
      custom: tokens.filter(t => !t.isDefault).length,
      active: tokens.filter(t => t.isActive && t.isTradingEnabled).length
    };
  });
  
  return breakdown;
}

const businessTokenController = {
  // Get all supported tokens for a business (includes default tokens)
  async getSupportedTokens(req, res) {
    try {
      const userId = req.user.id;

      const business = await Business.findOne({ ownerId: userId });
      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'Business not found'
        });
      }

      // Ensure business has default tokens
      await addDefaultTokensToExistingBusiness(business);

      // Get token breakdown statistics
      const tokenBreakdown = getTokenBreakdown(business.supportedTokens);

      res.json({
        success: true,
        data: {
          businessId: business.businessId,
          businessName: business.businessName,
          supportedTokens: business.supportedTokens || {
            base: [],
            solana: [],
            ethereum: []
          },
          feeConfiguration: business.feeConfiguration || {
            base: [],
            solana: [],
            ethereum: []
          },
          paymentWallets: business.paymentWallets || {
            solana: null,
            base: null,
            ethereum: null
          },
          bankAccount: business.bankAccount || null,
          tokenStatistics: {
            breakdown: tokenBreakdown,
            summary: {
              totalTokens: tokenBreakdown.base.total + tokenBreakdown.solana.total + tokenBreakdown.ethereum.total,
              defaultTokens: tokenBreakdown.base.default + tokenBreakdown.solana.default + tokenBreakdown.ethereum.default,
              customTokens: tokenBreakdown.base.custom + tokenBreakdown.solana.custom + tokenBreakdown.ethereum.custom,
              activeTokens: tokenBreakdown.base.active + tokenBreakdown.solana.active + tokenBreakdown.ethereum.active
            }
          },
          defaultTokensInfo: {
            description: 'Default tokens are automatically provided with 0% fees. You can customize their fees.',
            feesCustomizable: 'You can adjust fees for both default and custom tokens',
            defaultFeePercentage: '0% (can be customized)'
          },
          lastUpdated: business.supportedTokensUpdatedAt || business.updatedAt
        }
      });

    } catch (error) {
      console.error('Get supported tokens error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Get default and custom tokens breakdown
  async getTokensBreakdown(req, res) {
    try {
      const userId = req.user.id;

      const business = await Business.findOne({ ownerId: userId });
      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'Business not found'
        });
      }

      // Ensure business has default tokens
      await addDefaultTokensToExistingBusiness(business);

      const getDefaultTokens = (network) => {
        if (!business.supportedTokens?.[network]) return [];
        return business.supportedTokens[network].filter(t => t.isDefault);
      };

      const getCustomTokens = (network) => {
        if (!business.supportedTokens?.[network]) return [];
        return business.supportedTokens[network].filter(t => !t.isDefault);
      };

      const defaultTokens = {
        base: getDefaultTokens('base'),
        solana: getDefaultTokens('solana'),
        ethereum: getDefaultTokens('ethereum')
      };

      const customTokens = {
        base: getCustomTokens('base'),
        solana: getCustomTokens('solana'),
        ethereum: getCustomTokens('ethereum')
      };

      // Get fee information for each token type
      const getTokensWithFees = (tokens, network) => {
        return tokens.map(token => {
          const feeConfig = business.feeConfiguration?.[network]?.find(
            f => f.contractAddress.toLowerCase() === token.contractAddress.toLowerCase()
          );
          return {
            ...token,
            feePercentage: feeConfig ? feeConfig.feePercentage : 0
          };
        });
      };

      res.json({
        success: true,
        data: {
          businessId: business.businessId,
          businessName: business.businessName,
          defaultTokens: {
            base: getTokensWithFees(defaultTokens.base, 'base'),
            solana: getTokensWithFees(defaultTokens.solana, 'solana'),
            ethereum: getTokensWithFees(defaultTokens.ethereum, 'ethereum')
          },
          customTokens: {
            base: getTokensWithFees(customTokens.base, 'base'),
            solana: getTokensWithFees(customTokens.solana, 'solana'),
            ethereum: getTokensWithFees(customTokens.ethereum, 'ethereum')
          },
          summary: {
            defaultTokensCount: {
              base: defaultTokens.base.length,
              solana: defaultTokens.solana.length,
              ethereum: defaultTokens.ethereum.length,
              total: defaultTokens.base.length + defaultTokens.solana.length + defaultTokens.ethereum.length
            },
            customTokensCount: {
              base: customTokens.base.length,
              solana: customTokens.solana.length,
              ethereum: customTokens.ethereum.length,
              total: customTokens.base.length + customTokens.solana.length + customTokens.ethereum.length
            }
          },
          info: {
            defaultTokensDescription: 'These tokens are automatically provided to all businesses with 0% default fees',
            customTokensDescription: 'These are additional tokens you have manually added',
            feeCustomization: 'You can customize fees for both default and custom tokens (0-10%)',
            defaultTokenProtection: 'Default tokens cannot be deleted, only disabled or fee-adjusted'
          }
        }
      });

    } catch (error) {
      console.error('Get tokens breakdown error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Add supported tokens to a network (custom tokens only)
  async addSupportedTokens(req, res) {
    try {
      const userId = req.user.id;
      const { network, tokens } = req.body;

      // Validation
      if (!network || !tokens || !Array.isArray(tokens) || tokens.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Network and tokens array are required',
          example: {
            network: 'base',
            tokens: [
              {
                address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
                symbol: 'USDC',
                name: 'USD Coin',
                decimals: 6,
                feePercentage: 0
              }
            ]
          }
        });
      }

      const supportedNetworks = ['base', 'solana', 'ethereum'];
      if (!supportedNetworks.includes(network.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: 'Unsupported network',
          supportedNetworks
        });
      }

      const business = await Business.findOne({ ownerId: userId });
      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'Business not found'
        });
      }

      // Ensure business has default tokens
      await addDefaultTokensToExistingBusiness(business);

      // Validate each token
      const validatedTokens = [];
      const validationErrors = [];

      for (const token of tokens) {
        const { address, symbol, name, decimals, feePercentage } = token;

        // Basic validation
        if (!address || !symbol || !name) {
          validationErrors.push({
            token,
            error: 'Address, symbol, and name are required'
          });
          continue;
        }

        if (feePercentage !== undefined && (feePercentage < 0 || feePercentage > 10)) {
          validationErrors.push({
            token,
            error: 'Fee percentage must be between 0 and 10'
          });
          continue;
        }

        try {
          // Create token object (custom tokens are NOT default)
          const tokenObj = {
            contractAddress: address.trim(),
            symbol: symbol.trim().toUpperCase(),
            name: name.trim(),
            decimals: decimals || (network === 'solana' ? 9 : 18),
            network: network.toLowerCase(),
            type: network.toLowerCase() === 'solana' ? 'SPL' : 'ERC-20',
            isActive: true,
            isTradingEnabled: true,
            isDefault: false, // Custom tokens are never default
            addedAt: new Date(),
            metadata: {}
          };

          validatedTokens.push({
            ...tokenObj,
            feePercentage: feePercentage || 0
          });

        } catch (error) {
          validationErrors.push({
            token,
            error: `Validation failed: ${error.message}`
          });
        }
      }

      if (validatedTokens.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid tokens to add',
          errors: validationErrors
        });
      }

      // Initialize supportedTokens and feeConfiguration if they don't exist
      if (!business.supportedTokens) {
        business.supportedTokens = { base: [], solana: [], ethereum: [] };
      }
      if (!business.feeConfiguration) {
        business.feeConfiguration = { base: [], solana: [], ethereum: [] };
      }

      const networkKey = network.toLowerCase();

      // Check for duplicates and add tokens
      const addedTokens = [];
      const duplicateTokens = [];

      for (const token of validatedTokens) {
        const existingToken = business.supportedTokens[networkKey].find(
          t => t.contractAddress.toLowerCase() === token.contractAddress.toLowerCase()
        );

        if (existingToken) {
          duplicateTokens.push(token);
          continue;
        }

        // Add to supported tokens
        business.supportedTokens[networkKey].push({
          contractAddress: token.contractAddress,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          network: token.network,
          type: token.type,
          isActive: token.isActive,
          isTradingEnabled: token.isTradingEnabled,
          isDefault: token.isDefault, // false for custom tokens
          addedAt: token.addedAt,
          metadata: token.metadata
        });

        // Add fee configuration
        business.feeConfiguration[networkKey].push({
          contractAddress: token.contractAddress,
          symbol: token.symbol,
          feePercentage: token.feePercentage,
          isActive: true,
          isDefault: false, // false for custom tokens
          updatedAt: new Date()
        });

        addedTokens.push(token);
      }

      business.supportedTokensUpdatedAt = new Date();
      business.updatedAt = new Date();
      await business.save();

      res.json({
        success: true,
        message: `Successfully added ${addedTokens.length} custom tokens to ${network}`,
        data: {
          network: networkKey,
          addedTokens,
          duplicateTokens,
          validationErrors,
          totalTokens: business.supportedTokens[networkKey].length,
          customTokens: business.supportedTokens[networkKey].filter(t => !t.isDefault).length,
          defaultTokens: business.supportedTokens[networkKey].filter(t => t.isDefault).length
        }
      });

    } catch (error) {
      console.error('Add supported tokens error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Update token configuration (fee percentage, active status) - Works for both default and custom tokens
  async updateTokenConfiguration(req, res) {
    try {
      const userId = req.user.id;
      const { network, address, updates } = req.body;

      // Validation
      if (!network || !address || !updates) {
        return res.status(400).json({
          success: false,
          message: 'Network, address, and updates are required',
          example: {
            network: 'base',
            address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
            updates: {
              feePercentage: 2.0,
              isActive: true,
              isTradingEnabled: true
            }
          }
        });
      }

      const business = await Business.findOne({ ownerId: userId });
      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'Business not found'
        });
      }

      // Ensure business has default tokens
      await addDefaultTokensToExistingBusiness(business);

      const networkKey = network.toLowerCase();
      
      if (!business.supportedTokens?.[networkKey] || !business.feeConfiguration?.[networkKey]) {
        return res.status(404).json({
          success: false,
          message: `No tokens configured for ${network} network`
        });
      }

      // Find and update token in supported tokens
      const tokenIndex = business.supportedTokens[networkKey].findIndex(
        t => t.contractAddress.toLowerCase() === address.toLowerCase()
      );

      if (tokenIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Token not found in supported tokens list'
        });
      }

      const token = business.supportedTokens[networkKey][tokenIndex];

      // Find and update fee configuration
      const feeIndex = business.feeConfiguration[networkKey].findIndex(
        t => t.contractAddress.toLowerCase() === address.toLowerCase()
      );

      // Update token status if provided
      if (updates.isActive !== undefined) {
        business.supportedTokens[networkKey][tokenIndex].isActive = updates.isActive;
        if (feeIndex !== -1) {
          business.feeConfiguration[networkKey][feeIndex].isActive = updates.isActive;
        }
      }

      // Update trading status if provided
      if (updates.isTradingEnabled !== undefined) {
        business.supportedTokens[networkKey][tokenIndex].isTradingEnabled = updates.isTradingEnabled;
      }

      // Update fee percentage if provided (works for both default and custom tokens)
      if (updates.feePercentage !== undefined) {
        if (updates.feePercentage < 0 || updates.feePercentage > 10) {
          return res.status(400).json({
            success: false,
            message: 'Fee percentage must be between 0 and 10'
          });
        }

        if (feeIndex !== -1) {
          business.feeConfiguration[networkKey][feeIndex].feePercentage = updates.feePercentage;
          business.feeConfiguration[networkKey][feeIndex].updatedAt = new Date();
        }
      }

      business.supportedTokensUpdatedAt = new Date();
      business.updatedAt = new Date();
      await business.save();

      res.json({
        success: true,
        message: `Token configuration updated successfully${token.isDefault ? ' (Default token)' : ' (Custom token)'}`,
        data: {
          network: networkKey,
          address,
          updates,
          token: business.supportedTokens[networkKey][tokenIndex],
          feeConfiguration: feeIndex !== -1 ? business.feeConfiguration[networkKey][feeIndex] : null,
          isDefaultToken: token.isDefault,
          note: token.isDefault ? 'You can customize fees for default tokens' : 'Custom token updated'
        }
      });

    } catch (error) {
      console.error('Update token configuration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Bulk update fees for multiple tokens
  async bulkUpdateFees(req, res) {
    try {
      const userId = req.user.id;
      const { tokenUpdates } = req.body;

      if (!tokenUpdates || !Array.isArray(tokenUpdates)) {
        return res.status(400).json({
          success: false,
          message: 'tokenUpdates array is required',
          example: {
            tokenUpdates: [
              {
                network: 'base',
                address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
                feePercentage: 1.0
              },
              {
                network: 'solana',
                address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                feePercentage: 1.5
              }
            ]
          }
        });
      }

      const business = await Business.findOne({ ownerId: userId });
      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'Business not found'
        });
      }

      // Ensure business has default tokens
      await addDefaultTokensToExistingBusiness(business);

      const updatedTokens = [];
      const errors = [];

      for (const update of tokenUpdates) {
        const { network, address, feePercentage } = update;

        if (!network || !address || feePercentage === undefined) {
          errors.push({
            update,
            error: 'Network, address, and feePercentage are required'
          });
          continue;
        }

        if (feePercentage < 0 || feePercentage > 10) {
          errors.push({
            update,
            error: 'Fee percentage must be between 0 and 10'
          });
          continue;
        }

        const networkKey = network.toLowerCase();

        // Find the token (both default and custom)
        const tokenIndex = business.supportedTokens[networkKey]?.findIndex(
          t => t.contractAddress.toLowerCase() === address.toLowerCase()
        );

        if (tokenIndex === -1 || tokenIndex === undefined) {
          errors.push({
            update,
            error: `Token not found on ${network} network`
          });
          continue;
        }

        const token = business.supportedTokens[networkKey][tokenIndex];

        // Update fee configuration
        const feeIndex = business.feeConfiguration[networkKey]?.findIndex(
          t => t.contractAddress.toLowerCase() === address.toLowerCase()
        );

        if (feeIndex !== -1) {
          const oldFeePercentage = business.feeConfiguration[networkKey][feeIndex].feePercentage;
          business.feeConfiguration[networkKey][feeIndex].feePercentage = feePercentage;
          business.feeConfiguration[networkKey][feeIndex].updatedAt = new Date();
          
          updatedTokens.push({
            network: networkKey,
            address,
            symbol: token.symbol,
            name: token.name,
            oldFeePercentage,
            newFeePercentage: feePercentage,
            isDefault: token.isDefault
          });
        }
      }

      if (updatedTokens.length > 0) {
        business.supportedTokensUpdatedAt = new Date();
        business.updatedAt = new Date();
        await business.save();
      }

      res.json({
        success: true,
        message: `Updated fees for ${updatedTokens.length} tokens`,
        data: {
          updatedTokens,
          errors,
          summary: {
            totalUpdates: updatedTokens.length,
            defaultTokensUpdated: updatedTokens.filter(t => t.isDefault).length,
            customTokensUpdated: updatedTokens.filter(t => !t.isDefault).length,
            errors: errors.length
          }
        }
      });

    } catch (error) {
      console.error('Bulk update fees error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Remove token from supported list (with default token protection)
  async removeSupportedToken(req, res) {
    try {
      const userId = req.user.id;
      const { network, address, forceRemove = false } = req.body;

      if (!network || !address) {
        return res.status(400).json({
          success: false,
          message: 'Network and address are required'
        });
      }

      const business = await Business.findOne({ ownerId: userId });
      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'Business not found'
        });
      }

      const networkKey = network.toLowerCase();

      if (!business.supportedTokens?.[networkKey]) {
        return res.status(404).json({
          success: false,
          message: `No tokens configured for ${network} network`
        });
      }

      // Find token
      const tokenIndex = business.supportedTokens[networkKey].findIndex(
        t => t.contractAddress.toLowerCase() === address.toLowerCase()
      );

      if (tokenIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Token not found in supported tokens list'
        });
      }

      const token = business.supportedTokens[networkKey][tokenIndex];

      // Protect default tokens from deletion
      if (token.isDefault && !forceRemove) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove default tokens. You can only disable them by setting isActive to false.',
          suggestion: 'Use the update endpoint to set isActive: false instead of removing the token',
          tokenInfo: {
            symbol: token.symbol,
            name: token.name,
            isDefault: true
          },
          alternatives: [
            'Disable the token: PUT /tokens/update with isActive: false',
            'Customize the fee: PUT /tokens/update with feePercentage: [0-10]'
          ]
        });
      }

      // Allow removal if it's a custom token or forceRemove is true
      const removedToken = business.supportedTokens[networkKey][tokenIndex];
      business.supportedTokens[networkKey].splice(tokenIndex, 1);

      // Remove from fee configuration
      if (business.feeConfiguration?.[networkKey]) {
        const feeIndex = business.feeConfiguration[networkKey].findIndex(
          t => t.contractAddress.toLowerCase() === address.toLowerCase()
        );
        if (feeIndex !== -1) {
          business.feeConfiguration[networkKey].splice(feeIndex, 1);
        }
      }

      business.supportedTokensUpdatedAt = new Date();
      business.updatedAt = new Date();
      await business.save();

      res.json({
        success: true,
        message: `${token.isDefault ? 'Default' : 'Custom'} token removed successfully`,
        data: {
          network: networkKey,
          removedToken,
          remainingTokens: business.supportedTokens[networkKey].length,
          wasDefaultToken: token.isDefault,
          warning: token.isDefault ? 'Default token was forcibly removed' : null
        }
      });

    } catch (error) {
      console.error('Remove supported token error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Clear all custom tokens for a specific network (protects default tokens)
  async clearNetworkTokens(req, res) {
    try {
      const userId = req.user.id;
      const { network, confirmClear, includeDefaults = false } = req.body;

      if (!network) {
        return res.status(400).json({
          success: false,
          message: 'Network is required'
        });
      }

      if (!confirmClear) {
        return res.status(400).json({
          success: false,
          message: 'Please confirm by setting confirmClear to true'
        });
      }

      const business = await Business.findOne({ ownerId: userId });
      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'Business not found'
        });
      }

      const networkKey = network.toLowerCase();
      const currentTokens = business.supportedTokens?.[networkKey] || [];
      
      let tokensToRemove, tokensToKeep;
      
      if (includeDefaults) {
        tokensToRemove = currentTokens;
        tokensToKeep = [];
      } else {
        tokensToRemove = currentTokens.filter(t => !t.isDefault);
        tokensToKeep = currentTokens.filter(t => t.isDefault);
      }

      // Update supported tokens
      if (business.supportedTokens) {
        business.supportedTokens[networkKey] = tokensToKeep;
      }

      // Update fee configuration
      if (business.feeConfiguration) {
        const addressesToKeep = tokensToKeep.map(t => t.contractAddress.toLowerCase());
        business.feeConfiguration[networkKey] = business.feeConfiguration[networkKey]?.filter(
          f => addressesToKeep.includes(f.contractAddress.toLowerCase())
        ) || [];
      }

      business.supportedTokensUpdatedAt = new Date();
      business.updatedAt = new Date();
      await business.save();

      res.json({
        success: true,
        message: `Successfully cleared ${tokensToRemove.length} ${includeDefaults ? 'tokens (including defaults)' : 'custom tokens'} from ${network} network`,
        data: {
          network: networkKey,
          removedTokensCount: tokensToRemove.length,
          remainingTokensCount: tokensToKeep.length,
          removedTokens: tokensToRemove.map(t => ({
            symbol: t.symbol,
            name: t.name,
            isDefault: t.isDefault
          })),
          keptTokens: tokensToKeep.map(t => ({
            symbol: t.symbol,
            name: t.name,
            isDefault: t.isDefault
          })),
          warning: includeDefaults ? 'Default tokens were also removed and will need to be re-added manually' : 'Default tokens were preserved'
        }
      });

    } catch (error) {
      console.error('Clear network tokens error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Set payment wallets for receiving fees
  async setPaymentWallets(req, res) {
    try {
      const userId = req.user.id;
      const { solanaWallet, baseWallet, ethereumWallet } = req.body;

      // Validation for wallet addresses
      const walletValidations = [];

      if (solanaWallet) {
        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(solanaWallet)) {
          walletValidations.push('Invalid Solana wallet address format');
        }
      }

      if (baseWallet) {
        if (!/^0x[a-fA-F0-9]{40}$/.test(baseWallet)) {
          walletValidations.push('Invalid Base wallet address format');
        }
      }

      if (ethereumWallet) {
        if (!/^0x[a-fA-F0-9]{40}$/.test(ethereumWallet)) {
          walletValidations.push('Invalid Ethereum wallet address format');
        }
      }

      if (walletValidations.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid wallet address format',
          errors: walletValidations
        });
      }

      const business = await Business.findOne({ ownerId: userId });
      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'Business not found'
        });
      }

      // Initialize paymentWallets if it doesn't exist
      if (!business.paymentWallets) {
        business.paymentWallets = {};
      }

      // Update wallet addresses
      if (solanaWallet !== undefined) {
        business.paymentWallets.solana = solanaWallet.trim() || null;
      }
      if (baseWallet !== undefined) {
        business.paymentWallets.base = baseWallet.trim() || null;
      }
      if (ethereumWallet !== undefined) {
        business.paymentWallets.ethereum = ethereumWallet.trim() || null;
      }

      business.updatedAt = new Date();
      await business.save();

      res.json({
        success: true,
        message: 'Payment wallets updated successfully',
        data: {
          paymentWallets: business.paymentWallets
        }
      });

    } catch (error) {
      console.error('Set payment wallets error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Set bank account for fiat payments
  async setBankAccount(req, res) {
    try {
      const userId = req.user.id;
      const { 
        accountName, 
        accountNumber, 
        bankName, 
        bankCode, 
        currency = 'NGN' 
      } = req.body;

      // Validation
      if (!accountName || !accountNumber || !bankName) {
        return res.status(400).json({
          success: false,
          message: 'Account name, account number, and bank name are required'
        });
      }

      // Basic account number validation (Nigerian banks typically 10 digits)
      if (!/^\d{10}$/.test(accountNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid account number format. Should be 10 digits.'
        });
      }

      const business = await Business.findOne({ ownerId: userId });
      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'Business not found'
        });
      }

      business.bankAccount = {
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
        bankName: bankName.trim(),
        bankCode: bankCode?.trim(),
        currency: currency.toUpperCase(),
        isVerified: false,
        addedAt: new Date()
      };

      business.updatedAt = new Date();
      await business.save();

      res.json({
        success: true,
        message: 'Bank account information saved successfully',
        data: {
          bankAccount: business.bankAccount,
          note: 'Bank account verification will be performed during the first transaction'
        }
      });

    } catch (error) {
      console.error('Set bank account error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Get complete fee and payment configuration
  async getPaymentConfiguration(req, res) {
    try {
      const userId = req.user.id;

      const business = await Business.findOne({ ownerId: userId })
        .select('businessId businessName supportedTokens feeConfiguration paymentWallets bankAccount supportedTokensUpdatedAt');

      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'Business not found'
        });
      }

      // Ensure business has default tokens
      await addDefaultTokensToExistingBusiness(business);

      // Calculate summary statistics with default/custom breakdown
      const summary = {
        totalTokens: {
          base: business.supportedTokens?.base?.length || 0,
          solana: business.supportedTokens?.solana?.length || 0,
          ethereum: business.supportedTokens?.ethereum?.length || 0
        },
        defaultTokens: {
          base: business.supportedTokens?.base?.filter(t => t.isDefault)?.length || 0,
          solana: business.supportedTokens?.solana?.filter(t => t.isDefault)?.length || 0,
          ethereum: business.supportedTokens?.ethereum?.filter(t => t.isDefault)?.length || 0
        },
        customTokens: {
          base: business.supportedTokens?.base?.filter(t => !t.isDefault)?.length || 0,
          solana: business.supportedTokens?.solana?.filter(t => !t.isDefault)?.length || 0,
          ethereum: business.supportedTokens?.ethereum?.filter(t => !t.isDefault)?.length || 0
        },
        activeTokens: {
          base: business.supportedTokens?.base?.filter(t => t.isActive && t.isTradingEnabled)?.length || 0,
          solana: business.supportedTokens?.solana?.filter(t => t.isActive && t.isTradingEnabled)?.length || 0,
          ethereum: business.supportedTokens?.ethereum?.filter(t => t.isActive && t.isTradingEnabled)?.length || 0
        },
        averageFees: {
          base: business.feeConfiguration?.base?.length > 0 
            ? (business.feeConfiguration.base.reduce((sum, f) => sum + f.feePercentage, 0) / business.feeConfiguration.base.length).toFixed(2)
            : 0,
          solana: business.feeConfiguration?.solana?.length > 0
            ? (business.feeConfiguration.solana.reduce((sum, f) => sum + f.feePercentage, 0) / business.feeConfiguration.solana.length).toFixed(2)
            : 0,
          ethereum: business.feeConfiguration?.ethereum?.length > 0
            ? (business.feeConfiguration.ethereum.reduce((sum, f) => sum + f.feePercentage, 0) / business.feeConfiguration.ethereum.length).toFixed(2)
            : 0
        },
        walletConfigured: {
          solana: !!business.paymentWallets?.solana,
          base: !!business.paymentWallets?.base,
          ethereum: !!business.paymentWallets?.ethereum
        },
        bankAccountConfigured: !!business.bankAccount?.accountNumber
      };

      res.json({
        success: true,
        data: {
          businessInfo: {
            businessId: business.businessId,
            businessName: business.businessName
          },
          summary,
          supportedTokens: business.supportedTokens || { base: [], solana: [], ethereum: [] },
          feeConfiguration: business.feeConfiguration || { base: [], solana: [], ethereum: [] },
          paymentWallets: business.paymentWallets || { solana: null, base: null, ethereum: null },
          bankAccount: business.bankAccount || null,
          lastUpdated: business.supportedTokensUpdatedAt || business.updatedAt,
          defaultTokensInfo: {
            description: 'Your business comes with default supported tokens (ETH, SOL, USDC, USDT) with 0% default fees. You can customize their fees and add more tokens.',
            feeCustomization: 'Fees for both default and custom tokens can be adjusted from 0% to 10%',
            defaultTokenProtection: 'Default tokens cannot be deleted, only disabled by setting isActive to false'
          }
        }
      });

    } catch (error) {
      console.error('Get payment configuration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

module.exports = businessTokenController;