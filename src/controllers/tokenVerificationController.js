const bcrypt = require('bcrypt');
const { Business, ApiKey } = require('../models');
const TokenValidationService = require('../services/tokenValidationService');

class TokenVerificationController {
  // Middleware to authenticate business API keys
  async authenticateBusinessApiKey(req, res, next) {
    try {
      const publicKey = req.headers['x-api-key'];
      const secretKey = req.headers['x-api-secret'];

      if (!publicKey || !secretKey) {
        return res.status(401).json({
          success: false,
          error: 'API key and secret are required. Use X-API-Key and X-API-Secret headers.',
          documentation: 'https://docs.yourapi.com/authentication'
        });
      }

      // Find the API key
      const apiKey = await ApiKey.findOne({ publicKey, isActive: true })
        .populate('businessId')
        .populate('userId');

      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key'
        });
      }

      // Verify secret key
      const isValidSecret = await bcrypt.compare(secretKey, apiKey.secretKey);
      if (!isValidSecret) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API secret'
        });
      }

      // Check if business is active
      if (!apiKey.businessId || apiKey.businessId.status === 'deleted' || apiKey.businessId.status === 'suspended') {
        return res.status(401).json({
          success: false,
          error: 'Business account is not active'
        });
      }

      // Check permissions
      const requiredPermission = 'validate';
      if (!apiKey.permissions.includes(requiredPermission) && !apiKey.permissions.includes('admin')) {
        return res.status(403).json({
          success: false,
          error: `Insufficient permissions. Required: ${requiredPermission}`
        });
      }

      // Update last used timestamp
      apiKey.lastUsedAt = new Date();
      await apiKey.save();

      // Add business and API key info to request
      req.business = {
        id: apiKey.businessId._id,
        businessId: apiKey.businessId.businessId,
        name: apiKey.businessId.businessName,
        status: apiKey.businessId.status
      };

      req.apiKey = {
        id: apiKey._id,
        publicKey: apiKey.publicKey,
        permissions: apiKey.permissions
      };

      next();
    } catch (error) {
      console.error('API key authentication error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication failed'
      });
    }
  }

  // Verify single token and get details
  async verifyToken(req, res) {
    try {
      const { address, network } = req.body;

      // Validation
      if (!address || !network) {
        return res.status(400).json({
          success: false,
          error: 'Token address and network are required',
          example: {
            address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
            network: 'base'
          }
        });
      }

      // Validate network
      const supportedNetworks = ['base', 'ethereum', 'solana', 'base-sepolia', 'solana-devnet'];
      if (!supportedNetworks.includes(network.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported network',
          supportedNetworks
        });
      }

      // Validate token using the service
      const validationResult = await TokenValidationService.validateTokenAddress(address, network);

      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          error: validationResult.error,
          address,
          network,
          timestamp: new Date().toISOString()
        });
      }

      // Check if token is in known token lists
      const tokenListResult = await TokenValidationService.checkTokenLists(address, network);

      // Get additional token metadata if available
      const enhancedTokenInfo = {
        ...validationResult.tokenInfo,
        isVerified: tokenListResult?.isInList || false,
        tokenListInfo: tokenListResult?.isInList ? {
          listName: tokenListResult.listName,
          listTokenInfo: tokenListResult.tokenInfo
        } : null,
        validationTimestamp: new Date().toISOString(),
        validatedBy: {
          businessId: req.business.businessId,
          businessName: req.business.name
        }
      };

      res.json({
        success: true,
        data: {
          address,
          network: network.toLowerCase(),
          isValid: true,
          tokenDetails: enhancedTokenInfo,
          validation: {
            method: network.toLowerCase() === 'solana' || network.toLowerCase() === 'solana-devnet' ? 'SPL' : 'ERC-20',
            timestamp: new Date().toISOString(),
            rpcEndpoint: TokenValidationService.rpcEndpoints[network.toLowerCase()]
          }
        }
      });

    } catch (error) {
      console.error('Token verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during token verification',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Verify multiple tokens in batch
  async verifyTokensBatch(req, res) {
    try {
      const { tokens, network } = req.body;

      // Validation
      if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Tokens array is required and cannot be empty',
          example: {
            tokens: ['0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', '0xfde4c96c8593536e31f229ea441755bf6bb6b9fb'],
            network: 'base'
          }
        });
      }

      if (!network) {
        return res.status(400).json({
          success: false,
          error: 'Network is required'
        });
      }

      // Limit batch size
      if (tokens.length > 20) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 20 tokens can be verified in a single batch request'
        });
      }

      // Validate network
      const supportedNetworks = ['base', 'ethereum', 'solana', 'base-sepolia', 'solana-devnet'];
      if (!supportedNetworks.includes(network.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported network',
          supportedNetworks
        });
      }

      // Process tokens in parallel (with rate limiting)
      const results = await TokenValidationService.validateMultipleAddresses(tokens, network);

      // Enhance results with token list information
      const enhancedResults = await Promise.all(
        results.map(async (result) => {
          if (result.isValid) {
            const tokenListResult = await TokenValidationService.checkTokenLists(result.address, network);
            
            return {
              ...result,
              tokenDetails: {
                ...result.tokenInfo,
                isVerified: tokenListResult?.isInList || false,
                tokenListInfo: tokenListResult?.isInList ? {
                  listName: tokenListResult.listName,
                  listTokenInfo: tokenListResult.tokenInfo
                } : null
              }
            };
          }
          return result;
        })
      );

      // Generate summary
      const summary = {
        total: enhancedResults.length,
        valid: enhancedResults.filter(r => r.isValid).length,
        invalid: enhancedResults.filter(r => !r.isValid).length,
        verified: enhancedResults.filter(r => r.isValid && r.tokenDetails?.isVerified).length
      };

      res.json({
        success: true,
        data: {
          network: network.toLowerCase(),
          summary,
          results: enhancedResults,
          validation: {
            method: network.toLowerCase() === 'solana' || network.toLowerCase() === 'solana-devnet' ? 'SPL' : 'ERC-20',
            timestamp: new Date().toISOString(),
            validatedBy: {
              businessId: req.business.businessId,
              businessName: req.business.name
            }
          }
        }
      });

    } catch (error) {
      console.error('Batch token verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during batch token verification',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get supported networks and validation capabilities
  async getSupportedNetworks(req, res) {
    try {
      const networks = {
        mainnet: {
          base: {
            name: 'Base',
            chainId: 8453,
            rpcEndpoint: TokenValidationService.rpcEndpoints.base,
            tokenStandard: 'ERC-20',
            features: ['token_validation', 'metadata_fetching', 'token_lists']
          },
          ethereum: {
            name: 'Ethereum',
            chainId: 1,
            rpcEndpoint: TokenValidationService.rpcEndpoints.ethereum,
            tokenStandard: 'ERC-20',
            features: ['token_validation', 'metadata_fetching', 'token_lists']
          },
          solana: {
            name: 'Solana',
            rpcEndpoint: TokenValidationService.rpcEndpoints.solana,
            tokenStandard: 'SPL',
            features: ['token_validation', 'metadata_fetching', 'token_lists']
          }
        },
        testnet: {
          'base-sepolia': {
            name: 'Base Sepolia',
            chainId: 84532,
            rpcEndpoint: TokenValidationService.rpcEndpoints['base-sepolia'],
            tokenStandard: 'ERC-20',
            features: ['token_validation']
          },
          'solana-devnet': {
            name: 'Solana Devnet',
            rpcEndpoint: TokenValidationService.rpcEndpoints['solana-devnet'],
            tokenStandard: 'SPL',
            features: ['token_validation']
          }
        }
      };

      res.json({
        success: true,
        data: {
          networks,
          capabilities: {
            maxBatchSize: 20,
            supportedStandards: ['ERC-20', 'SPL'],
            features: [
              'Format validation',
              'Blockchain verification',
              'Metadata retrieval',
              'Token list checking',
              'Batch processing'
            ]
          },
          rateLimit: {
            requestsPerMinute: 60,
            batchLimit: 20
          },
          business: {
            businessId: req.business.businessId,
            businessName: req.business.name,
            permissions: req.apiKey.permissions
          }
        }
      });

    } catch (error) {
      console.error('Get networks error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get validation examples for different networks
  async getValidationExamples(req, res) {
    try {
      const examples = {
        base: {
          network: 'base',
          validTokens: [
            {
              address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
              name: 'USD Coin',
              symbol: 'USDC',
              description: 'USDC on Base network'
            },
            {
              address: '0x4200000000000000000000000000000000000006',
              name: 'Wrapped Ethereum',
              symbol: 'WETH',
              description: 'Wrapped ETH on Base'
            }
          ],
          invalidAddresses: [
            '0x123', // Too short
            'invalid-address', // Invalid format
            '0x0000000000000000000000000000000000000000' // Zero address
          ]
        },
        ethereum: {
          network: 'ethereum',
          validTokens: [
            {
              address: '0xA0b86a33E6441e14d792fE21909f5c578F8F4A52',
              name: 'USD Coin',
              symbol: 'USDC',
              description: 'USDC on Ethereum mainnet'
            }
          ]
        },
        solana: {
          network: 'solana',
          validTokens: [
            {
              address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
              name: 'USD Coin',
              symbol: 'USDC',
              description: 'USDC on Solana'
            },
            {
              address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
              name: 'Tether USD',
              symbol: 'USDT',
              description: 'USDT on Solana'
            }
          ],
          invalidAddresses: [
            'invalid123', // Invalid base58
            '123', // Too short
            'InvalidAddress' // Invalid format
          ]
        }
      };

      res.json({
        success: true,
        data: {
          examples,
          usage: {
            singleValidation: {
              endpoint: 'POST /api/v1/validate/token',
              headers: {
                'X-API-Key': req.apiKey.publicKey,
                'X-API-Secret': '[your-secret-key]',
                'Content-Type': 'application/json'
              },
              body: {
                address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
                network: 'base'
              }
            },
            batchValidation: {
              endpoint: 'POST /api/v1/validate/batch',
              body: {
                tokens: ['0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', '0x4200000000000000000000000000000000000006'],
                network: 'base'
              }
            }
          },
          business: {
            businessId: req.business.businessId,
            businessName: req.business.name
          }
        }
      });

    } catch (error) {
      console.error('Get examples error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = new TokenVerificationController();