const { BusinessOnrampOrder, BUSINESS_ORDER_STATUS } = require('../models/BusinessOnrampOrder');
const { Business } = require('../models');
const monnifyService = require('../services/monnifyService');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Helper function to fetch crypto prices using internal onramp price API
async function fetchCryptoToNgnPrice(cryptoSymbol, cryptoAmount = 1) {
  try {
    console.log(`[BUSINESS_ONRAMP] Fetching ${cryptoSymbol} price using internal onramp API`);
    
    // Make actual HTTP request to internal onramp price API
    const baseUrl = process.env.INTERNAL_API_BASE_URL || 'http://localhost:5002';
    const response = await axios.get(`${baseUrl}/api/v1/onramp-price`, {
      params: {
        cryptoSymbol: cryptoSymbol,
        cryptoAmount: cryptoAmount
      },
      timeout: 10000 // 10 second timeout
    });
    
    if (!response.data || !response.data.success) {
      throw new Error(response.data?.message || `Failed to get price for ${cryptoSymbol}`);
    }
    
    const priceData = response.data.data;
    
    console.log(`[BUSINESS_ONRAMP] Price retrieved: 1 ${cryptoSymbol} = ₦${priceData.unitPriceInNgn.toLocaleString()}`);
    
    return {
      cryptoSymbol: priceData.cryptoSymbol,
      cryptoAmount: priceData.cryptoAmount,
      unitPriceInNgn: priceData.unitPriceInNgn,
      totalNgnNeeded: priceData.totalNgnNeeded,
      exchangeRate: priceData.unitPriceInNgn,
      ngnToTokenRate: 1 / priceData.unitPriceInNgn, // How many tokens per 1 NGN
      formattedPrice: priceData.formattedPrice,
      exchangeRateString: priceData.exchangeRate,
      timestamp: new Date(priceData.timestamp),
      source: priceData.source
    };
  } catch (error) {
    console.error('[BUSINESS_ONRAMP] Price fetch error:', error);
    throw new Error(`Failed to fetch ${cryptoSymbol} price: ${error.message}`);
  }
}

// Helper function to send webhook to business (optional)
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
    
    // Add signature for webhook verification
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
      timeout: 10000 // 10 second timeout
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
    
    // Add signature for webhook verification
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
      timeout: 15000 // 15 second timeout
    });
    
    console.log(`[LIQUIDITY_WEBHOOK] Successfully sent settlement request`);
  } catch (error) {
    console.error(`[LIQUIDITY_WEBHOOK] Failed to send liquidity webhook:`, error.message);
    throw error; // Settlement failures should be handled
  }
}

