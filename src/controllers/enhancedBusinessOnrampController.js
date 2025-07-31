/**
 * Enhanced Business Onramp Controller - Updated with Smart Contract Token Support Validation
 * Validates both business support AND smart contract support before creating orders
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
 * Enhanced token validation function that checks BOTH business and smart contract support
 */
async function validateTokenSupport(tokenInfo, targetToken, targetNetwork) {
  try {
    console.log(`[TOKEN_VALIDATION] Validating ${targetToken} on ${targetNetwork}`);
    
    // Step 1: Business support validation (already done in main function)
    console.log(`[TOKEN_VALIDATION] ✅ Business supports ${targetToken}`);
    
    // Step 2: Smart contract support validation (NEW)
    if (targetNetwork === 'base') {
      console.log(`[TOKEN_VALIDATION] Checking smart contract support for ${targetToken}...`);
      
      const isContractSupported = await priceChecker.isTokenSupportedByReserve(tokenInfo.contractAddress);
      
      if (!isContractSupported) {
        console.error(`[TOKEN_VALIDATION] ❌ Smart contract does NOT support ${targetToken}`);
        return {
          valid: false,
          reason: 'TOKEN_NOT_SUPPORTED_BY_SMART_CONTRACT',
          message: `Token ${targetToken} is not supported by the reserve smart contract`,
          businessSupported: true,
          contractSupported: false
        };
      }
      
      console.log(`[TOKEN_VALIDATION] ✅ Smart contract supports ${targetToken}`);
      
      // Step 3: Check liquidity availability
      console.log(`[TOKEN_VALIDATION] Checking liquidity for ${targetToken}...`);
      
      const quickPrice = await priceChecker.getQuickPrice(tokenInfo.contractAddress, 1);
      
      if (!quickPrice.success) {
        console.error(`[TOKEN_VALIDATION] ❌ No liquidity available for ${targetToken}`);
        return {
          valid: false,
          reason: 'NO_LIQUIDITY_AVAILABLE',
          message: `No liquidity available for ${targetToken} on DEX`,
          businessSupported: true,
          contractSupported: true,
          hasLiquidity: false
        };
      }
      
      if (!quickPrice.hasAdequateLiquidity) {
        console.error(`[TOKEN_VALIDATION] ❌ Insufficient liquidity for ${targetToken}`);
        return {
          valid: false,
          reason: 'INSUFFICIENT_LIQUIDITY',
          message: `Insufficient liquidity for ${targetToken} (minimum $100 USDC required)`,
          businessSupported: true,
          contractSupported: true,
          hasLiquidity: false,
          usdcValue: quickPrice.usdcValue
        };
      }
      
      console.log(`[TOKEN_VALIDATION] ✅ Adequate liquidity available for ${targetToken}`);
      
      return {
        valid: true,
        reason: 'FULLY_SUPPORTED',
        message: `Token ${targetToken} is fully supported`,
        businessSupported: true,
        contractSupported: true,
        hasLiquidity: true,
        priceData: quickPrice
      };
      
    } else {
      // For non-Base networks, we only check business support for now
      console.log(`[TOKEN_VALIDATION] Non-Base network (${targetNetwork}), skipping smart contract validation`);
      return {
        valid: true,
        reason: 'BUSINESS_SUPPORTED_ONLY',
        message: `Token ${targetToken} is supported by business (smart contract validation not available for ${targetNetwork})`,
        businessSupported: true,
        contractSupported: null, // Not applicable
        hasLiquidity: null // Not checked for non-Base
      };
    }
    
  } catch (error) {
    console.error(`[TOKEN_VALIDATION] Error validating ${targetToken}:`, error);
    return {
      valid: false,
      reason: 'VALIDATION_ERROR',
      message: `Error validating token support: ${error.message}`,
      businessSupported: true,
      contractSupported: null,
      error: error.message
    };
  }
}

/**
 * Enhanced price fetching function using smart contract integration
 */
