/**
 * Fixed Onramp Price Checker Service
 * Simplified to match the working SimpleTokenPriceFetcher approach
 */

const ethers = require('ethers');
const { BASE_CONFIG } = require('../config/baseConfig');
const { ABOKI_V2_ABI, QUOTER_ABI, ERC20_ABI, ROUTER_V2_ABI } = require('../utils/abi');

class OnrampPriceChecker {
    constructor() {
        console.log('🚀 Initializing Onramp Price Checker...');
        
        // Use the EXACT same initialization as SimpleTokenPriceFetcher (which works)
        this.provider = new ethers.providers.JsonRpcProvider(BASE_CONFIG.rpc);
        
        // Initialize contracts using the same pattern as working code
        this.abokiContract = new ethers.Contract(
            BASE_CONFIG.ABOKI_V2_CONTRACT, 
            ABOKI_V2_ABI, 
            this.provider
        );
        
        this.routerV2 = new ethers.Contract(
            BASE_CONFIG.V2_ROUTER, 
            ROUTER_V2_ABI, 
            this.provider
        );
        
        this.quoterV3 = new ethers.Contract(
            BASE_CONFIG.V3_QUOTER, 
            QUOTER_ABI, 
            this.provider
        );
        
        console.log('✅ Onramp Price Checker initialized');
        console.log(`📍 Reserve Contract: ${BASE_CONFIG.ABOKI_V2_CONTRACT}`);
        console.log(`🌐 RPC URL: ${BASE_CONFIG.rpc}`);
        console.log(`⚡ Network: ${BASE_CONFIG.name} (Chain ID: ${BASE_CONFIG.chainId})`);
    }

    async validateConnection() {
        try {
            console.log('🔍 Validating network connection...');
            const network = await this.provider.getNetwork();
            
            if (network.chainId !== BASE_CONFIG.chainId) {
                throw new Error(`Wrong network! Expected Base (${BASE_CONFIG.chainId}), got ${network.chainId}`);
            }
            
            console.log(`✅ Connected to ${BASE_CONFIG.name} (Chain ID: ${network.chainId})`);
            
            // Test contract connection
            console.log('🔍 Testing contract connection...');
            await this.abokiContract.getConfiguration();
            console.log('✅ Contract connection validated');
            return true;
        } catch (error) {
            console.error('❌ Connection validation failed:', error.message);
            return false;
        }
    }

    async getTokenInfo(tokenAddress) {
        try {
            if (tokenAddress === BASE_CONFIG.WETH || tokenAddress.toLowerCase() === 'eth') {
                return {
                    symbol: 'ETH',
                    name: 'Ethereum',
                    decimals: 18,
                    address: BASE_CONFIG.WETH,
                    isNative: true
                };
            }

            const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
            
            const [symbol, decimals, name] = await Promise.all([
                token.symbol(),
                token.decimals(),
                token.name()
            ]);
            
            return { 
                symbol, 
                decimals, 
                name, 
                address: tokenAddress,
                isNative: false
            };
        } catch (error) {
            throw new Error(`Failed to get token info: ${error.message}`);
        }
    }

    async isTokenSupportedByReserve(tokenAddress) {
        try {
            console.log(`🔍 Checking reserve support for: ${tokenAddress}`);
            const isSupported = await this.abokiContract.supportedTokens(tokenAddress);
            console.log(`🏦 Reserve support: ${isSupported ? '✅ SUPPORTED' : '❌ NOT SUPPORTED'}`);
            return isSupported;
        } catch (error) {
            console.error(`❌ Error checking reserve support for ${tokenAddress}:`, error.message);
            return false;
        }
    }

    // Use EXACT same USDC price logic as SimpleTokenPriceFetcher
    async getUSDCPrice(ethAmount) {
        try {
            const amountIn = ethers.utils.parseEther(ethAmount.toString());
            
            // Try V3 first (same approach as SimpleTokenPriceFetcher)
            const feeTiers = [500, 3000, 10000];
            
            for (const feeTier of feeTiers) {
                try {
                    const amountOut = await this.quoterV3.callStatic.quoteExactInputSingle({
                        tokenIn: BASE_CONFIG.WETH,
                        tokenOut: BASE_CONFIG.USDC,
                        fee: feeTier,
                        amountIn: amountIn,
                        sqrtPriceLimitX96: 0
                    });
                    
                    return ethers.utils.formatUnits(amountOut.amountOut, 6);
                } catch (error) {
                    continue;
                }
            }
            
            // Fallback to V2 (same as SimpleTokenPriceFetcher)
            try {
                const path = [BASE_CONFIG.WETH, BASE_CONFIG.USDC];
                const amounts = await this.routerV2.callStatic.getAmountsOut(amountIn, path);
                return ethers.utils.formatUnits(amounts[1], 6);
            } catch (error) {
                return null;
            }
        } catch (error) {
            return null;
        }
    }

