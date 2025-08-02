/**
 * FIXED Solana Onramp Price Checker Service
 * Uses Jupiter API v6 for token price discovery and routing on Solana
 * Fixed SOL token handling and API endpoints
 */

const fetch = require('node-fetch');
const { SOLANA_CONFIG } = require('../config/solanaConfig');

class SolanaTokenPriceChecker {
    constructor() {
        console.log('🚀 Initializing FIXED Solana Token Price Checker with Jupiter v6...');
        console.log(`📍 Jupiter API: ${SOLANA_CONFIG.jupiterApi}`);
        console.log(`🌐 RPC URL: ${SOLANA_CONFIG.rpc}`);
        console.log(`🪙 Correct SOL address: ${SOLANA_CONFIG.TOKENS.SOL}`);
        console.log('✅ Solana Price Checker initialized');
    }

    async validateConnection() {
        try {
            console.log('🔍 Validating Jupiter API v6 connection...');
            
            // Test Jupiter API v6 with a simple SOL to USDC quote using CORRECT SOL address
            const testUrl = `${SOLANA_CONFIG.jupiterApi}/quote?inputMint=${SOLANA_CONFIG.TOKENS.SOL}&outputMint=${SOLANA_CONFIG.TOKENS.USDC}&amount=1000000000&slippageBps=50`;
            
            console.log(`🔗 Test URL: ${testUrl}`);
            
            const response = await fetch(testUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'OnrampService/1.0'
                },
                timeout: 10000
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Jupiter API v6 connection validated');
                console.log(`🎯 Test quote result: ${data.outAmount ? 'Success' : 'No data'}`);
                return true;
            } else {
                const errorText = await response.text();
                console.error(`❌ Jupiter API error: ${response.status} - ${errorText}`);
                throw new Error(`Jupiter API responded with status: ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Jupiter API connection validation failed:', error.message);
            return false;
        }
    }

    /**
     * FIXED: Get token info from Jupiter's token list or known tokens
     */
    async getTokenInfo(tokenAddress) {
        try {
            // Check if it's a known token first
            const knownToken = Object.entries(SOLANA_CONFIG.TOKENS).find(
                ([symbol, address]) => address === tokenAddress
            );
            
            if (knownToken) {
                const [symbol] = knownToken;
                return {
                    symbol: symbol,
                    name: this.getTokenName(symbol),
                    decimals: SOLANA_CONFIG.DECIMALS[symbol] || 6,
                    address: tokenAddress,
                    isNative: symbol === 'SOL'
                };
            }
            
            // For unknown tokens, try to get info from a token registry or use defaults
            console.log(`🔍 Unknown token: ${tokenAddress}, using default structure`);
            
            return {
                symbol: 'UNKNOWN',
                name: 'Unknown Token',
                decimals: 6, // Default decimals for SPL tokens
                address: tokenAddress,
                isNative: false
            };
        } catch (error) {
            throw new Error(`Failed to get Solana token info: ${error.message}`);
        }
    }

    getTokenName(symbol) {
        const names = {
            SOL: 'Solana',
            USDC: 'USD Coin',
            USDT: 'Tether USD',
            JUP: 'Jupiter',
            BONK: 'Bonk',
            RAY: 'Raydium',
            ORCA: 'Orca'
        };
        return names[symbol] || symbol;
    }

    /**
     * FIXED: Get Jupiter v6 quote for token to USDC conversion
     */
    async getJupiterQuote(inputToken, outputToken, amount, options = {}) {
        try {
            const { 
                slippageBps = 50, // 0.5% slippage
                verbose = true 
            } = options;

            const tokenInfo = await this.getTokenInfo(inputToken);
            const amountInSmallestUnit = Math.floor(amount * Math.pow(10, tokenInfo.decimals));
            
            // FIXED: Use Jupiter v6 API format
            const url = `${SOLANA_CONFIG.jupiterApi}/quote?inputMint=${inputToken}&outputMint=${outputToken}&amount=${amountInSmallestUnit}&slippageBps=${slippageBps}&onlyDirectRoutes=false&asLegacyTransaction=false`;
            
            if (verbose) {
                console.log(`📊 Getting Jupiter v6 quote: ${amount} ${tokenInfo.symbol} → USDC`);
                console.log(`🔗 Query URL: ${url}`);
            }
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'OnrampService/1.0'
                },
                timeout: 10000
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ Jupiter API v6 error: ${response.status} - ${errorText}`);
                throw new Error(`Jupiter API error: ${response.status} - ${errorText}`);
            }
            
            const quote = await response.json();
            
            if (!quote.outAmount) {
                throw new Error('No quote returned from Jupiter API');
            }
            
            // Calculate output amount in USDC
            const outputDecimals = SOLANA_CONFIG.DECIMALS.USDC;
            const usdcAmount = parseFloat(quote.outAmount) / Math.pow(10, outputDecimals);
            const pricePerToken = usdcAmount / amount;
            
            // FIXED: Handle v6 response format
            const priceImpactPct = quote.priceImpactPct ? parseFloat(quote.priceImpactPct) : 0;
            const routeSteps = quote.routePlan ? quote.routePlan.length : 1;
            const route = quote.routePlan ? 
                quote.routePlan.map(step => step.swapInfo?.label || 'Unknown').join(' → ') : 
                'Direct';
            
            if (verbose) {
                console.log(`✅ Jupiter v6 quote successful:`);
                console.log(`  Input: ${amount} ${tokenInfo.symbol}`);
                console.log(`  Output: ${usdcAmount.toFixed(6)} USDC`);
                console.log(`  Price per token: ${pricePerToken.toFixed(8)}`);
                console.log(`  Price impact: ${priceImpactPct}%`);
                console.log(`  Route steps: ${routeSteps}`);
                console.log(`  Route: ${route}`);
            }
            
            return {
                success: true,
                quote: quote,
                tokenInfo: tokenInfo,
                inputAmount: amount,
                usdcAmount: usdcAmount,
                pricePerToken: pricePerToken,
                priceImpact: priceImpactPct,
                routeSteps: routeSteps,
                route: route,
                hasAdequateLiquidity: usdcAmount >= 1.0, // $1 minimum
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`❌ Jupiter v6 quote failed for ${inputToken}:`, error.message);
            return {
                success: false,
                error: error.message,
                hasAdequateLiquidity: false
            };
        }
    }

    /**
     * FIXED: Get token to USDC price using Jupiter v6
     */
    async getTokenToUSDCPrice(tokenAddress, tokenAmount, options = {}) {
        try {
            const { 
                verbose = true, 
                checkBusinessSupport = true,
                minLiquidityThreshold = 1.0
            } = options;

            if (verbose) {
                console.log('\n💰 FIXED SOLANA ONRAMP PRICE ESTIMATION');
                console.log('═'.repeat(50));
            }
            
            // SPECIAL HANDLING: Make sure we're using the correct SOL address
            let effectiveTokenAddress = tokenAddress;
            if (tokenAddress.toLowerCase() === 'sol' || 
                tokenAddress === '11111111111111111111111111111112') { // Old incorrect address
                effectiveTokenAddress = SOLANA_CONFIG.TOKENS.SOL; // Use correct wrapped SOL
                console.log(`🔄 Converting SOL reference to correct wrapped SOL: ${effectiveTokenAddress}`);
            }
            
            // Get token info
            const tokenInfo = await this.getTokenInfo(effectiveTokenAddress);
            if (verbose) {
                console.log(`🪙 Token: ${tokenInfo.name} (${tokenInfo.symbol})`);
                console.log(`📍 Original Address: ${tokenAddress}`);
                console.log(`📍 Effective Address: ${effectiveTokenAddress}`);
                console.log(`🔢 Amount: ${tokenAmount} ${tokenInfo.symbol}`);
            }
            
            // Get Jupiter quote for token → USDC using CORRECT address
            const quoteResult = await this.getJupiterQuote(
                effectiveTokenAddress, 
                SOLANA_CONFIG.TOKENS.USDC, 
                tokenAmount, 
                { verbose: verbose }
            );
            
            if (!quoteResult.success) {
                if (verbose) {
                    console.log('\n❌ NO PRICE FOUND');
                    console.log('═'.repeat(30));
                    console.log('No liquidity available for this token on Solana DEXs');
                    console.log(`Error: ${quoteResult.error}`);
                }
                
                return {
                    success: false,
                    error: quoteResult.error,
                    tokenInfo: tokenInfo,
                    canProcessOnramp: false
                };
            }
            
            const hasAdequatePoolLiquidity = quoteResult.usdcAmount >= minLiquidityThreshold;
            
            if (verbose) {
                console.log('\n🏆 PRICE ESTIMATION RESULT');
                console.log('═'.repeat(40));
                console.log(`🎯 ${tokenAmount} ${tokenInfo.symbol} = ${quoteResult.usdcAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})} USDC`);
                console.log(`💎 Price per ${tokenInfo.symbol}: ${quoteResult.pricePerToken.toFixed(8)}`);
                console.log(`🛣️  Best route: ${quoteResult.route}`);
                console.log(`📈 Price impact: ${quoteResult.priceImpact.toFixed(3)}%`);
                console.log(`💧 Adequate liquidity: ${hasAdequatePoolLiquidity ? 'YES' : 'NO'} (>${minLiquidityThreshold})`);
                console.log(`⚡ Network: Solana Mainnet`);
                console.log(`🕐 Timestamp: ${new Date().toLocaleString()}`);
            }
            
            return {
                success: true,
                tokenInfo: tokenInfo,
                inputAmount: tokenAmount,
                usdcValue: quoteResult.usdcAmount,
                pricePerToken: quoteResult.pricePerToken,
                bestRoute: quoteResult.route,
                priceImpact: quoteResult.priceImpact,
                routeSteps: quoteResult.routeSteps,
                hasAdequatePoolLiquidity: hasAdequatePoolLiquidity,
                canProcessOnramp: hasAdequatePoolLiquidity,
                jupiterQuote: quoteResult.quote, // Store for potential swap execution
                timestamp: new Date().toISOString(),
                network: 'solana',
                usdcAddress: SOLANA_CONFIG.TOKENS.USDC,
                poolLiquidityInfo: {
                    estimatedLiquidity: quoteResult.usdcAmount,
                    priceImpact: quoteResult.priceImpact,
                    route: quoteResult.route
                }
            };
            
        } catch (error) {
            console.error('❌ Error in Solana price estimation:', error.message);
            return {
                success: false,
                error: error.message,
                canProcessOnramp: false
            };
        }
    }

    /**
     * Validate if token is supported for onramp on Solana
     */
    async validateTokenForOnramp(tokenAddress, tokenAmount, options = {}) {
        console.log('\n🔍 VALIDATING SOLANA TOKEN FOR ONRAMP');
        console.log('═'.repeat(50));
        
        const priceResult = await this.getTokenToUSDCPrice(tokenAddress, tokenAmount, {
            verbose: true,
            minLiquidityThreshold: options.minLiquidityThreshold || 1.0
        });
        
        if (priceResult.success && priceResult.canProcessOnramp) {
            console.log('\n✅ SOLANA TOKEN VALIDATION PASSED');
            console.log('═'.repeat(30));
            console.log('✅ Token has liquidity on Jupiter');
            console.log('✅ Price impact acceptable');
            console.log('✅ Ready for onramp processing');
            
            return {
                valid: true,
                priceData: priceResult,
                recommendation: 'PROCEED_WITH_ONRAMP'
            };
        } else {
            console.log('\n❌ SOLANA TOKEN VALIDATION FAILED');
            console.log('═'.repeat(30));
            
            if (!priceResult.success) {
                console.log('❌ No liquidity available on Solana DEXs');
            }
            if (priceResult.hasAdequatePoolLiquidity === false) {
                console.log('❌ Insufficient liquidity for onramp');
            }
            
            return {
                valid: false,
                priceData: priceResult,
                recommendation: 'REJECT_ONRAMP'
            };
        }
    }

    /**
     * Get quick price check for a token
     */
    async getQuickPrice(tokenAddress, amount) {
        try {
            return await this.getTokenToUSDCPrice(tokenAddress, amount, {
                verbose: false,
                minLiquidityThreshold: 0.5
            });
        } catch (error) {
            console.error(`❌ Quick price check failed for ${tokenAddress}:`, error.message);
            return {
                success: false,
                error: error.message,
                canProcessOnramp: false
            };
        }
    }

    /**
     * Check multiple tokens for support
     */
    async checkMultipleTokenSupport(tokenAddresses) {
        try {
            console.log(`🔍 Checking Jupiter support for ${tokenAddresses.length} tokens...`);
            
            const results = [];
            
            for (const tokenAddress of tokenAddresses) {
                try {
                    const priceResult = await this.getQuickPrice(tokenAddress, 1);
                    results.push({
                        tokenAddress,
                        supported: priceResult.success,
                        hasLiquidity: priceResult.hasAdequatePoolLiquidity,
                        error: priceResult.error
                    });
                } catch (error) {
                    results.push({
                        tokenAddress,
                        supported: false,
                        hasLiquidity: false,
                        error: error.message
                    });
                }
            }
            
            return results;
        } catch (error) {
            console.error('❌ Error checking multiple token support:', error.message);
            return tokenAddresses.map(addr => ({
                tokenAddress: addr,
                supported: false,
                hasLiquidity: false,
                error: error.message
            }));
        }
    }

    /**
     * Get supported tokens from Jupiter
     */
    async getSupportedTokens() {
        try {
            console.log('🔍 Fetching supported tokens from Jupiter...');
            
            // Jupiter provides a token list endpoint
            const response = await fetch('https://token.jup.ag/strict', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'OnrampService/1.0'
                },
                timeout: 15000
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch Jupiter token list: ${response.status}`);
            }
            
            const tokens = await response.json();
            
            console.log(`✅ Retrieved ${tokens.length} supported tokens from Jupiter`);
            
            return {
                success: true,
                tokens: tokens,
                count: tokens.length,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Error fetching supported tokens:', error.message);
            return {
                success: false,
                error: error.message,
                tokens: [],
                count: 0
            };
        }
    }

    /**
     * Health check for Jupiter API
     */
    async healthCheck() {
        try {
            console.log('🔍 Performing Jupiter API health check...');
            
            const connectionValid = await this.validateConnection();
            
            // Test a few basic operations
            const testResults = {
                connection: connectionValid,
                basicQuote: false,
                tokenList: false
            };
            
            if (connectionValid) {
                // Test basic SOL to USDC quote using CORRECT SOL address
                try {
                    const basicQuote = await this.getQuickPrice(SOLANA_CONFIG.TOKENS.SOL, 1);
                    testResults.basicQuote = basicQuote.success;
                } catch (error) {
                    console.warn('❌ Basic quote test failed:', error.message);
                }
                
                // Test token list retrieval
                try {
                    const tokenList = await this.getSupportedTokens();
                    testResults.tokenList = tokenList.success;
                } catch (error) {
                    console.warn('❌ Token list test failed:', error.message);
                }
            }
            
            const healthScore = Object.values(testResults).filter(Boolean).length;
            const isHealthy = healthScore >= 2; // At least connection + one other test
            
            console.log(`🏥 Jupiter API health: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'} (${healthScore}/3 tests passed)`);
            
            return {
                healthy: isHealthy,
                score: healthScore,
                maxScore: 3,
                tests: testResults,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Health check failed:', error.message);
            return {
                healthy: false,
                score: 0,
                maxScore: 3,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = { SolanaTokenPriceChecker };