/**
 * FIXED Solana Network Configuration
 * Fixed SOL token address and added proper default tokens
 */

const SOLANA_CONFIG = {
    // Network details
    name: 'Solana Mainnet',
    network: 'mainnet-beta',
    chainId: 101,
    
    // RPC and API endpoints
    rpc: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    jupiterApi: process.env.JUPITER_API_URL || 'https://quote-api.jup.ag/v6',  // Updated to v6
    
    // FIXED: Correct Solana token addresses
    TOKENS: {
        SOL: 'So11111111111111111111111111111111111111112', // CORRECT wrapped SOL address
        USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USD Coin
        USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // Tether USD
        JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',   // Jupiter
        BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // Bonk
        RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',  // Raydium
        ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',  // Orca
        MNGO: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac',  // Mango
        SRM: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',   // Serum
        STEP: 'StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT',  // Step Finance
        COPE: '8HGyAAB1yoM1ttS7pXjHMa3dukTFGQggnFFH3hJZgzQh',  // Cope
        MEDIA: 'ETAtLmCmsoiEEKfNrHKJ2kYy3MoABhU6NQvpSfij5tDs', // Media Network
        ROPE: '8PMHT4swUMtBzgHnh5U564N5sjPSiUz2cjEQzFnnP1Fo',  // Rope Token
        FIDA: 'EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp',  // Bonfida
        KIN: 'kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6',   // Kin
        MAPS: 'MAPS41MDahZ9QdKXhVa4dWB9RuyfV4XqhyAZ8XcYepb'   // Maps
    },
    
    // Token decimals mapping
    DECIMALS: {
        SOL: 9,
        USDC: 6,
        USDT: 6,
        JUP: 6,
        BONK: 5,
        RAY: 6,
        ORCA: 6,
        MNGO: 6,
        SRM: 6,
        STEP: 9,
        COPE: 6,
        MEDIA: 6,
        ROPE: 9,
        FIDA: 6,
        KIN: 5,
        MAPS: 6
    },
    
    // Jupiter API configuration - UPDATED for v6
    JUPITER: {
        baseUrl: 'https://quote-api.jup.ag/v6',
        endpoints: {
            quote: '/quote',
            swap: '/swap',
            tokens: 'https://token.jup.ag/strict' // Token list endpoint
        },
        defaultSlippage: 50, // 0.5% in basis points
        maxSlippage: 300,    // 3% in basis points
        timeouts: {
            quote: 10000,     // 10 seconds
            swap: 30000,      // 30 seconds
            tokenList: 15000  // 15 seconds
        }
    },
    
    // Onramp specific settings
    ONRAMP: {
        minTransactionUsdc: 1.0,     // Minimum $1 USDC
        maxTransactionUsdc: 100000,  // Maximum $100k USDC
        minLiquidityThreshold: 1.0,  // Minimum liquidity for onramp
        maxPriceImpact: 5.0,         // Maximum 5% price impact
        defaultDecimals: 6,          // Default decimals for unknown SPL tokens
        confirmationTime: '30-60 seconds' // Estimated confirmation time
    },
    
    // Common DEX labels (for route display)
    DEX_LABELS: {
        'Orca': 'Orca',
        'Raydium': 'Raydium',
        'Jupiter': 'Jupiter',
        'Serum': 'Serum',
        'Aldrin': 'Aldrin',
        'Crema': 'Crema',
        'Lifinity': 'Lifinity',
        'Mercurial': 'Mercurial',
        'Saber': 'Saber',
        'Step Finance': 'Step',
        'Penguin': 'Penguin',
        'Saros': 'Saros',
        'Invariant': 'Invariant',
        'Meteora': 'Meteora',
        'GooseFX': 'GooseFX'
    },
    
    // Error codes and messages
    ERROR_CODES: {
        NO_LIQUIDITY: 'SOLANA_NO_LIQUIDITY',
        INSUFFICIENT_LIQUIDITY: 'SOLANA_INSUFFICIENT_LIQUIDITY',
        HIGH_PRICE_IMPACT: 'SOLANA_HIGH_PRICE_IMPACT',
        TOKEN_NOT_FOUND: 'SOLANA_TOKEN_NOT_FOUND',
        JUPITER_API_ERROR: 'JUPITER_API_ERROR',
        NETWORK_ERROR: 'SOLANA_NETWORK_ERROR',
        INVALID_TOKEN_ADDRESS: 'INVALID_SOLANA_TOKEN_ADDRESS'
    }
};