    async getTokenToUSDCPrice(tokenAddress, tokenAmount, options = {}) {
        try {
            const { 
                verbose = true, 
                checkReserveSupport = true,
                minLiquidityThreshold = 100
            } = options;

            if (verbose) {
                console.log('\n💰 ONRAMP PRICE ESTIMATION');
                console.log('═'.repeat(50));
            }
            
            // Get token info
            const tokenInfo = await this.getTokenInfo(tokenAddress);
            if (verbose) {
                console.log(`🪙 Token: ${tokenInfo.name} (${tokenInfo.symbol})`);
                console.log(`📍 Address: ${tokenAddress}`);
                console.log(`🔢 Amount: ${tokenAmount} ${tokenInfo.symbol}`);
            }
            
            // Check reserve support if requested
            let isReserveSupported = true;
            if (checkReserveSupport) {
                isReserveSupported = await this.isTokenSupportedByReserve(tokenAddress);
                if (verbose) {
                    console.log(`🏦 Reserve Support: ${isReserveSupported ? '✅ SUPPORTED' : '❌ NOT SUPPORTED'}`);
                }
            }
            
            // Convert token amount to wei - USE SAME APPROACH AS SIMPLE FETCHER
            const amountIn = ethers.utils.parseUnits(tokenAmount.toString(), tokenInfo.decimals);
            if (verbose) {
                console.log(`⚡ Amount in wei: ${amountIn.toString()}`);
            }
            
            let bestPrice = null;
            let bestRoute = null;
            
            if (verbose) {
                console.log('\n🔍 CHECKING PRICE ROUTES');
                console.log('─'.repeat(30));
            }
            
            // Route 1: Direct Token -> USDC (V3) - SAME AS SIMPLE FETCHER
            if (verbose) console.log('🔵 Route 1: Direct Token → USDC (V3)');
            for (const fee of BASE_CONFIG.V3_FEES) {
                try {
                    const amountOut = await this.quoterV3.callStatic.quoteExactInputSingle({
                        tokenIn: tokenAddress,
                        tokenOut: BASE_CONFIG.USDC,
                        fee: fee,
                        amountIn: amountIn,
                        sqrtPriceLimitX96: 0
                    });
                    
                    const usdcAmount = ethers.utils.formatUnits(amountOut.amountOut, 6);
                    const pricePerToken = parseFloat(usdcAmount) / parseFloat(tokenAmount);
                    
                    if (verbose) {
                        console.log(`  💎 ${fee/10000}% fee: $${parseFloat(usdcAmount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}`);
                        console.log(`     Price per token: $${pricePerToken.toFixed(6)}`);
                    }
                    
                    if (!bestPrice || parseFloat(usdcAmount) > bestPrice.usdcAmount) {
                        bestPrice = {
                            usdcAmount: parseFloat(usdcAmount),
                            pricePerToken: pricePerToken,
                            rawAmount: amountOut.amountOut
                        };
                        bestRoute = `V3 Direct (${fee/10000}% fee)`;
                    }
                } catch (error) {
                    if (verbose) console.log(`  ❌ ${fee/10000}% fee: No liquidity`);
                }
            }
            
            // Route 2: Direct Token -> USDC (V2) - SAME AS SIMPLE FETCHER
            if (verbose) console.log('\n🟡 Route 2: Direct Token → USDC (V2)');
            try {
                const path = [tokenAddress, BASE_CONFIG.USDC];
                const amounts = await this.routerV2.callStatic.getAmountsOut(amountIn, path);
                
                const usdcAmount = ethers.utils.formatUnits(amounts[1], 6);
                const pricePerToken = parseFloat(usdcAmount) / parseFloat(tokenAmount);
                
                if (verbose) {
                    console.log(`  💎 Standard: $${parseFloat(usdcAmount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}`);
                    console.log(`     Price per token: $${pricePerToken.toFixed(6)}`);
                }
                
                if (!bestPrice || parseFloat(usdcAmount) > bestPrice.usdcAmount) {
                    bestPrice = {
                        usdcAmount: parseFloat(usdcAmount),
                        pricePerToken: pricePerToken,
                        rawAmount: amounts[1]
                    };
                    bestRoute = 'V2 Direct';
                }
            } catch (error) {
                if (verbose) console.log(`  ❌ V2 Direct: No liquidity`);
            }
            
            // Route 3: Token -> WETH -> USDC (V3) - SAME AS SIMPLE FETCHER
            if (verbose) console.log('\n🔵 Route 3: Token → WETH → USDC (V3)');
            for (const fee1 of BASE_CONFIG.V3_FEES) {
                try {
                    // Step 1: Token -> WETH
                    const ethOut = await this.quoterV3.callStatic.quoteExactInputSingle({
                        tokenIn: tokenAddress,
                        tokenOut: BASE_CONFIG.WETH,
                        fee: fee1,
                        amountIn: amountIn,
                        sqrtPriceLimitX96: 0
                    });
                    
                    // Step 2: WETH -> USDC (using same logic as SimpleTokenPriceFetcher)
                    const ethAmount = ethers.utils.formatEther(ethOut.amountOut);
                    const usdcAmount = await this.getUSDCPrice(ethAmount);
                    
                    if (usdcAmount) {
                        const pricePerToken = parseFloat(usdcAmount) / parseFloat(tokenAmount);
                        
                        if (verbose) {
                            console.log(`  💎 Via ${fee1/10000}% pool: $${parseFloat(usdcAmount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}`);
                            console.log(`     Price per token: $${pricePerToken.toFixed(6)}`);
                        }
                        
                        if (!bestPrice || parseFloat(usdcAmount) > bestPrice.usdcAmount) {
                            bestPrice = {
                                usdcAmount: parseFloat(usdcAmount),
                                pricePerToken: pricePerToken,
                                rawAmount: ethOut.amountOut
                            };
                            bestRoute = `V3 Route via ${fee1/10000}%`;
                        }
                    }
                } catch (error) {
                    // Skip failed routes
                    continue;
                }
            }
            
            // Route 4: Token -> WETH -> USDC (V2) - SAME AS SIMPLE FETCHER
            if (verbose) console.log('\n🟡 Route 4: Token → WETH → USDC (V2)');
            try {
                const path = [tokenAddress, BASE_CONFIG.WETH, BASE_CONFIG.USDC];
                const amounts = await this.routerV2.callStatic.getAmountsOut(amountIn, path);
                
                const usdcAmount = ethers.utils.formatUnits(amounts[2], 6);
                const pricePerToken = parseFloat(usdcAmount) / parseFloat(tokenAmount);
                
                if (verbose) {
                    console.log(`  💎 Route: $${parseFloat(usdcAmount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}`);
                    console.log(`     Price per token: $${pricePerToken.toFixed(6)}`);
                }
                
                if (!bestPrice || parseFloat(usdcAmount) > bestPrice.usdcAmount) {
                    bestPrice = {
                        usdcAmount: parseFloat(usdcAmount),
                        pricePerToken: pricePerToken,
                        rawAmount: amounts[2]
                    };
                    bestRoute = 'V2 Route';
                }
            } catch (error) {
                if (verbose) console.log(`  ❌ V2 Route: No liquidity`);
            }
            
            // Analyze results
            if (bestPrice) {
                const hasAdequateLiquidity = bestPrice.usdcAmount >= minLiquidityThreshold;
                
                if (verbose) {
                    console.log('\n🏆 PRICE ESTIMATION RESULT');
                    console.log('═'.repeat(40));
                    console.log(`🎯 ${tokenAmount} ${tokenInfo.symbol} = $${bestPrice.usdcAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}`);
                    console.log(`💎 Price per ${tokenInfo.symbol}: $${bestPrice.pricePerToken.toFixed(6)}`);
                    console.log(`🛣️  Best route: ${bestRoute}`);
                    console.log(`🏦 Reserve supports: ${isReserveSupported ? 'YES' : 'NO'}`);
                    console.log(`💧 Adequate liquidity: ${hasAdequateLiquidity ? 'YES' : 'NO'} (>${minLiquidityThreshold} USDC)`);
                    console.log(`⚡ Network: Base Mainnet`);
                    console.log(`🕐 Timestamp: ${new Date().toLocaleString()}`);
                }
                
                return {
                    success: true,
                    tokenInfo: tokenInfo,
                    inputAmount: tokenAmount,
                    usdcValue: bestPrice.usdcAmount,
                    pricePerToken: bestPrice.pricePerToken,
                    bestRoute: bestRoute,
                    isReserveSupported: isReserveSupported,
                    hasAdequateLiquidity: hasAdequateLiquidity,
                    canProcessOnramp: isReserveSupported && hasAdequateLiquidity,
                    timestamp: new Date().toISOString(),
                    network: 'base',
                    contractAddress: BASE_CONFIG.ABOKI_V2_CONTRACT,
                    usdcAddress: BASE_CONFIG.USDC
                };
            } else {
                if (verbose) {
                    console.log('\n❌ NO PRICE FOUND');
                    console.log('═'.repeat(30));
                    console.log('No liquidity available for this token on Base DEXs');
                    console.log('This token cannot be processed for onramp');
                }
                
                return {
                    success: false,
                    error: 'No liquidity found',
                    tokenInfo: tokenInfo,
                    isReserveSupported: isReserveSupported,
                    canProcessOnramp: false
                };
            }
            
        } catch (error) {
            console.error('❌ Error in price estimation:', error.message);
            return {
                success: false,
                error: error.message,
                canProcessOnramp: false
            };
        }
    }

