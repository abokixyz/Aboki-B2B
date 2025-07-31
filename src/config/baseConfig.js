/**
 * Base Network Configuration
 * Contains all network-specific settings and contract addresses
 */

const BASE_CONFIG = {
    name: 'Base Mainnet',
    rpc: process.env.RPC_URL || process.env.ETH_RPC_URL || 'https://mainnet.base.org',
    chainId: 8453,
    
    // Your reserve contract
    ABOKI_V2_CONTRACT: "0x37588aD0e6ccf52a8f7DEe694f803E722FEFb390",
    
    // Core tokens
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    ETH: "0x0000000000000000000000000000000000000000", // Native ETH
    
    // DEX infrastructure (Same as your working DexTester)
    V2_ROUTER: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24",
    V3_QUOTER: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
    
    // Fee tiers for V3
    V3_FEES: [100, 500, 3000, 10000],
    
    // Common Base tokens for testing
    COMMON_TOKENS: {
        "WETH": "0x4200000000000000000000000000000000000006",
        "USDC": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "DAI": "0x50c5725949a6f0c72e6c4a641f24049a917db0cb",
        "USDT": "0xfde4c96c8593536e31f229ea441fcf1f96242775",
        "CBETH": "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22",
        "PRIME": "0xfa980ced6895ac314e7de34ef1bfae90a5add21b",
        "FAIR": "0x7D928816CC9c462DD7adef911De41535E444CB07"
    },
    
    // Price validation settings
    PRICE_SETTINGS: {
        MIN_LIQUIDITY_THRESHOLD: 100, // Minimum $100 USDC equivalent
        QUOTE_VALID_FOR_SECONDS: 300, // 5 minutes
        MAX_PRICE_IMPACT: 5, // 5% max price impact
        DEFAULT_SLIPPAGE: 0.5 // 0.5% default slippage
    },
    
    // RPC settings
    RPC_SETTINGS: {
        TIMEOUT: 10000, // 10 second timeout
        RETRY_COUNT: 3,
        RETRY_DELAY: 1000 // 1 second delay between retries
    }
};

module.exports = { BASE_CONFIG };