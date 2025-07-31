 /**
 * Reserve Validator Service (Optional)
 * Dedicated service for reserve validation tasks
 */

const { OnrampPriceChecker } = require('./onrampPriceChecker');
const { BASE_CONFIG } = require('../config/baseConfig');

class ReserveValidator {
    constructor() {
        this.priceChecker = new OnrampPriceChecker();
        console.log('🏦 Reserve Validator initialized');
    }

    /**
     * Validate token and get price for onramp processing
     * @param {string} tokenAddress - Token contract address
     * @param {number} amount - Token amount to check
     * @param {object} options - Validation options
     * @returns {Promise<object>} Validation result with pricing
     */
    async validateTokenAndGetPrice(tokenAddress, amount, options = {}) {
        try {
            const {
                minLiquidityThreshold = BASE_CONFIG.PRICE_SETTINGS.MIN_LIQUIDITY_THRESHOLD,
                requireReserveSupport = true,
                verbose = false
            } = options;

            if (verbose) {
                console.log('\n🔍 RESERVE VALIDATION STARTED');
                console.log('═'.repeat(50));
                console.log(`🪙 Token: ${tokenAddress}`);
                console.log(`🔢 Amount: ${amount}`);
                console.log(`💧 Min Liquidity: $${minLiquidityThreshold}`);
                console.log(`🏦 Require Reserve Support: ${requireReserveSupport}`);
            }

            const result = await this.priceChecker.validateTokenForOnramp(tokenAddress, amount, {
                minLiquidityThreshold,
                verbose
            });

            // Additional business logic for validation
            const validation = {
                isValid: result.valid,
                canProcess: result.valid,
                reasons: [],
                priceData: result.priceData,
                recommendation: result.recommendation
            };

            // Check specific validation criteria
            if (!result.priceData?.success) {
                validation.reasons.push('No price data available');
                validation.canProcess = false;
            }

            if (requireReserveSupport && !result.priceData?.isReserveSupported) {
                validation.reasons.push('Token not supported by reserve contract');
                validation.canProcess = false;
            }

            if (!result.priceData?.hasAdequateLiquidity) {
                validation.reasons.push(`Insufficient liquidity (minimum $${minLiquidityThreshold} required)`);
                validation.canProcess = false;
            }

            if (verbose) {
                console.log('\n📊 VALIDATION SUMMARY');
                console.log('─'.repeat(30));
                console.log(`✅ Valid: ${validation.isValid}`);
                console.log(`🔄 Can Process: ${validation.canProcess}`);
                if (validation.reasons.length > 0) {
                    console.log('❌ Issues:');
                    validation.reasons.forEach(reason => console.log(`   - ${reason}`));
                }
            }

            return validation;

        } catch (error) {
            console.error('❌ Reserve validation error:', error.message);
            return {
                isValid: false,
                canProcess: false,
                reasons: [`Validation error: ${error.message}`],
                recommendation: 'REJECT_ONRAMP',
                error: error.message
            };
        }
    }

    /**
     * Check if token is supported by reserve contract
     * @param {string} tokenAddress - Token contract address
     * @returns {Promise<boolean>} Support status
     */
    async checkReserveSupport(tokenAddress) {
        try {
            return await this.priceChecker.isTokenSupportedByReserve(tokenAddress);
        } catch (error) {
            console.error(`❌ Error checking reserve support for ${tokenAddress}:`, error.message);
            return false;
        }
    }

    /**
     * Check multiple tokens for reserve support
     * @param {string[]} tokenAddresses - Array of token addresses
     * @returns {Promise<object>} Support status for each token
     */
    async checkMultipleTokensSupport(tokenAddresses) {
        try {
            const supportStatuses = await this.priceChecker.checkMultipleTokenSupport(tokenAddresses);
            
            const result = {};
            tokenAddresses.forEach((address, index) => {
                result[address] = supportStatuses[index] || false;
            });

            return result;
        } catch (error) {
            console.error('❌ Error checking multiple tokens support:', error.message);
            // Return all false if error
            const result = {};
            tokenAddresses.forEach(address => {
                result[address] = false;
            });
            return result;
        }
    }