    async validateTokenForOnramp(tokenAddress, tokenAmount, options = {}) {
        console.log('\n🔍 VALIDATING TOKEN FOR ONRAMP');
        console.log('═'.repeat(50));
        
        const priceResult = await this.getTokenToUSDCPrice(tokenAddress, tokenAmount, {
            verbose: true,
            checkReserveSupport: true,
            minLiquidityThreshold: options.minLiquidityThreshold || 100
        });
        
        if (priceResult.success && priceResult.canProcessOnramp) {
            console.log('\n✅ TOKEN VALIDATION PASSED');
            console.log('═'.repeat(30));
            console.log('✅ Token has liquidity');
            console.log('✅ Reserve supports token');
            console.log('✅ Ready for onramp processing');
            
            return {
                valid: true,
                priceData: priceResult,
                recommendation: 'PROCEED_WITH_ONRAMP'
            };
        } else {
            console.log('\n❌ TOKEN VALIDATION FAILED');
            console.log('═'.repeat(30));
            
            if (!priceResult.success) {
                console.log('❌ No liquidity available');
            }
            if (priceResult.isReserveSupported === false) {
                console.log('❌ Token not supported by reserve');
            }
            if (priceResult.hasAdequateLiquidity === false) {
                console.log('❌ Insufficient liquidity for onramp');
            }
            
            return {
                valid: false,
                priceData: priceResult,
                recommendation: 'REJECT_ONRAMP'
            };
        }
    }