async function fetchCryptoToNgnPriceWithSmartContract(cryptoSymbol, business, cryptoAmount = 1) {
  try {
    console.log(`[SMART_CONTRACT_PRICE] Fetching ${cryptoSymbol} price with smart contract validation`);
    
    // Find token address from business supported tokens
    let tokenAddress = null;
    let tokenInfo = null;
    let network = null;
    
    for (const networkName of ['base', 'solana', 'ethereum']) {
      if (business.supportedTokens?.[networkName]) {
        const token = business.supportedTokens[networkName].find(
          t => t.symbol.toUpperCase() === cryptoSymbol.toUpperCase() && t.isActive
        );
        if (token) {
          tokenAddress = token.contractAddress;
          tokenInfo = token;
          network = networkName;
          break;
        }
      }
    }
    
    if (!tokenAddress) {
      throw new Error(`Token ${cryptoSymbol} not found in business supported tokens`);
    }
    
    console.log(`[SMART_CONTRACT_PRICE] Token found: ${tokenInfo.symbol} (${tokenAddress}) on ${network}`);
    
    // Currently only Base network is supported by OnrampPriceChecker
    if (network !== 'base') {
      throw new Error(`Smart contract pricing only supports Base network. Token ${cryptoSymbol} is on ${network}`);
    }
    
    // Use the onramp price checker to get USDC price from smart contracts
    console.log(`[SMART_CONTRACT_PRICE] Querying smart contracts for ${cryptoAmount} ${cryptoSymbol}...`);
    
    const priceResult = await priceChecker.getTokenToUSDCPrice(
      tokenAddress, 
      cryptoAmount,
      {
        verbose: true,
        checkReserveSupport: true,
        minLiquidityThreshold: 100 // Minimum $100 USDC liquidity
      }
    );
    
    if (!priceResult.success) {
      throw new Error(`Failed to get smart contract price for ${cryptoSymbol}: ${priceResult.error}`);
    }
    
    if (!priceResult.canProcessOnramp) {
      throw new Error(`Token ${cryptoSymbol} cannot be processed: ${!priceResult.isReserveSupported ? 'Reserve not supported' : 'Insufficient liquidity'}`);
    }
    
    // Get USDC to NGN conversion rate
    const usdcToNgnRate = await getUSDCToNGNRate();
    
    // Calculate NGN values from USDC amounts
    const totalNgnValue = priceResult.usdcValue * usdcToNgnRate;
    const unitPriceInNgn = totalNgnValue / cryptoAmount;
    
    console.log(`[SMART_CONTRACT_PRICE] Smart contract pricing results:`);
    console.log(`  - ${cryptoAmount} ${cryptoSymbol} = ${priceResult.usdcValue} USDC`);
    console.log(`  - Price per token: ${priceResult.pricePerToken} USDC`);
    console.log(`  - Best DEX route: ${priceResult.bestRoute}`);
    console.log(`  - USDC to NGN rate: ₦${usdcToNgnRate.toLocaleString()}`);
    console.log(`  - Total NGN value: ₦${totalNgnValue.toLocaleString()}`);
    console.log(`  - Unit price in NGN: ₦${unitPriceInNgn.toLocaleString()}`);
    console.log(`  - Reserve supported: ${priceResult.isReserveSupported}`);
    console.log(`  - Adequate liquidity: ${priceResult.hasAdequateLiquidity}`);
    
    return {
      cryptoSymbol: cryptoSymbol.toUpperCase(),
      cryptoAmount: cryptoAmount,
      network: network,
      tokenAddress: tokenAddress,
      
      // USDC values from smart contract
      usdcValue: priceResult.usdcValue,
      pricePerTokenUsdc: priceResult.pricePerToken,
      
      // NGN conversions
      unitPriceInNgn: unitPriceInNgn,
      totalNgnNeeded: totalNgnValue,
      exchangeRate: unitPriceInNgn,
      ngnToTokenRate: 1 / unitPriceInNgn,
      
      // Smart contract specific data
      bestRoute: priceResult.bestRoute,
      reserveSupported: priceResult.isReserveSupported,
      liquidityAdequate: priceResult.hasAdequateLiquidity,
      canProcessOnramp: priceResult.canProcessOnramp,
      
      // Formatting
      formattedPrice: `₦${unitPriceInNgn.toLocaleString()}`,
      exchangeRateString: `1 ${cryptoSymbol} = ₦${unitPriceInNgn.toLocaleString()}`,
      usdcRateString: `1 ${cryptoSymbol} = ${priceResult.pricePerToken.toFixed(6)} USDC`,
      
      // Metadata
      timestamp: new Date(priceResult.timestamp),
      source: 'smart_contract_dex',
      contractAddress: priceResult.contractAddress,
      tokenInfo: priceResult.tokenInfo
    };
    
  } catch (error) {
    console.error('[SMART_CONTRACT_PRICE] Enhanced price fetch error:', error);
    throw new Error(`Failed to fetch ${cryptoSymbol} price from smart contract: ${error.message}`);
  }
}

/**
 * Get USDC to NGN conversion rate
 */
async function getUSDCToNGNRate() {
  try {
    const baseUrl = process.env.INTERNAL_API_BASE_URL || 'http://localhost:5002';
    
    try {
      const response = await axios.get(`${baseUrl}/api/v1/exchange-rate/usdc-ngn`, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'EnhancedOnrampService/1.0'
        }
      });
      
      if (response.data && response.data.success) {
        console.log(`[USDC_NGN_RATE] Got rate from internal API: ₦${response.data.data.rate}`);
        return response.data.data.rate;
      }
    } catch (apiError) {
      console.warn('[USDC_NGN_RATE] Internal API failed, using fallback:', apiError.message);
    }
    
    const fallbackRate = process.env.FALLBACK_USDC_NGN_RATE || 1650;
    console.log(`[USDC_NGN_RATE] Using fallback rate: ₦${fallbackRate}`);
    return parseFloat(fallbackRate);
    
  } catch (error) {
    console.error('[USDC_NGN_RATE] Error getting USDC-NGN rate:', error);
    return 1650;
  }
}