    /**
     * Get reserve contract configuration
     * @returns {Promise<object>} Contract configuration
     */
    async getReserveConfiguration() {
        try {
            const config = await this.priceChecker.getContractConfiguration();
            return {
                success: true,
                config
            };
        } catch (error) {
            console.error('❌ Error getting reserve configuration:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get reserve contract balances
     * @returns {Promise<object>} Contract balances
     */
    async getReserveBalances() {
        try {
            const balances = await this.priceChecker.getContractBalances();
            return {
                success: true,
                balances
            };
        } catch (error) {
            console.error('❌ Error getting reserve balances:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate business token configuration against reserve
     * @param {object} businessTokens - Business supported tokens
     * @returns {Promise<object>} Validation results
     */
    async validateBusinessTokenConfiguration(businessTokens) {
        try {
            console.log('\n🏢 VALIDATING BUSINESS TOKEN CONFIGURATION');
            console.log('═'.repeat(50));

            const validationResults = {
                valid: true,
                totalTokens: 0,
                supportedByReserve: 0,
                unsupportedTokens: [],
                details: {}
            };

            for (const [network, tokens] of Object.entries(businessTokens)) {
                if (!Array.isArray(tokens)) continue;

                console.log(`\n🌐 Network: ${network.toUpperCase()}`);
                console.log('─'.repeat(20));

                const activeTokens = tokens.filter(t => t.isActive && t.isTradingEnabled);
                validationResults.totalTokens += activeTokens.length;

                const tokenAddresses = activeTokens.map(t => t.contractAddress);
                const supportStatuses = await this.checkMultipleTokensSupport(tokenAddresses);

                validationResults.details[network] = {
                    totalTokens: activeTokens.length,
                    supportedCount: 0,
                    tokens: []
                };

                for (const token of activeTokens) {
                    const isSupported = supportStatuses[token.contractAddress];
                    
                    if (isSupported) {
                        validationResults.supportedByReserve++;
                        validationResults.details[network].supportedCount++;
                    } else {
                        validationResults.unsupportedTokens.push({
                            symbol: token.symbol,
                            network: network,
                            contractAddress: token.contractAddress
                        });
                    }

                    validationResults.details[network].tokens.push({
                        symbol: token.symbol,
                        contractAddress: token.contractAddress,
                        isSupported: isSupported
                    });

                    console.log(`${isSupported ? '✅' : '❌'} ${token.symbol}: ${isSupported ? 'SUPPORTED' : 'NOT SUPPORTED'}`);
                    console.log(`   📍 ${token.contractAddress}`);
                }
            }

            // Calculate overall validity
            const supportPercentage = validationResults.totalTokens > 0 
                ? (validationResults.supportedByReserve / validationResults.totalTokens) * 100 
                : 0;

            validationResults.supportPercentage = supportPercentage;
            validationResults.valid = supportPercentage >= 50; // At least 50% should be supported

            console.log('\n📊 VALIDATION SUMMARY');
            console.log('═'.repeat(30));
            console.log(`🔢 Total Active Tokens: ${validationResults.totalTokens}`);
            console.log(`✅ Supported by Reserve: ${validationResults.supportedByReserve}`);
            console.log(`❌ Unsupported: ${validationResults.unsupportedTokens.length}`);
            console.log(`📈 Support Percentage: ${supportPercentage.toFixed(1)}%`);
            console.log(`🎯 Overall Valid: ${validationResults.valid ? 'YES' : 'NO'}`);

            if (validationResults.unsupportedTokens.length > 0) {
                console.log('\n⚠️  UNSUPPORTED TOKENS:');
                validationResults.unsupportedTokens.forEach(token => {
                    console.log(`   - ${token.symbol} (${token.network}): ${token.contractAddress}`);
                });
            }

            return validationResults;

        } catch (error) {
            console.error('❌ Error validating business token configuration:', error.message);
            return {
                valid: false,
                error: error.message,
                totalTokens: 0,
                supportedByReserve: 0,
                unsupportedTokens: []
            };
        }
    }

    /**
     * Get quick price estimate without full validation
     * @param {string} tokenAddress - Token contract address
     * @param {number} amount - Token amount
     * @returns {Promise<object>} Price estimate
     */
    async getQuickPriceEstimate(tokenAddress, amount) {
        try {
            return await this.priceChecker.getQuickPrice(tokenAddress, amount);
        } catch (error) {
            console.error('❌ Error getting quick price estimate:', error.message);
            return {
                success: false,
                error: error.message,
                canProcessOnramp: false
            };
        }
    }

    /**
     * Health check for reserve validator
     * @returns {Promise<object>} Health status
     */
    async healthCheck() {
        try {
            const isConnected = await this.priceChecker.validateConnection();
            
            return {
                healthy: isConnected,
                timestamp: new Date().toISOString(),
                services: {
                    priceChecker: isConnected,
                    reserveContract: isConnected,
                    network: 'base'
                }
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = { ReserveValidator };