// Environment-specific overrides
if (process.env.NODE_ENV === 'development') {
    // Use devnet for development
    SOLANA_CONFIG.network = 'devnet';
    SOLANA_CONFIG.chainId = 103;
    SOLANA_CONFIG.rpc = process.env.SOLANA_DEVNET_RPC || 'https://api.devnet.solana.com';
} else if (process.env.NODE_ENV === 'testing') {
    // Use testnet for testing
    SOLANA_CONFIG.network = 'testnet';
    SOLANA_CONFIG.chainId = 102;
    SOLANA_CONFIG.rpc = process.env.SOLANA_TESTNET_RPC || 'https://api.testnet.solana.com';
}

// Validation function
function validateSolanaConfig() {
    const required = ['rpc', 'jupiterApi'];
    const missing = required.filter(key => !SOLANA_CONFIG[key]);
    
    if (missing.length > 0) {
        throw new Error(`Missing required Solana configuration: ${missing.join(', ')}`);
    }
    
    console.log('✅ Solana configuration validated');
    return true;
}

// Helper functions
const SolanaConfigHelpers = {
    /**
     * Get token info by symbol
     */
    getTokenBySymbol(symbol) {
        const upperSymbol = symbol.toUpperCase();
        const address = SOLANA_CONFIG.TOKENS[upperSymbol];
        const decimals = SOLANA_CONFIG.DECIMALS[upperSymbol];
        
        if (!address) {
            return null;
        }
        
        return {
            symbol: upperSymbol,
            address: address,
            decimals: decimals || SOLANA_CONFIG.ONRAMP.defaultDecimals,
            isNative: upperSymbol === 'SOL'
        };
    },
    
    /**
     * Get token info by address
     */
    getTokenByAddress(address) {
        const entry = Object.entries(SOLANA_CONFIG.TOKENS).find(
            ([symbol, tokenAddress]) => tokenAddress === address
        );
        
        if (!entry) {
            return null;
        }
        
        const [symbol] = entry;
        return this.getTokenBySymbol(symbol);
    },
    
    /**
     * Check if token is native SOL
     */
    isNativeSOL(tokenAddress) {
        return tokenAddress === SOLANA_CONFIG.TOKENS.SOL || 
               tokenAddress.toLowerCase() === 'sol';
    },
    
    /**
     * Get all supported token symbols
     */
    getSupportedTokens() {
        return Object.keys(SOLANA_CONFIG.TOKENS);
    },
    
    /**
     * Format token amount with proper decimals
     */
    formatTokenAmount(amount, tokenAddress) {
        const tokenInfo = this.getTokenByAddress(tokenAddress);
        const decimals = tokenInfo ? tokenInfo.decimals : SOLANA_CONFIG.ONRAMP.defaultDecimals;
        return parseFloat(amount.toFixed(decimals));
    },
    
    /**
     * Convert token amount to smallest unit (lamports/atoms)
     */
    toSmallestUnit(amount, tokenAddress) {
        const tokenInfo = this.getTokenByAddress(tokenAddress);
        const decimals = tokenInfo ? tokenInfo.decimals : SOLANA_CONFIG.ONRAMP.defaultDecimals;
        return Math.floor(amount * Math.pow(10, decimals));
    },
    
    /**
     * Convert from smallest unit to token amount
     */
    fromSmallestUnit(amount, tokenAddress) {
        const tokenInfo = this.getTokenByAddress(tokenAddress);
        const decimals = tokenInfo ? tokenInfo.decimals : SOLANA_CONFIG.ONRAMP.defaultDecimals;
        return parseFloat(amount) / Math.pow(10, decimals);
    },
    
    /**
     * Validate Solana token address format
     */
    isValidTokenAddress(address) {
        // Solana addresses are base58 encoded and typically 32 bytes (44 characters)
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        return base58Regex.test(address);
    },
    
    /**
     * Get DEX name from label
     */
    getDexName(label) {
        return SOLANA_CONFIG.DEX_LABELS[label] || label || 'Unknown DEX';
    }
};

module.exports = {
    SOLANA_CONFIG,
    validateSolanaConfig,
    SolanaConfigHelpers
};