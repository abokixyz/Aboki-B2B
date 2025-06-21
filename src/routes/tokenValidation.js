const express = require('express');
const router = express.Router();
const tokenValidationService = require('../services/tokenValidationService');

// Middleware to verify JWT token (optional for validation routes)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  const jwt = require('jsonwebtoken');
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};

// POST /validate/address - Validate a single token address
router.post('/address', async (req, res) => {
  try {
    const { address, network } = req.body;

    // Validation
    if (!address || !network) {
      return res.status(400).json({
        success: false,
        message: 'Token address and network are required',
        example: {
          address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          network: 'base'
        }
      });
    }

    // Validate the token address
    const validationResult = await tokenValidationService.validateTokenAddress(address, network);

    // Also check if token is in known token lists
    const tokenListCheck = await tokenValidationService.checkTokenLists(address, network);

    const response = {
      success: true,
      data: {
        address,
        network,
        validation: validationResult,
        tokenList: tokenListCheck,
        validatedAt: new Date().toISOString()
      }
    };

    // Set appropriate status code
    const statusCode = validationResult.isValid ? 200 : 400;
    
    res.status(statusCode).json(response);

  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during token validation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /validate/batch - Validate multiple token addresses
router.post('/batch', async (req, res) => {
  try {
    const { addresses, network } = req.body;

    // Validation
    if (!addresses || !Array.isArray(addresses) || !network) {
      return res.status(400).json({
        success: false,
        message: 'Addresses array and network are required',
        example: {
          addresses: [
            '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
            '0xfde4c96c8593536e31f229ea441755bf6bb6b9fb'
          ],
          network: 'base'
        }
      });
    }

    if (addresses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one address is required'
      });
    }

    if (addresses.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 20 addresses can be validated at once'
      });
    }

    // Validate all addresses
    const validationResults = await tokenValidationService.validateMultipleAddresses(addresses, network);

    // Count valid/invalid tokens
    const summary = {
      total: validationResults.length,
      valid: validationResults.filter(r => r.isValid).length,
      invalid: validationResults.filter(r => !r.isValid).length
    };

    res.json({
      success: true,
      data: {
        network,
        results: validationResults,
        summary,
        validatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Batch validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during batch validation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /validate/format/:network/:address - Quick format validation (no blockchain call)
router.get('/format/:network/:address', (req, res) => {
  try {
    const { network, address } = req.params;

    let isValidFormat = false;
    let addressType = 'unknown';

    if (network.toLowerCase() === 'base' || network.toLowerCase() === 'ethereum') {
      isValidFormat = tokenValidationService.isValidEthereumAddress(address);
      addressType = 'ethereum-compatible';
    } else if (network.toLowerCase() === 'solana') {
      isValidFormat = tokenValidationService.isValidSolanaAddress(address);
      addressType = 'solana';
    }

    res.json({
      success: true,
      data: {
        address,
        network,
        isValidFormat,
        addressType,
        checkedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Format validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during format validation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /validate/custom-token - Validate and potentially add custom token (requires auth)
router.post('/custom-token', authenticateToken, async (req, res) => {
  try {
    const { address, network, description } = req.body;
    const userId = req.user.id;

    // Validation
    if (!address || !network) {
      return res.status(400).json({
        success: false,
        message: 'Token address and network are required'
      });
    }

    // Validate the token
    const validationResult = await tokenValidationService.validateTokenAddress(address, network);

    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Token validation failed',
        validation: validationResult
      });
    }

    // Check token lists
    const tokenListCheck = await tokenValidationService.checkTokenLists(address, network);

    // Here you could save the custom token to database for the user
    // const customToken = await CustomToken.create({
    //   userId,
    //   address,
    //   network,
    //   tokenInfo: validationResult.tokenInfo,
    //   description,
    //   isInKnownList: tokenListCheck?.isInList || false,
    //   addedAt: new Date()
    // });

    res.json({
      success: true,
      message: 'Custom token validated successfully',
      data: {
        address,
        network,
        validation: validationResult,
        tokenList: tokenListCheck,
        description,
        addedBy: userId,
        addedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Custom token validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during custom token validation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /validate/networks - Get supported networks and their details
router.get('/networks', (req, res) => {
  try {
    const supportedNetworks = {
      base: {
        name: 'Base',
        chainId: 8453,
        nativeCurrency: 'ETH',
        addressFormat: 'ethereum',
        explorerUrl: 'https://basescan.org',
        rpcUrl: 'https://mainnet.base.org',
        tokenStandard: 'ERC-20'
      },
      ethereum: {
        name: 'Ethereum',
        chainId: 1,
        nativeCurrency: 'ETH',
        addressFormat: 'ethereum',
        explorerUrl: 'https://etherscan.io',
        rpcUrl: 'https://eth.llamarpc.com',
        tokenStandard: 'ERC-20'
      },
      solana: {
        name: 'Solana',
        chainId: null,
        nativeCurrency: 'SOL',
        addressFormat: 'base58',
        explorerUrl: 'https://solscan.io',
        rpcUrl: 'https://api.mainnet-beta.solana.com',
        tokenStandard: 'SPL'
      },
      'base-sepolia': {
        name: 'Base Sepolia (Testnet)',
        chainId: 84532,
        nativeCurrency: 'ETH',
        addressFormat: 'ethereum',
        explorerUrl: 'https://sepolia.basescan.org',
        rpcUrl: 'https://sepolia.base.org',
        tokenStandard: 'ERC-20'
      },
      'solana-devnet': {
        name: 'Solana Devnet',
        chainId: null,
        nativeCurrency: 'SOL',
        addressFormat: 'base58',
        explorerUrl: 'https://solscan.io',
        rpcUrl: 'https://api.devnet.solana.com',
        tokenStandard: 'SPL'
      }
    };

    res.json({
      success: true,
      data: {
        supportedNetworks,
        totalNetworks: Object.keys(supportedNetworks).length,
        mainnetNetworks: ['base', 'ethereum', 'solana'],
        testnetNetworks: ['base-sepolia', 'solana-devnet']
      }
    });

  } catch (error) {
    console.error('Get networks error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /validate/examples - Get example token addresses for testing
router.get('/examples', (req, res) => {
  try {
    const examples = {
      base: {
        valid: [
          {
            address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
            name: 'USD Coin',
            symbol: 'USDC'
          },
          {
            address: '0xfde4c96c8593536e31f229ea441755bf6bb6b9fb',
            name: 'Tether USD',
            symbol: 'USDT'
          },
          {
            address: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
            name: 'Dai Stablecoin',
            symbol: 'DAI'
          }
        ],
        invalid: [
          '0x1234567890123456789012345678901234567890', // Invalid checksum
          '0x123', // Too short
          'not-an-address' // Invalid format
        ]
      },
      solana: {
        valid: [
          {
            address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            name: 'USD Coin',
            symbol: 'USDC'
          },
          {
            address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
            name: 'Tether USD',
            symbol: 'USDT'
          },
          {
            address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
            name: 'Bonk',
            symbol: 'BONK'
          }
        ],
        invalid: [
          '11111111111111111111111111111111', // System program (not a token)
          'InvalidAddress123', // Invalid format
          'abcd' // Too short
        ]
      }
    };

    res.json({
      success: true,
      data: examples,
      usage: {
        testValidation: 'Use these addresses to test the validation endpoints',
        validAddresses: 'Should return isValid: true with token metadata',
        invalidAddresses: 'Should return isValid: false with error messages'
      }
    });

  } catch (error) {
    console.error('Get examples error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;