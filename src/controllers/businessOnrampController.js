/**
 * UPDATED COMPLETE Generic Token Onramp Controller with Solana Support
 * Supports Base network (smart contracts), Solana network (Jupiter), and other networks with current exchange rates
 */

const { BusinessOnrampOrder, BUSINESS_ORDER_STATUS } = require('../models/BusinessOnrampOrder');
const { Business } = require('../models');
const monnifyService = require('../services/monnifyService');
const { OnrampPriceChecker } = require('../services/onrampPriceChecker');
const { SolanaTokenPriceChecker } = require('../services/solanaOnrampPriceChecker.js');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { BASE_CONFIG } = require('../config/baseConfig');
const { SOLANA_CONFIG } = require('../config/solanaConfig');
const { DEFAULT_TOKENS } = require('../config/defaultTokens');

// Initialize price checkers
const priceChecker = new OnrampPriceChecker();
const solanaChecker = new SolanaTokenPriceChecker();

/**
 * Ensure business has default tokens
 */
async function ensureBusinessHasDefaultTokens(business) {
  let needsSave = false;

  // Initialize if missing
  if (!business.supportedTokens) {
    business.supportedTokens = { base: [], solana: [], ethereum: [] };
    needsSave = true;
  }
  if (!business.feeConfiguration) {
    business.feeConfiguration = { base: [], solana: [], ethereum: [] };
    needsSave = true;
  }

  // Add missing default tokens
  for (const [networkName, tokens] of Object.entries(DEFAULT_TOKENS)) {
    if (!business.supportedTokens[networkName]) {
      business.supportedTokens[networkName] = [];
      needsSave = true;
    }
    if (!business.feeConfiguration[networkName]) {
      business.feeConfiguration[networkName] = [];
      needsSave = true;
    }

    for (const tokenTemplate of tokens) {
      const existingToken = business.supportedTokens[networkName].find(
        t => t.contractAddress.toLowerCase() === tokenTemplate.contractAddress.toLowerCase()
      );

      if (!existingToken) {
        business.supportedTokens[networkName].push({
          symbol: tokenTemplate.symbol,
          name: tokenTemplate.name,
          contractAddress: tokenTemplate.contractAddress,
          decimals: tokenTemplate.decimals,
          network: tokenTemplate.network,
          type: tokenTemplate.type,
          isActive: tokenTemplate.isActive,
          isTradingEnabled: tokenTemplate.isTradingEnabled,
          isDefault: tokenTemplate.isDefault,
          logoUrl: tokenTemplate.logoUrl,
          addedAt: new Date(),
          metadata: {}
        });

        business.feeConfiguration[networkName].push({
          contractAddress: tokenTemplate.contractAddress,
          symbol: tokenTemplate.symbol,
          feePercentage: 0,
          isActive: true,
          isDefault: true,
          updatedAt: new Date()
        });

        needsSave = true;
        console.log(`✅ Auto-added ${tokenTemplate.symbol} to ${networkName} network`);
      }
    }
  }

  if (needsSave) {
    business.supportedTokensUpdatedAt = new Date();
    business.updatedAt = new Date();
    await business.save();
    console.log(`✅ Business default tokens updated`);
  }
}

/**
 * Get USDC to NGN rate using your own onramp pricing API instead of hardcoded values
 */
async function getUSDCToNGNRate() {
  try {
    const baseUrl = process.env.INTERNAL_API_BASE_URL || 'http://localhost:5002';
    
    console.log('[USDC_NGN_RATE] Fetching current USDC rate from onramp API...');
    
    try {
      const response = await axios.get(`${baseUrl}/api/v1/onramp-price`, {
        params: {
          cryptoSymbol: 'USDC',
          cryptoAmount: 1
        },
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OnrampService/1.0'
        }
      });
      
      if (response.data && response.data.success && response.data.data) {
        const usdcRate = response.data.data.unitPriceInNgn;
        console.log(`[USDC_NGN_RATE] ✅ Got current USDC rate from onramp API: ₦${usdcRate.toLocaleString()}`);
        return usdcRate;
      } else {
        console.warn('[USDC_NGN_RATE] Onramp API returned invalid data:', response.data);
        throw new Error('Invalid response from onramp API');
      }
    } catch (onrampApiError) {
      console.warn('[USDC_NGN_RATE] Onramp API failed, trying dedicated exchange rate endpoint:', onrampApiError.message);
      
      try {
        const exchangeResponse = await axios.get(`${baseUrl}/api/v1/exchange-rate/usdc-ngn`, {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'OnrampService/1.0'
          }
        });
        
        if (exchangeResponse.data && exchangeResponse.data.success) {
          const rate = exchangeResponse.data.data.rate;
          console.log(`[USDC_NGN_RATE] ✅ Got rate from exchange endpoint: ₦${rate.toLocaleString()}`);
          return rate;
        }
      } catch (exchangeApiError) {
        console.warn('[USDC_NGN_RATE] Exchange rate endpoint also failed:', exchangeApiError.message);
      }
      
      const fallbackRate = process.env.CURRENT_USDC_NGN_RATE || 1720;
      console.log(`[USDC_NGN_RATE] ⚠️  Using fallback rate: ₦${fallbackRate} (update CURRENT_USDC_NGN_RATE env var)`);
      return parseFloat(fallbackRate);
    }
    
  } catch (error) {
    console.error('[USDC_NGN_RATE] Error getting USDC-NGN rate:', error.message);
    
    const emergencyRate = 1720;
    console.log(`[USDC_NGN_RATE] 🆘 Using emergency fallback: ₦${emergencyRate}`);
    return emergencyRate;
  }
}

/**
 * FIXED: Process Base network tokens with proper ETH handling
 */
async function processBaseNetworkTokenFixed(cryptoSymbol, tokenInfo, cryptoAmount, customerNgnAmount = null) {
  try {
      console.log(`[BASE_TOKEN_PROCESSOR] Processing Base token: ${cryptoSymbol}`);
      
      const isETH = cryptoSymbol.toUpperCase() === 'ETH' || 
                    cryptoSymbol.toUpperCase() === 'WETH' ||
                    tokenInfo.contractAddress?.toLowerCase() === BASE_CONFIG.WETH?.toLowerCase();
      
      let effectiveTokenAddress;
      let isReserveSupported;
      
      if (isETH) {
          console.log(`[BASE_TOKEN_PROCESSOR] ✅ Processing ETH as native token`);
          effectiveTokenAddress = BASE_CONFIG.WETH || '0x4200000000000000000000000000000000000006';
          isReserveSupported = true;
          console.log(`[BASE_TOKEN_PROCESSOR] ✅ ETH is natively supported (using WETH: ${effectiveTokenAddress})`);
      } else {
          console.log(`[BASE_TOKEN_PROCESSOR] Checking smart contract support for ${cryptoSymbol}...`);
          effectiveTokenAddress = tokenInfo.contractAddress;
          isReserveSupported = await priceChecker.isTokenSupportedByReserve(tokenInfo.contractAddress);
          
          if (!isReserveSupported) {
              console.error(`[BASE_TOKEN_PROCESSOR] ❌ ${cryptoSymbol} not supported by smart contract reserve`);
              throw new Error(`Token ${cryptoSymbol} is not supported by the smart contract reserve. Please contact support to add this token.`);
          }
          
          console.log(`[BASE_TOKEN_PROCESSOR] ✅ ${cryptoSymbol} is supported by reserve`);
      }
      
      console.log(`[BASE_TOKEN_PROCESSOR] Getting unit price for ${cryptoSymbol}...`);
      const unitPriceResult = await priceChecker.getTokenToUSDCPrice(effectiveTokenAddress, 1, {
          verbose: false,
          checkReserveSupport: false,
          minLiquidityThreshold: 0,
          checkPoolLiquidity: true
      });
      
      if (!unitPriceResult.success) {
          console.error(`[BASE_TOKEN_PROCESSOR] ❌ Failed to get ${cryptoSymbol} unit price:`, unitPriceResult.error);
          throw new Error(`Failed to get ${cryptoSymbol} price from DEX: ${unitPriceResult.error}`);
      }
      
      console.log(`[BASE_TOKEN_PROCESSOR] ✅ Unit price: 1 ${cryptoSymbol} = $${unitPriceResult.pricePerToken} USDC`);
      
      console.log(`[BASE_TOKEN_PROCESSOR] Getting current USDC-NGN exchange rate...`);
      const usdcToNgnRate = await getUSDCToNGNRate();
      console.log(`[BASE_TOKEN_PROCESSOR] ✅ Current USDC rate: ₦${usdcToNgnRate.toLocaleString()}`);
      
      let actualTokenAmount = cryptoAmount;
      let actualUsdcValue = unitPriceResult.usdcValue * cryptoAmount;
      
      if (customerNgnAmount) {
          const customerUsdcAmount = customerNgnAmount / usdcToNgnRate;
          actualTokenAmount = customerUsdcAmount / unitPriceResult.pricePerToken;
          actualUsdcValue = customerUsdcAmount;
          
          console.log(`[BASE_TOKEN_PROCESSOR] Customer purchase calculation with CURRENT rates:`);
          console.log(`  - Customer NGN: ₦${customerNgnAmount.toLocaleString()}`);
          console.log(`  - Current USDC rate: ₦${usdcToNgnRate.toLocaleString()}`);
          console.log(`  - USDC equivalent: $${customerUsdcAmount.toFixed(6)}`);
          console.log(`  - Token unit price: $${unitPriceResult.pricePerToken.toFixed(8)} USDC`);
          console.log(`  - Token amount: ${actualTokenAmount.toFixed(8)} ${cryptoSymbol}`);
          console.log(`  - Total USDC value: $${actualUsdcValue.toFixed(6)}`);
      }
      
      const meetsMinTransactionValue = actualUsdcValue >= 1.0;
      
      if (!meetsMinTransactionValue) {
          const minimumNgnRequired = Math.ceil(usdcToNgnRate * 1.0);
          console.error(`[BASE_TOKEN_PROCESSOR] ❌ Transaction value too small for ${cryptoSymbol}`);
          throw new Error(`Transaction value ($${actualUsdcValue.toFixed(6)}) is below minimum ($1 USDC = ₦${minimumNgnRequired.toLocaleString()}). Minimum purchase: ₦${minimumNgnRequired.toLocaleString()}`);
      }
      
      console.log(`[BASE_TOKEN_PROCESSOR] ✅ Transaction meets minimum value: $${actualUsdcValue.toFixed(6)} USDC (>$1.0 required)`);
      
      const hasAdequatePoolLiquidity = unitPriceResult.hasAdequatePoolLiquidity;
      if (!hasAdequatePoolLiquidity && actualUsdcValue > 100) {
          console.log(`[BASE_TOKEN_PROCESSOR] ⚠️  Large order with limited liquidity - may experience slippage`);
      }
      
      const totalNgnValue = actualUsdcValue * usdcToNgnRate;
      const unitPriceInNgn = (unitPriceResult.pricePerToken * usdcToNgnRate);
      
      const swapRoute = {
          inputToken: effectiveTokenAddress,
          outputToken: unitPriceResult.usdcAddress || '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          route: unitPriceResult.bestRoute,
          expectedUsdcOut: actualUsdcValue,
          slippageTolerance: hasAdequatePoolLiquidity ? 0.5 : 2.0,
          deadline: Math.floor(Date.now() / 1000) + 1800,
          isNativeETH: isETH
      };
      
      return {
          cryptoSymbol: cryptoSymbol.toUpperCase(),
          cryptoAmount: actualTokenAmount,
          network: 'base',
          tokenAddress: effectiveTokenAddress,
          decimals: tokenInfo.decimals || 18,
          isNativeToken: isETH,
          
          unitPriceInNgn: unitPriceInNgn,
          totalNgnNeeded: totalNgnValue,
          exchangeRate: unitPriceInNgn,
          ngnToTokenRate: 1 / unitPriceInNgn,
          
          usdcValue: actualUsdcValue,
          pricePerTokenUsdc: unitPriceResult.pricePerToken,
          usdcToNgnRate: usdcToNgnRate,
          
          reserveSupported: isReserveSupported,
          meetsMinTransactionValue: meetsMinTransactionValue,
          hasAdequatePoolLiquidity: hasAdequatePoolLiquidity,
          liquidityWarning: !hasAdequatePoolLiquidity && actualUsdcValue > 100,
          poolLiquidityInfo: unitPriceResult.poolLiquidityInfo,
          canProcessOnramp: true,
          bestRoute: unitPriceResult.bestRoute,
          
          swapRoute: swapRoute,
          
          formattedPrice: `₦${unitPriceInNgn.toLocaleString()}`,
          exchangeRateString: `1 ${cryptoSymbol} = ₦${unitPriceInNgn.toLocaleString()}`,
          usdcRateString: `1 ${cryptoSymbol} = $${unitPriceResult.pricePerToken.toFixed(6)} USDC`,
          currentUsdcRate: `1 USDC = ₦${usdcToNgnRate.toLocaleString()}`,
          
          timestamp: new Date(),
          source: 'smart_contract_dex_with_current_rates',
          rateSource: 'onramp_api',
          validation: {
              businessSupported: true,
              contractSupported: isReserveSupported,
              meetsMinValue: meetsMinTransactionValue,
              hasLiquidity: hasAdequatePoolLiquidity,
              canSwap: true,
              actualPurchaseAmount: actualTokenAmount,
              actualUsdcValue: actualUsdcValue,
              currentUsdcRate: usdcToNgnRate,
              minimumUsdcRequired: 1.0,
              minimumNgnRequired: Math.ceil(usdcToNgnRate * 1.0),
              isNativeToken: isETH,
              effectiveTokenAddress: effectiveTokenAddress
          }
      };
      
  } catch (error) {
      console.error(`[BASE_TOKEN_PROCESSOR] Error processing Base token ${cryptoSymbol}:`, error.message);
      throw error;
  }
}


