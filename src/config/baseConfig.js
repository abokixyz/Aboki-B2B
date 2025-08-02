/**
 * Base Network Configuration
 * Contains all network-specific settings and contract addresses
 * UPDATED: Enhanced ETH support and consistency fixes
 */

const BASE_CONFIG = {
    name: 'Base Mainnet',
    rpc: process.env.RPC_URL || process.env.ETH_RPC_URL || 'https://mainnet.base.org',
    chainId: 8453,
    
    // Your reserve contract
    ABOKI_V2_CONTRACT: "0x37588aD0e6ccf52a8f7DEe694f803E722FEFb390",
    
    // Core tokens - FIXED: Better ETH handling
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    ETH: "0x0000000000000000000000000000000000000000", // Native ETH placeholder
    
    // DEX infrastructure (Same as your working DexTester)
    V2_ROUTER: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24",
    V3_ROUTER: "0x2626664c2603336E57B271c5C0b26F421741e481", // ADDED: Missing V3 Router
    V3_QUOTER: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
    
    // Fee tiers for V3
    V3_FEES: [100, 500, 3000, 10000],
    
    // Common Base tokens for testing - ENHANCED: Added ETH variants
    COMMON_TOKENS: {
        "ETH": "0x4200000000000000000000000000000000000006",     // ETH maps to WETH for pricing
        "WETH": "0x4200000000000000000000000000000000000006",
        "USDC": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "DAI": "0x50c5725949a6f0c72e6c4a641f24049a917db0cb",
        "USDT": "0xfde4c96c8593536e31f229ea441fcf1f96242775",
        "CBETH": "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22",
        "PRIME": "0xfa980ced6895ac314e7de34ef1bfae90a5add21b",
        "FAIR": "0x7D928816CC9c462DD7adef911De41535E444CB07"
    },
    
    // NEW: ETH handling configuration
    ETH_CONFIG: {
        NATIVE_ADDRESS: "0x0000000000000000000000000000000000000000",
        WRAPPED_ADDRESS: "0x4200000000000000000000000000000000000006",
        SYMBOLS: ["ETH", "WETH"],
        IS_NATIVE_SUPPORTED: true, // Your contract can handle native ETH
        USE_WETH_FOR_PRICING: true // Use WETH address for price queries
    },
    
    // Price validation settings
    PRICE_SETTINGS: {
        MIN_LIQUIDITY_THRESHOLD: 100, // Minimum $100 USDC equivalent
        QUOTE_VALID_FOR_SECONDS: 300, // 5 minutes
        MAX_PRICE_IMPACT: 5, // 5% max price impact
        DEFAULT_SLIPPAGE: 0.5, // 0.5% default slippage
        MIN_TRANSACTION_VALUE_USD: 1.0 // Minimum $1 USD transaction
    },
    
    // RPC settings
    RPC_SETTINGS: {
        TIMEOUT: 10000, // 10 second timeout
        RETRY_COUNT: 3,
        RETRY_DELAY: 1000 // 1 second delay between retries
    },
    
    // NEW: Helper functions for ETH handling
    HELPERS: {
        /**
         * Check if a token is ETH (native or wrapped)
         */
        isETH: function(tokenSymbol, tokenAddress) {
            if (!tokenSymbol && !tokenAddress) return false;
            
            // Check by symbol
            if (tokenSymbol) {
                return this.ETH_CONFIG.SYMBOLS.includes(tokenSymbol.toUpperCase());
            }
            
            // Check by address
            if (tokenAddress) {
                const addr = tokenAddress.toLowerCase();
                return addr === this.ETH_CONFIG.NATIVE_ADDRESS.toLowerCase() ||
                       addr === this.ETH_CONFIG.WRAPPED_ADDRESS.toLowerCase();
            }
            
            return false;
        },
        
        /**
         * Get the effective address for pricing (WETH for ETH)
         */
        getEffectiveAddress: function(tokenSymbol, tokenAddress) {
            if (this.isETH(tokenSymbol, tokenAddress)) {
                return this.ETH_CONFIG.WRAPPED_ADDRESS;
            }
            return tokenAddress;
        },
        
        /**
         * Check if token is natively supported (always true for ETH)
         */
        isNativelySupported: function(tokenSymbol, tokenAddress) {
            if (this.isETH(tokenSymbol, tokenAddress)) {
                return this.ETH_CONFIG.IS_NATIVE_SUPPORTED;
            }
            return null; // Needs contract check for other tokens
        },
        
        /**
         * Get token configuration
         */
        getTokenConfig: function(symbolOrAddress) {
            // Try to find in COMMON_TOKENS by symbol
            if (this.COMMON_TOKENS[symbolOrAddress.toUpperCase()]) {
                return {
                    symbol: symbolOrAddress.toUpperCase(),
                    address: this.COMMON_TOKENS[symbolOrAddress.toUpperCase()],
                    isETH: this.isETH(symbolOrAddress, null)
                };
            }
            
            // Try to find by address
            for (const [symbol, address] of Object.entries(this.COMMON_TOKENS)) {
                if (address.toLowerCase() === symbolOrAddress.toLowerCase()) {
                    return {
                        symbol: symbol,
                        address: address,
                        isETH: this.isETH(symbol, address)
                    };
                }
            }
            
            return null;
        }
    }
};

// Bind helper functions to the config object
Object.keys(BASE_CONFIG.HELPERS).forEach(key => {
    BASE_CONFIG.HELPERS[key] = BASE_CONFIG.HELPERS[key].bind(BASE_CONFIG);
});

module.exports = { BASE_CONFIG };