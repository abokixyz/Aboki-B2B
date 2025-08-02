/**
 * FIXED Default Tokens Configuration
 * Added proper Solana default tokens including SOL, USDC, USDT
 */

const DEFAULT_TOKENS = {
  // Base Network tokens
  base: [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      contractAddress: '0x4200000000000000000000000000000000000006', // WETH on Base
      decimals: 18,
      network: 'base',
      type: 'native',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true,
      logoUrl: 'https://ethereum.org/static/6b935ac0e6194247347855dc3d328e83/81d9f/eth-diamond-colored.webp'
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
      decimals: 6,
      network: 'base',
      type: 'stablecoin',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true,
      logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      contractAddress: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', // USDT on Base
      decimals: 6,
      network: 'base',
      type: 'stablecoin',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true,
      logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
    }
  ],
  
  // FIXED: Solana Network tokens with correct addresses
  solana: [
    {
      symbol: 'SOL',
      name: 'Solana',
      contractAddress: 'So11111111111111111111111111111111111111112', // CORRECT wrapped SOL
      decimals: 9,
      network: 'solana',
      type: 'native',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true,
      logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on Solana
      decimals: 6,
      network: 'solana',
      type: 'stablecoin',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true,
      logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT on Solana
      decimals: 6,
      network: 'solana',
      type: 'stablecoin',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true,
      logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png'
    },
    {
      symbol: 'JUP',
      name: 'Jupiter',
      contractAddress: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      decimals: 6,
      network: 'solana',
      type: 'governance',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true,
      logoUrl: 'https://static.jup.ag/jup/icon.png'
    },
    {
      symbol: 'RAY',
      name: 'Raydium',
      contractAddress: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
      decimals: 6,
      network: 'solana',
      type: 'defi',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true,
      logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png'
    }
  ],
  
  // Ethereum Network tokens (if needed)
  ethereum: [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      contractAddress: '0x0000000000000000000000000000000000000000', // Native ETH
      decimals: 18,
      network: 'ethereum',
      type: 'native',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true,
      logoUrl: 'https://ethereum.org/static/6b935ac0e6194247347855dc3d328e83/81d9f/eth-diamond-colored.webp'
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      contractAddress: '0xA0b86a33E6441D33F7B77966f74dA712f5bFe1D5', // USDC on Ethereum
      decimals: 6,
      network: 'ethereum',
      type: 'stablecoin',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true,
      logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT on Ethereum
      decimals: 6,
      network: 'ethereum',
      type: 'stablecoin',
      isActive: true,
      isTradingEnabled: true,
      isDefault: true,
      logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
    }
  ]
};

module.exports = { DEFAULT_TOKENS };