async function processSolanaUSDCDirect(cryptoSymbol, tokenInfo, cryptoAmount, customerNgnAmount = null) {
  try {
      console.log(`[SOLANA_USDC_DIRECT] Processing direct USDC purchase on Solana`);
      
      // Step 1: Get current USDC to NGN rate
      console.log(`[SOLANA_USDC_DIRECT] Getting current USDC-NGN exchange rate...`);
      const usdcToNgnRate = await getUSDCToNGNRate();
      console.log(`[SOLANA_USDC_DIRECT] ✅ Current USDC rate: ₦${usdcToNgnRate.toLocaleString()}`);
      
      // Step 2: Calculate customer's USDC amount
      let actualUsdcAmount = cryptoAmount;
      let actualNgnValue = cryptoAmount * usdcToNgnRate;
      
      if (customerNgnAmount) {
          actualUsdcAmount = customerNgnAmount / usdcToNgnRate;
          actualNgnValue = customerNgnAmount;
          
          console.log(`[SOLANA_USDC_DIRECT] Customer purchase calculation:`);
          console.log(`  - Customer NGN: ₦${customerNgnAmount.toLocaleString()}`);
          console.log(`  - Current USDC rate: ₦${usdcToNgnRate.toLocaleString()}`);
          console.log(`  - USDC amount: ${actualUsdcAmount.toFixed(6)} USDC`);
          console.log(`  - No swap needed - direct USDC purchase`);
      }
      
      // Step 3: Check minimum transaction value
      const meetsMinTransactionValue = actualUsdcAmount >= 1.0;
      
      if (!meetsMinTransactionValue) {
          const minimumNgnRequired = Math.ceil(usdcToNgnRate * 1.0);
          console.error(`[SOLANA_USDC_DIRECT] ❌ Transaction value too small`);
          throw new Error(`Transaction value ($${actualUsdcAmount.toFixed(6)}) is below minimum ($1 USDC = ₦${minimumNgnRequired.toLocaleString()}). Minimum purchase: ₦${minimumNgnRequired.toLocaleString()}`);
      }
      
      console.log(`[SOLANA_USDC_DIRECT] ✅ Transaction meets minimum value: $${actualUsdcAmount.toFixed(6)} USDC (>$1.0 required)`);
      
      const unitPriceInNgn = usdcToNgnRate;
      const pricePerTokenUsdc = 1.0; // 1 USDC = 1 USDC
      
      console.log(`[SOLANA_USDC_DIRECT] ✅ Direct USDC purchase calculation:`);
      console.log(`  - Unit price: 1 USDC = ₦${unitPriceInNgn.toLocaleString()}`);
      console.log(`  - Customer gets: ${actualUsdcAmount.toFixed(6)} USDC`);
      console.log(`  - Total value: ₦${actualNgnValue.toLocaleString()}`);
      console.log(`  - Exchange rate source: Current onramp API`);
      console.log(`  - Token type: Solana USDC (direct)`);
      
      return {
          cryptoSymbol: 'USDC',
          cryptoAmount: actualUsdcAmount,
          network: 'solana',
          tokenAddress: tokenInfo.contractAddress,
          decimals: tokenInfo.decimals || 6,
          isNativeToken: false,
          
          // Pricing information
          unitPriceInNgn: unitPriceInNgn,
          totalNgnNeeded: actualNgnValue,
          exchangeRate: unitPriceInNgn,
          ngnToTokenRate: 1 / unitPriceInNgn,
          
          // USDC conversion data
          usdcValue: actualUsdcAmount,
          pricePerTokenUsdc: pricePerTokenUsdc,
          usdcToNgnRate: usdcToNgnRate,
          
          // Validation results - all true for direct USDC
          jupiterSupported: true, // Not needed but mark as supported
          meetsMinTransactionValue: meetsMinTransactionValue,
          hasAdequatePoolLiquidity: true, // No liquidity needed for direct purchase
          liquidityWarning: false,
          canProcessOnramp: true,
          bestRoute: 'Direct USDC Purchase',
          priceImpact: 0, // No price impact for direct purchase
          
          // Swap routing information (not needed for direct USDC)
          swapRoute: {
              inputToken: tokenInfo.contractAddress,
              outputToken: tokenInfo.contractAddress, // Same token
              route: 'Direct USDC Purchase',
              expectedUsdcOut: actualUsdcAmount,
              priceImpact: 0,
              routeSteps: [],
              jupiterQuote: null,
              network: 'solana',
              isDirect: true
          },
          
          // Formatting
          formattedPrice: `₦${unitPriceInNgn.toLocaleString()}`,
          exchangeRateString: `1 USDC = ₦${unitPriceInNgn.toLocaleString()}`,
          usdcRateString: `1 USDC = $1.00 USDC`,
          currentUsdcRate: `1 USDC = ₦${usdcToNgnRate.toLocaleString()}`,
          
          // Metadata
          timestamp: new Date(),
          source: 'direct_usdc_purchase_with_current_rates',
          rateSource: 'onramp_api',
          validation: {
              businessSupported: true,
              jupiterSupported: true, // Not applicable but set to true
              meetsMinValue: meetsMinTransactionValue,
              hasLiquidity: true, // Not applicable for direct purchase
              canSwap: false, // No swap needed
              actualPurchaseAmount: actualUsdcAmount,
              actualUsdcValue: actualUsdcAmount,
              currentUsdcRate: usdcToNgnRate,
              minimumUsdcRequired: 1.0,
              minimumNgnRequired: Math.ceil(usdcToNgnRate * 1.0),
              isNativeToken: false,
              effectiveTokenAddress: tokenInfo.contractAddress,
              priceImpact: 0,
              routeSteps: 0,
              isDirect: true
          }
      };
      
  } catch (error) {
      console.error(`[SOLANA_USDC_DIRECT] Error processing direct USDC purchase:`, error.message);
      throw error;
  }
}

/**
 * NEW: Process Solana network tokens using Jupiter
 */
async function processSolanaNetworkToken(cryptoSymbol, tokenInfo, cryptoAmount, customerNgnAmount = null) {
  try {
      console.log(`[SOLANA_TOKEN_PROCESSOR_FIXED] Processing Solana token: ${cryptoSymbol}`);
      
      // SPECIAL CASE: If customer wants USDC on Solana, no swap needed
      const isUSDC = cryptoSymbol.toUpperCase() === 'USDC' || 
                     tokenInfo.contractAddress === SOLANA_CONFIG.TOKENS.USDC;
      
      if (isUSDC) {
          console.log(`[SOLANA_TOKEN_PROCESSOR_FIXED] 🪙 USDC detected - no swap needed, direct USDC purchase`);
          return await processSolanaUSDCDirect(cryptoSymbol, tokenInfo, cryptoAmount, customerNgnAmount);
      }
      
      // For non-USDC tokens, use Jupiter swap to USDC
      console.log(`[SOLANA_TOKEN_PROCESSOR_FIXED] 🔄 Non-USDC token - will swap to USDC via Jupiter`);
      
      // Step 1: Get unit price using Jupiter
      console.log(`[SOLANA_TOKEN_PROCESSOR_FIXED] Getting unit price for ${cryptoSymbol}...`);
      const unitPriceResult = await solanaChecker.getTokenToUSDCPrice(tokenInfo.contractAddress, 1, {
          verbose: false,
          minLiquidityThreshold: 0
      });
      
      if (!unitPriceResult.success) {
          console.error(`[SOLANA_TOKEN_PROCESSOR_FIXED] ❌ Failed to get ${cryptoSymbol} unit price:`, unitPriceResult.error);
          throw new Error(`Failed to get ${cryptoSymbol} price from Jupiter: ${unitPriceResult.error}`);
      }
      
      console.log(`[SOLANA_TOKEN_PROCESSOR_FIXED] ✅ Unit price: 1 ${cryptoSymbol} = $${unitPriceResult.pricePerToken} USDC`);
      
      // Step 2: Get CURRENT USDC to NGN rate
      console.log(`[SOLANA_TOKEN_PROCESSOR_FIXED] Getting current USDC-NGN exchange rate...`);
      const usdcToNgnRate = await getUSDCToNGNRate();
      console.log(`[SOLANA_TOKEN_PROCESSOR_FIXED] ✅ Current USDC rate: ₦${usdcToNgnRate.toLocaleString()}`);
      
      // Step 3: Calculate customer's actual token amount if NGN amount provided
      let actualTokenAmount = cryptoAmount;
      let actualUsdcValue = unitPriceResult.usdcValue * cryptoAmount;
      
      if (customerNgnAmount) {
          const customerUsdcAmount = customerNgnAmount / usdcToNgnRate;
          actualTokenAmount = customerUsdcAmount / unitPriceResult.pricePerToken;
          actualUsdcValue = customerUsdcAmount;
          
          console.log(`[SOLANA_TOKEN_PROCESSOR_FIXED] Customer purchase calculation with CURRENT rates:`);
          console.log(`  - Customer NGN: ₦${customerNgnAmount.toLocaleString()}`);
          console.log(`  - Current USDC rate: ₦${usdcToNgnRate.toLocaleString()}`);
          console.log(`  - USDC equivalent: $${customerUsdcAmount.toFixed(6)}`);
          console.log(`  - Token unit price: $${unitPriceResult.pricePerToken.toFixed(8)} USDC`);
          console.log(`  - Token amount: ${actualTokenAmount.toFixed(8)} ${cryptoSymbol}`);
          console.log(`  - Total USDC value: $${actualUsdcValue.toFixed(6)}`);
      }
      
      // Step 4: Check minimum transaction value
      const meetsMinTransactionValue = actualUsdcValue >= 1.0;
      
      if (!meetsMinTransactionValue) {
          const minimumNgnRequired = Math.ceil(usdcToNgnRate * 1.0);
          console.error(`[SOLANA_TOKEN_PROCESSOR_FIXED] ❌ Transaction value too small for ${cryptoSymbol}`);
          throw new Error(`Transaction value ($${actualUsdcValue.toFixed(6)}) is below minimum ($1 USDC = ₦${minimumNgnRequired.toLocaleString()}). Minimum purchase: ₦${minimumNgnRequired.toLocaleString()}`);
      }
      
      console.log(`[SOLANA_TOKEN_PROCESSOR_FIXED] ✅ Transaction meets minimum value: $${actualUsdcValue.toFixed(6)} USDC (>$1.0 required)`);
      
      // Step 5: Check liquidity for large orders
      const hasAdequatePoolLiquidity = unitPriceResult.hasAdequatePoolLiquidity;
      if (!hasAdequatePoolLiquidity && actualUsdcValue > 100) {
          console.log(`[SOLANA_TOKEN_PROCESSOR_FIXED] ⚠️  Large order with limited liquidity - may experience slippage`);
      }
      
      // Step 6: Calculate final NGN values using CURRENT rate
      const totalNgnValue = actualUsdcValue * usdcToNgnRate;
      const unitPriceInNgn = (unitPriceResult.pricePerToken * usdcToNgnRate);
      
      console.log(`[SOLANA_TOKEN_PROCESSOR_FIXED] ✅ Final calculation with CURRENT rates:`);
      console.log(`  - Unit price: $${unitPriceResult.pricePerToken.toFixed(8)} USDC = ₦${unitPriceInNgn.toLocaleString()}`);
      console.log(`  - Customer gets: ${actualTokenAmount.toFixed(8)} ${cryptoSymbol}`);
      console.log(`  - Total value: $${actualUsdcValue.toFixed(6)} USDC = ₦${totalNgnValue.toLocaleString()}`);
      console.log(`  - Exchange rate source: Current onramp API`);
      console.log(`  - Token type: Solana SPL Token`);
      
      // Step 7: Prepare swap routing information for Jupiter
      const swapRoute = {
          inputToken: tokenInfo.contractAddress,
          outputToken: SOLANA_CONFIG.TOKENS.USDC,
          route: unitPriceResult.bestRoute,
          expectedUsdcOut: actualUsdcValue,
          priceImpact: unitPriceResult.priceImpact,
          routeSteps: unitPriceResult.routeSteps,
          jupiterQuote: unitPriceResult.jupiterQuote,
          network: 'solana'
      };
      
      return {
          cryptoSymbol: cryptoSymbol.toUpperCase(),
          cryptoAmount: actualTokenAmount,
          network: 'solana',
          tokenAddress: tokenInfo.contractAddress,
          decimals: tokenInfo.decimals || 9,
          isNativeToken: tokenInfo.contractAddress === SOLANA_CONFIG.TOKENS.SOL,
          
          // Pricing information with CURRENT rates
          unitPriceInNgn: unitPriceInNgn,
          totalNgnNeeded: totalNgnValue,
          exchangeRate: unitPriceInNgn,
          ngnToTokenRate: 1 / unitPriceInNgn,
          
          // USDC conversion data with CURRENT rate
          usdcValue: actualUsdcValue,
          pricePerTokenUsdc: unitPriceResult.pricePerToken,
          usdcToNgnRate: usdcToNgnRate,
          
          // Validation results
          jupiterSupported: true,
          meetsMinTransactionValue: meetsMinTransactionValue,
          hasAdequatePoolLiquidity: hasAdequatePoolLiquidity,
          liquidityWarning: !hasAdequatePoolLiquidity && actualUsdcValue > 100,
          poolLiquidityInfo: unitPriceResult.poolLiquidityInfo,
          canProcessOnramp: true,
          bestRoute: unitPriceResult.bestRoute,
          priceImpact: unitPriceResult.priceImpact,
          
          // Swap routing information
          swapRoute: swapRoute,
          
          // Formatting with CURRENT rates
          formattedPrice: `₦${unitPriceInNgn.toLocaleString()}`,
          exchangeRateString: `1 ${cryptoSymbol} = ₦${unitPriceInNgn.toLocaleString()}`,
          usdcRateString: `1 ${cryptoSymbol} = $${unitPriceResult.pricePerToken.toFixed(6)} USDC`,
          currentUsdcRate: `1 USDC = ₦${usdcToNgnRate.toLocaleString()}`,
          
          // Metadata
          timestamp: new Date(),
          source: 'jupiter_dex_with_current_rates',
          rateSource: 'onramp_api',
          validation: {
              businessSupported: true,
              jupiterSupported: true,
              meetsMinValue: meetsMinTransactionValue,
              hasLiquidity: hasAdequatePoolLiquidity,
              canSwap: true,
              actualPurchaseAmount: actualTokenAmount,
              actualUsdcValue: actualUsdcValue,
              currentUsdcRate: usdcToNgnRate,
              minimumUsdcRequired: 1.0,
              minimumNgnRequired: Math.ceil(usdcToNgnRate * 1.0),
              isNativeToken: tokenInfo.contractAddress === SOLANA_CONFIG.TOKENS.SOL,
              effectiveTokenAddress: tokenInfo.contractAddress,
              priceImpact: unitPriceResult.priceImpact,
              routeSteps: unitPriceResult.routeSteps
          }
      };
      
  } catch (error) {
      console.error(`[SOLANA_TOKEN_PROCESSOR_FIXED] Error processing Solana token ${cryptoSymbol}:`, error.message);
      throw error;
  }
}

