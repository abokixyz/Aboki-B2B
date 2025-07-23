// config/defaultTokens.js
const DEFAULT_TOKENS = {
    base: [
      {
        symbol: "ETH",
        name: "Ethereum",
        contractAddress: "0x4200000000000000000000000000000000000006", // WETH on Base
        decimals: 18,
        network: "base",
        type: "ERC-20",
        isActive: true,
        isTradingEnabled: true,
        isDefault: true,
        logoUrl: "https://cryptologos.cc/logos/ethereum-eth-logo.png"
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        contractAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // Native USDC on Base
        decimals: 6,
        network: "base",
        type: "ERC-20",
        isActive: true,
        isTradingEnabled: true,
        isDefault: true,
        logoUrl: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png"
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        contractAddress: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", // USDT on Base
        decimals: 6,
        network: "base",
        type: "ERC-20",
        isActive: true,
        isTradingEnabled: true,
        isDefault: true,
        logoUrl: "https://cryptologos.cc/logos/tether-usdt-logo.png"
      }
    ],
    solana: [
      {
        symbol: "SOL",
        name: "Solana",
        contractAddress: "11111111111111111111111111111112", // System Program (native SOL)
        decimals: 9,
        network: "solana",
        type: "Native",
        isActive: true,
        isTradingEnabled: true,
        isDefault: true,
        logoUrl: "https://cryptologos.cc/logos/solana-sol-logo.png"
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        contractAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC on Solana
        decimals: 6,
        network: "solana",
        type: "SPL",
        isActive: true,
        isTradingEnabled: true,
        isDefault: true,
        logoUrl: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png"
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        contractAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT on Solana
        decimals: 6,
        network: "solana",
        type: "SPL",
        isActive: true,
        isTradingEnabled: true,
        isDefault: true,
        logoUrl: "https://cryptologos.cc/logos/tether-usdt-logo.png"
      }
    ],
    ethereum: [
      {
        symbol: "ETH",
        name: "Ethereum",
        contractAddress: "0x0000000000000000000000000000000000000000", // Native ETH
        decimals: 18,
        network: "ethereum",
        type: "Native",
        isActive: true,
        isTradingEnabled: true,
        isDefault: true,
        logoUrl: "https://cryptologos.cc/logos/ethereum-eth-logo.png"
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        contractAddress: "0xA0b86a33E6441951c6A8EE97B2b0f42A9c38f0Ac", // USDC on Ethereum
        decimals: 6,
        network: "ethereum",
        type: "ERC-20",
        isActive: true,
        isTradingEnabled: true,
        isDefault: true,
        logoUrl: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png"
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        contractAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT on Ethereum
        decimals: 6,
        network: "ethereum",
        type: "ERC-20",
        isActive: true,
        isTradingEnabled: true,
        isDefault: true,
        logoUrl: "https://cryptologos.cc/logos/tether-usdt-logo.png"
      }
    ]
  };
  
  // Helper function to get default tokens for a specific network
  const getDefaultTokensForNetwork = (network) => {
    return DEFAULT_TOKENS[network] || [];
  };
  
  // Helper function to check if a token is a default token
  const isDefaultToken = (contractAddress, network) => {
    const networkTokens = DEFAULT_TOKENS[network] || [];
    return networkTokens.some(token => 
      token.contractAddress.toLowerCase() === contractAddress.toLowerCase()
    );
  };
  
  // Helper function to get all default token addresses
  const getAllDefaultTokenAddresses = () => {
    const addresses = {};
    Object.keys(DEFAULT_TOKENS).forEach(network => {
      addresses[network] = DEFAULT_TOKENS[network].map(token => token.contractAddress);
    });
    return addresses;
  };
  
  // Helper function to get default token count
  const getDefaultTokenCount = () => {
    const count = {};
    Object.keys(DEFAULT_TOKENS).forEach(network => {
      count[network] = DEFAULT_TOKENS[network].length;
    });
    count.total = Object.values(count).reduce((sum, val) => sum + val, 0);
    return count;
  };
  
  module.exports = {
    DEFAULT_TOKENS,
    getDefaultTokensForNetwork,
    isDefaultToken,
    getAllDefaultTokenAddresses,
    getDefaultTokenCount
  };