/**
 * Off-ramp Webhook Handler & Deposit Monitor
 * Handles deposit confirmations and processes token swaps to fiat
 * Compatible with ethers v5.7
 */

const { BusinessOfframpOrder, BUSINESS_OFFRAMP_STATUS } = require('../models/BusinessOfframpOrder');
const { ethers } = require('ethers');
const { Connection, PublicKey } = require('@solana/web3.js');
const { getAccount } = require('@solana/spl-token');
const walletGeneratorService = require('../services/walletGeneratorService');
const axios = require('axios');
const crypto = require('crypto');

class OfframpWebhookHandler {
  constructor() {
    // Initialize blockchain connections (ethers v5.7 syntax)
    this.baseProvider = new ethers.providers.JsonRpcProvider(
      process.env.BASE_RPC_URL || 'https://mainnet.base.org'
    );
    
    this.solanaConnection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
    
    console.log('🚀 Off-ramp webhook handler initialized');
  }

  /**
   * Handle deposit confirmation webhook from blockchain monitors
   */
  async handleDepositConfirmation(req, res) {
    try {
      console.log('[DEPOSIT_WEBHOOK] Received deposit confirmation');
      
      const { 
        walletAddress, 
        transactionHash, 
        tokenAddress, 
        amount, 
        network,
        blockNumber,
        confirmations 
      } = req.body;
      
      // Validate required fields
      if (!walletAddress || !transactionHash || !amount || !network) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: walletAddress, transactionHash, amount, network'
        });
      }
      
      console.log(`[DEPOSIT_WEBHOOK] Deposit: ${amount} tokens to ${walletAddress} on ${network}`);
      console.log(`[DEPOSIT_WEBHOOK] Transaction: ${transactionHash}`);
      
      // Find the corresponding order
      const order = await BusinessOfframpOrder.findByDepositWallet(walletAddress);
      
      if (!order) {
        console.warn(`[DEPOSIT_WEBHOOK] No order found for wallet: ${walletAddress}`);
        return res.status(404).json({
          success: false,
          message: 'No order found for this wallet address'
        });
      }
      
      // Check if order is still valid
      if (order.isExpired) {
        console.warn(`[DEPOSIT_WEBHOOK] Order ${order.orderId} has expired`);
        await order.updateStatus(BUSINESS_OFFRAMP_STATUS.EXPIRED);
        
        return res.status(400).json({
          success: false,
          message: 'Order has expired',
          orderId: order.orderId
        });
      }
      
      // Verify the deposit amount matches expected amount (with some tolerance)
      const expectedAmount = parseFloat(order.tokenAmount);
      const receivedAmount = parseFloat(amount);
      const tolerance = 0.01; // 1% tolerance
      const amountDifference = Math.abs(expectedAmount - receivedAmount);
      const isAmountValid = amountDifference <= (expectedAmount * tolerance);
      
      if (!isAmountValid) {
        console.warn(`[DEPOSIT_WEBHOOK] Amount mismatch for order ${order.orderId}`);
        console.warn(`  Expected: ${expectedAmount}, Received: ${receivedAmount}`);
        
        // Still process but flag for manual review
        await order.updateStatus(BUSINESS_OFFRAMP_STATUS.DEPOSIT_RECEIVED, {
          transactionHash,
          receivedAmount,
          amountMismatch: true,
          expectedAmount,
          requiresReview: true
        });
        
        // Send notification for manual review
        await this.sendAmountMismatchNotification(order, expectedAmount, receivedAmount);
        
        return res.json({
          success: true,
          message: 'Deposit received but amount mismatch detected - requires manual review',
          orderId: order.orderId,
          requiresReview: true
        });
      }
      
      // Update order status to deposit received
      await order.updateStatus(BUSINESS_OFFRAMP_STATUS.DEPOSIT_RECEIVED, {
        transactionHash,
        receivedAmount,
        blockNumber,
        confirmations
      });
      
      console.log(`[DEPOSIT_WEBHOOK] ✅ Order ${order.orderId} deposit confirmed`);
      
      // Send business webhook
      if (order.webhookUrl) {
        await this.sendBusinessWebhook(order.webhookUrl, {
          orderId: order.orderId,
          businessOrderReference: order.businessOrderReference,
          status: order.status,
          event: 'deposit_received',
          transactionHash,
          receivedAmount,
          network,
          timestamp: new Date().toISOString()
        }, 'offramp_order.deposit_received');
      }
      
      // Initiate token swap processing
      await this.initiateTokenSwap(order);
      
      res.json({
        success: true,
        message: 'Deposit confirmed and processing initiated',
        orderId: order.orderId,
        status: order.status
      });
      
    } catch (error) {
      console.error('[DEPOSIT_WEBHOOK] Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process deposit confirmation',
        error: error.message
      });
    }
  }

  /**
   * Initiate token swap to USDC/fiat
   */
  async initiateTokenSwap(order) {
    try {
      console.log(`[TOKEN_SWAP] Initiating swap for order ${order.orderId}`);
      
      // Update status to processing
      await order.updateStatus(BUSINESS_OFFRAMP_STATUS.PROCESSING, {
        swapInitiatedAt: new Date()
      });
      
      // Get wallet private key for swap execution
      const walletKeys = await walletGeneratorService.getWalletPrivateKey(
        order.depositWallet.privateKey
      );
      
      if (!walletKeys.success) {
        throw new Error(`Failed to decrypt wallet keys: ${walletKeys.error}`);
      }
      
      let swapResult;
      
      if (order.targetNetwork === 'base') {
        swapResult = await this.executeBaseTokenSwap(order, walletKeys.privateKey);
      } else if (order.targetNetwork === 'solana') {
        swapResult = await this.executeSolanaTokenSwap(order, walletKeys.privateKey);
      } else {
        throw new Error(`Unsupported network for swap: ${order.targetNetwork}`);
      }
      
      if (swapResult.success) {
        console.log(`[TOKEN_SWAP] ✅ Swap completed for order ${order.orderId}`);
        
        // Update order with swap results
        await order.updateStatus(BUSINESS_OFFRAMP_STATUS.PENDING_PAYOUT, {
          swapTransactionHash: swapResult.transactionHash,
          swapCompletedAt: new Date(),
          usdcReceived: swapResult.usdcAmount
        });
        
        // Initiate bank payout
        await this.initiateBankPayout(order, swapResult.usdcAmount);
        
      } else {
        console.error(`[TOKEN_SWAP] ❌ Swap failed for order ${order.orderId}:`, swapResult.error);
        
        await order.updateStatus(BUSINESS_OFFRAMP_STATUS.FAILED, {
          failureReason: `Token swap failed: ${swapResult.error}`,
          failureStage: 'token_swap'
        });
      }
      
    } catch (error) {
      console.error(`[TOKEN_SWAP] Error processing swap for order ${order.orderId}:`, error);
      
      await order.updateStatus(BUSINESS_OFFRAMP_STATUS.FAILED, {
        failureReason: `Swap processing error: ${error.message}`,
        failureStage: 'token_swap_initiation'
      });
    }
  }

  /**
   * Execute token swap on Base network
   */
  async executeBaseTokenSwap(order, privateKey) {
    try {
      console.log(`[BASE_SWAP] Executing Base token swap for ${order.targetToken}`);
      
      // Create wallet instance (ethers v5.7 syntax)
      const wallet = new ethers.Wallet(privateKey, this.baseProvider);
      
      // If token is USDC, no swap needed
      if (order.targetToken.toUpperCase() === 'USDC') {
        console.log(`[BASE_SWAP] No swap needed for USDC - calculating balance`);
        
        const usdcContract = new ethers.Contract(
          order.tokenContractAddress,
          ['function balanceOf(address account) external view returns (uint256)'],
          this.baseProvider
        );
        
        const balance = await usdcContract.balanceOf(wallet.address);
        // ethers v5.7 syntax for formatting units
        const usdcAmount = parseFloat(ethers.utils.formatUnits(balance, 6));
        
        return {
          success: true,
          usdcAmount,
          transactionHash: 'DIRECT_USDC',
          note: 'No swap required for USDC'
        };
      }
      
      // For other tokens, execute swap via DEX
      const swapData = await this.getBaseSwapQuote(
        order.tokenContractAddress,
        order.depositWallet.receivedAmount || order.tokenAmount
      );
      
      if (!swapData.success) {
        throw new Error(`Failed to get swap quote: ${swapData.error}`);
      }
      
      // Execute the swap transaction
      const swapTx = await this.executeBaseSwapTransaction(wallet, swapData);
      
      return {
        success: true,
        transactionHash: swapTx.hash,
        usdcAmount: swapData.expectedUsdcOut,
        gasUsed: swapTx.gasUsed?.toString(),
        swapRoute: swapData.route
      };
      
    } catch (error) {
      console.error('[BASE_SWAP] Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute token swap on Solana network
   */
  async executeSolanaTokenSwap(order, privateKeyBase64) {
    try {
      console.log(`[SOLANA_SWAP] Executing Solana token swap for ${order.targetToken}`);
      
      // If token is USDC, no swap needed
      if (order.targetToken.toUpperCase() === 'USDC') {
        console.log(`[SOLANA_SWAP] No swap needed for USDC`);
        
        const receivedAmount = order.depositWallet.receivedAmount || order.tokenAmount;
        
        return {
          success: true,
          usdcAmount: receivedAmount,
          transactionHash: 'DIRECT_USDC',
          note: 'No swap required for USDC'
        };
      }
      
      // For other tokens, use Jupiter for swap
      const jupiterSwap = await this.executeSolanaJupiterSwap(
        privateKeyBase64,
        order.tokenContractAddress,
        order.depositWallet.receivedAmount || order.tokenAmount
      );
      
      return jupiterSwap;
      
    } catch (error) {
      console.error('[SOLANA_SWAP] Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get Base network swap quote (placeholder - implement with your DEX)
   */
  async getBaseSwapQuote(tokenAddress, amount) {
    try {
      // This is a placeholder - implement with your preferred DEX
      // Example: Uniswap V3, 1inch, etc.
      
      console.log(`[BASE_QUOTE] Getting swap quote for ${amount} tokens at ${tokenAddress}`);
      
      // Mock implementation - replace with actual DEX integration
      const mockQuote = {
        success: true,
        expectedUsdcOut: amount * 0.98, // Mock 2% slippage
        route: 'MockDEX',
        priceImpact: 0.02,
        estimatedGas: '150000'
      };
      
      return mockQuote;
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute Base swap transaction (placeholder)
   */
  async executeBaseSwapTransaction(wallet, swapData) {
    try {
      console.log(`[BASE_SWAP_TX] Executing swap transaction`);
      
      // This is a placeholder - implement with your DEX contract calls
      // Example: Uniswap router interaction
      
      // Mock transaction for now
      const mockTx = {
        hash: '0x' + crypto.randomBytes(32).toString('hex'),
        gasUsed: ethers.BigNumber.from('150000'),
        status: 1
      };
      
      console.log(`[BASE_SWAP_TX] Mock transaction: ${mockTx.hash}`);
      
      return mockTx;
      
    } catch (error) {
      throw new Error(`Swap transaction failed: ${error.message}`);
    }
  }

  /**
   * Execute Solana Jupiter swap (placeholder)
   */
  async executeSolanaJupiterSwap(privateKey, tokenMint, amount) {
    try {
      console.log(`[JUPITER_SWAP] Executing Jupiter swap for ${amount} tokens`);
      
      // This is a placeholder - implement with Jupiter API
      // https://station.jup.ag/docs/apis/swap-api
      
      const mockSwap = {
        success: true,
        usdcAmount: amount * 0.97, // Mock 3% slippage
        transactionHash: crypto.randomBytes(32).toString('hex'),
        route: 'Jupiter',
        priceImpact: 0.03
      };
      
      console.log(`[JUPITER_SWAP] Mock swap completed: ${mockSwap.transactionHash}`);
      
      return mockSwap;
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Initiate bank payout
   */
  async initiateBankPayout(order, usdcAmount) {
    try {
      console.log(`[BANK_PAYOUT] Initiating payout for order ${order.orderId}`);
      
      // Convert USDC to NGN at current rate
      const usdcToNgnRate = await this.getCurrentOfframpRate();
      const ngnAmount = usdcAmount * usdcToNgnRate;
      
      // Verify amount matches expected (accounting for slippage)
      const expectedNgn = order.netNgnAmount;
      const tolerance = 0.05; // 5% tolerance for slippage
      const amountDifference = Math.abs(expectedNgn - ngnAmount);
      const isAmountAcceptable = amountDifference <= (expectedNgn * tolerance);
      
      if (!isAmountAcceptable) {
        console.warn(`[BANK_PAYOUT] Significant amount difference for order ${order.orderId}`);
        console.warn(`  Expected: ₦${expectedNgn}, Calculated: ₦${ngnAmount}`);
      }
      
      // Use the lower amount to be safe
      const finalPayoutAmount = Math.min(ngnAmount, expectedNgn);
      
      // Call bank payout service
      const payoutResult = await this.executeBankPayout({
        accountNumber: order.recipientAccountNumber,
        accountName: order.recipientAccountName,
        bankCode: order.recipientBankCode,
        amount: finalPayoutAmount,
        reference: `OFFRAMP-${order.businessOrderReference}`,
        narration: `Crypto offramp payment for ${order.targetToken}`
      });
      
      if (payoutResult.success) {
        await order.updateStatus(BUSINESS_OFFRAMP_STATUS.COMPLETED, {
          payoutReference: payoutResult.reference,
          payoutTransactionId: payoutResult.transactionId,
          finalPayoutAmount: finalPayoutAmount,
          payoutCompletedAt: new Date()
        });
        
        console.log(`[BANK_PAYOUT] ✅ Payout completed for order ${order.orderId}`);
        
        // Send completion webhook
        if (order.webhookUrl) {
          await this.sendBusinessWebhook(order.webhookUrl, {
            orderId: order.orderId,
            businessOrderReference: order.businessOrderReference,
            status: BUSINESS_OFFRAMP_STATUS.COMPLETED,
            event: 'payout_completed',
            payoutAmount: finalPayoutAmount,
            payoutReference: payoutResult.reference,
            timestamp: new Date().toISOString()
          }, 'offramp_order.completed');
        }
        
      } else {
        await order.updateStatus(BUSINESS_OFFRAMP_STATUS.FAILED, {
          failureReason: `Bank payout failed: ${payoutResult.error}`,
          failureStage: 'bank_payout'
        });
      }
      
    } catch (error) {
      console.error(`[BANK_PAYOUT] Error for order ${order.orderId}:`, error);
      
      await order.updateStatus(BUSINESS_OFFRAMP_STATUS.FAILED, {
        failureReason: `Payout error: ${error.message}`,
        failureStage: 'bank_payout_initiation'
      });
    }
  }

  /**
   * Execute bank payout via payment service
   */
  async executeBankPayout(payoutData) {
    try {
      const payoutServiceUrl = process.env.PAYOUT_SERVICE_URL || 'https://api.paymentservice.com/payouts';
      const payoutApiKey = process.env.PAYOUT_API_KEY;
      
      if (!payoutApiKey) {
        throw new Error('Payout service not configured');
      }
      
      const response = await axios.post(payoutServiceUrl, {
        accountNumber: payoutData.accountNumber,
        accountName: payoutData.accountName,
        bankCode: payoutData.bankCode,
        amount: payoutData.amount,
        reference: payoutData.reference,
        narration: payoutData.narration,
        currency: 'NGN'
      }, {
        headers: {
          'Authorization': `Bearer ${payoutApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      
      if (response.data.success) {
        return {
          success: true,
          reference: response.data.data.reference,
          transactionId: response.data.data.transactionId,
          status: response.data.data.status
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Payout failed'
        };
      }
      
    } catch (error) {
      console.error('[BANK_PAYOUT] Service error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current offramp rate
   */
  async getCurrentOfframpRate() {
    try {
      const baseUrl = process.env.INTERNAL_API_BASE_URL || 'http://localhost:5002';
      
      const response = await axios.get(`${baseUrl}/api/v1/offramp-price`, {
        params: { token: 'USDC', amount: 1 },
        timeout: 5000
      });
      
      if (response.data?.success) {
        return response.data.data.rate;
      }
      
      // Fallback rate
      return parseFloat(process.env.CURRENT_USDC_NGN_OFFRAMP_RATE || 1650);
      
    } catch (error) {
      console.warn('[OFFRAMP_RATE] API failed, using fallback:', error.message);
      return parseFloat(process.env.CURRENT_USDC_NGN_OFFRAMP_RATE || 1650);
    }
  }

  /**
   * Send business webhook
   */
  async sendBusinessWebhook(webhookUrl, data, eventType) {
    try {
      const payload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data
      };
      
      const signature = crypto
        .createHmac('sha256', process.env.WEBHOOK_SECRET || 'default-secret')
        .update(JSON.stringify(payload))
        .digest('hex');
      
      await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'User-Agent': 'OfframpService/1.0'
        },
        timeout: 10000
      });
      
      console.log(`[BUSINESS_WEBHOOK] ✅ Sent ${eventType} webhook`);
      
    } catch (error) {
      console.error(`[BUSINESS_WEBHOOK] Failed to send ${eventType}:`, error.message);
    }
  }

  /**
   * Send amount mismatch notification
   */
  async sendAmountMismatchNotification(order, expected, received) {
    try {
      // Send internal notification
      const notificationUrl = process.env.INTERNAL_NOTIFICATION_WEBHOOK;
      
      if (notificationUrl) {
        await axios.post(notificationUrl, {
          type: 'AMOUNT_MISMATCH_ALERT',
          orderId: order.orderId,
          businessOrderReference: order.businessOrderReference,
          expectedAmount: expected,
          receivedAmount: received,
          difference: Math.abs(expected - received),
          percentageDifference: ((Math.abs(expected - received) / expected) * 100).toFixed(2),
          requiresReview: true,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('[AMOUNT_MISMATCH] Failed to send notification:', error);
    }
  }

  /**
   * Monitor expired orders and clean up
   */
  async monitorExpiredOrders() {
    try {
      console.log('[EXPIRED_MONITOR] Checking for expired orders...');
      
      const expiredOrders = await BusinessOfframpOrder.findExpiredOrders();
      
      for (const order of expiredOrders) {
        console.log(`[EXPIRED_MONITOR] Expiring order ${order.orderId}`);
        
        await order.updateStatus(BUSINESS_OFFRAMP_STATUS.EXPIRED, {
          expiredAt: new Date(),
          autoExpired: true
        });
        
        // Send expiration webhook
        if (order.webhookUrl) {
          await this.sendBusinessWebhook(order.webhookUrl, {
            orderId: order.orderId,
            businessOrderReference: order.businessOrderReference,
            status: BUSINESS_OFFRAMP_STATUS.EXPIRED,
            event: 'order_expired',
            expiredAt: new Date().toISOString()
          }, 'offramp_order.expired');
        }
      }
      
      console.log(`[EXPIRED_MONITOR] Processed ${expiredOrders.length} expired orders`);
      
    } catch (error) {
      console.error('[EXPIRED_MONITOR] Error:', error);
    }
  }

  /**
   * Health check
   */
  getHealthStatus() {
    return {
      webhookHandler: 'operational',
      baseConnection: !!this.baseProvider,
      solanaConnection: !!this.solanaConnection,
      services: {
        walletGenerator: 'available',
        payoutService: !!process.env.PAYOUT_API_KEY,
        webhookSecret: !!process.env.WEBHOOK_SECRET
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new OfframpWebhookHandler();