/**
 * Process non-Base/Solana tokens using internal API
 */
async function processNonBaseToken(cryptoSymbol, tokenInfo, network, cryptoAmount) {
  try {
    console.log(`[NON_BASE_PROCESSOR] Processing ${network} token: ${cryptoSymbol}`);
    
    const baseUrl = process.env.INTERNAL_API_BASE_URL || 'http://localhost:5002';
    const response = await axios.get(`${baseUrl}/api/v1/onramp-price`, {
      params: {
        cryptoSymbol: cryptoSymbol,
        cryptoAmount: cryptoAmount,
        network: network
      },
      timeout: 10000
    });
    
    if (!response.data || !response.data.success) {
      throw new Error(response.data?.message || `Failed to get price for ${cryptoSymbol} on ${network}`);
    }
    
    const priceData = response.data.data;
    
    console.log(`[NON_BASE_PROCESSOR] ✅ ${network} API price: 1 ${cryptoSymbol} = ₦${priceData.unitPriceInNgn.toLocaleString()}`);
    
    return {
      cryptoSymbol: priceData.cryptoSymbol,
      cryptoAmount: priceData.cryptoAmount,
      network: network,
      tokenAddress: tokenInfo.contractAddress,
      decimals: tokenInfo.decimals,
      
      unitPriceInNgn: priceData.unitPriceInNgn,
      totalNgnNeeded: priceData.totalNgnNeeded,
      exchangeRate: priceData.unitPriceInNgn,
      ngnToTokenRate: 1 / priceData.unitPriceInNgn,
      
      formattedPrice: priceData.formattedPrice,
      exchangeRateString: priceData.exchangeRate,
      
      timestamp: new Date(priceData.timestamp),
      source: priceData.source || 'internal_api',
      validation: {
        businessSupported: true,
        contractSupported: null,
        hasLiquidity: true,
        canSwap: true
      }
    };
    
  } catch (error) {
    console.error(`[NON_BASE_PROCESSOR] Error processing ${network} token ${cryptoSymbol}:`, error.message);
    throw error;
  }
}

/**
 * UPDATED: Universal token validation and pricing function that handles Base, Solana, and other networks
 */
async function validateAndPriceToken(cryptoSymbol, business, cryptoAmount = 1, customerNgnAmount = null) {
  try {
    console.log(`[TOKEN_PROCESSOR_FIXED] Processing ${cryptoSymbol} ${customerNgnAmount ? `for customer purchase: ₦${customerNgnAmount.toLocaleString()}` : `for ${cryptoAmount} tokens`}`);
    
    // AUTO-INITIALIZE DEFAULT TOKENS IF MISSING
    await ensureBusinessHasDefaultTokens(business);
    
    // Step 1: Find token in business configuration - MUST RESPECT NETWORK SPECIFICITY
    let tokenAddress = null;
    let tokenInfo = null;
    let network = null;
    let requestedNetwork = null; // Track what network was requested
    
    // NEW: If we're processing a request with a specific network, prioritize that network
    if (global.currentRequestNetwork) {
      requestedNetwork = global.currentRequestNetwork;
      console.log(`[TOKEN_PROCESSOR_FIXED] 🎯 Prioritizing requested network: ${requestedNetwork}`);
      
      // Check the requested network first
      if (business.supportedTokens?.[requestedNetwork]) {
        const token = business.supportedTokens[requestedNetwork].find(
          t => t.symbol.toUpperCase() === cryptoSymbol.toUpperCase() && 
               t.isActive !== false && 
               t.isTradingEnabled !== false
        );
        if (token) {
          tokenAddress = token.contractAddress;
          tokenInfo = token;
          network = requestedNetwork;
          console.log(`[TOKEN_PROCESSOR_FIXED] ✅ Found ${cryptoSymbol} on REQUESTED network: ${network}`);
        }
      }
    }
    
    // If not found on requested network, search other networks
    if (!tokenAddress || !tokenInfo) {
      for (const networkName of ['base', 'solana', 'ethereum']) {
        // Skip the already-checked requested network
        if (networkName === requestedNetwork) continue;
        
        if (business.supportedTokens?.[networkName]) {
          const token = business.supportedTokens[networkName].find(
            t => t.symbol.toUpperCase() === cryptoSymbol.toUpperCase() && 
                 t.isActive !== false && 
                 t.isTradingEnabled !== false
          );
          if (token) {
            tokenAddress = token.contractAddress;
            tokenInfo = token;
            network = networkName;
            
            // WARN if we're using a different network than requested
            if (requestedNetwork && network !== requestedNetwork) {
              console.log(`[TOKEN_PROCESSOR_FIXED] ⚠️  ${cryptoSymbol} NOT found on requested ${requestedNetwork}, using ${network} instead`);
            }
            break;
          }
        }
      }
    }
    
    if (!tokenAddress || !tokenInfo) {
      throw new Error(`Token ${cryptoSymbol} is not configured in your business supported tokens${requestedNetwork ? ` for ${requestedNetwork} network` : ''}`);
    }
    
    console.log(`[TOKEN_PROCESSOR_FIXED] ✅ Final routing: ${cryptoSymbol} → ${network} network (${tokenAddress})`);
    
    // Step 2: Route to appropriate network processor - FIXED ROUTING
    if (network === 'base') {
      console.log(`[TOKEN_PROCESSOR_FIXED] 🔵 Processing on Base network`);
      return await processBaseNetworkTokenFixed(cryptoSymbol, tokenInfo, cryptoAmount, customerNgnAmount);
    } else if (network === 'solana') {
      console.log(`[TOKEN_PROCESSOR_FIXED] 🟡 Processing on Solana network`);
      return await processSolanaNetworkToken(cryptoSymbol, tokenInfo, cryptoAmount, customerNgnAmount);
    } else {
      console.log(`[TOKEN_PROCESSOR_FIXED] 🔴 Processing on ${network} network via internal API`);
      return await processNonBaseToken(cryptoSymbol, tokenInfo, network, cryptoAmount);
    }
    
  } catch (error) {
    console.error(`[TOKEN_PROCESSOR_FIXED] Error processing ${cryptoSymbol}:`, error.message);
    throw error;
  }
}

/**
 * Initialize transaction for Base network tokens
 */
async function initializeBaseTransaction(orderData, priceData) {
  try {
    console.log(`[TRANSACTION_INIT] Initializing Base transaction for ${orderData.targetToken}`);
    
    const transactionParams = {
      orderId: orderData.orderId,
      inputToken: priceData.tokenAddress,
      outputToken: priceData.swapRoute.outputToken,
      inputAmount: orderData.estimatedTokenAmount,
      expectedOutputAmount: priceData.usdcValue,
      customerWallet: orderData.customerWallet,
      swapRoute: priceData.swapRoute,
      deadline: priceData.swapRoute.deadline,
      slippageTolerance: priceData.swapRoute.slippageTolerance
    };
    
    const liquidityServerUrl = process.env.LIQUIDITY_SERVER_WEBHOOK_URL;
    if (!liquidityServerUrl) {
      throw new Error('Liquidity server URL not configured');
    }
    
    console.log(`[TRANSACTION_INIT] Sending transaction request to liquidity server...`);
    
    const payload = {
      event: 'transaction.prepare',
      timestamp: new Date().toISOString(),
      data: transactionParams
    };
    
    const signature = crypto
      .createHmac('sha256', process.env.LIQUIDITY_WEBHOOK_SECRET || 'liquidity-secret')
      .update(JSON.stringify(payload))
      .digest('hex');
    
    const response = await axios.post(liquidityServerUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Service': 'OnrampService'
      },
      timeout: 15000
    });
    
    if (response.data.success) {
      console.log(`[TRANSACTION_INIT] ✅ Transaction initialized: ${response.data.transactionId}`);
      return {
        success: true,
        transactionId: response.data.transactionId,
        expectedGas: response.data.expectedGas,
        estimatedConfirmationTime: response.data.estimatedConfirmationTime
      };
    } else {
      throw new Error(`Transaction initialization failed: ${response.data.message}`);
    }
    
  } catch (error) {
    console.error(`[TRANSACTION_INIT] Failed to initialize transaction:`, error.message);
    throw error;
  }
}

/**
 * NEW: Initialize transaction for Solana network tokens
 */
/**
 * UPDATED Generic Token Onramp Controller - Part 2 (Controller Methods)
 * Contains all controller methods with Base and Solana support
 */

// Continue from Part 1...

async function initializeSolanaTransaction(orderData, priceData) {
  try {
    console.log(`[SOLANA_TRANSACTION_INIT] Initializing Solana transaction for ${orderData.targetToken}`);
    
    const transactionParams = {
      orderId: orderData.orderId,
      inputToken: priceData.tokenAddress,
      outputToken: SOLANA_CONFIG.TOKENS.USDC,
      inputAmount: orderData.estimatedTokenAmount,
      expectedOutputAmount: priceData.usdcValue,
      customerWallet: orderData.customerWallet,
      jupiterQuote: priceData.swapRoute.jupiterQuote,
      priceImpact: priceData.priceImpact,
      routeSteps: priceData.swapRoute.routeSteps,
      network: 'solana'
    };
    
    const solanaServerUrl = process.env.SOLANA_LIQUIDITY_SERVER_WEBHOOK_URL;
    if (!solanaServerUrl) {
      console.warn(`[SOLANA_TRANSACTION_INIT] Solana liquidity server URL not configured, skipping transaction preparation`);
      return {
        success: true,
        transactionId: `SOLANA_${Date.now()}`,
        note: 'Transaction prepared for manual execution'
      };
    }
    
    console.log(`[SOLANA_TRANSACTION_INIT] Sending transaction request to Solana liquidity server...`);
    
    const payload = {
      event: 'solana.transaction.prepare',
      timestamp: new Date().toISOString(),
      data: transactionParams
    };
    
    const signature = crypto
      .createHmac('sha256', process.env.SOLANA_WEBHOOK_SECRET || 'solana-secret')
      .update(JSON.stringify(payload))
      .digest('hex');
    
    const response = await axios.post(solanaServerUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Service': 'OnrampService',
        'X-Network': 'solana'
      },
      timeout: 15000
    });
    
    if (response.data.success) {
      console.log(`[SOLANA_TRANSACTION_INIT] ✅ Solana transaction initialized: ${response.data.transactionId}`);
      return {
        success: true,
        transactionId: response.data.transactionId,
        estimatedConfirmationTime: response.data.estimatedConfirmationTime || '30-60 seconds'
      };
    } else {
      throw new Error(`Solana transaction initialization failed: ${response.data.message}`);
    }
    
  } catch (error) {
    console.error(`[SOLANA_TRANSACTION_INIT] Failed to initialize Solana transaction:`, error.message);
    return {
      success: false,
      error: error.message,
      transactionId: `MANUAL_${Date.now()}`
    };
  }
}

// Helper function to send webhook to business
async function sendBusinessWebhook(webhookUrl, orderData, eventType = 'order.updated') {
  try {
    if (!webhookUrl) {
      return { sent: false, reason: 'no_url' };
    }
    
    console.log(`[BUSINESS_WEBHOOK] Sending ${eventType} webhook`);
    
    const webhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: orderData
    };
    
    const signature = crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET || 'default-secret')
      .update(JSON.stringify(webhookPayload))
      .digest('hex');
    
    await axios.post(webhookUrl, webhookPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'User-Agent': 'OnrampService/1.0'
      },
      timeout: 10000
    });
    
    console.log(`[BUSINESS_WEBHOOK] ✅ ${eventType} webhook sent successfully`);
    return { sent: true };
  } catch (error) {
    console.error(`[BUSINESS_WEBHOOK] Failed to send webhook:`, error.message);
    return { sent: false, error: error.message };
  }
}

