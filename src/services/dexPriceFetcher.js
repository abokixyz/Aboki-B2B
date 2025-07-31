/**
 * DEX Price Fetcher Utility (Optional)
 * Standalone utility for DEX price fetching without reserve validation
 */

const { OnrampPriceChecker } = require('../services/onrampPriceChecker');
const { BASE_CONFIG } = require('../config/baseConfig');

class DexPriceFetcher {
    constructor() {
        this.priceChecker = new OnrampPriceChecker();
        console.log('💱 DEX Price Fetcher initialized');
    }

    /**
     * Get token price in USDC without reserve validation
     * @param {string} tokenAddress - Token contract address
     * @param {number} amount - Token amount
     * @param {object} options - Fetching options
     * @returns {Promise<object>} Price result
     */
    async getPrice(tokenAddress, amount, options = {}) {
        try {
            const {
                verbose = false,
                includeAllRoutes = false
            } = options;

            return await this.priceChecker.getTokenToUSDCPrice(tokenAddress, amount, { 
                verbose,
                checkReserveSupport: false,
                minLiquidityThreshold: 0 // No minimum for pure price fetching
            });
        } catch (error) {
            console.error('❌ DEX price fetch error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get price for multiple tokens
     * @param {Array} tokens - Array of {address, amount} objects
     * @returns {Promise<object>} Price results for all tokens
     */
    async getMultiplePrices(tokens) {
        try {
            console.log(`💱 Fetching prices for ${tokens.length} tokens...`);
            
            const results = {};
            const promises = tokens.map(async (token, index) => {
                try {
                    const price = await this.getPrice(token.address, token.amount, { verbose: false });
                    results[token.address] = {
                        ...price,
                        symbol: token.symbol || 'UNKNOWN',
                        requestedAmount: token.amount
                    };
                } catch (error) {
                    results[token.address] = {
                        success: false,
                        error: error.message,
                        symbol: token.symbol || 'UNKNOWN',
                        requestedAmount: token.amount
                    };
                }
            });

            await Promise.all(promises);

            const successful = Object.values(results).filter(r => r.success).length;
            const failed = tokens.length - successful;

            console.log(`✅ Price fetch complete: ${successful} successful, ${failed} failed`);

            return {
                success: true,
                results,
                summary: {
                    total: tokens.length,
                    successful,
                    failed
                }
            };
        } catch (error) {
            console.error('❌ Multiple price fetch error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get ETH to USDC price
     * @param {number} ethAmount - ETH amount
     * @returns {Promise<number|null>} USDC amount or null
     */
    async getETHPrice(ethAmount = 1) {
        try {
            return await this.priceChecker.getETHToUSDCPrice(ethAmount);
        } catch (error) {
            console.error('❌ ETH price fetch error:', error.message);
            return null;
        }
    }

    /**
     * Compare prices across different routes
     * @param {string} tokenAddress - Token contract address
     * @param {number} amount - Token amount
     * @returns {Promise<object>} Detailed route comparison
     */
    async compareRoutes(tokenAddress, amount) {
        try {
            console.log(`\n💱 COMPARING ROUTES FOR TOKEN`);
            console.log('═'.repeat(50));
            
            const tokenInfo = await this.priceChecker.getTokenInfo(tokenAddress);
            console.log(`🪙 Token: ${tokenInfo.name} (${tokenInfo.symbol})`);
            console.log(`🔢 Amount: ${amount} ${tokenInfo.symbol}`);

            const routes = [];
            const amountIn = require('ethers').utils.parseUnits(amount.toString(), tokenInfo.decimals);

            // Test V3 Direct routes
            console.log('\n🔵 V3 DIRECT ROUTES');
            console.log('─'.repeat(25));
            for (const fee of BASE_CONFIG.V3_FEES) {
                try {
                    const result = await this.priceChecker.quoterV3.callStatic.quoteExactInputSingle({
                        tokenIn: tokenAddress,
                        tokenOut: BASE_CONFIG.USDC,
                        fee: fee,
                        amountIn: amountIn,
                        sqrtPriceLimitX96: 0
                    });

                    const usdcAmount = require('ethers').utils.formatUnits(result.amountOut, 6);
                    const pricePerToken = parseFloat(usdcAmount) / parseFloat(amount);

                    routes.push({
                        type: 'V3_DIRECT',
                        fee: fee,
                        feePercentage: fee / 10000,
                        usdcAmount: parseFloat(usdcAmount),
                        pricePerToken: pricePerToken,
                        gasEstimate: result.gasEstimate?.toString() || 'N/A'
                    });

                    console.log(`  💎 ${fee/10000}% fee: $${parseFloat(usdcAmount).toFixed(6)} (${pricePerToken.toFixed(8)} per token)`);
                } catch (error) {
                    console.log(`  ❌ ${fee/10000}% fee: No liquidity`);
                }
            }

            // Test V2 Direct route
            console.log('\n🟡 V2 DIRECT ROUTE');
            console.log('─'.repeat(20));
            try {
                const path = [tokenAddress, BASE_CONFIG.USDC];
                const amounts = await this.priceChecker.routerV2.callStatic.getAmountsOut(amountIn, path);
                const usdcAmount = require('ethers').utils.formatUnits(amounts[1], 6);
                const pricePerToken = parseFloat(usdcAmount) / parseFloat(amount);

                routes.push({
                    type: 'V2_DIRECT',
                    usdcAmount: parseFloat(usdcAmount),
                    pricePerToken: pricePerToken
                });

                console.log(`  💎 Standard: $${parseFloat(usdcAmount).toFixed(6)} (${pricePerToken.toFixed(8)} per token)`);
            } catch (error) {
                console.log(`  ❌ V2 Direct: No liquidity`);
            }

            // Test V3 Routes via WETH
            console.log('\n🔵 V3 ROUTES VIA WETH');
            console.log('─'.repeat(25));
            for (const fee1 of BASE_CONFIG.V3_FEES) {
                try {
                    // Token -> WETH
                    const ethResult = await this.priceChecker.quoterV3.callStatic.quoteExactInputSingle({
                        tokenIn: tokenAddress,
                        tokenOut: BASE_CONFIG.WETH,
                        fee: fee1,
                        amountIn: amountIn,
                        sqrtPriceLimitX96: 0
                    });

                    // WETH -> USDC
                    const ethAmount = require('ethers').utils.formatEther(ethResult.amountOut);
                    const usdcAmount = await this.getETHPrice(ethAmount);

                    if (usdcAmount) {
                        const pricePerToken = parseFloat(usdcAmount) / parseFloat(amount);

                        routes.push({
                            type: 'V3_VIA_WETH',
                            fee: fee1,
                            feePercentage: fee1 / 10000,
                            usdcAmount: parseFloat(usdcAmount),
                            pricePerToken: pricePerToken,
                            ethIntermediate: parseFloat(ethAmount)
                        });

                        console.log(`  💎 Via ${fee1/10000}% pool: $${parseFloat(usdcAmount).toFixed(6)} (${pricePerToken.toFixed(8)} per token)`);
                    }
                } catch (error) {
                    // Skip failed routes
                    continue;
                }
            }

            // Test V2 Route via WETH
            console.log('\n🟡 V2 ROUTE VIA WETH');
            console.log('─'.repeat(22));
            try {
                const path = [tokenAddress, BASE_CONFIG.WETH, BASE_CONFIG.USDC];
                const amounts = await this.priceChecker.routerV2.callStatic.getAmountsOut(amountIn, path);
                const usdcAmount = require('ethers').utils.formatUnits(amounts[2], 6);
                const pricePerToken = parseFloat(usdcAmount) / parseFloat(amount);

                routes.push({
                    type: 'V2_VIA_WETH',
                    usdcAmount: parseFloat(usdcAmount),
                    pricePerToken: pricePerToken
                });

                console.log(`  💎 Via WETH: $${parseFloat(usdcAmount).toFixed(6)} (${pricePerToken.toFixed(8)} per token)`);
            } catch (error) {
                console.log(`  ❌ V2 via WETH: No liquidity`);
            }

            // Find best route
            const bestRoute = routes.reduce((best, current) => 
                (!best || current.usdcAmount > best.usdcAmount) ? current : best
            , null);

            console.log('\n🏆 ROUTE COMPARISON SUMMARY');
            console.log('═'.repeat(40));
            if (bestRoute) {
                console.log(`🥇 Best Route: ${bestRoute.type}`);
                if (bestRoute.feePercentage) console.log(`   Fee: ${bestRoute.feePercentage}%`);
                console.log(`   Price: $${bestRoute.usdcAmount.toFixed(6)}`);
                console.log(`   Per Token: $${bestRoute.pricePerToken.toFixed(8)}`);
            } else {
                console.log('❌ No valid routes found');
            }

            return {
                success: true,
                tokenInfo,
                routes: routes.sort((a, b) => b.usdcAmount - a.usdcAmount), // Sort by best price
                bestRoute,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Route comparison error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Monitor price over time
     * @param {string} tokenAddress - Token contract address
     * @param {number} amount - Token amount
     * @param {number} intervalMinutes - Monitoring interval in minutes
     * @param {number} durationMinutes - Total monitoring duration
     * @returns {Promise<void>} Starts monitoring
     */
    async monitorPrice(tokenAddress, amount, intervalMinutes = 5, durationMinutes = 60) {
        try {
            console.log(`\n📊 STARTING PRICE MONITORING`);
            console.log('═'.repeat(40));
            console.log(`🪙 Token: ${tokenAddress}`);
            console.log(`🔢 Amount: ${amount}`);
            console.log(`⏱️  Interval: ${intervalMinutes} minutes`);
            console.log(`⏳ Duration: ${durationMinutes} minutes`);

            const prices = [];
            const startTime = Date.now();
            const endTime = startTime + (durationMinutes * 60 * 1000);
            const interval = intervalMinutes * 60 * 1000;

            const monitoringLoop = async () => {
                if (Date.now() >= endTime) {
                    console.log('\n✅ MONITORING COMPLETE');
                    console.log('═'.repeat(30));
                    
                    if (prices.length > 0) {
                        const avgPrice = prices.reduce((sum, p) => sum + p.usdcValue, 0) / prices.length;
                        const minPrice = Math.min(...prices.map(p => p.usdcValue));
                        const maxPrice = Math.max(...prices.map(p => p.usdcValue));
                        
                        console.log(`📈 Average Price: $${avgPrice.toFixed(6)}`);
                        console.log(`📉 Min Price: $${minPrice.toFixed(6)}`);
                        console.log(`📊 Max Price: $${maxPrice.toFixed(6)}`);
                        console.log(`📋 Total Samples: ${prices.length}`);
                    }
                    return;
                }

                const price = await this.getPrice(tokenAddress, amount, { verbose: false });
                
                if (price.success) {
                    prices.push({
                        timestamp: new Date().toISOString(),
                        usdcValue: price.usdcValue,
                        pricePerToken: price.pricePerToken,
                        bestRoute: price.bestRoute
                    });

                    console.log(`🕐 ${new Date().toLocaleTimeString()}: $${price.usdcValue.toFixed(6)} via ${price.bestRoute}`);
                } else {
                    console.log(`🕐 ${new Date().toLocaleTimeString()}: ❌ Failed to get price`);
                }

                setTimeout(monitoringLoop, interval);
            };

            monitoringLoop();

        } catch (error) {
            console.error('❌ Price monitoring error:', error.message);
        }
    }
}

module.exports = { DexPriceFetcher };