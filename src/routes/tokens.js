const express = require('express');
const router = express.Router();

// Import models
const { Business } = require('../models');

// Middleware to verify JWT token
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

// Predefined tokens for Base and Solana networks
const AVAILABLE_TOKENS = {
  base: [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      contractAddress: '0x4200000000000000000000000000000000000006',
      decimals: 18,
      network: 'base',
      type: 'native',
      logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      contractAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      decimals: 6,
      network: 'base',
      type: 'erc20',
      logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      contractAddress: '0xfde4c96c8593536e31f229ea441755bf6bb6b9fb',
      decimals: 6,
      network: 'base',
      type: 'erc20',
      logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
    },
    {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      contractAddress: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
      decimals: 18,
      network: 'base',
      type: 'erc20',
      logoUrl: 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png'
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ethereum',
      contractAddress: '0x4200000000000000000000000000000000000006',
      decimals: 18,
      network: 'base',
      type: 'erc20',
      logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
    },
    {
      symbol: 'CBETH',
      name: 'Coinbase Wrapped Staked ETH',
      contractAddress: '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22',
      decimals: 18,
      network: 'base',
      type: 'erc20',
      logoUrl: 'https://assets.coingecko.com/coins/images/27008/large/cbeth.png'
    }
  ],
  solana: [
    {
      symbol: 'SOL',
      name: 'Solana',
      contractAddress: '11111111111111111111111111111111',
      decimals: 9,
      network: 'solana',
      type: 'native',
      logoUrl: 'https://cryptologos.cc/logos/solana-sol-logo.png'
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
      network: 'solana',
      type: 'spl',
      logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      decimals: 6,
      network: 'solana',
      type: 'spl',
      logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
    },
    {
      symbol: 'BONK',
      name: 'Bonk',
      contractAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      decimals: 5,
      network: 'solana',
      type: 'spl',
      logoUrl: 'https://assets.coingecko.com/coins/images/28600/large/bonk.jpg'
    },
    {
      symbol: 'RAY',
      name: 'Raydium',
      contractAddress: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
      decimals: 6,
      network: 'solana',
      type: 'spl',
      logoUrl: 'https://cryptologos.cc/logos/raydium-ray-logo.png'
    },
    {
      symbol: 'ORCA',
      name: 'Orca',
      contractAddress: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
      decimals: 6,
      network: 'solana',
      type: 'spl',
      logoUrl: 'https://assets.coingecko.com/coins/images/17547/large/Orca_Logo.png'
    },
    {
      symbol: 'MNGO',
      name: 'Mango',
      contractAddress: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac',
      decimals: 6,
      network: 'solana',
      type: 'spl',
      logoUrl: 'https://assets.coingecko.com/coins/images/17232/large/mango.png'
    }
  ]
};