    async getQuickPrice(tokenAddress, amount) {
        try {
            return await this.getTokenToUSDCPrice(tokenAddress, amount, {
                verbose: false,
                checkReserveSupport: true,
                minLiquidityThreshold: 50
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

    async getContractConfiguration() {
        try {
            console.log('🔍 Getting contract configuration...');
            const config = await this.abokiContract.getConfiguration();
            return {
                v2Router: config.v2Router,
                v3Router: config.v3Router,
                v3Quoter: config.v3Quoter,
                weth: config.weth,
                totalOrders: config.totalOrders.toString()
            };
        } catch (error) {
            console.error('❌ Error getting contract configuration:', error.message);
            return null;
        }
    }

    async getContractBalances() {
        try {
            const contractAddress = BASE_CONFIG.ABOKI_V2_CONTRACT;
            console.log(`🔍 Getting contract balances for: ${contractAddress}`);
            
            // Check ETH balance
            const ethBalance = await this.provider.getBalance(contractAddress);
            
            // Check common token balances
            const tokenBalances = [];
            
            const commonTokens = BASE_CONFIG.COMMON_TOKENS || {};
            for (const [symbol, address] of Object.entries(commonTokens)) {
                try {
                    const tokenContract = new ethers.Contract(address, ERC20_ABI, this.provider);
                    const balance = await tokenContract.balanceOf(contractAddress);
                    const decimals = await tokenContract.decimals();
                    const formattedBalance = ethers.utils.formatUnits(balance, decimals);
                    
                    tokenBalances.push({
                        symbol,
                        address,
                        balance: formattedBalance,
                        rawBalance: balance,
                        decimals: Number(decimals)
                    });
                    
                    console.log(`✅ ${symbol}: ${formattedBalance}`);
                } catch (error) {
                    console.log(`❌ ${symbol}: Failed to get balance - ${error.message}`);
                }
            }
            
            return {
                ethBalance: ethers.utils.formatEther(ethBalance),
                tokenBalances
            };
        } catch (error) {
            console.error('❌ Error getting contract balances:', error.message);
            return null;
        }
    }

    async checkMultipleTokenSupport(tokenAddresses) {
        try {
            console.log(`🔍 Checking support for ${tokenAddresses.length} tokens...`);
            const supportStatus = await this.abokiContract.areTokensSupported(tokenAddresses);
            return supportStatus;
        } catch (error) {
            console.error('❌ Error checking multiple token support:', error.message);
            return tokenAddresses.map(() => false);
        }
    }
}

module.exports = { OnrampPriceChecker };