const genericTokenOnrampController = {
  // Get supported tokens with network information
  getSupportedTokens: async (req, res) => {
    try {
      console.log('[GENERIC_CONTROLLER] Getting supported tokens');
      const business = req.business;
      
      const fullBusiness = await Business.findById(business.id || business._id);
      
      if (!fullBusiness || !fullBusiness.supportedTokens) {
        return res.json({
          success: true,
          data: {
            supportedTokens: {},
            businessInfo: {
              businessId: business.businessId,
              businessName: business.businessName
            },
            statistics: {
              totalTokens: 0
            }
          }
        });
      }
      
      const supportedTokens = {};
      let totalTokens = 0;
      
      for (const [network, tokens] of Object.entries(fullBusiness.supportedTokens)) {
        if (Array.isArray(tokens)) {
          supportedTokens[network] = tokens.map(token => ({
            symbol: token.symbol,
            name: token.name,
            contractAddress: token.contractAddress,
            decimals: token.decimals,
            isActive: token.isActive !== false,
            feePercentage: 1.5,
            network: network
          }));
          totalTokens += tokens.length;
        }
      }
      
      res.json({
        success: true,
        data: {
          supportedTokens,
          businessInfo: {
            businessId: fullBusiness.businessId,
            businessName: fullBusiness.businessName
          },
          statistics: {
            totalTokens,
            networks: Object.keys(supportedTokens),
            baseTokens: supportedTokens.base?.length || 0,
            solanaTokens: supportedTokens.solana?.length || 0,
            ethereumTokens: supportedTokens.ethereum?.length || 0
          }
        }
      });
      
    } catch (error) {
      console.error('[GENERIC_CONTROLLER] Error getting supported tokens:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get supported tokens',
        error: error.message
      });
    }
  },

  // UPDATED: Universal token onramp order creation with Base and Solana support
  createOnrampOrder: async (req, res) => {
    try {
      console.log('[GENERIC_ONRAMP_FIXED] Creating universal token onramp order with FIXED network routing');
      const business = req.business;
      const {
        customerEmail,
        customerName,
        customerPhone,
        amount,
        targetToken,
        targetNetwork,
        customerWallet,
        redirectUrl,
        webhookUrl,
        metadata = {}
      } = req.body;
      
      // Input validation
      if (!customerEmail || !customerName || !amount || !targetToken || !targetNetwork || !customerWallet) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
          required: ['customerEmail', 'customerName', 'amount', 'targetToken', 'targetNetwork', 'customerWallet'],
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }
      
      // Amount validation
      if (amount < 1000 || amount > 10000000) {
        return res.status(400).json({
          success: false,
          message: 'Amount must be between ₦1,000 and ₦10,000,000',
          code: 'INVALID_AMOUNT_RANGE'
        });
      }
      
      // Network validation
      const supportedNetworks = ['base', 'solana', 'ethereum'];
      if (!supportedNetworks.includes(targetNetwork.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Unsupported network: ${targetNetwork}. Supported networks: ${supportedNetworks.join(', ')}`,
          code: 'UNSUPPORTED_NETWORK'
        });
      }
      
      console.log(`[GENERIC_ONRAMP_FIXED] Customer wants: ₦${amount.toLocaleString()} worth of ${targetToken} on ${targetNetwork}`);
      
      // CRITICAL FIX: Set the requested network in global context for proper routing
      global.currentRequestNetwork = targetNetwork.toLowerCase();
      
      try {
        // Step 1: Calculate fees first to get net amount for token purchase
        const tokenInfo = business.supportedTokens?.[targetNetwork]?.find(
          t => t.symbol.toUpperCase() === targetToken.toUpperCase() && 
               t.isActive !== false && 
               t.isTradingEnabled !== false
        );
        
        if (!tokenInfo) {
          return res.status(400).json({
            success: false,
            message: `Token ${targetToken} is not configured for your business on ${targetNetwork}`,
            code: 'TOKEN_NOT_CONFIGURED'
          });
        }
        
        const feeConfig = business.feeConfiguration?.[targetNetwork]?.find(
          f => f.contractAddress?.toLowerCase() === tokenInfo.contractAddress?.toLowerCase() && f.isActive
        );
        const feePercentage = feeConfig ? feeConfig.feePercentage : 0;
        const feeAmount = Math.round(amount * (feePercentage / 100));
        const netAmount = amount - feeAmount;
        
        console.log(`[GENERIC_ONRAMP_FIXED] Fee calculation:`);
        console.log(`  - Gross amount: ₦${amount.toLocaleString()}`);
        console.log(`  - Business fee (${feePercentage}%): ₦${feeAmount.toLocaleString()}`);
        console.log(`  - Net amount for tokens: ₦${netAmount.toLocaleString()}`);
        
        // Step 2: Validate with customer's actual net purchase amount using FIXED routing
        let priceData;
        try {
          priceData = await validateAndPriceToken(targetToken, business, 1, netAmount);
        } catch (validationError) {
          console.error(`[GENERIC_ONRAMP_FIXED] ❌ Token validation failed:`, validationError.message);
          
          return res.status(400).json({
            success: false,
            message: validationError.message,
            details: {
              token: targetToken,
              network: targetNetwork,
              customerAmount: `₦${amount.toLocaleString()}`,
              netAmountForTokens: `₦${netAmount.toLocaleString()}`,
              step: 'token_validation_with_current_rates_fixed_routing'
            },
            code: 'TOKEN_VALIDATION_FAILED'
          });
        }
        
        // VERIFY: Ensure we got the correct network
        if (priceData.network !== targetNetwork.toLowerCase()) {
          console.warn(`[GENERIC_ONRAMP_FIXED] ⚠️  Network mismatch: requested ${targetNetwork}, got ${priceData.network}`);
          // Could return error here if strict network adherence required
        }
        
        console.log(`[GENERIC_ONRAMP_FIXED] ✅ Token validation passed using CURRENT rates on ${priceData.network}`);
        console.log(`[GENERIC_ONRAMP_FIXED] Customer will receive: ${priceData.cryptoAmount.toFixed(8)} ${targetToken}`);
        console.log(`[GENERIC_ONRAMP_FIXED] Current USDC rate: ₦${priceData.usdcToNgnRate.toLocaleString()}`);
        
        // Step 3: Use the calculated token amount from priceData
        const estimatedTokenAmount = parseFloat(priceData.cryptoAmount.toFixed(priceData.decimals || 18));
        
        console.log(`[GENERIC_ONRAMP_FIXED] Final order calculations:`);
        console.log(`  - Gross Amount: ₦${amount.toLocaleString()}`);
        console.log(`  - Fee (${feePercentage}%): ₦${feeAmount.toLocaleString()}`);
        console.log(`  - Net Amount: ₦${netAmount.toLocaleString()}`);
        console.log(`  - Token Amount: ${estimatedTokenAmount} ${targetToken}`);
        console.log(`  - Price Source: ${priceData.source}`);
        console.log(`  - Network: ${priceData.network}`);
        
        // Step 4: Generate unique identifiers
        const businessOrderReference = `ONRAMP-${targetToken}-${uuidv4().substr(0, 8).toUpperCase()}`;
        const orderId = `OR_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        // Step 5: Create order with enhanced metadata
        const order = new BusinessOnrampOrder({
          orderId,
          businessId: business._id,
          businessOrderReference,
          customerEmail: customerEmail.toLowerCase().trim(),
          customerName: customerName.trim(),
          customerPhone: customerPhone?.trim(),
          amount,
          targetToken: targetToken.toUpperCase(),
          targetNetwork: targetNetwork.toLowerCase(),
          tokenContractAddress: priceData.tokenAddress,
          customerWallet: customerWallet.trim(),
          exchangeRate: priceData.unitPriceInNgn,
          estimatedTokenAmount,
          feePercentage,
          feeAmount,
          netAmount,
          status: BUSINESS_ORDER_STATUS.INITIATED,
          redirectUrl: redirectUrl?.trim(),
          webhookUrl: webhookUrl?.trim(),
          metadata: {
            ...metadata,
            // Token validation results
            tokenValidation: priceData.validation,
            // Pricing metadata with current rates
            pricingSource: priceData.source,
            pricingTimestamp: priceData.timestamp,
            currentUsdcRate: priceData.usdcToNgnRate,
            rateSource: priceData.rateSource,
            // Network-specific data
            ...(priceData.network === 'base' && priceData.usdcValue && {
              smartContractData: {
                usdcValue: priceData.usdcValue,
                pricePerTokenUsdc: priceData.pricePerTokenUsdc,
                bestRoute: priceData.bestRoute,
                reserveSupported: priceData.reserveSupported,
                liquidityAdequate: priceData.hasAdequatePoolLiquidity,
                swapRoute: priceData.swapRoute,
                actualUsdcValue: priceData.validation.actualUsdcValue
              }
            }),
            ...(priceData.network === 'solana' && {
              jupiterData: {
                usdcValue: priceData.usdcValue,
                pricePerTokenUsdc: priceData.pricePerTokenUsdc,
                bestRoute: priceData.bestRoute,
                priceImpact: priceData.priceImpact,
                routeSteps: priceData.swapRoute.routeSteps,
                jupiterQuote: priceData.swapRoute.jupiterQuote,
                actualUsdcValue: priceData.validation.actualUsdcValue
              }
            })
          },
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000)
        });
        
        await order.save();
        console.log(`[GENERIC_ONRAMP_FIXED] ✅ Order created: ${order.orderId}`);
        
        // Step 6: Generate payment link
        console.log(`[GENERIC_ONRAMP_FIXED] Generating payment link...`);
        const paymentDetails = await monnifyService.generatePaymentLink({
          amount,
          reference: businessOrderReference,
          customerName,
          customerEmail,
          redirectUrl: redirectUrl || `${process.env.FRONTEND_URL}/payment/success?orderId=${orderId}`
        });
        
        if (!paymentDetails.success) {
          throw new Error(`Payment link generation failed: ${paymentDetails.message}`);
        }
        
        console.log(`[GENERIC_ONRAMP_FIXED] ✅ Payment link generated`);
        
        // Step 7: Initialize transaction preparation based on network
        let transactionPreparation = null;
        if (priceData.network === 'base' && priceData.swapRoute) {
          try {
            transactionPreparation = await initializeBaseTransaction(order, priceData);
            console.log(`[GENERIC_ONRAMP_FIXED] ✅ Base transaction preparation initiated`);
          } catch (transactionError) {
            console.warn(`[GENERIC_ONRAMP_FIXED] Base transaction preparation failed:`, transactionError.message);
          }
        } else if (priceData.network === 'solana' && priceData.swapRoute) {
          try {
            transactionPreparation = await initializeSolanaTransaction(order, priceData);
            console.log(`[GENERIC_ONRAMP_FIXED] ✅ Solana transaction preparation initiated`);
          } catch (transactionError) {
            console.warn(`[GENERIC_ONRAMP_FIXED] Solana transaction preparation failed:`, transactionError.message);
          }
        }
        
        // Step 8: Prepare comprehensive response
        const responseData = {
          orderId: order.orderId,
          businessOrderReference: order.businessOrderReference,
          amount: order.amount,
          targetToken: order.targetToken,
          targetNetwork: order.targetNetwork,
          actualNetwork: priceData.network, // Show which network was actually used
          requestedNetwork: targetNetwork.toLowerCase(),
          networkMatches: priceData.network === targetNetwork.toLowerCase(),
          estimatedTokenAmount: order.estimatedTokenAmount,
          exchangeRate: order.exchangeRate,
          feeAmount: order.feeAmount,
          feePercentage: order.feePercentage,
          status: order.status,
          expiresAt: order.expiresAt,
          customerWallet: order.customerWallet,
          
          // Payment information
          paymentDetails: {
            paymentUrl: paymentDetails.checkoutUrl,
            paymentReference: paymentDetails.paymentReference || businessOrderReference,
            transactionReference: paymentDetails.transactionReference,
            expiresIn: 1800
          },
          
          // Token and pricing information with CURRENT rates
          tokenInfo: {
            symbol: priceData.cryptoSymbol,
            address: priceData.tokenAddress,
            network: priceData.network,
            decimals: priceData.decimals,
            isNativeToken: priceData.isNativeToken
          },
          
          pricingInfo: {
            source: priceData.source,
            timestamp: priceData.timestamp,
            exchangeRateString: priceData.exchangeRateString,
            currentUsdcRate: priceData.currentUsdcRate,
            rateSource: priceData.rateSource,
            ...(priceData.usdcRateString && { usdcRateString: priceData.usdcRateString })
          },
          
          // Validation results
          validation: priceData.validation,
          
          // Configuration
          webhookConfigured: !!order.webhookUrl
        };
        
        // Add network-specific data
        if (priceData.network === 'base' && priceData.usdcValue) {
          responseData.smartContractData = {
            usdcValue: priceData.usdcValue,
            pricePerTokenUsdc: priceData.pricePerTokenUsdc,
            bestRoute: priceData.bestRoute,
            swapRoute: priceData.swapRoute,
            reserveSupported: priceData.reserveSupported,
            liquidityAdequate: priceData.hasAdequatePoolLiquidity
          };
          
          if (transactionPreparation) {
            responseData.transactionPreparation = transactionPreparation;
          }
        } else if (priceData.network === 'solana') {
          responseData.jupiterData = {
            usdcValue: priceData.usdcValue,
            pricePerTokenUsdc: priceData.pricePerTokenUsdc,
            bestRoute: priceData.bestRoute,
            priceImpact: priceData.priceImpact,
            routeSteps: priceData.swapRoute.routeSteps,
            jupiterSupported: priceData.validation.jupiterSupported
          };
          
          if (transactionPreparation) {
            responseData.transactionPreparation = transactionPreparation;
          }
        }
        
        // Step 9: Send optional webhook (non-blocking)
        if (order.webhookUrl) {
          const orderData = {
            orderId: order.orderId,
            businessOrderReference: order.businessOrderReference,
            status: order.status,
            amount: order.amount,
            targetToken: order.targetToken,
            targetNetwork: order.targetNetwork,
            actualNetwork: priceData.network,
            estimatedTokenAmount: order.estimatedTokenAmount,
            customerEmail: order.customerEmail,
            customerWallet: order.customerWallet,
            metadata: order.metadata,
            currentUsdcRate: priceData.usdcToNgnRate,
            network: priceData.network
          };
          
          sendBusinessWebhook(order.webhookUrl, orderData, 'order.created')
            .catch(error => console.error('[GENERIC_ONRAMP_FIXED] Webhook failed:', error));
        }
        
        res.status(201).json({
          success: true,
          message: `Onramp order created successfully for ${targetToken} on ${priceData.network} (requested: ${targetNetwork}) using current exchange rates`,
          data: responseData
        });
        
        console.log(`[GENERIC_ONRAMP_FIXED] ✅ Order creation completed for ${targetToken} on ${priceData.network} with current rates`);
        
      } finally {
        // Clean up global context
        delete global.currentRequestNetwork;
      }
      
    } catch (error) {
      console.error('[GENERIC_ONRAMP_FIXED] Order creation error:', error);
      // Clean up global context on error too
      delete global.currentRequestNetwork;
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create onramp order',
        details: {
          token: req.body.targetToken,
          network: req.body.targetNetwork,
          step: 'order_creation_fixed'
        },
        code: 'ORDER_CREATION_FAILED'
      });
    }
  },

  // UPDATED: Universal token quote with Base and Solana support
  getQuote: async (req, res) => {
    try {
      console.log('[GENERIC_QUOTE_FIXED] Getting universal token quote with FIXED network routing');
      const business = req.business;
      const { amount, targetToken, targetNetwork } = req.body;
      
      // Basic validation
      if (!amount || !targetToken || !targetNetwork) {
        return res.status(400).json({
          success: false,
          message: 'Amount, targetToken, and targetNetwork are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }
      
      if (amount < 1000 || amount > 10000000) {
        return res.status(400).json({
          success: false,
          message: 'Amount must be between ₦1,000 and ₦10,000,000',
          code: 'INVALID_AMOUNT_RANGE'
        });
      }
      
      // Network validation
      const supportedNetworks = ['base', 'solana', 'ethereum'];
      if (!supportedNetworks.includes(targetNetwork.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Unsupported network: ${targetNetwork}. Supported networks: ${supportedNetworks.join(', ')}`,
          code: 'UNSUPPORTED_NETWORK'
        });
      }
      
      console.log(`[GENERIC_QUOTE_FIXED] Quote request: ${targetToken} on ${targetNetwork}, Amount: ₦${amount.toLocaleString()}`);
      
      // CRITICAL FIX: Set the requested network in global context
      global.currentRequestNetwork = targetNetwork.toLowerCase();
      
      try {
        // Get token info for fee calculation
        const tokenInfo = business.supportedTokens?.[targetNetwork]?.find(
          t => t.symbol.toUpperCase() === targetToken.toUpperCase() && 
               t.isActive !== false && 
               t.isTradingEnabled !== false
        );
        
        if (!tokenInfo) {
          return res.status(400).json({
            success: false,
            message: `Token ${targetToken} is not configured for your business on ${targetNetwork}`,
            code: 'TOKEN_NOT_CONFIGURED'
          });
        }
        
        // Calculate fees first
        const feeConfig = business.feeConfiguration?.[targetNetwork]?.find(
          f => f.contractAddress?.toLowerCase() === tokenInfo.contractAddress?.toLowerCase() && f.isActive
        );
        const feePercentage = feeConfig ? feeConfig.feePercentage : 0;
        const feeAmount = Math.round(amount * (feePercentage / 100));
        const netAmount = amount - feeAmount;
        
        // Universal token validation and pricing with customer's net amount using FIXED routing
        let priceData;
        try {
          priceData = await validateAndPriceToken(targetToken, business, 1, netAmount);
        } catch (validationError) {
          console.error(`[GENERIC_QUOTE_FIXED] ❌ Validation failed:`, validationError.message);
          
          return res.status(400).json({
            success: false,
            message: validationError.message,
            details: {
              token: targetToken,
              network: targetNetwork,
              customerAmount: `₦${amount.toLocaleString()}`,
              netAmountForTokens: `₦${netAmount.toLocaleString()}`,
              step: 'quote_validation_with_current_rates_fixed_routing'
            },
            code: 'QUOTE_VALIDATION_FAILED'
          });
        }
        
        const finalTokenAmount = parseFloat(priceData.cryptoAmount.toFixed(priceData.decimals || 18));
        const tokenAmount = parseFloat((amount * priceData.ngnToTokenRate).toFixed(priceData.decimals || 18));
        
        // Prepare comprehensive quote response with CURRENT rates
        const responseData = {
          amount,
          targetToken: targetToken.toUpperCase(),
          targetNetwork: targetNetwork.toLowerCase(),
          actualNetwork: priceData.network, // Show which network was actually used
          requestedNetwork: targetNetwork.toLowerCase(),
          networkMatches: priceData.network === targetNetwork.toLowerCase(),
          exchangeRate: priceData.unitPriceInNgn,
          tokenAmount,
          feePercentage,
          feeAmount,
          netAmount,
          finalTokenAmount,
          
          // Detailed breakdown with current rates
          breakdown: {
            grossAmount: `₦${amount.toLocaleString()}`,
            businessFee: `₦${feeAmount.toLocaleString()} (${feePercentage}%)`,
            netAmount: `₦${netAmount.toLocaleString()}`,
            youReceive: `${finalTokenAmount} ${targetToken.toUpperCase()}`,
            currentUsdcRate: priceData.currentUsdcRate
          },
          
          // Token information
          tokenInfo: {
            symbol: priceData.cryptoSymbol,
            address: priceData.tokenAddress,
            network: priceData.network,
            decimals: priceData.decimals,
            isNativeToken: priceData.isNativeToken
          },
          
          // Pricing information with CURRENT rates
          pricingInfo: {
            source: priceData.source,
            timestamp: priceData.timestamp,
            exchangeRateString: priceData.exchangeRateString,
            currentUsdcRate: priceData.currentUsdcRate,
            rateSource: priceData.rateSource,
            ...(priceData.usdcRateString && { usdcRateString: priceData.usdcRateString })
          },
          
          // Validation results
          validation: priceData.validation,
          
          // Quote validity
          validFor: 300, // 5 minutes
          expiresAt: new Date(Date.now() + 5 * 60 * 1000)
        };
        
        // Add network-specific data
        if (priceData.network === 'base' && priceData.usdcValue) {
          responseData.smartContractData = {
            usdcValue: priceData.usdcValue,
            pricePerTokenUsdc: priceData.pricePerTokenUsdc,
            bestRoute: priceData.bestRoute,
            swapRoute: priceData.swapRoute,
            reserveSupported: priceData.reserveSupported,
            liquidityAdequate: priceData.hasAdequatePoolLiquidity,
            estimatedGas: priceData.swapRoute?.estimatedGas || 'TBD'
          };
        } else if (priceData.network === 'solana') {
          responseData.jupiterData = {
            usdcValue: priceData.usdcValue,
            pricePerTokenUsdc: priceData.pricePerTokenUsdc,
            bestRoute: priceData.bestRoute,
            priceImpact: priceData.priceImpact,
            routeSteps: priceData.swapRoute.routeSteps,
            jupiterSupported: priceData.validation.jupiterSupported,
            estimatedConfirmation: '30-60 seconds'
          };
        }
        
        res.json({
          success: true,
          message: `Quote generated successfully for ${targetToken} on ${priceData.network} (requested: ${targetNetwork}) using current exchange rates`,
          data: responseData
        });
        
        console.log(`[GENERIC_QUOTE_FIXED] ✅ Quote completed for ${targetToken} on ${priceData.network} with current rates`);
        
      } finally {
        // Clean up global context
        delete global.currentRequestNetwork;
      }
      
    } catch (error) {
      console.error('[GENERIC_QUOTE_FIXED] Quote error:', error);
      delete global.currentRequestNetwork;
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate quote',
        code: 'QUOTE_ERROR'
      });
    }
  },

  // Get order by ID (all networks)
  getOrderById: async (req, res) => {
    try {
      const { orderId } = req.params;
      const business = req.business;
      
      const order = await BusinessOnrampOrder.findOne({
        $or: [
          { orderId: orderId },
          { businessOrderReference: orderId }
        ],
        businessId: business._id
      });
      
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }
      
      res.json({
        success: true,
        data: {
          orderId: order.orderId,
          businessOrderReference: order.businessOrderReference,
          status: order.status,
          amount: order.amount,
          targetToken: order.targetToken,
          targetNetwork: order.targetNetwork,
          estimatedTokenAmount: order.estimatedTokenAmount,
          actualTokenAmount: order.actualTokenAmount,
          customerEmail: order.customerEmail,
          customerWallet: order.customerWallet,
          exchangeRate: order.exchangeRate,
          feeAmount: order.feeAmount,
          transactionHash: order.transactionHash,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          completedAt: order.completedAt,
          metadata: order.metadata,
          validation: order.metadata?.tokenValidation,
          pricingInfo: {
            source: order.metadata?.pricingSource,
            timestamp: order.metadata?.pricingTimestamp,
            currentUsdcRate: order.metadata?.currentUsdcRate,
            rateSource: order.metadata?.rateSource
          },
          // Network-specific data
          smartContractData: order.metadata?.smartContractData,
          jupiterData: order.metadata?.jupiterData
        }
      });
      
    } catch (error) {
      console.error('[GENERIC_CONTROLLER] Error getting order:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get order',
        error: error.message
      });
    }
  },

  // Get all orders with network filtering
  getAllOrders: async (req, res) => {
    try {
      const business = req.business;
      const {
        status,
        targetToken,
        targetNetwork,
        customerEmail,
        page = 1,
        limit = 20,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;
      
      // Build query
      const query = { businessId: business._id };
      
      if (status) query.status = status;
      if (targetToken) query.targetToken = targetToken.toUpperCase();
      if (targetNetwork) query.targetNetwork = targetNetwork.toLowerCase();
      if (customerEmail) query.customerEmail = customerEmail.toLowerCase();
      
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }
      
      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
      
      // Get orders and total count
      const [orders, total] = await Promise.all([
        BusinessOnrampOrder.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        BusinessOnrampOrder.countDocuments(query)
      ]);
      
      // Calculate summary with network breakdown
      const summary = await BusinessOnrampOrder.aggregate([
        { $match: { businessId: business._id } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalOrders: { $sum: 1 },
            completedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            pendingOrders: {
              $sum: { $cond: [{ $in: ['$status', ['initiated', 'pending', 'processing']] }, 1, 0] }
            },
            totalFees: { $sum: '$feeAmount' },
            baseOrders: {
              $sum: { $cond: [{ $eq: ['$targetNetwork', 'base'] }, 1, 0] }
            },
            solanaOrders: {
              $sum: { $cond: [{ $eq: ['$targetNetwork', 'solana'] }, 1, 0] }
            },
            ethereumOrders: {
              $sum: { $cond: [{ $eq: ['$targetNetwork', 'ethereum'] }, 1, 0] }
            }
          }
        }
      ]);
      
      res.json({
        success: true,
        data: {
          orders: orders.map(order => ({
            orderId: order.orderId,
            businessOrderReference: order.businessOrderReference,
            status: order.status,
            amount: order.amount,
            targetToken: order.targetToken,
            targetNetwork: order.targetNetwork,
            estimatedTokenAmount: order.estimatedTokenAmount,
            actualTokenAmount: order.actualTokenAmount,
            customerEmail: order.customerEmail,
            customerWallet: order.customerWallet,
            feeAmount: order.feeAmount,
            transactionHash: order.transactionHash,
            createdAt: order.createdAt,
            completedAt: order.completedAt,
            currentUsdcRate: order.metadata?.currentUsdcRate,
            network: order.targetNetwork,
            pricingSource: order.metadata?.pricingSource
          })),
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / parseInt(limit))
          },
          summary: summary[0] || {
            totalAmount: 0,
            totalOrders: 0,
            completedOrders: 0,
            pendingOrders: 0,
            totalFees: 0,
            baseOrders: 0,
            solanaOrders: 0,
            ethereumOrders: 0
          }
        }
      });
      
    } catch (error) {
      console.error('[GENERIC_CONTROLLER] Error getting orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get orders',
        error: error.message
      });
    }
  },

  // Get business statistics with network breakdown
  getBusinessStats: async (req, res) => {
    try {
      const business = req.business;
      const { timeframe = '30d', groupBy = 'day' } = req.query;
      
      // Calculate date range
      let startDate = new Date();
      switch (timeframe) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate = new Date('2020-01-01');
      }
      
      // Overview stats
      const overview = await BusinessOnrampOrder.aggregate([
        {
          $match: {
            businessId: business._id,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalFees: { $sum: '$feeAmount' },
            completedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            }
          }
        }
      ]);
      
      const overviewData = overview[0] || {
        totalOrders: 0,
        totalAmount: 0,
        totalFees: 0,
        completedOrders: 0
      };
      
      overviewData.successRate = overviewData.totalOrders > 0 
        ? (overviewData.completedOrders / overviewData.totalOrders) * 100 
        : 0;
      overviewData.averageOrderValue = overviewData.totalOrders > 0 
        ? overviewData.totalAmount / overviewData.totalOrders 
        : 0;
      
      // Status breakdown
      const statusBreakdown = await BusinessOnrampOrder.aggregate([
        {
          $match: {
            businessId: business._id,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);
      
      // Token breakdown
      const tokenBreakdown = await BusinessOnrampOrder.aggregate([
        {
          $match: {
            businessId: business._id,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$targetToken',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalTokenAmount: { $sum: '$estimatedTokenAmount' }
          }
        }
      ]);
      
      // Network breakdown (NEW)
      const networkBreakdown = await BusinessOnrampOrder.aggregate([
        {
          $match: {
            businessId: business._id,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$targetNetwork',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgOrderValue: { $avg: '$amount' },
            completedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            }
          }
        }
      ]);
      
      // Exchange rate analysis
      const rateAnalysis = await BusinessOnrampOrder.aggregate([
        {
          $match: {
            businessId: business._id,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$metadata.rateSource',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgUsdcRate: { $avg: '$metadata.currentUsdcRate' }
          }
        }
      ]);
      
      // Pricing source analysis (NEW)
      const pricingSourceAnalysis = await BusinessOnrampOrder.aggregate([
        {
          $match: {
            businessId: business._id,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$metadata.pricingSource',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            networks: { $addToSet: '$targetNetwork' }
          }
        }
      ]);
      
      // Time series data with network information
      const timeSeriesData = await BusinessOnrampOrder.aggregate([
        {
          $match: {
            businessId: business._id,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              date: {
                $dateToString: {
                  format: groupBy === 'day' ? '%Y-%m-%d' : 
                         groupBy === 'week' ? '%Y-%U' : '%Y-%m',
                  date: '$createdAt'
                }
              },
              network: '$targetNetwork'
            },
            orders: { $sum: 1 },
            amount: { $sum: '$amount' },
            fees: { $sum: '$feeAmount' },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            avgUsdcRate: { $avg: '$metadata.currentUsdcRate' }
          }
        },
        { $sort: { '_id.date': 1, '_id.network': 1 } }
      ]);
      
      res.json({
        success: true,
        data: {
          timeframe,
          overview: overviewData,
          statusBreakdown: statusBreakdown.reduce((acc, item) => {
            acc[item._id] = {
              count: item.count,
              totalAmount: item.totalAmount
            };
            return acc;
          }, {}),
          tokenBreakdown: tokenBreakdown.reduce((acc, item) => {
            acc[item._id] = {
              count: item.count,
              totalAmount: item.totalAmount,
              totalTokenAmount: item.totalTokenAmount
            };
            return acc;
          }, {}),
          networkBreakdown: networkBreakdown.reduce((acc, item) => {
            acc[item._id] = {
              count: item.count,
              totalAmount: item.totalAmount,
              avgOrderValue: item.avgOrderValue,
              completedOrders: item.completedOrders,
              successRate: item.count > 0 ? (item.completedOrders / item.count) * 100 : 0
            };
            return acc;
          }, {}),
          rateAnalysis: rateAnalysis.reduce((acc, item) => {
            acc[item._id || 'unknown'] = {
              count: item.count,
              totalAmount: item.totalAmount,
              avgUsdcRate: item.avgUsdcRate
            };
            return acc;
          }, {}),
          pricingSourceAnalysis: pricingSourceAnalysis.reduce((acc, item) => {
            acc[item._id || 'unknown'] = {
              count: item.count,
              totalAmount: item.totalAmount,
              networks: item.networks
            };
            return acc;
          }, {}),
          timeSeriesData
        }
      });
      
    } catch (error) {
      console.error('[GENERIC_CONTROLLER] Error getting stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get statistics',
        error: error.message
      });
    }
  },

  // Handle Monnify webhook (supports all networks)
  handleMonnifyWebhook: async (req, res) => {
    try {
      console.log('[GENERIC_CONTROLLER] Handling Monnify webhook');
      const { paymentReference, paymentStatus, paidAmount, transactionReference, customerEmail } = req.body;
      
      if (!paymentReference || !paymentStatus) {
        return res.status(400).json({
          success: false,
          message: 'Missing required webhook data'
        });
      }
      
      // Find order
      const order = await BusinessOnrampOrder.findOne({
        businessOrderReference: paymentReference
      });
      
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }
      
      // Update order status based on payment status
      let newStatus;
      let message = '';
      
      switch (paymentStatus.toUpperCase()) {
        case 'PAID':
          newStatus = BUSINESS_ORDER_STATUS.PROCESSING;
          message = 'Payment processed and settlement initiated';
          break;
        case 'FAILED':
          newStatus = BUSINESS_ORDER_STATUS.FAILED;
          message = 'Payment failed';
          break;
        case 'CANCELLED':
          newStatus = BUSINESS_ORDER_STATUS.CANCELLED;
          message = 'Payment cancelled';
          break;
        default:
          newStatus = BUSINESS_ORDER_STATUS.PENDING;
          message = 'Payment status updated';
      }
      
      // Update order
      order.status = newStatus;
      order.updatedAt = new Date();
      if (transactionReference) {
        order.paymentReference = transactionReference;
      }
      if (paidAmount) {
        order.paidAmount = paidAmount;
      }
      
      await order.save();
      
      // Send webhook to business if configured
      if (order.webhookUrl && newStatus === BUSINESS_ORDER_STATUS.PROCESSING) {
        const orderData = {
          orderId: order.orderId,
          businessOrderReference: order.businessOrderReference,
          status: order.status,
          amount: order.amount,
          paidAmount: order.paidAmount,
          targetToken: order.targetToken,
          targetNetwork: order.targetNetwork,
          estimatedTokenAmount: order.estimatedTokenAmount,
          customerEmail: order.customerEmail,
          customerWallet: order.customerWallet,
          transactionReference: order.paymentReference,
          metadata: order.metadata,
          currentUsdcRate: order.metadata?.currentUsdcRate,
          network: order.targetNetwork
        };
        
        sendBusinessWebhook(order.webhookUrl, orderData, 'order.payment_received')
          .catch(error => console.error('[GENERIC_CONTROLLER] Business webhook failed:', error));
      }
      
      res.json({
        success: true,
        message: message,
        orderStatus: order.status
      });
      
    } catch (error) {
      console.error('[GENERIC_CONTROLLER] Webhook error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process webhook',
        error: error.message
      });
    }
  },

  // UPDATED: Universal token support checker with Base and Solana support
  checkTokenSupport: async (req, res) => {
    try {
      console.log('[TOKEN_SUPPORT] Checking universal token support with Base and Solana');
      const business = req.business;
      const { targetToken, targetNetwork } = req.body;
      
      if (!targetToken || !targetNetwork) {
        return res.status(400).json({
          success: false,
          message: 'targetToken and targetNetwork are required',
          example: {
            targetToken: 'USDC',
            targetNetwork: 'base'
          }
        });
      }
      
      console.log(`[TOKEN_SUPPORT] Checking support for ${targetToken} on ${targetNetwork}`);
      
      const supportCheck = {
        token: targetToken.toUpperCase(),
        network: targetNetwork.toLowerCase(),
        timestamp: new Date().toISOString(),
        checks: []
      };
      
      // Check 1: Business configuration
      const businessCheck = {
        name: 'Business Configuration',
        status: 'checking'
      };
      
      const tokenInfo = business.supportedTokens?.[targetNetwork]?.find(
        token => token.symbol.toUpperCase() === targetToken.toUpperCase()
      );
      
      if (!tokenInfo) {
        businessCheck.status = 'failed';
        businessCheck.error = `${targetToken} is not configured for your business on ${targetNetwork}`;
        businessCheck.availableTokens = business.supportedTokens?.[targetNetwork]?.map(t => t.symbol) || [];
        supportCheck.checks.push(businessCheck);
        
        return res.json({
          success: false,
          message: `${targetToken} is not supported by your business`,
          data: supportCheck
        });
      }
      
      businessCheck.status = 'passed';
      businessCheck.result = {
        symbol: tokenInfo.symbol,
        name: tokenInfo.name,
        contractAddress: tokenInfo.contractAddress,
        decimals: tokenInfo.decimals,
        isActive: tokenInfo.isActive,
        isTradingEnabled: tokenInfo.isTradingEnabled
      };
      supportCheck.checks.push(businessCheck);
      
      // Check 2: Network-specific support
      if (targetNetwork.toLowerCase() === 'base') {
        const contractCheck = {
          name: 'Smart Contract Support (Base)',
          status: 'checking'
        };
        
        try {
          const isReserveSupported = await priceChecker.isTokenSupportedByReserve(tokenInfo.contractAddress);
          
          contractCheck.status = isReserveSupported ? 'passed' : 'failed';
          contractCheck.result = {
            reserveSupported: isReserveSupported,
            contractAddress: tokenInfo.contractAddress
          };
          
          if (!isReserveSupported) {
            contractCheck.error = 'Token is not supported by the smart contract reserve';
            contractCheck.recommendation = 'Contact support to add this token to the reserve';
          }
        } catch (error) {
          contractCheck.status = 'error';
          contractCheck.error = error.message;
        }
        
        supportCheck.checks.push(contractCheck);
        
        // Check 3: Liquidity and pricing (Base)
        if (contractCheck.status === 'passed') {
          const liquidityCheck = {
            name: 'DEX Liquidity and Pricing (Base)',
            status: 'checking'
          };
          
          try {
            const priceResult = await priceChecker.getTokenToUSDCPrice(tokenInfo.contractAddress, 1, {
              verbose: false,
              checkReserveSupport: false,
              minLiquidityThreshold: 50
            });
            
            const currentUsdcRate = await getUSDCToNGNRate();
            
            liquidityCheck.status = priceResult.success && priceResult.hasAdequateLiquidity ? 'passed' : 'failed';
            liquidityCheck.result = {
              hasLiquidity: priceResult.success,
              adequateLiquidity: priceResult.hasAdequateLiquidity,
              usdcValue: priceResult.usdcValue,
              pricePerToken: priceResult.pricePerToken,
              bestRoute: priceResult.bestRoute,
              currentUsdcRate: currentUsdcRate,
              ngnPricePerToken: priceResult.pricePerToken * currentUsdcRate
            };
            
            if (!priceResult.success) {
              liquidityCheck.error = 'No liquidity found on DEXs';
            } else if (!priceResult.hasAdequateLiquidity) {
              liquidityCheck.error = `Insufficient liquidity: $${priceResult.usdcValue} USDC (minimum $50 required)`;
            }
          } catch (error) {
            liquidityCheck.status = 'error';
            liquidityCheck.error = error.message;
          }
          
          supportCheck.checks.push(liquidityCheck);
        }
      } else if (targetNetwork.toLowerCase() === 'solana') {
        const jupiterCheck = {
          name: 'Jupiter DEX Support (Solana)',
          status: 'checking'
        };
        
        try {
          const priceResult = await solanaChecker.getTokenToUSDCPrice(tokenInfo.contractAddress, 1, {
            verbose: false,
            minLiquidityThreshold: 50
          });
          
          const currentUsdcRate = await getUSDCToNGNRate();
          
          jupiterCheck.status = priceResult.success ? 'passed' : 'failed';
          jupiterCheck.result = {
            jupiterSupported: priceResult.success,
            hasLiquidity: priceResult.success,
            adequateLiquidity: priceResult.hasAdequateLiquidity,
            usdcValue: priceResult.usdcValue,
            pricePerToken: priceResult.pricePerToken,
            bestRoute: priceResult.bestRoute,
            priceImpact: priceResult.priceImpact,
            currentUsdcRate: currentUsdcRate,
            ngnPricePerToken: priceResult.pricePerToken * currentUsdcRate
          };
          
          if (!priceResult.success) {
            jupiterCheck.error = 'Token not found on Jupiter or insufficient liquidity';
          }
        } catch (error) {
          jupiterCheck.status = 'error';
          jupiterCheck.error = error.message;
        }
        
        supportCheck.checks.push(jupiterCheck);
      } else {
        // For other networks, assume supported via internal API
        const apiCheck = {
          name: `Internal API Support (${targetNetwork})`,
          status: 'passed',
          result: {
            internalApiSupported: true,
            note: 'Token will be processed via internal pricing API'
          }
        };
        
        supportCheck.checks.push(apiCheck);
      }
      
      // Check 4: Fee configuration
      const feeCheck = {
        name: 'Fee Configuration',
        status: 'checking'
      };
      
      const feeConfig = business.feeConfiguration?.[targetNetwork]?.find(
        f => f.contractAddress?.toLowerCase() === tokenInfo.contractAddress?.toLowerCase() && f.isActive
      );
      
      feeCheck.status = 'passed';
      feeCheck.result = {
        feeConfigured: !!feeConfig,
        feePercentage: feeConfig ? feeConfig.feePercentage : 0,
        feeRecipient: feeConfig ? feeConfig.feeRecipient : null
      };
      
      supportCheck.checks.push(feeCheck);
      
      // Overall assessment
      const passedChecks = supportCheck.checks.filter(c => c.status === 'passed').length;
      const totalChecks = supportCheck.checks.length;
      const criticalChecksPassed = supportCheck.checks.slice(0, 2).every(c => c.status === 'passed');
      
      supportCheck.summary = {
        totalChecks,
        passedChecks,
        failedChecks: supportCheck.checks.filter(c => c.status === 'failed').length,
        errorChecks: supportCheck.checks.filter(c => c.status === 'error').length,
        overallStatus: criticalChecksPassed ? (passedChecks === totalChecks ? 'fully_supported' : 'partially_supported') : 'not_supported',
        canProcessOnramp: criticalChecksPassed
      };
      
      supportCheck.recommendation = supportCheck.summary.canProcessOnramp 
        ? `${targetToken} is ready for onramp orders on ${targetNetwork}`
        : `${targetToken} cannot be used for onramp on ${targetNetwork} - fix failing checks`;
      
      res.json({
        success: supportCheck.summary.canProcessOnramp,
        message: supportCheck.recommendation,
        data: supportCheck
      });
      
    } catch (error) {
      console.error('[TOKEN_SUPPORT] Error checking token support:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check token support',
        error: error.message
      });
    }
  },

  // UPDATED: Get all supported tokens with validation status for all networks
  getSupportedTokensWithValidation: async (req, res) => {
    try {
      console.log('[SUPPORTED_TOKENS] Getting all supported tokens with validation for Base and Solana');
      const business = req.business;
      const { validateAll = false } = req.query;
      
      const fullBusiness = await Business.findById(business.id || business._id);
      
      if (!fullBusiness || !fullBusiness.supportedTokens) {
        return res.status(404).json({
          success: false,
          message: 'No tokens configured for your business',
          code: 'NO_TOKENS_CONFIGURED'
        });
      }
      
      // Get current USDC rate once for all calculations
      const currentUsdcRate = await getUSDCToNGNRate();
      
      const tokenReport = {
        business: {
          id: fullBusiness._id,
          businessId: fullBusiness.businessId,
          name: fullBusiness.businessName
        },
        currentUsdcRate: currentUsdcRate,
        rateSource: 'onramp_api',
        networks: {},
        summary: {
          totalTokens: 0,
          fullySupported: 0,
          partiallySupported: 0,
          notSupported: 0,
          validationPerformed: validateAll
        },
        timestamp: new Date().toISOString()
      };
      
      // Process each network
      for (const [networkName, tokens] of Object.entries(fullBusiness.supportedTokens)) {
        if (!Array.isArray(tokens) || tokens.length === 0) continue;
        
        console.log(`[SUPPORTED_TOKENS] Processing ${tokens.length} tokens on ${networkName}`);
        
        tokenReport.networks[networkName] = {
          name: networkName,
          totalTokens: tokens.length,
          tokens: []
        };
        
        for (const token of tokens) {
          const tokenStatus = {
            symbol: token.symbol,
            name: token.name,
            contractAddress: token.contractAddress,
            decimals: token.decimals,
            isActive: token.isActive,
            isTradingEnabled: token.isTradingEnabled,
            validation: {
              businessSupported: true,
              contractSupported: null,
              hasLiquidity: null,
              canProcessOnramp: null
            }
          };
          
          tokenReport.summary.totalTokens++;
          
          // Perform validation if requested or for Base/Solana tokens
          if (validateAll || ['base', 'solana'].includes(networkName.toLowerCase())) {
            try {
              if (networkName.toLowerCase() === 'base') {
                // Check smart contract support
                const isContractSupported = await priceChecker.isTokenSupportedByReserve(token.contractAddress);
                tokenStatus.validation.contractSupported = isContractSupported;
                
                if (isContractSupported) {
                  // Check liquidity and get current NGN price
                  const quickPrice = await priceChecker.getTokenToUSDCPrice(token.contractAddress, 1, {
                    verbose: false,
                    checkReserveSupport: false,
                    minLiquidityThreshold: 50
                  });
                  
                  tokenStatus.validation.hasLiquidity = quickPrice.success;
                  tokenStatus.validation.canProcessOnramp = quickPrice.success && quickPrice.hasAdequateLiquidity;
                  
                  if (quickPrice.success) {
                    tokenStatus.priceInfo = {
                      usdcValue: quickPrice.usdcValue,
                      pricePerToken: quickPrice.pricePerToken,
                      bestRoute: quickPrice.bestRoute,
                      hasAdequateLiquidity: quickPrice.hasAdequateLiquidity,
                      ngnPricePerToken: quickPrice.pricePerToken * currentUsdcRate,
                      currentUsdcRate: currentUsdcRate,
                      formattedNgnPrice: `₦${(quickPrice.pricePerToken * currentUsdcRate).toLocaleString()}`,
                      source: 'base_dex'
                    };
                  }
                } else {
                  tokenStatus.validation.hasLiquidity = false;
                  tokenStatus.validation.canProcessOnramp = false;
                }
              } else if (networkName.toLowerCase() === 'solana') {
                // Check Jupiter support
                const jupiterPrice = await solanaChecker.getTokenToUSDCPrice(token.contractAddress, 1, {
                  verbose: false,
                  minLiquidityThreshold: 50
                });
                
                tokenStatus.validation.contractSupported = 'Jupiter';
                tokenStatus.validation.hasLiquidity = jupiterPrice.success;
                tokenStatus.validation.canProcessOnramp = jupiterPrice.success && jupiterPrice.hasAdequateLiquidity;
                
                if (jupiterPrice.success) {
                  tokenStatus.priceInfo = {
                    usdcValue: jupiterPrice.usdcValue,
                    pricePerToken: jupiterPrice.pricePerToken,
                    bestRoute: jupiterPrice.bestRoute,
                    priceImpact: jupiterPrice.priceImpact,
                    hasAdequateLiquidity: jupiterPrice.hasAdequateLiquidity,
                     ngnPricePerToken: jupiterPrice.pricePerToken * currentUsdcRate,
                    currentUsdcRate: currentUsdcRate,
                    formattedNgnPrice: `₦${(jupiterPrice.pricePerToken * currentUsdcRate).toLocaleString()}`,
                    source: 'jupiter_dex'
                  };
                }
              } else {
                // For other networks, assume supported if configured
                tokenStatus.validation.contractSupported = 'Internal API';
                tokenStatus.validation.hasLiquidity = 'Assumed';
                tokenStatus.validation.canProcessOnramp = true;
              }
              
              // Determine support level
              if (tokenStatus.validation.canProcessOnramp === true) {
                tokenStatus.supportLevel = 'fully_supported';
                tokenReport.summary.fullySupported++;
              } else if (tokenStatus.validation.contractSupported === true || tokenStatus.validation.contractSupported === 'Jupiter') {
                tokenStatus.supportLevel = 'partially_supported';
                tokenReport.summary.partiallySupported++;
              } else {
                tokenStatus.supportLevel = 'not_supported';
                tokenReport.summary.notSupported++;
              }
              
            } catch (validationError) {
              tokenStatus.validation.error = validationError.message;
              tokenStatus.supportLevel = 'validation_error';
              tokenReport.summary.notSupported++;
            }
          } else {
            // Skip validation
            tokenStatus.supportLevel = 'not_validated';
            tokenStatus.validation.note = 'Validation skipped - use validateAll=true to check all tokens';
          }
          
          tokenReport.networks[networkName].tokens.push(tokenStatus);
        }
      }
      
      // Generate recommendations
      tokenReport.recommendations = [];
      
      if (tokenReport.summary.notSupported > 0) {
        tokenReport.recommendations.push(`${tokenReport.summary.notSupported} tokens are not fully supported - check configuration`);
      }
      
      if (tokenReport.summary.partiallySupported > 0) {
        tokenReport.recommendations.push(`${tokenReport.summary.partiallySupported} tokens have limited liquidity - consider adding liquidity`);
      }
      
      if (tokenReport.summary.fullySupported === 0) {
        tokenReport.recommendations.push('No tokens are fully supported for onramp - check configuration and liquidity');
      }
      
      // Add network-specific recommendations
      const baseTokens = tokenReport.networks.base?.tokens || [];
      const solanaTokens = tokenReport.networks.solana?.tokens || [];
      
      if (baseTokens.length > 0) {
        const unsupportedBase = baseTokens.filter(t => t.supportLevel === 'not_supported').length;
        if (unsupportedBase > 0) {
          tokenReport.recommendations.push(`${unsupportedBase} Base tokens need smart contract reserve support`);
        }
      }
      
      if (solanaTokens.length > 0) {
        const unsupportedSolana = solanaTokens.filter(t => t.supportLevel === 'not_supported').length;
        if (unsupportedSolana > 0) {
          tokenReport.recommendations.push(`${unsupportedSolana} Solana tokens need Jupiter liquidity`);
        }
      }
      
      res.json({
        success: true,
        message: `Found ${tokenReport.summary.totalTokens} configured tokens across ${Object.keys(tokenReport.networks).length} networks with current USDC rate: ₦${currentUsdcRate.toLocaleString()}`,
        data: tokenReport
      });
      
    } catch (error) {
      console.error('[SUPPORTED_TOKENS] Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get supported tokens',
        error: error.message
      });
    }
  },

  // UPDATED: Test any token with network-specific validation
  testToken: async (req, res) => {
    try {
      console.log('[TOKEN_TEST] Testing token for onramp compatibility with multi-network support');
      const business = req.business;
      const { targetToken, targetNetwork, testAmount = 1000 } = req.body;
      
      if (!targetToken || !targetNetwork) {
        return res.status(400).json({
          success: false,
          message: 'targetToken and targetNetwork are required',
          example: {
            targetToken: 'USDC',
            targetNetwork: 'base',
            testAmount: 1000
          }
        });
      }
      
      // Network validation
      const supportedNetworks = ['base', 'solana', 'ethereum'];
      if (!supportedNetworks.includes(targetNetwork.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Unsupported network: ${targetNetwork}. Supported networks: ${supportedNetworks.join(', ')}`,
          code: 'UNSUPPORTED_NETWORK'
        });
      }
      
      console.log(`[TOKEN_TEST] Testing ₦${testAmount.toLocaleString()} purchase of ${targetToken} on ${targetNetwork}`);
      
      const testResult = {
        input: {
          token: targetToken.toUpperCase(),
          network: targetNetwork.toLowerCase(),
          testAmount: testAmount
        },
        tests: [],
        timestamp: new Date().toISOString()
      };
      
      // Test 1: Business Configuration
      const test1 = {
        name: 'Business Configuration Check',
        status: 'testing'
      };
      
      try {
        const tokenInfo = business.supportedTokens?.[targetNetwork]?.find(
          token => token.symbol.toUpperCase() === targetToken.toUpperCase()
        );
        
        if (!tokenInfo) {
          test1.status = 'failed';
          test1.error = `${targetToken} not configured for business on ${targetNetwork}`;
          test1.availableTokens = business.supportedTokens?.[targetNetwork]?.map(t => t.symbol) || [];
        } else {
          test1.status = 'passed';
          test1.result = {
            configured: true,
            tokenInfo: {
              symbol: tokenInfo.symbol,
              name: tokenInfo.name,
              contractAddress: tokenInfo.contractAddress,
              decimals: tokenInfo.decimals
            }
          };
          testResult.tokenInfo = tokenInfo;
        }
      } catch (error) {
        test1.status = 'error';
        test1.error = error.message;
      }
      
      testResult.tests.push(test1);
      
      // Only continue if business config passed
      if (test1.status !== 'passed') {
        testResult.summary = {
          totalTests: 1,
          passedTests: 0,
          overallStatus: 'failed',
          canProcessOnramp: false
        };
        
        return res.json({
          success: false,
          message: `${targetToken} is not configured for your business on ${targetNetwork}`,
          data: testResult
        });
      }
      
      // Test 2: Network-specific support validation
      const test2 = {
        name: `${targetNetwork.charAt(0).toUpperCase() + targetNetwork.slice(1)} Network Support Check`,
        status: 'testing'
      };
      
      try {
        if (targetNetwork.toLowerCase() === 'base') {
          // Test Base smart contract support
          const isReserveSupported = await priceChecker.isTokenSupportedByReserve(testResult.tokenInfo.contractAddress);
          
          test2.status = isReserveSupported ? 'passed' : 'failed';
          test2.result = {
            smartContractSupported: isReserveSupported,
            contractAddress: testResult.tokenInfo.contractAddress,
            network: 'base'
          };
          
          if (!isReserveSupported) {
            test2.error = 'Token not supported by Base smart contract reserve';
          }
        } else if (targetNetwork.toLowerCase() === 'solana') {
          // Test Solana Jupiter support
          const jupiterTest = await solanaChecker.getTokenToUSDCPrice(testResult.tokenInfo.contractAddress, 0.01, {
            verbose: false
          });
          
          test2.status = jupiterTest.success ? 'passed' : 'failed';
          test2.result = {
            jupiterSupported: jupiterTest.success,
            contractAddress: testResult.tokenInfo.contractAddress,
            network: 'solana',
            priceImpact: jupiterTest.priceImpact
          };
          
          if (!jupiterTest.success) {
            test2.error = 'Token not found on Jupiter or insufficient liquidity';
          }
        } else {
          // For other networks, assume supported
          test2.status = 'passed';
          test2.result = {
            internalApiSupported: true,
            network: targetNetwork,
            note: 'Will be processed via internal API'
          };
        }
      } catch (error) {
        test2.status = 'error';
        test2.error = error.message;
      }
      
      testResult.tests.push(test2);
      
      // Test 3: Price and Validation with CURRENT rates
      const test3 = {
        name: 'Price and Validation Check with Current Rates',
        status: 'testing'
      };
      
      try {
        // Calculate net amount after fees for testing
        const feeConfig = business.feeConfiguration?.[targetNetwork]?.find(
          f => f.contractAddress?.toLowerCase() === testResult.tokenInfo.contractAddress?.toLowerCase() && f.isActive
        );
        const feePercentage = feeConfig ? feeConfig.feePercentage : 0;
        const feeAmount = Math.round(testAmount * (feePercentage / 100));
        const netAmount = testAmount - feeAmount;
        
        const priceData = await validateAndPriceToken(targetToken, business, 1, netAmount);
        
        test3.status = 'passed';
        test3.result = {
          pricingSuccessful: true,
          testAmount: testAmount,
          feeAmount: feeAmount,
          netAmount: netAmount,
          tokenAmount: priceData.cryptoAmount,
          unitPriceInNgn: priceData.unitPriceInNgn,
          exchangeRate: priceData.exchangeRateString,
          currentUsdcRate: priceData.usdcToNgnRate,
          source: priceData.source,
          rateSource: priceData.rateSource,
          actualNetwork: priceData.network,
          validation: priceData.validation
        };
        
        // Add network-specific data
        if (priceData.network === 'base') {
          test3.result.smartContractData = {
            usdcValue: priceData.usdcValue,
            pricePerTokenUsdc: priceData.pricePerTokenUsdc,
            bestRoute: priceData.bestRoute,
            reserveSupported: priceData.reserveSupported,
            liquidityAdequate: priceData.hasAdequatePoolLiquidity
          };
        } else if (priceData.network === 'solana') {
          test3.result.jupiterData = {
            usdcValue: priceData.usdcValue,
            pricePerTokenUsdc: priceData.pricePerTokenUsdc,
            bestRoute: priceData.bestRoute,
            priceImpact: priceData.priceImpact,
            routeSteps: priceData.swapRoute?.routeSteps
          };
        }
        
        testResult.priceData = priceData;
      } catch (error) {
        test3.status = 'failed';
        test3.error = error.message;
      }
      
      testResult.tests.push(test3);
      
      // Test 4: Fee Calculation
      const test4 = {
        name: 'Fee Calculation',
        status: 'testing'
      };
      
      try {
        const feeConfig = business.feeConfiguration?.[targetNetwork]?.find(
          f => f.contractAddress?.toLowerCase() === testResult.tokenInfo.contractAddress?.toLowerCase()
        );
        
        test4.status = 'passed';
        test4.result = {
          feeConfigured: !!feeConfig,
          feePercentage: feeConfig ? feeConfig.feePercentage : 0,
          feeCalculationWorking: true
        };
      } catch (error) {
        test4.status = 'error';
        test4.error = error.message;
      }
      
      testResult.tests.push(test4);
      
      // Generate summary
      const passedTests = testResult.tests.filter(t => t.status === 'passed').length;
      const totalTests = testResult.tests.length;
      
      testResult.summary = {
        totalTests,
        passedTests,
        failedTests: testResult.tests.filter(t => t.status === 'failed').length,
        errorTests: testResult.tests.filter(t => t.status === 'error').length,
        overallStatus: passedTests === totalTests ? 'passed' : 'failed',
        canProcessOnramp: passedTests === totalTests
      };
      
      testResult.conclusion = testResult.summary.canProcessOnramp
        ? `${targetToken} is fully compatible with onramp system on ${targetNetwork} using current rates`
        : `${targetToken} has ${totalTests - passedTests} failing test(s) and cannot be used for onramp on ${targetNetwork}`;
      
      // Add next steps with current rate info
      if (testResult.summary.canProcessOnramp) {
        testResult.nextSteps = [
          `Create quote: POST /api/v1/business-onramp/quote`,
          `Create order: POST /api/v1/business-onramp/create`,
          `Monitor orders: GET /api/v1/business-onramp/orders`,
          `Current USDC rate: ₦${testResult.priceData?.usdcToNgnRate?.toLocaleString() || 'N/A'}`,
          `Actual network: ${testResult.priceData?.network || targetNetwork}`
        ];
      } else {
        const failedTests = testResult.tests.filter(t => t.status === 'failed');
        testResult.nextSteps = failedTests.map(test => `Fix: ${test.error}`);
      }
      
      res.json({
        success: testResult.summary.canProcessOnramp,
        message: testResult.conclusion,
        data: testResult
      });
      
    } catch (error) {
      console.error('[TOKEN_TEST] Error testing token:', error);
      res.status(500).json({
        success: false,
        message: 'Token testing failed',
        error: error.message
      });
    }
  },

  // UPDATED: Health check for onramp system with Base and Solana support
  healthCheck: async (req, res) => {
    try {
      console.log('[HEALTH_CHECK] Checking onramp system health with Base and Solana support');
      
      const healthReport = {
        timestamp: new Date().toISOString(),
        version: 'generic-v2.0-base-solana-updated',
        services: {},
        overallStatus: 'checking'
      };
      
      // Check Base smart contract connection
      healthReport.services.baseSmartContract = {
        name: 'Smart Contract (Base)',
        status: 'checking'
      };
      
      try {
        const connectionValid = await priceChecker.validateConnection();
        const contractConfig = await priceChecker.getContractConfiguration();
        
        healthReport.services.baseSmartContract.status = connectionValid ? 'healthy' : 'unhealthy';
        healthReport.services.baseSmartContract.details = {
          connected: connectionValid,
          configuration: contractConfig,
          contractAddress: process.env.ABOKI_V2_CONTRACT || 'Not configured',
          rpcUrl: process.env.BASE_RPC_URL || 'Not configured'
        };
      } catch (error) {
        healthReport.services.baseSmartContract.status = 'unhealthy';
        healthReport.services.baseSmartContract.error = error.message;
      }
      
      // Check Solana Jupiter connection
      healthReport.services.solanaJupiter = {
        name: 'Jupiter DEX (Solana)',
        status: 'checking'
      };
      
      try {
        const jupiterHealth = await solanaChecker.validateConnection();
        
        healthReport.services.solanaJupiter.status = jupiterHealth ? 'healthy' : 'unhealthy';
        healthReport.services.solanaJupiter.details = {
          connected: jupiterHealth,
          jupiterApiUrl: process.env.JUPITER_API_URL || 'https://quote-api.jup.ag',
          solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
        };
      } catch (error) {
        healthReport.services.solanaJupiter.status = 'unhealthy';
        healthReport.services.solanaJupiter.error = error.message;
      }
      
      // Check internal API and current rate fetching
      healthReport.services.internalApi = {
        name: 'Internal Pricing API',
        status: 'checking'
      };
      
      try {
        const baseUrl = process.env.INTERNAL_API_BASE_URL || 'http://localhost:5002';
        const response = await axios.get(`${baseUrl}/api/v1/health`, { timeout: 5000 });
        
        healthReport.services.internalApi.status = response.status === 200 ? 'healthy' : 'unhealthy';
        healthReport.services.internalApi.details = {
          baseUrl: baseUrl,
          responseTime: response.headers['x-response-time'] || 'N/A'
        };
      } catch (error) {
        healthReport.services.internalApi.status = 'unhealthy';
        healthReport.services.internalApi.error = error.message;
      }
      
      // Check current USDC rate fetching
      healthReport.services.exchangeRates = {
        name: 'Exchange Rate Service',
        status: 'checking'
      };
      
      try {
        const currentUsdcRate = await getUSDCToNGNRate();
        
        healthReport.services.exchangeRates.status = currentUsdcRate > 0 ? 'healthy' : 'unhealthy';
        healthReport.services.exchangeRates.details = {
          currentUsdcRate: currentUsdcRate,
          formattedRate: `₦${currentUsdcRate.toLocaleString()}`,
          source: 'onramp_api',
          lastUpdated: new Date().toISOString()
        };
      } catch (error) {
        healthReport.services.exchangeRates.status = 'unhealthy';
        healthReport.services.exchangeRates.error = error.message;
      }
      
      // Check payment service
      healthReport.services.paymentService = {
        name: 'Monnify Payment Service',
        status: 'checking'
      };
      
      try {
        const monnifyHealth = await monnifyService.healthCheck?.() || { healthy: true };
        
        healthReport.services.paymentService.status = monnifyHealth.healthy ? 'healthy' : 'unhealthy';
        healthReport.services.paymentService.details = monnifyHealth;
      } catch (error) {
        healthReport.services.paymentService.status = 'unknown';
        healthReport.services.paymentService.error = error.message;
      }
      
      // Overall health assessment
      const healthyServices = Object.values(healthReport.services).filter(s => s.status === 'healthy').length;
      const totalServices = Object.keys(healthReport.services).length;
      
      healthReport.overallStatus = healthyServices === totalServices ? 'healthy' : 
                                   healthyServices > 0 ? 'degraded' : 'unhealthy';
      
      healthReport.summary = {
        totalServices,
        healthyServices,
        unhealthyServices: totalServices - healthyServices,
        healthPercentage: Math.round((healthyServices / totalServices) * 100)
      };
      
      healthReport.capabilities = {
        baseTokenSupport: healthReport.services.baseSmartContract.status === 'healthy',
        solanaTokenSupport: healthReport.services.solanaJupiter.status === 'healthy',
        fallbackPricing: healthReport.services.internalApi.status === 'healthy',
        currentRateFetching: healthReport.services.exchangeRates.status === 'healthy',
        paymentProcessing: healthReport.services.paymentService.status === 'healthy',
        universalTokenSupport: healthyServices > 0
      };
      
      // Add current rate info to response
      if (healthReport.services.exchangeRates.status === 'healthy') {
        healthReport.currentRates = {
          usdcToNgn: healthReport.services.exchangeRates.details.currentUsdcRate,
          formatted: healthReport.services.exchangeRates.details.formattedRate,
          source: 'live_onramp_api',
          note: 'Rates are fetched from your own pricing API in real-time'
        };
      }
      
      // Add network status summary
      healthReport.networkStatus = {
        base: healthReport.services.baseSmartContract.status === 'healthy' ? 'operational' : 'degraded',
        solana: healthReport.services.solanaJupiter.status === 'healthy' ? 'operational' : 'degraded',
        ethereum: healthReport.services.internalApi.status === 'healthy' ? 'operational' : 'degraded'
      };
      
      const statusCode = healthReport.overallStatus === 'healthy' ? 200 : 
                         healthReport.overallStatus === 'degraded' ? 207 : 503;
      
      res.status(statusCode).json({
        success: healthReport.overallStatus !== 'unhealthy',
        message: `Onramp system is ${healthReport.overallStatus} with Base and Solana support`,
        data: healthReport
      });
      
    } catch (error) {
      console.error('[HEALTH_CHECK] Health check error:', error);
      res.status(500).json({
        success: false,
        message: 'Health check failed',
        error: error.message
      });
    }
  }
};

/**
 * UPDATED: Base configuration additions to ensure ETH and Solana support
 */
const BASE_CONFIG_ADDITIONS = {
  // Make sure WETH is properly defined
  WETH: process.env.WETH_ADDRESS || '0x4200000000000000000000000000000000000006', // Base WETH
  
  // Add ETH handling flag
  NATIVE_TOKEN_SYMBOL: 'ETH',
  
  // Common tokens for easier reference
  COMMON_TOKENS: {
      ETH: '0x4200000000000000000000000000000000000006', // WETH on Base
      WETH: '0x4200000000000000000000000000000000000006',
      USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
  }
};

/**
 * UPDATED: OnrampPriceChecker to handle ETH properly
 */
class OnrampPriceCheckerFixed extends OnrampPriceChecker {
  
  async isTokenSupportedByReserve(tokenAddress) {
      try {
          console.log(`🔍 Checking reserve support for: ${tokenAddress}`);
          
          // Special handling for ETH/WETH
          const isETHOrWETH = tokenAddress?.toLowerCase() === BASE_CONFIG.WETH?.toLowerCase() ||
                             tokenAddress?.toLowerCase() === '0x4200000000000000000000000000000000000006' ||
                             tokenAddress?.toUpperCase() === 'ETH';
          
          if (isETHOrWETH) {
              console.log(`🏦 ETH/WETH is natively supported: ✅ SUPPORTED`);
              return true;
          }
          
          // For other tokens, check the contract
          const isSupported = await this.abokiContract.supportedTokens(tokenAddress);
          console.log(`🏦 Reserve support: ${isSupported ? '✅ SUPPORTED' : '❌ NOT SUPPORTED'}`);
          return isSupported;
      } catch (error) {
          console.error(`❌ Error checking reserve support for ${tokenAddress}:`, error.message);
          
          // If it's ETH/WETH and there's an error, assume it's supported
          const isETHOrWETH = tokenAddress?.toLowerCase() === BASE_CONFIG.WETH?.toLowerCase() ||
                             tokenAddress?.toLowerCase() === '0x4200000000000000000000000000000000000006';
          if (isETHOrWETH) {
              console.log(`🏦 ETH/WETH assumed supported despite error`);
              return true;
          }
          
          return false;
      }
  }
  
  async getTokenToUSDCPrice(tokenAddress, tokenAmount, options = {}) {
      try {
          // Handle ETH special case - convert to WETH address for price checking
          let effectiveTokenAddress = tokenAddress;
          
          if (tokenAddress?.toUpperCase() === 'ETH' || 
              tokenAddress?.toLowerCase() === '0x0000000000000000000000000000000000000000') {
              effectiveTokenAddress = BASE_CONFIG.WETH || '0x4200000000000000000000000000000000000006';
              console.log(`🔄 Converting ETH to WETH address for pricing: ${effectiveTokenAddress}`);
          }
          
          // Call the original method with the effective address
          return await super.getTokenToUSDCPrice(effectiveTokenAddress, tokenAmount, options);
          
      } catch (error) {
          console.error('❌ Error in ETH-aware price estimation:', error.message);
          return {
              success: false,
              error: error.message,
              canProcessOnramp: false
          };
      }
  }
}

/**
 * Business configuration fix - ensure ETH is properly configured
 */
function ensureETHConfiguration(business) {
  // Make sure ETH is in the business supported tokens for Base
  if (!business.supportedTokens?.base) {
      business.supportedTokens = { ...business.supportedTokens, base: [] };
  }
  
  // Check if ETH is already configured
  const hasETH = business.supportedTokens.base.some(token => 
      token.symbol.toUpperCase() === 'ETH' || 
      token.symbol.toUpperCase() === 'WETH'
  );
  
  if (!hasETH) {
      console.log('📝 Adding ETH configuration to business tokens...');
      business.supportedTokens.base.push({
          symbol: 'ETH',
          name: 'Ethereum',
          contractAddress: BASE_CONFIG.WETH || '0x4200000000000000000000000000000000000006',
          decimals: 18,
          isActive: true,
          isTradingEnabled: true,
          isDefault: true,
          network: 'base',
          logoUrl: 'https://ethereum.org/static/6b935ac0e6194247347855dc3d328e83/81d9f/eth-diamond-colored.webp'
      });
  }
  
  return business;
}

/**
 * Ensure Solana SOL configuration
 */
function ensureSOLConfiguration(business) {
  // Make sure SOL is in the business supported tokens for Solana
  if (!business.supportedTokens?.solana) {
      business.supportedTokens = { ...business.supportedTokens, solana: [] };
  }
  
  // Check if SOL is already configured
  const hasSOL = business.supportedTokens.solana.some(token => 
      token.symbol.toUpperCase() === 'SOL'
  );
  
  if (!hasSOL) {
      console.log('📝 Adding SOL configuration to business tokens...');
      business.supportedTokens.solana.push({
          symbol: 'SOL',
          name: 'Solana',
          contractAddress: SOLANA_CONFIG.TOKENS.SOL || '11111111111111111111111111111112',
          decimals: 9,
          isActive: true,
          isTradingEnabled: true,
          isDefault: true,
          network: 'solana',
          logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
      });
  }
  
  return business;
}

// Export the complete updated controller with all methods and Base/Solana support
module.exports = {
  ...genericTokenOnrampController,
  // Export helper functions for testing
  helpers: {
    validateAndPriceToken,
    processBaseNetworkTokenFixed,
    processSolanaNetworkToken,
    processNonBaseToken,
    initializeBaseTransaction,
    initializeSolanaTransaction,
    getUSDCToNGNRate,
    OnrampPriceCheckerFixed,
    ensureETHConfiguration,
    ensureSOLConfiguration,
    BASE_CONFIG_ADDITIONS
  }
};