// GET /tokens/available - Get all available tokens for Base and Solana
router.get('/available', (req, res) => {
  try {
    const { network } = req.query;

    if (network && !['base', 'solana'].includes(network.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid network. Supported networks: base, solana'
      });
    }

    let tokens = AVAILABLE_TOKENS;
    
    if (network) {
      tokens = { [network.toLowerCase()]: AVAILABLE_TOKENS[network.toLowerCase()] };
    }

    res.json({
      success: true,
      data: {
        networks: Object.keys(tokens),
        tokens,
        totalTokens: {
          base: AVAILABLE_TOKENS.base.length,
          solana: AVAILABLE_TOKENS.solana.length,
          total: AVAILABLE_TOKENS.base.length + AVAILABLE_TOKENS.solana.length
        }
      }
    });

  } catch (error) {
    console.error('Get available tokens error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /tokens/select - Select tokens for business
router.post('/select', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { network, tokens } = req.body;

    // Validation
    if (!network || !tokens || !Array.isArray(tokens)) {
      return res.status(400).json({
        success: false,
        message: 'Network and tokens array are required'
      });
    }

    if (!['base', 'solana'].includes(network.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid network. Supported networks: base, solana'
      });
    }

    if (tokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one token must be selected'
      });
    }

    if (tokens.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 10 tokens can be selected per network'
      });
    }

    // Find business
    const business = await Business.findOne({ ownerId: userId });
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found. Please create a business first.'
      });
    }

    const networkKey = network.toLowerCase();
    const availableTokens = AVAILABLE_TOKENS[networkKey];
    
    // Validate selected tokens
    const validTokens = [];
    const invalidTokens = [];

    for (const tokenSymbol of tokens) {
      const token = availableTokens.find(t => t.symbol.toLowerCase() === tokenSymbol.toLowerCase());
      if (token) {
        validTokens.push(token);
      } else {
        invalidTokens.push(tokenSymbol);
      }
    }

    if (invalidTokens.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid tokens for ${network}: ${invalidTokens.join(', ')}`,
        availableTokens: availableTokens.map(t => t.symbol)
      });
    }

    // Update business supported tokens
    if (!business.supportedTokens) {
      business.supportedTokens = { base: [], solana: [] };
    }

    business.supportedTokens[networkKey] = validTokens.map(token => ({
      symbol: token.symbol,
      name: token.name,
      contractAddress: token.contractAddress,
      decimals: token.decimals,
      network: token.network,
      type: token.type,
      logoUrl: token.logoUrl,
      addedAt: new Date()
    }));

    business.updatedAt = new Date();
    await business.save();

    res.json({
      success: true,
      message: `Successfully selected ${validTokens.length} tokens for ${network} network`,
      data: {
        network: networkKey,
        selectedTokens: business.supportedTokens[networkKey],
        totalSelected: business.supportedTokens[networkKey].length
      }
    });

  } catch (error) {
    console.error('Select tokens error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during token selection',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /tokens/selected - Get selected tokens for business
router.get('/selected', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { network } = req.query;

    const business = await Business.findOne({ ownerId: userId });
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    let selectedTokens = business.supportedTokens || { base: [], solana: [] };

    if (network) {
      if (!['base', 'solana'].includes(network.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid network. Supported networks: base, solana'
        });
      }
      selectedTokens = { [network.toLowerCase()]: selectedTokens[network.toLowerCase()] || [] };
    }

    res.json({
      success: true,
      data: {
        businessId: business.businessId,
        businessName: business.businessName,
        selectedTokens,
        summary: {
          base: business.supportedTokens?.base?.length || 0,
          solana: business.supportedTokens?.solana?.length || 0,
          total: (business.supportedTokens?.base?.length || 0) + (business.supportedTokens?.solana?.length || 0)
        }
      }
    });

  } catch (error) {
    console.error('Get selected tokens error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /tokens/update - Update selected tokens (add/remove)
router.put('/update', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { network, action, tokens } = req.body;

    // Validation
    if (!network || !action || !tokens || !Array.isArray(tokens)) {
      return res.status(400).json({
        success: false,
        message: 'Network, action, and tokens array are required'
      });
    }

    if (!['base', 'solana'].includes(network.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid network. Supported networks: base, solana'
      });
    }

    if (!['add', 'remove'].includes(action.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Supported actions: add, remove'
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
    const availableTokens = AVAILABLE_TOKENS[networkKey];
    
    if (!business.supportedTokens) {
      business.supportedTokens = { base: [], solana: [] };
    }

    let currentTokens = business.supportedTokens[networkKey] || [];

    if (action.toLowerCase() === 'add') {
      // Add tokens
      const tokensToAdd = [];
      const invalidTokens = [];

      for (const tokenSymbol of tokens) {
        const token = availableTokens.find(t => t.symbol.toLowerCase() === tokenSymbol.toLowerCase());
        const alreadySelected = currentTokens.find(t => t.symbol.toLowerCase() === tokenSymbol.toLowerCase());
        
        if (!token) {
          invalidTokens.push(tokenSymbol);
        } else if (!alreadySelected) {
          tokensToAdd.push({
            symbol: token.symbol,
            name: token.name,
            contractAddress: token.contractAddress,
            decimals: token.decimals,
            network: token.network,
            type: token.type,
            logoUrl: token.logoUrl,
            addedAt: new Date()
          });
        }
      }

      if (invalidTokens.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid tokens: ${invalidTokens.join(', ')}`
        });
      }

      if (currentTokens.length + tokensToAdd.length > 10) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 10 tokens can be selected per network'
        });
      }

      business.supportedTokens[networkKey] = [...currentTokens, ...tokensToAdd];

    } else {
      // Remove tokens
      const tokensToRemove = tokens.map(t => t.toLowerCase());
      business.supportedTokens[networkKey] = currentTokens.filter(
        token => !tokensToRemove.includes(token.symbol.toLowerCase())
      );
    }

    business.updatedAt = new Date();
    await business.save();

    res.json({
      success: true,
      message: `Successfully ${action}ed tokens for ${network} network`,
      data: {
        network: networkKey,
        action: action.toLowerCase(),
        selectedTokens: business.supportedTokens[networkKey],
        totalSelected: business.supportedTokens[networkKey].length
      }
    });

  } catch (error) {
    console.error('Update tokens error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during token update',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /tokens/clear - Clear all selected tokens for a network
router.delete('/clear', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { network } = req.body;

    if (!network) {
      return res.status(400).json({
        success: false,
        message: 'Network is required'
      });
    }

    if (!['base', 'solana'].includes(network.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid network. Supported networks: base, solana'
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
    
    if (!business.supportedTokens) {
      business.supportedTokens = { base: [], solana: [] };
    }

    business.supportedTokens[networkKey] = [];
    business.updatedAt = new Date();
    await business.save();

    res.json({
      success: true,
      message: `Successfully cleared all tokens for ${network} network`,
      data: {
        network: networkKey,
        selectedTokens: business.supportedTokens[networkKey]
      }
    });

  } catch (error) {
    console.error('Clear tokens error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during token clearing',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;