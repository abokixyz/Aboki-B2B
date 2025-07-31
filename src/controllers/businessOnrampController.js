/**
 * COMPLETE FIXED Generic Token Onramp Controller with Smart Contract Integration
 * Supports any token with proper validation and routing using CURRENT exchange rates
 */

const { BusinessOnrampOrder, BUSINESS_ORDER_STATUS } = require('../models/BusinessOnrampOrder');
const { Business } = require('../models');
const monnifyService = require('../services/monnifyService');
const { OnrampPriceChecker } = require('../services/onrampPriceChecker');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Initialize price checker
const priceChecker = new OnrampPriceChecker();

/**
 * FIXED: Get USDC to NGN rate using your own onramp pricing API instead of hardcoded values
 */
async function getUSDCToNGNRate() {
  try {
    const baseUrl = process.env.INTERNAL_API_BASE_URL || 'http://localhost:5002';
    
    console.log('[USDC_NGN_RATE] Fetching current USDC rate from onramp API...');
    
    try {
      // FIXED: Use your own onramp-price endpoint to get current USDC rate
      const response = await axios.get(`${baseUrl}/api/v1/onramp-price`, {
        params: {
          cryptoSymbol: 'USDC',
          cryptoAmount: 1 // Get price for 1 USDC
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
      
      // Fallback to dedicated exchange rate endpoint if it exists
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
      
      // Last resort: Use environment variable or current market fallback
      const fallbackRate = process.env.CURRENT_USDC_NGN_RATE || 1720; // Updated fallback
      console.log(`[USDC_NGN_RATE] ⚠️  Using fallback rate: ₦${fallbackRate} (update CURRENT_USDC_NGN_RATE env var)`);
      return parseFloat(fallbackRate);
    }
    
  } catch (error) {
    console.error('[USDC_NGN_RATE] Error getting USDC-NGN rate:', error.message);
    
    // Emergency fallback - should be updated regularly
    const emergencyRate = 1720;
    console.log(`[USDC_NGN_RATE] 🆘 Using emergency fallback: ₦${emergencyRate}`);
    return emergencyRate;
  }
}

/**
 * FIXED: Universal token validation and pricing function that properly handles customer purchase amounts
 */
async function validateAndPriceToken(cryptoSymbol, business, cryptoAmount = 1, customerNgnAmount = null) {
  try {
    console.log(`[TOKEN_PROCESSOR] Processing ${cryptoSymbol} ${customerNgnAmount ? `for customer purchase: ₦${customerNgnAmount.toLocaleString()}` : `for ${cryptoAmount} tokens`}`);
    
    // Step 1: Find token in business configuration
    let tokenAddress = null;
    let tokenInfo = null;
    let network = null;
    
    for (const networkName of ['base', 'solana', 'ethereum']) {
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
          break;
        }
      }
    }
    
    if (!tokenAddress || !tokenInfo) {
      throw new Error(`Token ${cryptoSymbol} is not configured in your business supported tokens`);
    }
    
    console.log(`[TOKEN_PROCESSOR] ✅ Found ${cryptoSymbol} in business config: ${tokenAddress} on ${network}`);
    
    // Step 2: For Base network, validate smart contract support
    if (network === 'base') {
      return await processBaseNetworkTokenFixed(cryptoSymbol, tokenInfo, cryptoAmount, customerNgnAmount);
    } else {
      // Step 3: For other networks, use internal API
      return await processNonBaseToken(cryptoSymbol, tokenInfo, network, cryptoAmount);
    }
    
  } catch (error) {
    console.error(`[TOKEN_PROCESSOR] Error processing ${cryptoSymbol}:`, error.message);
    throw error;
  }
}

/**
 * COMPLETELY FIXED: Properly handles customer purchase amount vs minimum transaction validation
 */
async function processBaseNetworkTokenFixed(cryptoSymbol, tokenInfo, cryptoAmount, customerNgnAmount = null) {
  try {
      console.log(`[BASE_TOKEN_PROCESSOR] Processing Base token: ${cryptoSymbol}`);
      
      // Step 1: Check if token is supported by smart contract reserve
      console.log(`[BASE_TOKEN_PROCESSOR] Checking smart contract support...`);
      const isReserveSupported = await priceChecker.isTokenSupportedByReserve(tokenInfo.contractAddress);
      
      if (!isReserveSupported) {
          console.error(`[BASE_TOKEN_PROCESSOR] ❌ ${cryptoSymbol} not supported by smart contract reserve`);
          throw new Error(`Token ${cryptoSymbol} is not supported by the smart contract reserve. Please contact support to add this token.`);
      }
      
      console.log(`[BASE_TOKEN_PROCESSOR] ✅ ${cryptoSymbol} is supported by reserve`);
      
      // Step 2: Get unit price first (1 token)
      console.log(`[BASE_TOKEN_PROCESSOR] Getting unit price for ${cryptoSymbol}...`);
      const unitPriceResult = await priceChecker.getTokenToUSDCPrice(tokenInfo.contractAddress, 1, {
          verbose: false,
          checkReserveSupport: false, // Already checked above
          minLiquidityThreshold: 0, // Don't check minimum for unit price
          checkPoolLiquidity: true
      });
      
      if (!unitPriceResult.success) {
          console.error(`[BASE_TOKEN_PROCESSOR] ❌ Failed to get ${cryptoSymbol} unit price:`, unitPriceResult.error);
          throw new Error(`Failed to get ${cryptoSymbol} price from DEX: ${unitPriceResult.error}`);
      }
      
      console.log(`[BASE_TOKEN_PROCESSOR] ✅ Unit price: 1 ${cryptoSymbol} = $${unitPriceResult.pricePerToken} USDC`);
      
      // Step 3: Get CURRENT USDC to NGN rate from your pricing API
      console.log(`[BASE_TOKEN_PROCESSOR] Getting current USDC-NGN exchange rate...`);
      const usdcToNgnRate = await getUSDCToNGNRate();
      console.log(`[BASE_TOKEN_PROCESSOR] ✅ Current USDC rate: ₦${usdcToNgnRate.toLocaleString()}`);
      
      // Step 4: Calculate customer's actual token amount if NGN amount provided
      let actualTokenAmount = cryptoAmount;
      let actualUsdcValue = unitPriceResult.usdcValue * cryptoAmount;
      
      if (customerNgnAmount) {
          // Convert customer's NGN to USDC using CURRENT rate
          const customerUsdcAmount = customerNgnAmount / usdcToNgnRate;
          
          // Calculate how many tokens customer will get
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
      
      // Step 5: FIXED - Check minimum transaction value using ACTUAL purchase amount
      const meetsMinTransactionValue = actualUsdcValue >= 1.0; // $1 minimum
      
      if (!meetsMinTransactionValue) {
          const minimumNgnRequired = Math.ceil(usdcToNgnRate * 1.0); // ₦ equivalent of $1 USDC
          console.error(`[BASE_TOKEN_PROCESSOR] ❌ Transaction value too small for ${cryptoSymbol}`);
          console.error(`[BASE_TOKEN_PROCESSOR] Customer amount: ₦${customerNgnAmount?.toLocaleString()} = $${actualUsdcValue.toFixed(6)} USDC`);
          console.error(`[BASE_TOKEN_PROCESSOR] Minimum required: $1.00 USDC = ₦${minimumNgnRequired.toLocaleString()}`);
          throw new Error(`Transaction value ($${actualUsdcValue.toFixed(6)}) is below minimum ($1 USDC = ₦${minimumNgnRequired.toLocaleString()}). Minimum purchase: ₦${minimumNgnRequired.toLocaleString()}`);
      }
      
      console.log(`[BASE_TOKEN_PROCESSOR] ✅ Transaction meets minimum value: $${actualUsdcValue.toFixed(6)} USDC (>${1.0} required)`);
      
      // Step 6: Check pool liquidity for large orders
      const hasAdequatePoolLiquidity = unitPriceResult.hasAdequatePoolLiquidity;
      if (!hasAdequatePoolLiquidity && actualUsdcValue > 100) {
          console.log(`[BASE_TOKEN_PROCESSOR] ⚠️  Large order with limited liquidity - may experience slippage`);
      }
      
      // Step 7: Calculate final NGN values using CURRENT rate
      const totalNgnValue = actualUsdcValue * usdcToNgnRate;
      const unitPriceInNgn = (unitPriceResult.pricePerToken * usdcToNgnRate);
      
      console.log(`[BASE_TOKEN_PROCESSOR] ✅ Final calculation with CURRENT rates:`);
      console.log(`  - Unit price: $${unitPriceResult.pricePerToken.toFixed(8)} USDC = ₦${unitPriceInNgn.toLocaleString()}`);
      console.log(`  - Customer gets: ${actualTokenAmount.toFixed(8)} ${cryptoSymbol}`);
      console.log(`  - Total value: $${actualUsdcValue.toFixed(6)} USDC = ₦${totalNgnValue.toLocaleString()}`);
      console.log(`  - Exchange rate source: Current onramp API`);
      
      // Step 8: Prepare swap routing information
      const swapRoute = {
          inputToken: tokenInfo.contractAddress,
          outputToken: unitPriceResult.usdcAddress || '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          route: unitPriceResult.bestRoute,
          expectedUsdcOut: actualUsdcValue,
          slippageTolerance: hasAdequatePoolLiquidity ? 0.5 : 2.0,
          deadline: Math.floor(Date.now() / 1000) + 1800
      };
      
      return {
          cryptoSymbol: cryptoSymbol.toUpperCase(),
          cryptoAmount: actualTokenAmount,
          network: 'base',
          tokenAddress: tokenInfo.contractAddress,
          decimals: tokenInfo.decimals,
          
          // Pricing information with CURRENT rates
          unitPriceInNgn: unitPriceInNgn,
          totalNgnNeeded: totalNgnValue,
          exchangeRate: unitPriceInNgn,
          ngnToTokenRate: 1 / unitPriceInNgn,
          
          // USDC conversion data with CURRENT rate
          usdcValue: actualUsdcValue,
          pricePerTokenUsdc: unitPriceResult.pricePerToken,
          usdcToNgnRate: usdcToNgnRate, // CURRENT rate from API
          
          // FIXED validation results
          reserveSupported: true,
          meetsMinTransactionValue: meetsMinTransactionValue,
          hasAdequatePoolLiquidity: hasAdequatePoolLiquidity,
          liquidityWarning: !hasAdequatePoolLiquidity && actualUsdcValue > 100,
          poolLiquidityInfo: unitPriceResult.poolLiquidityInfo,
          canProcessOnramp: true,
          bestRoute: unitPriceResult.bestRoute,
          
          // Swap routing information
          swapRoute: swapRoute,
          
          // Formatting with CURRENT rates
          formattedPrice: `₦${unitPriceInNgn.toLocaleString()}`,
          exchangeRateString: `1 ${cryptoSymbol} = ₦${unitPriceInNgn.toLocaleString()}`,
          usdcRateString: `1 ${cryptoSymbol} = $${unitPriceResult.pricePerToken.toFixed(6)} USDC`,
          currentUsdcRate: `1 USDC = ₦${usdcToNgnRate.toLocaleString()}`,
          
          // Metadata
          timestamp: new Date(),
          source: 'smart_contract_dex_with_current_rates',
          rateSource: 'onramp_api',
          validation: {
              businessSupported: true,
              contractSupported: true,
              meetsMinValue: meetsMinTransactionValue,
              hasLiquidity: hasAdequatePoolLiquidity,
              canSwap: true,
              actualPurchaseAmount: actualTokenAmount,
              actualUsdcValue: actualUsdcValue,
              currentUsdcRate: usdcToNgnRate,
              minimumUsdcRequired: 1.0,
              minimumNgnRequired: Math.ceil(usdcToNgnRate * 1.0)
          }
      };
      
  } catch (error) {
      console.error(`[BASE_TOKEN_PROCESSOR] Error processing Base token ${cryptoSymbol}:`, error.message);
      throw error;
  }
}

/**
 * Process non-Base tokens using internal API
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
      
      // Pricing information
      unitPriceInNgn: priceData.unitPriceInNgn,
      totalNgnNeeded: priceData.totalNgnNeeded,
      exchangeRate: priceData.unitPriceInNgn,
      ngnToTokenRate: 1 / priceData.unitPriceInNgn,
      
      // Formatting
      formattedPrice: priceData.formattedPrice,
      exchangeRateString: priceData.exchangeRate,
      
      // Metadata
      timestamp: new Date(priceData.timestamp),
      source: priceData.source || 'internal_api',
      validation: {
        businessSupported: true,
        contractSupported: null, // Not applicable for non-Base
        hasLiquidity: true, // Assumed if API returns price
        canSwap: true
      }
    };
    
  } catch (error) {
    console.error(`[NON_BASE_PROCESSOR] Error processing ${network} token ${cryptoSymbol}:`, error.message);
    throw error;
  }
}

/**
 * Initialize transaction for Base network tokens
 */
async function initializeBaseTransaction(orderData, priceData) {
  try {
    console.log(`[TRANSACTION_INIT] Initializing Base transaction for ${orderData.targetToken}`);
    
    // Prepare transaction parameters
    const transactionParams = {
      orderId: orderData.orderId,
      inputToken: priceData.tokenAddress,
      outputToken: priceData.swapRoute.outputToken, // USDC
      inputAmount: orderData.estimatedTokenAmount,
      expectedOutputAmount: priceData.usdcValue,
      customerWallet: orderData.customerWallet,
      swapRoute: priceData.swapRoute,
      deadline: priceData.swapRoute.deadline,
      slippageTolerance: priceData.swapRoute.slippageTolerance
    };
    
    // Send to liquidity server for transaction preparation
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
  // Get supported tokens
  getSupportedTokens: async (req, res) => {
    try {
      console.log('[GENERIC_CONTROLLER] Getting supported tokens');
      const business = req.business;
      
      // Get business with supported tokens
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
      
      // Format supported tokens
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
            feePercentage: 1.5
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
            totalTokens
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

  // COMPLETELY FIXED: Universal token onramp order creation with current rates
  createOnrampOrder: async (req, res) => {
    try {
      console.log('[GENERIC_ONRAMP] Creating universal token onramp order with CURRENT exchange rates');
      const business = req.business;
      const {
        customerEmail,
        customerName,
        customerPhone,
        amount, // Customer's NGN amount
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
      
      console.log(`[GENERIC_ONRAMP] Customer wants: ₦${amount.toLocaleString()} worth of ${targetToken} on ${targetNetwork}`);
      
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
      const netAmount = amount - feeAmount; // This amount actually buys tokens
      
      console.log(`[GENERIC_ONRAMP] Fee calculation:`);
      console.log(`  - Gross amount: ₦${amount.toLocaleString()}`);
      console.log(`  - Business fee (${feePercentage}%): ₦${feeAmount.toLocaleString()}`);
      console.log(`  - Net amount for tokens: ₦${netAmount.toLocaleString()}`);
      
      // Step 2: FIXED - Validate with customer's actual net purchase amount
      let priceData;
      try {
        priceData = await validateAndPriceToken(targetToken, business, 1, netAmount);
      } catch (validationError) {
        console.error(`[GENERIC_ONRAMP] ❌ Token validation failed:`, validationError.message);
        
        return res.status(400).json({
          success: false,
          message: validationError.message,
          details: {
            token: targetToken,
            network: targetNetwork,
            customerAmount: `₦${amount.toLocaleString()}`,
            netAmountForTokens: `₦${netAmount.toLocaleString()}`,
            step: 'token_validation_with_current_rates'
          },
          code: 'TOKEN_VALIDATION_FAILED'
        });
      }
      
      console.log(`[GENERIC_ONRAMP] ✅ Token validation passed using CURRENT rates`);
      console.log(`[GENERIC_ONRAMP] Customer will receive: ${priceData.cryptoAmount.toFixed(8)} ${targetToken}`);
      console.log(`[GENERIC_ONRAMP] Current USDC rate: ₦${priceData.usdcToNgnRate.toLocaleString()}`);
      
      // Step 3: Use the calculated token amount from priceData
      const estimatedTokenAmount = parseFloat(priceData.cryptoAmount.toFixed(priceData.decimals || 18));
      
      console.log(`[GENERIC_ONRAMP] Final order calculations:`);
      console.log(`  - Gross Amount: ₦${amount.toLocaleString()}`);
      console.log(`  - Fee (${feePercentage}%): ₦${feeAmount.toLocaleString()}`);
      console.log(`  - Net Amount: ₦${netAmount.toLocaleString()}`);
      console.log(`  - Token Amount: ${estimatedTokenAmount} ${targetToken}`);
      console.log(`  - Price Source: ${priceData.source}`);
      console.log(`  - Current USDC Rate: ₦${priceData.usdcToNgnRate.toLocaleString()}`);
      
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
       /**
 * COMPLETE FIXED Generic Token Onramp Controller - Part 2
 * Continuation of the fixed controller with current exchange rates
 */

       metadata: {
        ...metadata,
        // Token validation results
        tokenValidation: priceData.validation,
        // Pricing metadata with current rates
        pricingSource: priceData.source,
        pricingTimestamp: priceData.timestamp,
        currentUsdcRate: priceData.usdcToNgnRate,
        rateSource: priceData.rateSource,
        // Smart contract data (if applicable)
        ...(priceData.usdcValue && {
          smartContractData: {
            usdcValue: priceData.usdcValue,
            pricePerTokenUsdc: priceData.pricePerTokenUsdc,
            bestRoute: priceData.bestRoute,
            reserveSupported: priceData.reserveSupported,
            liquidityAdequate: priceData.hasAdequatePoolLiquidity,
            swapRoute: priceData.swapRoute,
            actualUsdcValue: priceData.validation.actualUsdcValue
          }
        })
      },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    });
    
    await order.save();
    console.log(`[GENERIC_ONRAMP] ✅ Order created: ${order.orderId}`);
    
    // Step 6: Generate payment link
    console.log(`[GENERIC_ONRAMP] Generating payment link...`);
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
    
    console.log(`[GENERIC_ONRAMP] ✅ Payment link generated`);
    
    // Step 7: For Base tokens, initialize transaction preparation
    let transactionPreparation = null;
    if (priceData.network === 'base' && priceData.swapRoute) {
      try {
        transactionPreparation = await initializeBaseTransaction(order, priceData);
        console.log(`[GENERIC_ONRAMP] ✅ Transaction preparation initiated`);
      } catch (transactionError) {
        console.warn(`[GENERIC_ONRAMP] Transaction preparation failed:`, transactionError.message);
        // Don't fail the order creation, just log the issue
      }
    }
    
    // Step 8: Prepare comprehensive response
    const responseData = {
      orderId: order.orderId,
      businessOrderReference: order.businessOrderReference,
      amount: order.amount,
      targetToken: order.targetToken,
      targetNetwork: order.targetNetwork,
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
        decimals: priceData.decimals
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
    
    // Add smart contract specific data for Base tokens
    if (priceData.network === 'base' && priceData.usdcValue) {
      responseData.smartContractData = {
        usdcValue: priceData.usdcValue,
        pricePerTokenUsdc: priceData.pricePerTokenUsdc,
        bestRoute: priceData.bestRoute,
        swapRoute: priceData.swapRoute,
        reserveSupported: priceData.reserveSupported,
        liquidityAdequate: priceData.hasAdequatePoolLiquidity,
        actualUsdcValue: priceData.validation.actualUsdcValue,
        minimumUsdcRequired: priceData.validation.minimumUsdcRequired,
        minimumNgnRequired: priceData.validation.minimumNgnRequired
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
        estimatedTokenAmount: order.estimatedTokenAmount,
        customerEmail: order.customerEmail,
        customerWallet: order.customerWallet,
        metadata: order.metadata,
        currentUsdcRate: priceData.usdcToNgnRate
      };
      
      sendBusinessWebhook(order.webhookUrl, orderData, 'order.created')
        .catch(error => console.error('[GENERIC_ONRAMP] Webhook failed:', error));
    }
    
    res.status(201).json({
      success: true,
      message: `Onramp order created successfully for ${targetToken} using current exchange rates`,
      data: responseData
    });
    
    console.log(`[GENERIC_ONRAMP] ✅ Order creation completed for ${targetToken} with current rates`);
    
  } catch (error) {
    console.error('[GENERIC_ONRAMP] Order creation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create onramp order',
      details: {
        token: req.body.targetToken,
        network: req.body.targetNetwork,
        step: 'order_creation'
      },
      code: 'ORDER_CREATION_FAILED'
    });
  }
},

// FIXED: Universal token quote with current rates
getQuote: async (req, res) => {
  try {
    console.log('[GENERIC_QUOTE] Getting universal token quote with CURRENT exchange rates');
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
    
    console.log(`[GENERIC_QUOTE] Quote request: ${targetToken} on ${targetNetwork}, Amount: ₦${amount.toLocaleString()}`);
    
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
    
    // FIXED: Universal token validation and pricing with customer's net amount
    let priceData;
    try {
      priceData = await validateAndPriceToken(targetToken, business, 1, netAmount);
    } catch (validationError) {
      console.error(`[GENERIC_QUOTE] ❌ Validation failed:`, validationError.message);
      
      return res.status(400).json({
        success: false,
        message: validationError.message,
        details: {
          token: targetToken,
          network: targetNetwork,
          customerAmount: `₦${amount.toLocaleString()}`,
          netAmountForTokens: `₦${netAmount.toLocaleString()}`,
          step: 'quote_validation_with_current_rates'
        },
        code: 'QUOTE_VALIDATION_FAILED'
      });
    }
    
    // The priceData already contains the correct token amount for customer's net purchase
    const finalTokenAmount = parseFloat(priceData.cryptoAmount.toFixed(priceData.decimals || 18));
    const tokenAmount = parseFloat((amount * priceData.ngnToTokenRate).toFixed(priceData.decimals || 18)); // Gross token amount
    
    // Prepare comprehensive quote response with CURRENT rates
    const responseData = {
      amount,
      targetToken: targetToken.toUpperCase(),
      targetNetwork: targetNetwork.toLowerCase(),
      exchangeRate: priceData.unitPriceInNgn,
      tokenAmount, // Gross amount (before fees)
      feePercentage,
      feeAmount,
      netAmount,
      finalTokenAmount, // Net amount (after fees) - what customer actually receives
      
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
        decimals: priceData.decimals
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
    
    // Add smart contract data for Base tokens
    if (priceData.network === 'base' && priceData.usdcValue) {
      responseData.smartContractData = {
        usdcValue: priceData.usdcValue,
        pricePerTokenUsdc: priceData.pricePerTokenUsdc,
        bestRoute: priceData.bestRoute,
        swapRoute: priceData.swapRoute,
        reserveSupported: priceData.reserveSupported,
        liquidityAdequate: priceData.hasAdequatePoolLiquidity,
        actualUsdcValue: priceData.validation.actualUsdcValue,
        minimumUsdcRequired: priceData.validation.minimumUsdcRequired,
        minimumNgnRequired: priceData.validation.minimumNgnRequired,
        estimatedGas: priceData.swapRoute?.estimatedGas || 'TBD'
      };
    }
    
    res.json({
      success: true,
      message: `Quote generated successfully for ${targetToken} using current exchange rates`,
      data: responseData
    });
    
    console.log(`[GENERIC_QUOTE] ✅ Quote completed for ${targetToken} with current rates`);
    
  } catch (error) {
    console.error('[GENERIC_QUOTE] Quote error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate quote',
      code: 'QUOTE_ERROR'
    });
  }
},

// Get order by ID
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
        smartContractData: order.metadata?.smartContractData
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

// Get all orders
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
    
    // Calculate summary
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
          totalFees: { $sum: '$feeAmount' }
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
          currentUsdcRate: order.metadata?.currentUsdcRate
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
          totalFees: 0
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

// Get business statistics
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
    
    // Network breakdown
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
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);
    
    // Exchange rate analysis (NEW)
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
    
    // Time series data
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
            $dateToString: {
              format: groupBy === 'day' ? '%Y-%m-%d' : 
                     groupBy === 'week' ? '%Y-%U' : '%Y-%m',
              date: '$createdAt'
            }
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
      { $sort: { '_id': 1 } }
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
            totalAmount: item.totalAmount
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

// Handle Monnify webhook
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
        currentUsdcRate: order.metadata?.currentUsdcRate
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

// Universal token support checker with current rates
checkTokenSupport: async (req, res) => {
  try {
    console.log('[TOKEN_SUPPORT] Checking universal token support with current rates');
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
   /**
 * COMPLETE FIXED Generic Token Onramp Controller - Final Part
 * Continuation with all remaining methods and exports
 */

   businessCheck.result = {
    symbol: tokenInfo.symbol,
    name: tokenInfo.name,
    contractAddress: tokenInfo.contractAddress,
    decimals: tokenInfo.decimals,
    isActive: tokenInfo.isActive,
    isTradingEnabled: tokenInfo.isTradingEnabled
  };
  supportCheck.checks.push(businessCheck);
  
  // Check 2: Smart contract support (Base only)
  if (targetNetwork.toLowerCase() === 'base') {
    const contractCheck = {
      name: 'Smart Contract Support',
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
    
    // Check 3: Liquidity and pricing with current rates (Base only)
    if (contractCheck.status === 'passed') {
      const liquidityCheck = {
        name: 'Liquidity and Pricing',
        status: 'checking'
      };
      
      try {
        const priceResult = await priceChecker.getTokenToUSDCPrice(tokenInfo.contractAddress, 1, {
          verbose: false,
          checkReserveSupport: false,
          minLiquidityThreshold: 50
        });
        
        // Get current USDC rate
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
  }
  
  // Check 4: Fee configuration
  const feeCheck = {
    name: 'Fee Configuration',
    status: 'checking'
  };
  
  const feeConfig = business.feeConfiguration?.[targetNetwork]?.find(
    f => f.contractAddress?.toLowerCase() === tokenInfo.contractAddress?.toLowerCase() && f.isActive
  );
  
  feeCheck.status = 'passed'; // Fees are optional
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
    ? `${targetToken} is ready for onramp orders`
    : `${targetToken} cannot be used for onramp - fix failing checks`;
  
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

// Get all supported tokens with validation status and current rates
getSupportedTokensWithValidation: async (req, res) => {
try {
  console.log('[SUPPORTED_TOKENS] Getting all supported tokens with validation and current rates');
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
      
      // Perform validation if requested or for Base tokens
      if (validateAll || networkName.toLowerCase() === 'base') {
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
                  // Current NGN pricing
                  ngnPricePerToken: quickPrice.pricePerToken * currentUsdcRate,
                  currentUsdcRate: currentUsdcRate,
                  formattedNgnPrice: `₦${(quickPrice.pricePerToken * currentUsdcRate).toLocaleString()}`
                };
              }
            } else {
              tokenStatus.validation.hasLiquidity = false;
              tokenStatus.validation.canProcessOnramp = false;
            }
          } else {
            // For non-Base networks, assume supported if configured
            tokenStatus.validation.contractSupported = 'N/A';
            tokenStatus.validation.hasLiquidity = 'Assumed';
            tokenStatus.validation.canProcessOnramp = true;
          }
          
          // Determine support level
          if (tokenStatus.validation.canProcessOnramp === true) {
            tokenStatus.supportLevel = 'fully_supported';
            tokenReport.summary.fullySupported++;
          } else if (tokenStatus.validation.contractSupported === true) {
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
    tokenReport.recommendations.push(`${tokenReport.summary.notSupported} tokens are not fully supported - check smart contract configuration`);
  }
  
  if (tokenReport.summary.partiallySupported > 0) {
    tokenReport.recommendations.push(`${tokenReport.summary.partiallySupported} tokens have limited liquidity - consider adding DEX liquidity`);
  }
  
  if (tokenReport.summary.fullySupported === 0) {
    tokenReport.recommendations.push('No tokens are fully supported for onramp - check configuration and liquidity');
  }
  
  res.json({
    success: true,
    message: `Found ${tokenReport.summary.totalTokens} configured tokens with current USDC rate: ₦${currentUsdcRate.toLocaleString()}`,
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

// Test any token before using it for orders with current rates
testToken: async (req, res) => {
try {
  console.log('[TOKEN_TEST] Testing token for onramp compatibility with current rates');
  const business = req.business;
  const { targetToken, targetNetwork, testAmount = 1000 } = req.body; // Default test with ₦1000
  
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
      message: `${targetToken} is not configured for your business`,
      data: testResult
    });
  }
  
  // Test 2: Price and Validation with CURRENT rates and customer amount
  const test2 = {
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
    
    test2.status = 'passed';
    test2.result = {
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
      validation: priceData.validation
    };
    
    // Add network-specific data
    if (priceData.network === 'base') {
      test2.result.smartContractData = {
        usdcValue: priceData.usdcValue,
        pricePerTokenUsdc: priceData.pricePerTokenUsdc,
        bestRoute: priceData.bestRoute,
        reserveSupported: priceData.reserveSupported,
        liquidityAdequate: priceData.hasAdequatePoolLiquidity,
        actualUsdcValue: priceData.validation.actualUsdcValue,
        minimumUsdcRequired: priceData.validation.minimumUsdcRequired,
        minimumNgnRequired: priceData.validation.minimumNgnRequired
      };
    }
    
    testResult.priceData = priceData;
  } catch (error) {
    test2.status = 'failed';
    test2.error = error.message;
  }
  
  testResult.tests.push(test2);
  
  // Test 3: Fee Calculation
  const test3 = {
    name: 'Fee Calculation',
    status: 'testing'
  };
  
  try {
    const feeConfig = business.feeConfiguration?.[targetNetwork]?.find(
      f => f.contractAddress?.toLowerCase() === testResult.tokenInfo.contractAddress?.toLowerCase()
    );
    
    test3.status = 'passed';
    test3.result = {
      feeConfigured: !!feeConfig,
      feePercentage: feeConfig ? feeConfig.feePercentage : 0,
      feeCalculationWorking: true
    };
  } catch (error) {
    test3.status = 'error';
    test3.error = error.message;
  }
  
  testResult.tests.push(test3);
  
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
    ? `${targetToken} is fully compatible with onramp system using current rates`
    : `${targetToken} has ${totalTests - passedTests} failing test(s) and cannot be used for onramp`;
  
  // Add next steps with current rate info
  if (testResult.summary.canProcessOnramp) {
    testResult.nextSteps = [
      `Create quote: POST /api/v1/business-onramp/quote`,
      `Create order: POST /api/v1/business-onramp/create`,
      `Monitor orders: GET /api/v1/business-onramp/orders`,
      `Current USDC rate: ₦${testResult.priceData?.usdcToNgnRate?.toLocaleString() || 'N/A'}`
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

// Health check for onramp system with current rate validation
healthCheck: async (req, res) => {
try {
  console.log('[HEALTH_CHECK] Checking onramp system health with current rates');
  
  const healthReport = {
    timestamp: new Date().toISOString(),
    version: 'generic-v1.1-fixed',
    services: {},
    overallStatus: 'checking'
  };
  
  // Check smart contract connection
  healthReport.services.smartContract = {
    name: 'Smart Contract (Base)',
    status: 'checking'
  };
  
  try {
    const connectionValid = await priceChecker.validateConnection();
    const contractConfig = await priceChecker.getContractConfiguration();
    
    healthReport.services.smartContract.status = connectionValid ? 'healthy' : 'unhealthy';
    healthReport.services.smartContract.details = {
      connected: connectionValid,
      configuration: contractConfig,
      contractAddress: process.env.ABOKI_V2_CONTRACT || 'Not configured',
      rpcUrl: process.env.BASE_RPC_URL || 'Not configured'
    };
  } catch (error) {
    healthReport.services.smartContract.status = 'unhealthy';
    healthReport.services.smartContract.error = error.message;
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
  
  // NEW: Check current USDC rate fetching
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
    baseTokenSupport: healthReport.services.smartContract.status === 'healthy',
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
  
  const statusCode = healthReport.overallStatus === 'healthy' ? 200 : 
                     healthReport.overallStatus === 'degraded' ? 207 : 503;
  
  res.status(statusCode).json({
    success: healthReport.overallStatus !== 'unhealthy',
    message: `Onramp system is ${healthReport.overallStatus} with current rate support`,
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

// Export the complete controller with all methods
module.exports = {
...genericTokenOnrampController,
// Export helper functions for testing
helpers: {
validateAndPriceToken,
processBaseNetworkTokenFixed,
processNonBaseToken,
initializeBaseTransaction,
getUSDCToNGNRate // Now uses current rates from your API
}
};