// Helper function to send webhook to business
async function sendBusinessWebhook(webhookUrl, orderData, eventType = 'order.updated') {
  try {
    if (!webhookUrl) {
      console.log('[BUSINESS_WEBHOOK] No webhook URL provided, skipping');
      return { sent: false, reason: 'no_url' };
    }
    
    console.log(`[BUSINESS_WEBHOOK] Sending ${eventType} webhook to ${webhookUrl}`);
    
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
        'User-Agent': 'RampService/1.0'
      },
      timeout: 10000
    });
    
    console.log(`[BUSINESS_WEBHOOK] Successfully sent ${eventType} webhook`);
    return { sent: true };
  } catch (error) {
    console.error(`[BUSINESS_WEBHOOK] Failed to send webhook:`, error.message);
    return { sent: false, error: error.message };
  }
}

// Helper function to send liquidity server webhook
async function sendLiquidityWebhook(orderData) {
  try {
    const liquidityWebhookUrl = process.env.LIQUIDITY_SERVER_WEBHOOK_URL;
    if (!liquidityWebhookUrl) {
      console.log('[LIQUIDITY_WEBHOOK] Liquidity server webhook URL not configured');
      return;
    }
    
    console.log(`[LIQUIDITY_WEBHOOK] Sending settlement request to liquidity server`);
    
    const settlementPayload = {
      event: 'settlement.required',
      timestamp: new Date().toISOString(),
      data: {
        orderId: orderData.orderId,
        businessOrderReference: orderData.businessOrderReference,
        amount: orderData.amount,
        targetToken: orderData.targetToken,
        targetNetwork: orderData.targetNetwork,
        tokenAmount: orderData.estimatedTokenAmount,
        customerWallet: orderData.customerWallet,
        businessId: orderData.businessId,
        feeAmount: orderData.feeAmount,
        metadata: orderData.metadata
      }
    };
    
    const signature = crypto
      .createHmac('sha256', process.env.LIQUIDITY_WEBHOOK_SECRET || 'liquidity-secret')
      .update(JSON.stringify(settlementPayload))
      .digest('hex');
    
    await axios.post(liquidityWebhookUrl, settlementPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Service': 'RampService'
      },
      timeout: 15000
    });
    
    console.log(`[LIQUIDITY_WEBHOOK] Successfully sent settlement request`);
  } catch (error) {
    console.error(`[LIQUIDITY_WEBHOOK] Failed to send liquidity webhook:`, error.message);
    throw error;
  }
}