const businessOnrampController = {
  // Create onramp order for business customer
  createOnrampOrder: async (req, res) => {
    try {
      console.log('[BUSINESS_ONRAMP] Creating new business onramp order');
      const business = req.business; // Set by authenticateApiKey middleware
      const {
        customerEmail,
        customerName,
        customerPhone,
        amount,
        targetToken,
        targetNetwork,
        customerWallet,
        redirectUrl,
        webhookUrl, // Optional
        metadata = {}
      } = req.body;
      
      console.log(`[BUSINESS_ONRAMP] Business: ${business.businessName}, Customer: ${customerEmail}, Amount: ₦${amount.toLocaleString()}, Target: ${targetToken} on ${targetNetwork}`);
      
      // Check if business has supported tokens configured
      if (!business.supportedTokens || !business.supportedTokens[targetNetwork]) {
        return res.status(400).json({
          success: false,
          message: `${targetNetwork} network not configured for your business`,
          availableNetworks: Object.keys(business.supportedTokens || {})
        });
      }
      
      // Find the specific token by symbol and network
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
            .map(t => ({ symbol: t.symbol, name: t.name, contractAddress: t.contractAddress }))
        });
      }
      
      // Get fee configuration for this token
      const feeConfig = business.feeConfiguration?.[targetNetwork]?.find(
        f => f.contractAddress.toLowerCase() === tokenInfo.contractAddress.toLowerCase() && f.isActive
      );
      const feePercentage = feeConfig ? feeConfig.feePercentage : 0;
      
      // Get current price using the internal onramp price API
      console.log(`[BUSINESS_ONRAMP] Getting current price for ${targetToken}`);
      const priceData = await fetchCryptoToNgnPrice(targetToken, 1);
      
      // Calculate amounts including business fees
      const feeAmount = Math.round(amount * (feePercentage / 100));
      const netAmount = amount - feeAmount;
      const estimatedTokenAmount = parseFloat((netAmount * priceData.ngnToTokenRate).toFixed(tokenInfo.decimals));
      
      console.log(`[BUSINESS_ONRAMP] Calculations - Amount: ₦${amount.toLocaleString()}, Fee: ₦${feeAmount.toLocaleString()} (${feePercentage}%), Net: ₦${netAmount.toLocaleString()}, Token Amount: ${estimatedTokenAmount} ${targetToken}`);
      
      // Generate unique references
      const businessOrderReference = `BIZRAMP-${uuidv4()}`;
      const orderId = `BO_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // Create business onramp order
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
        webhookUrl: webhookUrl?.trim(), // Optional
        metadata,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes expiration
      });
      
      await order.save();
      console.log(`[BUSINESS_ONRAMP] Order created with ID: ${order.orderId}`);
      
      // Generate payment link using Monnify
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
      
      // Prepare order data for optional webhook
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
      
      // Send webhook to business (optional - non-blocking)
      if (order.webhookUrl) {
        sendBusinessWebhook(order.webhookUrl, orderData, 'order.created')
          .then(result => {
            if (result.sent) {
              order.markWebhookDelivered();
              order.save();
            } else {
              order.updateWebhookAttempt();
              order.save();
            }
          })
          .catch(error => console.error('[BUSINESS_ONRAMP] Failed to send creation webhook:', error));
      }
      
      res.status(201).json({
        success: true,
        message: 'Business onramp order created successfully',
        data: {
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
            expiresIn: 1800 // 30 minutes in seconds
          },
          webhookConfigured: !!order.webhookUrl
        }
      });
      
      console.log(`[BUSINESS_ONRAMP] Order creation process completed successfully`);
    } catch (error) {
      console.error('[BUSINESS_ONRAMP] Error creating onramp order:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create business onramp order'
      });
    }
  },

  // Get order details by ID
  getOrderById: async (req, res) => {
    try {
      console.log('[BUSINESS_ONRAMP] Getting order by ID');
      const business = req.business;
      const { orderId } = req.params;
      
      const order = await BusinessOnrampOrder.findOne({
        orderId,
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
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          customerWallet: order.customerWallet,
          exchangeRate: order.exchangeRate,
          feeAmount: order.feeAmount,
          feePercentage: order.feePercentage,
          netAmount: order.netAmount,
          paidAmount: order.paidAmount,
          transactionHash: order.transactionHash,
          liquidityServerOrderId: order.liquidityServerOrderId,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          expiresAt: order.expiresAt,
          completedAt: order.completedAt,
          paymentCompletedAt: order.paymentCompletedAt,
          settlementInitiatedAt: order.settlementInitiatedAt,
          settlementCompletedAt: order.settlementCompletedAt,
          metadata: order.metadata,
          errorMessage: order.errorMessage,
          notes: order.notes,
          webhookUrl: order.webhookUrl,
          webhookAttempts: order.webhookAttempts,
          webhookDelivered: order.webhookDelivered,
          lastWebhookAttempt: order.lastWebhookAttempt,
          // Helper fields
          isExpired: order.isExpired(),
          canBeCancelled: order.canBeCancelled(),
          isPaymentCompleted: order.isPaymentCompleted(),
          formattedAmount: order.formattedAmount,
          formattedTokenAmount: order.formattedTokenAmount
        }
      });
      
    } catch (error) {
      console.error('[BUSINESS_ONRAMP] Get order by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get order details'
      });
    }
  },

  // Get all orders for business with comprehensive filtering
  getAllOrders: async (req, res) => {
    try {
      console.log('[BUSINESS_ONRAMP] Getting all business orders');
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
      if (customerEmail) query.customerEmail = { $regex: customerEmail, $options: 'i' };
      
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }
      
      // Pagination
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;
      
      // Sorting
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
      
      // Execute queries
      const [orders, total] = await Promise.all([
        BusinessOnrampOrder.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        BusinessOnrampOrder.countDocuments(query)
      ]);
      
      // Get summary statistics
      const summaryPipeline = [
        { $match: query },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalOrders: { $sum: 1 },
            completedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            pendingOrders: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['initiated', 'pending', 'processing']] },
                  1,
                  0
                ]
              }
            },
            totalFees: { $sum: '$feeAmount' }
          }
        }
      ];
      
      const summaryResult = await BusinessOnrampOrder.aggregate(summaryPipeline);
      const summary = summaryResult[0] || {
        totalAmount: 0,
        totalOrders: 0,
        completedOrders: 0,
        pendingOrders: 0,
        totalFees: 0
      };
      
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
            customerName: order.customerName,
            customerWallet: order.customerWallet,
            feeAmount: order.feeAmount,
            feePercentage: order.feePercentage,
            transactionHash: order.transactionHash,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            completedAt: order.completedAt,
            expiresAt: order.expiresAt,
            metadata: order.metadata,
            errorMessage: order.errorMessage
          })),
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum)
          },
          summary,
          filters: {
            status,
            targetToken,
            targetNetwork,
            customerEmail,
            startDate,
            endDate,
            sortBy,
            sortOrder
          }
        }
      });
      
    } catch (error) {
      console.error('[BUSINESS_ONRAMP] Get all orders error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get orders'
      });
    }
  },

  // Get supported tokens for business onramp
  getSupportedTokens: async (req, res) => {
    try {
      console.log('[BUSINESS_ONRAMP] Getting supported tokens');
      const business = req.business;
      
      // Ensure business has default tokens configured
      if (!business.supportedTokens) {
        return res.status(400).json({
          success: false,
          message: 'No tokens configured for your business. Please contact support.'
        });
      }
      
      // Format tokens with fee information
      const formatTokensWithFees = (tokens, network) => {
        return tokens
          .filter(token => token.isActive && token.isTradingEnabled)
          .map(token => {
            const feeConfig = business.feeConfiguration?.[network]?.find(
              f => f.contractAddress.toLowerCase() === token.contractAddress.toLowerCase()
            );
            
            return {
              symbol: token.symbol,
              name: token.name,
              contractAddress: token.contractAddress,
              decimals: token.decimals,
              network: token.network,
              isDefault: token.isDefault,
              feePercentage: feeConfig ? feeConfig.feePercentage : 0,
              logoUrl: token.logoUrl
            };
          });
      };
      
      const supportedTokens = {
        base: formatTokensWithFees(business.supportedTokens.base || [], 'base'),
        solana: formatTokensWithFees(business.supportedTokens.solana || [], 'solana'),
        ethereum: formatTokensWithFees(business.supportedTokens.ethereum || [], 'ethereum')
      };
      
      // Calculate statistics
      const totalTokens = Object.values(supportedTokens).reduce((sum, tokens) => sum + tokens.length, 0);
      const defaultTokens = Object.values(supportedTokens).reduce((sum, tokens) => 
        sum + tokens.filter(t => t.isDefault).length, 0);
      
      res.json({
        success: true,
        data: {
          supportedTokens,
          statistics: {
            totalActiveTokens: totalTokens,
            defaultTokens,
            customTokens: totalTokens - defaultTokens,
            networksSupported: Object.keys(supportedTokens).filter(network => 
              supportedTokens[network].length > 0
            )
          },
          businessInfo: {
            businessId: business.businessId,
            businessName: business.businessName
          }
        }
      });
      
    } catch (error) {
      console.error('[BUSINESS_ONRAMP] Get supported tokens error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get supported tokens'
      });
    }
  },

  // Get price quote for business onramp
  getQuote: async (req, res) => {
    try {
      console.log('[BUSINESS_ONRAMP] Getting price quote');
      const business = req.business;
      const { amount, targetToken, targetNetwork } = req.body;
      
      // Validation
      if (!amount || !targetToken || !targetNetwork) {
        return res.status(400).json({
          success: false,
          message: 'Amount, targetToken, and targetNetwork are required'
        });
      }
      
      if (amount < 1000) {
        return res.status(400).json({
          success: false,
          message: 'Minimum amount is ₦1,000'
        });
      }
      
      if (amount > 10000000) {
        return res.status(400).json({
          success: false,
          message: 'Maximum amount is ₦10,000,000'
        });
      }
      
      // Check if business supports the token
      if (!business.supportedTokens || !business.supportedTokens[targetNetwork]) {
        return res.status(400).json({
          success: false,
          message: `${targetNetwork} network not configured for your business`,
          availableNetworks: Object.keys(business.supportedTokens || {})
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
            .map(t => ({ symbol: t.symbol, name: t.name }))
        });
      }
      
      // Get fee configuration
      const feeConfig = business.feeConfiguration?.[targetNetwork]?.find(
        f => f.contractAddress.toLowerCase() === tokenInfo.contractAddress.toLowerCase() && f.isActive
      );
      const feePercentage = feeConfig ? feeConfig.feePercentage : 0;
      
      // Get current price using internal onramp price API
      const priceData = await fetchCryptoToNgnPrice(targetToken, 1);
      
      // Calculate quote
      const feeAmount = Math.round(amount * (feePercentage / 100));
      const netAmount = amount - feeAmount;
      const tokenAmount = parseFloat((amount * priceData.ngnToTokenRate).toFixed(tokenInfo.decimals));
      const finalTokenAmount = parseFloat((netAmount * priceData.ngnToTokenRate).toFixed(tokenInfo.decimals));
      
      res.json({
        success: true,
        data: {
          amount,
          targetToken: targetToken.toUpperCase(),
          targetNetwork: targetNetwork.toLowerCase(),
          exchangeRate: priceData.unitPriceInNgn,
          tokenAmount, // Amount without fees
          feePercentage,
          feeAmount,
          netAmount,
          finalTokenAmount, // Amount after fees
          breakdown: {
            grossAmount: `₦${amount.toLocaleString()}`,
            businessFee: `₦${feeAmount.toLocaleString()} (${feePercentage}%)`,
            netAmount: `₦${netAmount.toLocaleString()}`,
            youReceive: `${finalTokenAmount} ${targetToken.toUpperCase()}`
          },
          timestamp: priceData.timestamp,
          validFor: 300, // Quote valid for 5 minutes
          expiresAt: new Date(Date.now() + 5 * 60 * 1000)
        }
      });
      
    } catch (error) {
      console.error('[BUSINESS_ONRAMP] Quote error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get price quote'
      });
    }
  },

  // Get business statistics
  getBusinessStats: async (req, res) => {
    try {
      console.log('[BUSINESS_ONRAMP] Getting business statistics');
      const business = req.business;
      const { timeframe = '30d', groupBy = 'day' } = req.query;
      
      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      
      switch (timeframe) {
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        case 'all':
          startDate = new Date(0); // Beginning of time
          break;
        default:
          startDate.setDate(now.getDate() - 30);
      }
      
      const matchQuery = {
        businessId: business._id,
        createdAt: { $gte: startDate }
      };
      
      // Overview statistics
      const overviewPipeline = [
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalFees: { $sum: '$feeAmount' },
            completedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            failedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            },
            totalCompletedAmount: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] }
            }
          }
        }
      ];
      
      // Status breakdown
      const statusPipeline = [
        { $match: matchQuery },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ];
      
      // Token breakdown
      const tokenPipeline = [
        { $match: matchQuery },
        {
          $group: {
            _id: '$targetToken',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalTokenAmount: { $sum: '$estimatedTokenAmount' }
          }
        },
        { $sort: { count: -1 } }
      ];
      
      // Network breakdown
      const networkPipeline = [
        { $match: matchQuery },
        {
          $group: {
            _id: '$targetNetwork',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ];
      
      // Time series data
      let groupByFormat;
      switch (groupBy) {
        case 'day':
          groupByFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
          break;
        case 'week':
          groupByFormat = { $dateToString: { format: '%Y-W%U', date: '$createdAt' } };
          break;
        case 'month':
          groupByFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
          break;
        default:
          groupByFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
      }
      
      const timeSeriesPipeline = [
        { $match: matchQuery },
        {
          $group: {
            _id: groupByFormat,
            orders: { $sum: 1 },
            amount: { $sum: '$amount' },
            fees: { $sum: '$feeAmount' },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ];
      
      // Execute all pipelines
      const [overview, statusBreakdown, tokenBreakdown, networkBreakdown, timeSeriesData] = await Promise.all([
        BusinessOnrampOrder.aggregate(overviewPipeline),
        BusinessOnrampOrder.aggregate(statusPipeline),
        BusinessOnrampOrder.aggregate(tokenPipeline),
        BusinessOnrampOrder.aggregate(networkPipeline),
        BusinessOnrampOrder.aggregate(timeSeriesPipeline)
      ]);
      
      const overviewData = overview[0] || {
        totalOrders: 0,
        totalAmount: 0,
        totalFees: 0,
        completedOrders: 0,
        failedOrders: 0,
        totalCompletedAmount: 0
      };
      
      // Calculate additional metrics
      const successRate = overviewData.totalOrders > 0 
        ? (overviewData.completedOrders / overviewData.totalOrders * 100).toFixed(2)
        : 0;
      
      const averageOrderValue = overviewData.totalOrders > 0
        ? Math.round(overviewData.totalAmount / overviewData.totalOrders)
        : 0;
      
      res.json({
        success: true,
        data: {
          timeframe,
          overview: {
            ...overviewData,
            successRate: parseFloat(successRate),
            averageOrderValue
          },
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
          timeSeriesData
        }
      });
      
    } catch (error) {
      console.error('[BUSINESS_ONRAMP] Get business stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get business statistics'
      });
    }
  },

  // Handle Monnify payment webhook
  handleMonnifyWebhook: async (req, res) => {
    try {
      console.log('[BUSINESS_ONRAMP] Processing Monnify webhook');
      const {
        paymentReference,
        paymentStatus,
        paidAmount,
        transactionReference,
        customerEmail
      } = req.body;
      
      console.log(`[BUSINESS_ONRAMP] Webhook data - Ref: ${paymentReference}, Status: ${paymentStatus}, Amount: ₦${paidAmount}`);
      
      // Verify the payment with Monnify service
      const isValidPayment = await monnifyService.verifyPayment(paymentReference);
      if (!isValidPayment) {
        console.log('[BUSINESS_ONRAMP] Payment verification failed');
        return res.status(400).json({
          success: false,
          message: 'Invalid payment verification'
        });
      }
      
      // Find the order by business order reference
      const order = await BusinessOnrampOrder.findOne({
        businessOrderReference: paymentReference
      }).populate('businessId');
      
      if (!order) {
        console.log(`[BUSINESS_ONRAMP] Order not found for reference: ${paymentReference}`);
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }
      
      console.log(`[BUSINESS_ONRAMP] Order found: ${order.orderId}, Status: ${order.status}`);
      
      if (paymentStatus === 'PAID') {
        // Check if paid amount matches expected amount
        if (parseFloat(paidAmount) >= order.amount) {
          console.log(`[BUSINESS_ONRAMP] Payment successful for order ${order.orderId}`);
          
          // Update order to pending status (payment received)
          order.markAsPaid(parseFloat(paidAmount), transactionReference);
          await order.save();
          
          // Prepare order data for webhooks
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
            transactionReference: order.monnifyTransactionReference,
            paymentCompletedAt: order.paymentCompletedAt,
            metadata: order.metadata,
            businessId: order.businessId
          };
          
          // Send optional webhook to business (non-blocking)
          if (order.webhookUrl) {
            sendBusinessWebhook(order.webhookUrl, orderData, 'payment.completed')
              .then(result => {
                if (result.sent) {
                  order.markWebhookDelivered();
                } else {
                  order.updateWebhookAttempt();
                }
                order.save();
              })
              .catch(error => console.error('[BUSINESS_ONRAMP] Failed to send payment webhook:', error));
          }
          
          // Send settlement request to liquidity server
          try {
            await sendLiquidityWebhook(orderData);
            console.log(`[BUSINESS_ONRAMP] Settlement request sent for order ${order.orderId}`);
            
            // Update order to processing status
            order.status = BUSINESS_ORDER_STATUS.PROCESSING;
            order.settlementInitiatedAt = new Date();
            await order.save();
            
            // Send optional processing webhook to business
            if (order.webhookUrl) {
              sendBusinessWebhook(order.webhookUrl, {
                ...orderData,
                status: BUSINESS_ORDER_STATUS.PROCESSING,
                settlementInitiatedAt: order.settlementInitiatedAt
              }, 'order.processing')
                .catch(error => console.error('[BUSINESS_ONRAMP] Failed to send processing webhook:', error));
            }
            
          } catch (liquidityError) {
            console.error(`[BUSINESS_ONRAMP] Failed to send settlement request:`, liquidityError);
            
            // Mark order as failed
            order.markAsFailed(`Settlement failed: ${liquidityError.message}`);
            await order.save();
            
            // Send optional failure webhook to business
            if (order.webhookUrl) {
              sendBusinessWebhook(order.webhookUrl, {
                ...orderData,
                status: BUSINESS_ORDER_STATUS.FAILED,
                errorMessage: order.errorMessage
              }, 'order.failed')
                .catch(error => console.error('[BUSINESS_ONRAMP] Failed to send failure webhook:', error));
            }
          }
          
          return res.json({
            success: true,
            message: 'Payment processed and settlement initiated',
            orderStatus: order.status
          });
          
        } else {
          console.log(`[BUSINESS_ONRAMP] Insufficient payment amount for order ${order.orderId}`);
          order.markAsFailed(`Insufficient payment: received ₦${paidAmount}, expected ₦${order.amount}`);
          await order.save();
          
          return res.json({
            success: false,
            message: 'Payment amount insufficient',
            orderStatus: order.status
          });
        }
      } else {
        console.log(`[BUSINESS_ONRAMP] Payment failed for order ${order.orderId} with status: ${paymentStatus}`);
        order.markAsFailed(`Payment failed with status: ${paymentStatus}`);
        await order.save();
        
        // Send optional failure webhook to business
        if (order.webhookUrl) {
          sendBusinessWebhook(order.webhookUrl, {
            orderId: order.orderId,
            businessOrderReference: order.businessOrderReference,
            status: order.status,
            errorMessage: order.errorMessage,
            metadata: order.metadata
          }, 'order.failed')
            .catch(error => console.error('[BUSINESS_ONRAMP] Failed to send failure webhook:', error));
        }
        
        return res.json({
          success: false,
          message: 'Payment failed',
          orderStatus: order.status
        });
      }
      
    } catch (error) {
      console.error('[BUSINESS_ONRAMP] Webhook processing error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process webhook'
      });
    }
  }
};

module.exports = businessOnrampController;