const enhancedBusinessOnrampController = {
  // Enhanced createOnrampOrder with FULL token validation (business + smart contract)
  createOnrampOrder: async (req, res) => {
    try {
      console.log('[BUSINESS_ONRAMP] Creating new business onramp order with FULL token validation');
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
          message: 'Missing required fields: customerEmail, customerName, amount, targetToken, targetNetwork, customerWallet',
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
      
      console.log(`[BUSINESS_ONRAMP] Request: ${business.businessName}, Customer: ${customerEmail}, Amount: ₦${amount.toLocaleString()}, Target: ${targetToken} on ${targetNetwork}`);
      
      // Step 1: Business-level token validation
      if (!business.supportedTokens || !business.supportedTokens[targetNetwork]) {
        return res.status(400).json({
          success: false,
          message: `${targetNetwork} network not configured for your business`,
          availableNetworks: Object.keys(business.supportedTokens || {}),
          code: 'NETWORK_NOT_CONFIGURED'
        });
      }
      
      const tokenInfo = business.supportedTokens[targetNetwork].find(
        token => token.symbol.toUpperCase() === targetToken.toUpperCase() && 
                 token.isActive && 
                 token.isTradingEnabled
      );
      
      if (!tokenInfo) {
        return res.status(403).json({
          success: false,
          message: `Token ${targetToken} on ${targetNetwork} is not supported or not active for your business`,
          supportedTokens: business.supportedTokens[targetNetwork]
            .filter(t => t.isActive && t.isTradingEnabled)
            .map(t => ({ symbol: t.symbol, name: t.name, contractAddress: t.contractAddress })),
          code: 'TOKEN_NOT_SUPPORTED_BY_BUSINESS'
        });
      }
      
      console.log(`[BUSINESS_ONRAMP] ✅ Business supports ${targetToken}`);
      
      // Step 2: ENHANCED Token validation (business + smart contract + liquidity)
      console.log(`[BUSINESS_ONRAMP] Performing full token validation...`);
      
      const tokenValidation = await validateTokenSupport(tokenInfo, targetToken, targetNetwork);
      
      if (!tokenValidation.valid) {
        console.error(`[BUSINESS_ONRAMP] ❌ Token validation failed:`, tokenValidation.reason);
        
        // Return specific error based on validation failure
        const statusCode = tokenValidation.reason === 'TOKEN_NOT_SUPPORTED_BY_SMART_CONTRACT' ? 403 : 400;
        
        return res.status(statusCode).json({
          success: false,
          message: tokenValidation.message,
          details: {
            businessSupported: tokenValidation.businessSupported,
            contractSupported: tokenValidation.contractSupported,
            hasLiquidity: tokenValidation.hasLiquidity,
            network: targetNetwork,
            reason: tokenValidation.reason,
            ...(tokenValidation.usdcValue && { currentLiquidity: `$${tokenValidation.usdcValue} USDC` }),
            recommendation: tokenValidation.reason === 'TOKEN_NOT_SUPPORTED_BY_SMART_CONTRACT' 
              ? 'Contact support to add this token to the smart contract'
              : tokenValidation.reason === 'INSUFFICIENT_LIQUIDITY'
              ? 'Try a different token with better liquidity'
              : 'Contact support for assistance'
          },
          code: tokenValidation.reason
        });
      }
      
      console.log(`[BUSINESS_ONRAMP] ✅ Full token validation passed - ${tokenValidation.reason}`);
      
      // Step 3: Price calculation using smart contract (only for Base tokens)
      console.log(`[BUSINESS_ONRAMP] Getting price calculation...`);
      
      let priceData;
      
      if (targetNetwork === 'base' && tokenValidation.priceData) {
        // Use smart contract pricing for Base tokens
        console.log(`[BUSINESS_ONRAMP] Using smart contract pricing for Base token`);
        
        try {
          priceData = await fetchCryptoToNgnPriceWithSmartContract(targetToken, business, 1);
        } catch (smartContractError) {
          console.error('[BUSINESS_ONRAMP] Smart contract price calculation failed:', smartContractError);
          return res.status(500).json({
            success: false,
            message: 'Failed to calculate token price from smart contract',
            error: smartContractError.message,
            code: 'SMART_CONTRACT_PRICE_FAILED'
          });
        }
      } else {
        // Fallback to internal API for non-Base tokens or if smart contract fails
        console.log(`[BUSINESS_ONRAMP] Using internal API pricing for ${targetNetwork} token`);
        
        try {
          const baseUrl = process.env.INTERNAL_API_BASE_URL || 'http://localhost:5002';
          const response = await axios.get(`${baseUrl}/api/v1/onramp-price`, {
            params: {
              cryptoSymbol: targetToken,
              cryptoAmount: 1
            },
            timeout: 10000
          });
          
          if (!response.data || !response.data.success) {
            throw new Error(response.data?.message || `Failed to get price for ${targetToken}`);
          }
          
          const apiPriceData = response.data.data;
          
          priceData = {
            cryptoSymbol: targetToken.toUpperCase(),
            cryptoAmount: 1,
            unitPriceInNgn: apiPriceData.unitPriceInNgn,
            totalNgnNeeded: apiPriceData.totalNgnNeeded,
            exchangeRate: apiPriceData.unitPriceInNgn,
            ngnToTokenRate: 1 / apiPriceData.unitPriceInNgn,
            formattedPrice: apiPriceData.formattedPrice,
            exchangeRateString: apiPriceData.exchangeRate,
            timestamp: new Date(apiPriceData.timestamp),
            source: apiPriceData.source || 'internal_api'
          };
        } catch (apiError) {
          console.error('[BUSINESS_ONRAMP] Internal API price calculation failed:', apiError);
          return res.status(500).json({
            success: false,
            message: 'Failed to calculate token price',
            error: apiError.message,
            code: 'PRICE_CALCULATION_FAILED'
          });
        }
      }
      
      // Calculate amounts including business fees
      const feeConfig = business.feeConfiguration?.[targetNetwork]?.find(
        f => f.contractAddress.toLowerCase() === tokenInfo.contractAddress.toLowerCase() && f.isActive
      );
      const feePercentage = feeConfig ? feeConfig.feePercentage : 0;
      
      const feeAmount = Math.round(amount * (feePercentage / 100));
      const netAmount = amount - feeAmount;
      const estimatedTokenAmount = parseFloat((netAmount * priceData.ngnToTokenRate).toFixed(tokenInfo.decimals));
      
      console.log(`[BUSINESS_ONRAMP] Final calculations:`);
      console.log(`  - Amount: ₦${amount.toLocaleString()}`);
      console.log(`  - Fee: ₦${feeAmount.toLocaleString()} (${feePercentage}%)`);
      console.log(`  - Net: ₦${netAmount.toLocaleString()}`);
      console.log(`  - Token Amount: ${estimatedTokenAmount} ${targetToken}`);
      console.log(`  - Price Source: ${priceData.source}`);
      if (priceData.usdcValue) {
        console.log(`  - USDC Value: ${priceData.usdcValue} USDC`);
        console.log(`  - Best Route: ${priceData.bestRoute}`);
      }
      
      // Generate unique references
      const businessOrderReference = `BIZRAMP-${uuidv4()}`;
      const orderId = `BO_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // Create enhanced business onramp order
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
        tokenContractAddress: tokenInfo.contractAddress,
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
          // Enhanced validation metadata
          tokenValidation: {
            businessSupported: tokenValidation.businessSupported,
            contractSupported: tokenValidation.contractSupported,
            hasLiquidity: tokenValidation.hasLiquidity,
            validationReason: tokenValidation.reason
          },
          // Pricing metadata
          pricingSource: priceData.source,
          ...(priceData.usdcValue && {
            smartContractData: {
              usdcValue: priceData.usdcValue,
              pricePerTokenUsdc: priceData.pricePerTokenUsdc,
              bestRoute: priceData.bestRoute,
              reserveSupported: priceData.reserveSupported,
              liquidityAdequate: priceData.liquidityAdequate
            }
          })
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes expiration
      });
      
      await order.save();
      console.log(`[BUSINESS_ONRAMP] Enhanced order created with ID: ${order.orderId}`);
      
      // Generate payment link
      console.log(`[BUSINESS_ONRAMP] Generating payment link with reference: ${businessOrderReference}`);
      const paymentDetails = await monnifyService.generatePaymentLink({
        amount,
        reference: businessOrderReference,
        customerName,
        customerEmail,
        redirectUrl: redirectUrl || `${process.env.FRONTEND_URL}/business-payment/success?orderId=${orderId}`
      });
      
      if (!paymentDetails.success) {
        throw new Error(`Payment link generation failed: ${paymentDetails.message}`);
      }
      
      console.log(`[BUSINESS_ONRAMP] Payment link generated successfully`);
      
      // Prepare order data for webhook
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
        feeAmount: order.feeAmount,
        feePercentage: order.feePercentage,
        exchangeRate: order.exchangeRate,
        createdAt: order.createdAt,
        expiresAt: order.expiresAt,
        metadata: order.metadata
      };
      
      // Optional webhook (non-blocking)
      if (order.webhookUrl) {
        sendBusinessWebhook(order.webhookUrl, orderData, 'order.created')
          .then(result => {
            if (result.sent) {
              BusinessOnrampOrder.findByIdAndUpdate(order._id, {
                'webhookStatus.lastDeliveryStatus': 'delivered',
                'webhookStatus.lastDeliveryAt': new Date()
              }).exec();
            } else {
              BusinessOnrampOrder.findByIdAndUpdate(order._id, {
                'webhookStatus.attempts': 1,
                'webhookStatus.lastDeliveryStatus': 'failed',
                'webhookStatus.lastAttemptAt': new Date()
              }).exec();
            }
          })
          .catch(error => console.error('[BUSINESS_ONRAMP] Failed to send creation webhook:', error));
      }
      
      // Prepare enhanced response
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
        paymentDetails: {
          paymentUrl: paymentDetails.checkoutUrl,
          paymentReference: paymentDetails.paymentReference || businessOrderReference,
          transactionReference: paymentDetails.transactionReference,
          expiresIn: 1800
        },
        webhookConfigured: !!order.webhookUrl,
        validation: {
          businessSupported: true,
          contractSupported: tokenValidation.contractSupported,
          hasLiquidity: tokenValidation.hasLiquidity,
          validationPassed: true
        },
        pricingInfo: {
          source: priceData.source,
          timestamp: priceData.timestamp
        }
      };
      
      // Add smart contract data if available
      if (priceData.usdcValue) {
        responseData.smartContractData = {
          usdcValue: priceData.usdcValue,
          pricePerTokenUsdc: priceData.pricePerTokenUsdc,
          bestRoute: priceData.bestRoute,
          reserveSupported: priceData.reserveSupported,
          liquidityAdequate: priceData.liquidityAdequate,
          usdcRateString: priceData.usdcRateString
        };
      }
      
      res.status(201).json({
        success: true,
        message: 'Business onramp order created successfully with full validation',
        data: responseData
      });
      
      console.log(`[BUSINESS_ONRAMP] Enhanced order creation process completed successfully`);
      
    } catch (error) {
      console.error('[BUSINESS_ONRAMP] Error creating enhanced onramp order:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create business onramp order',
        code: 'ORDER_CREATION_FAILED'
      });
    }
  },

  // Enhanced quote function with full token validation
  getQuote: async (req, res) => {
    try {
      console.log('[BUSINESS_ONRAMP] Getting enhanced price quote with full token validation');
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
      
      // Business token validation
      if (!business.supportedTokens || !business.supportedTokens[targetNetwork]) {
        return res.status(400).json({
          success: false,
          message: `${targetNetwork} network not configured for your business`,
          availableNetworks: Object.keys(business.supportedTokens || {}),
          code: 'NETWORK_NOT_CONFIGURED'
        });
      }
      
      const tokenInfo = business.supportedTokens[targetNetwork].find(
        token => token.symbol.toUpperCase() === targetToken.toUpperCase() && 
                 token.isActive && 
                 token.isTradingEnabled
      );
      
      if (!tokenInfo) {
        return res.status(403).json({
          success: false,
          message: `Token ${targetToken} on ${targetNetwork} is not supported or not active`,
          supportedTokens: business.supportedTokens[targetNetwork]
            .filter(t => t.isActive && t.isTradingEnabled)
            .map(t => ({ symbol: t.symbol, name: t.name })),
          code: 'TOKEN_NOT_SUPPORTED_BY_BUSINESS'
        });
      }
      
      // ENHANCED: Full token validation (business + smart contract)
      const tokenValidation = await validateTokenSupport(tokenInfo, targetToken, targetNetwork);
      
      if (!tokenValidation.valid) {
        console.error(`[BUSINESS_ONRAMP] Quote validation failed:`, tokenValidation.reason);
        
        return res.status(400).json({
          success: false,
          message: tokenValidation.message,
          details: {
            businessSupported: tokenValidation.businessSupported,
            contractSupported: tokenValidation.contractSupported,
            hasLiquidity: tokenValidation.hasLiquidity,
            network: targetNetwork,
            reason: tokenValidation.reason
          },
          code: tokenValidation.reason
        });
      }
      
      // Get price data based on network and validation results
      let priceData;
      
      if (targetNetwork === 'base' && tokenValidation.priceData) {
        // Use smart contract pricing for Base tokens
        try {
          priceData = await fetchCryptoToNgnPriceWithSmartContract(targetToken, business, 1);
        } catch (smartContractError) {
          console.error('[BUSINESS_ONRAMP] Smart contract quote failed:', smartContractError);
          return res.status(500).json({
            success: false,
            message: 'Failed to get smart contract quote',
            error: smartContractError.message,
            code: 'SMART_CONTRACT_QUOTE_FAILED'
          });
        }
      } else {
        // Fallback to internal API
        try {
          const baseUrl = process.env.INTERNAL_API_BASE_URL || 'http://localhost:5002';
          const response = await axios.get(`${baseUrl}/api/v1/onramp-price`, {
            params: {
              cryptoSymbol: targetToken,
              cryptoAmount: 1
            },
            timeout: 10000
          });
          
          if (!response.data || !response.data.success) {
            throw new Error(response.data?.message || `Failed to get price for ${targetToken}`);
          }
          
          const apiPriceData = response.data.data;
          
          priceData = {
            cryptoSymbol: targetToken.toUpperCase(),
            cryptoAmount: 1,
            unitPriceInNgn: apiPriceData.unitPriceInNgn,
            totalNgnNeeded: apiPriceData.totalNgnNeeded,
            exchangeRate: apiPriceData.unitPriceInNgn,
            ngnToTokenRate: 1 / apiPriceData.unitPriceInNgn,
            formattedPrice: apiPriceData.formattedPrice,
            exchangeRateString: apiPriceData.exchangeRate,
            timestamp: new Date(apiPriceData.timestamp),
            source: apiPriceData.source || 'internal_api'
          };
        } catch (apiError) {
          console.error('[BUSINESS_ONRAMP] Internal API quote failed:', apiError);
          return res.status(500).json({
            success: false,
            message: 'Failed to get price quote',
            error: apiError.message,
            code: 'QUOTE_CALCULATION_FAILED'
          });
        }
      }
      
      // Calculate quote with fees
      const feeConfig = business.feeConfiguration?.[targetNetwork]?.find(
        f => f.contractAddress.toLowerCase() === tokenInfo.contractAddress.toLowerCase() && f.isActive
      );
      const feePercentage = feeConfig ? feeConfig.feePercentage : 0;
      
      const feeAmount = Math.round(amount * (feePercentage / 100));
      const netAmount = amount - feeAmount;
      const tokenAmount = parseFloat((amount * priceData.ngnToTokenRate).toFixed(tokenInfo.decimals));
      const finalTokenAmount = parseFloat((netAmount * priceData.ngnToTokenRate).toFixed(tokenInfo.decimals));
      
      // Prepare enhanced response
      const responseData = {
        amount,
        targetToken: targetToken.toUpperCase(),
        targetNetwork: targetNetwork.toLowerCase(),
        exchangeRate: priceData.unitPriceInNgn,
        tokenAmount,
        feePercentage,
        feeAmount,
        netAmount,
        finalTokenAmount,
        breakdown: {
          grossAmount: `₦${amount.toLocaleString()}`,
          businessFee: `₦${feeAmount.toLocaleString()} (${feePercentage}%)`,
          netAmount: `₦${netAmount.toLocaleString()}`,
          youReceive: `${finalTokenAmount} ${targetToken.toUpperCase()}`
        },
        timestamp: priceData.timestamp,
        validFor: 300,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        validation: {
          businessSupported: tokenValidation.businessSupported,
          contractSupported: tokenValidation.contractSupported,
          hasLiquidity: tokenValidation.hasLiquidity,
          validationPassed: true
        },
        pricingInfo: {
          source: priceData.source
        }
      };
      
      // Add smart contract data if available
      if (priceData.usdcValue) {
        responseData.smartContractData = {
          usdcValue: priceData.usdcValue,
          pricePerTokenUsdc: priceData.pricePerTokenUsdc,
          bestRoute: priceData.bestRoute,
          reserveSupported: priceData.reserveSupported,
          liquidityAdequate: priceData.liquidityAdequate,
          usdcRateString: priceData.usdcRateString
        };
      }
      
      res.json({
        success: true,
        data: responseData
      });
      
    } catch (error) {
      console.error('[BUSINESS_ONRAMP] Enhanced quote error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get enhanced price quote',
        code: 'QUOTE_ERROR'
      });
    }
  },

  // Enhanced getSupportedTokens with smart contract validation info
  getSupportedTokens: async (req, res) => {
    try {
      console.log('[BUSINESS_ONRAMP] Getting supported tokens with smart contract validation');
      const business = req.business;
      
      // Ensure business has default tokens configured
      if (!business.supportedTokens) {
        return res.status(400).json({
          success: false,
          message: 'No tokens configured for your business. Please contact support.',
          code: 'NO_TOKENS_CONFIGURED'
        });
      }
      
      // Enhanced token formatting with smart contract validation
      const formatTokensWithValidation = async (tokens, network) => {
        if (!tokens || tokens.length === 0) return [];
        
        const formattedTokens = [];
        
        for (const token of tokens.filter(t => t.isActive && t.isTradingEnabled)) {
          const feeConfig = business.feeConfiguration?.[network]?.find(
            f => f.contractAddress.toLowerCase() === token.contractAddress.toLowerCase()
          );
          
          let contractSupported = null;
          let hasLiquidity = null;
          
          // Check smart contract support for Base tokens
          if (network === 'base') {
            try {
              const isSupported = await priceChecker.isTokenSupportedByReserve(token.contractAddress);
              contractSupported = isSupported;
              
              if (isSupported) {
                const quickPrice = await priceChecker.getQuickPrice(token.contractAddress, 1);
                hasLiquidity = quickPrice.success && quickPrice.hasAdequateLiquidity;
              }
            } catch (error) {
              console.warn(`[TOKEN_VALIDATION] Failed to validate ${token.symbol}:`, error.message);
              contractSupported = false;
              hasLiquidity = false;
            }
          }
          
          formattedTokens.push({
            symbol: token.symbol,
            name: token.name,
            contractAddress: token.contractAddress,
            decimals: token.decimals,
            network: token.network,
            isDefault: token.isDefault,
            feePercentage: feeConfig ? feeConfig.feePercentage : 0,
            logoUrl: token.logoUrl,
            // Enhanced validation info
            smartContractSupported: network === 'base',
            contractSupported: contractSupported,
            hasLiquidity: hasLiquidity,
            canProcessOnramp: network === 'base' ? (contractSupported && hasLiquidity) : true
          });
        }
        
        return formattedTokens;
      };
      
      // Process all networks
      const supportedTokens = {
        base: await formatTokensWithValidation(business.supportedTokens.base || [], 'base'),
        solana: await formatTokensWithValidation(business.supportedTokens.solana || [], 'solana'),
        ethereum: await formatTokensWithValidation(business.supportedTokens.ethereum || [], 'ethereum')
      };
      
      // Calculate enhanced statistics
      const calculateStats = (tokens) => ({
        total: tokens.length,
        default: tokens.filter(t => t.isDefault).length,
        custom: tokens.filter(t => !t.isDefault).length,
        contractSupported: tokens.filter(t => t.contractSupported === true).length,
        fullySupported: tokens.filter(t => t.canProcessOnramp === true).length,
        hasLiquidity: tokens.filter(t => t.hasLiquidity === true).length
      });
      
      const statistics = {
        base: calculateStats(supportedTokens.base),
        solana: calculateStats(supportedTokens.solana),
        ethereum: calculateStats(supportedTokens.ethereum)
      };
      
      const totalStats = {
        totalTokens: statistics.base.total + statistics.solana.total + statistics.ethereum.total,
        defaultTokens: statistics.base.default + statistics.solana.default + statistics.ethereum.default,
        customTokens: statistics.base.custom + statistics.solana.custom + statistics.ethereum.custom,
        fullySupported: statistics.base.fullySupported + statistics.solana.fullySupported + statistics.ethereum.fullySupported,
        smartContractTokens: statistics.base.total // Only Base tokens support smart contract
      };
      
      res.json({
        success: true,
        data: {
          supportedTokens,
          statistics: {
            ...totalStats,
            breakdown: statistics
          },
          businessInfo: {
            businessId: business.businessId,
            businessName: business.businessName
          },
          validationInfo: {
            smartContractValidation: 'Available for Base network tokens',
            businessValidation: 'All tokens validated against business configuration',
            liquidityValidation: 'Real-time liquidity check for Base tokens',
            note: 'canProcessOnramp = true means token is fully supported for onramp orders'
          }
        }
      });
      
    } catch (error) {
      console.error('[BUSINESS_ONRAMP] Get supported tokens error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get supported tokens',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        code: 'GET_TOKENS_ERROR'
      });
    }
  },

  // Enhanced health check endpoint
  healthCheck: async (req, res) => {
    try {
      console.log('[BUSINESS_ONRAMP] Enhanced health check');
      
      // Test smart contract connection
      let smartContractHealth = false;
      let contractError = null;
      
      try {
        smartContractHealth = await priceChecker.validateConnection();
      } catch (error) {
        contractError = error.message;
        console.error('[HEALTH_CHECK] Smart contract connection failed:', error);
      }
      
      // Test internal API connection
      let internalApiHealth = false;
      let apiError = null;
      
      try {
        const baseUrl = process.env.INTERNAL_API_BASE_URL || 'http://localhost:5002';
        const response = await axios.get(`${baseUrl}/api/v1/health`, { timeout: 5000 });
        internalApiHealth = response.status === 200;
      } catch (error) {
        apiError = error.message;
        console.error('[HEALTH_CHECK] Internal API connection failed:', error);
      }
      
      const isHealthy = smartContractHealth || internalApiHealth; // At least one should work
      const statusCode = isHealthy ? 200 : 503;
      
      res.status(statusCode).json({
        success: isHealthy,
        message: isHealthy 
          ? 'Enhanced onramp service is operational'
          : 'Enhanced onramp service has connectivity issues',
        data: {
          timestamp: new Date().toISOString(),
          version: 'enhanced',
          services: {
            smartContract: {
              available: smartContractHealth,
              network: 'Base Mainnet',
              contract: process.env.ABOKI_V2_CONTRACT || '0x14157cA08Ed86531355f1DE8c918dE85CA6bCDa1',
              ...(contractError && { error: contractError })
            },
            internalApi: {
              available: internalApiHealth,
              baseUrl: process.env.INTERNAL_API_BASE_URL || 'http://localhost:5002',
              ...(apiError && { error: apiError })
            }
          },
          capabilities: {
            businessTokenValidation: true,
            smartContractValidation: smartContractHealth,
            liquidityChecking: smartContractHealth,
            baseNetworkSupport: smartContractHealth,
            fallbackPricing: internalApiHealth
          },
          recommendations: !isHealthy ? [
            !smartContractHealth && 'Check Base RPC connection and contract address',
            !internalApiHealth && 'Check internal API service availability'
          ].filter(Boolean) : []
        }
      });
      
    } catch (error) {
      console.error('[HEALTH_CHECK] Health check error:', error);
      res.status(500).json({
        success: false,
        message: 'Health check failed',
        error: error.message,
        code: 'HEALTH_CHECK_ERROR'
      });
    }
  },

  // Enhanced order status endpoint with validation info
  getOrderStatus: async (req, res) => {
    try {
      const { orderId } = req.params;
      const business = req.business;
      
      console.log(`[BUSINESS_ONRAMP] Getting order status for ${orderId}`);
      
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
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        });
      }
      
      // Enhanced response with validation metadata
      const responseData = {
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
        feePercentage: order.feePercentage,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        expiresAt: order.expiresAt,
        webhookStatus: order.webhookStatus,
        // Enhanced metadata
        validation: order.metadata?.tokenValidation || null,
        pricingInfo: {
          source: order.metadata?.pricingSource || 'unknown',
          smartContractData: order.metadata?.smartContractData || null
        }
      };
      
      res.json({
        success: true,
        data: responseData
      });
      
    } catch (error) {
      console.error('[BUSINESS_ONRAMP] Get order status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get order status',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        code: 'GET_ORDER_STATUS_ERROR'
      });
    }
  }
};

// Import existing methods from original controller
let originalController;
try {
  originalController = require('./businessOnrampController');
} catch (error) {
  console.warn('[ENHANCED_CONTROLLER] Original controller not found, using defaults');
  originalController = {
    getOrderById: (req, res) => res.status(501).json({ success: false, message: 'Method not implemented' }),
    getAllOrders: (req, res) => res.status(501).json({ success: false, message: 'Method not implemented' }),
    getBusinessStats: (req, res) => res.status(501).json({ success: false, message: 'Method not implemented' }),
    handleMonnifyWebhook: (req, res) => res.status(501).json({ success: false, message: 'Method not implemented' })
  };
}

// Merge enhanced methods with existing ones
module.exports = {
  ...enhancedBusinessOnrampController,
  // Keep all other existing methods unchanged
  getOrderById: originalController.getOrderById,
  getAllOrders: originalController.getAllOrders,
  getBusinessStats: originalController.getBusinessStats,
  handleMonnifyWebhook: originalController.handleMonnifyWebhook
};