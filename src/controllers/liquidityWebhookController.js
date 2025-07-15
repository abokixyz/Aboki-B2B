const { BusinessOnrampOrder, BUSINESS_ORDER_STATUS } = require('../models/BusinessOnrampOrder');
const { Business } = require('../models');
const crypto = require('crypto');
const axios = require('axios');

// Helper function to verify webhook signature
function verifyWebhookSignature(payload, signature, secret) {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    const receivedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  } catch (error) {
    console.error('[LIQUIDITY_WEBHOOK] Signature verification error:', error);
    return false;
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

const liquidityWebhookController = {
  // Handle settlement completion from liquidity server
  handleSettlementCompletion: async (req, res) => {
    try {
      console.log('[LIQUIDITY_WEBHOOK] Processing settlement completion webhook');
      
      // Verify webhook signature
      const signature = req.headers['x-webhook-signature'];
      const webhookSecret = process.env.LIQUIDITY_WEBHOOK_SECRET || 'liquidity-secret';
      
      if (!signature || !verifyWebhookSignature(req.body, signature, webhookSecret)) {
        console.log('[LIQUIDITY_WEBHOOK] Invalid webhook signature');
        return res.status(401).json({
          success: false,
          message: 'Invalid webhook signature'
        });
      }
      
      const {
        event,
        data: {
          orderId,
          liquidityServerOrderId,
          status,
          transactionHash,
          actualTokenAmount,
          errorMessage,
          processedAt
        }
      } = req.body;
      
      console.log(`[LIQUIDITY_WEBHOOK] Event: ${event}, Order: ${orderId}, Status: ${status}`);
      
      // Find the business onramp order
      const order = await BusinessOnrampOrder.findOne({ orderId });
      
      if (!order) {
        console.log(`[LIQUIDITY_WEBHOOK] Order not found: ${orderId}`);
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }
      
      console.log(`[LIQUIDITY_WEBHOOK] Processing order ${order.orderId}, current status: ${order.status}`);
      
      // Update order based on settlement status
      if (status === 'completed') {
        console.log(`[LIQUIDITY_WEBHOOK] Settlement completed for order ${orderId}`);
        
        // Mark order as completed
        order.markAsCompleted(transactionHash, actualTokenAmount);
        order.liquidityServerOrderId = liquidityServerOrderId;
        await order.save();
        
        // Prepare order data for business webhook
        const orderData = {
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
          transactionHash: order.transactionHash,
          completedAt: order.completedAt,
          settlementCompletedAt: order.settlementCompletedAt,
          metadata: order.metadata
        };
        
        // Send completion webhook to business (optional)
        if (order.webhookUrl) {
          const webhookResult = await sendBusinessWebhook(
            order.webhookUrl, 
            orderData, 
            'order.completed'
          );
          
          if (webhookResult.sent) {
            order.markWebhookDelivered();
            await order.save();
          } else {
            order.updateWebhookAttempt();
            await order.save();
          }
        }
        
        console.log(`[LIQUIDITY_WEBHOOK] Order ${orderId} marked as completed`);
        
      } else if (status === 'failed') {
        console.log(`[LIQUIDITY_WEBHOOK] Settlement failed for order ${orderId}: ${errorMessage}`);
        
        // Mark order as failed
        order.markAsFailed(errorMessage || 'Settlement failed on liquidity server');
        order.liquidityServerOrderId = liquidityServerOrderId;
        await order.save();
        
        // Prepare failure data for business webhook
        const orderData = {
          orderId: order.orderId,
          businessOrderReference: order.businessOrderReference,
          status: order.status,
          amount: order.amount,
          targetToken: order.targetToken,
          targetNetwork: order.targetNetwork,
          customerEmail: order.customerEmail,
          errorMessage: order.errorMessage,
          metadata: order.metadata
        };
        
        // Send failure webhook to business (optional)
        if (order.webhookUrl) {
          const webhookResult = await sendBusinessWebhook(
            order.webhookUrl, 
            orderData, 
            'order.failed'
          );
          
          if (webhookResult.sent) {
            order.markWebhookDelivered();
          } else {
            order.updateWebhookAttempt();
          }
          await order.save();
        }
        
        console.log(`[LIQUIDITY_WEBHOOK] Order ${orderId} marked as failed`);
        
      } else if (status === 'processing') {
        console.log(`[LIQUIDITY_WEBHOOK] Settlement processing for order ${orderId}`);
        
        // Update processing status if not already set
        if (order.status !== BUSINESS_ORDER_STATUS.PROCESSING) {
          order.status = BUSINESS_ORDER_STATUS.PROCESSING;
          order.liquidityServerOrderId = liquidityServerOrderId;
          order.settlementInitiatedAt = new Date();
          await order.save();
        }
        
      } else {
        console.log(`[LIQUIDITY_WEBHOOK] Unknown settlement status: ${status}`);
        return res.status(400).json({
          success: false,
          message: `Unknown settlement status: ${status}`
        });
      }
      
      res.json({
        success: true,
        message: 'Settlement webhook processed successfully',
        orderId,
        orderStatus: order.status
      });
      
    } catch (error) {
      console.error('[LIQUIDITY_WEBHOOK] Error processing settlement webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process settlement webhook'
      });
    }
  },

  // Handle settlement status updates from liquidity server
  handleSettlementUpdate: async (req, res) => {
    try {
      console.log('[LIQUIDITY_WEBHOOK] Processing settlement update webhook');
      
      // Verify webhook signature
      const signature = req.headers['x-webhook-signature'];
      const webhookSecret = process.env.LIQUIDITY_WEBHOOK_SECRET || 'liquidity-secret';
      
      if (!signature || !verifyWebhookSignature(req.body, signature, webhookSecret)) {
        console.log('[LIQUIDITY_WEBHOOK] Invalid webhook signature');
        return res.status(401).json({
          success: false,
          message: 'Invalid webhook signature'
        });
      }
      
      const {
        event,
        data: {
          orderId,
          liquidityServerOrderId,
          status,
          statusMessage,
          updatedAt
        }
      } = req.body;
      
      console.log(`[LIQUIDITY_WEBHOOK] Update event: ${event}, Order: ${orderId}, Status: ${status}`);
      
      // Find the business onramp order
      const order = await BusinessOnrampOrder.findOne({ orderId });
      
      if (!order) {
        console.log(`[LIQUIDITY_WEBHOOK] Order not found: ${orderId}`);
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }
      
      // Update order notes with status message
      if (statusMessage) {
        order.notes = statusMessage;
        order.updatedAt = new Date();
        await order.save();
      }
      
      // Send update webhook to business if they want status updates (optional)
      if (order.webhookUrl && status) {
        const orderData = {
          orderId: order.orderId,
          businessOrderReference: order.businessOrderReference,
          status: order.status,
          liquidityStatus: status,
          statusMessage,
          liquidityServerOrderId,
          metadata: order.metadata
        };
        
        await sendBusinessWebhook(
          order.webhookUrl, 
          orderData, 
          'order.status_update'
        );
      }
      
      res.json({
        success: true,
        message: 'Settlement update processed successfully',
        orderId
      });
      
    } catch (error) {
      console.error('[LIQUIDITY_WEBHOOK] Error processing settlement update:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process settlement update'
      });
    }
  },

  // Handle liquidity server errors
  handleLiquidityError: async (req, res) => {
    try {
      console.log('[LIQUIDITY_WEBHOOK] Processing liquidity error webhook');
      
      // Verify webhook signature
      const signature = req.headers['x-webhook-signature'];
      const webhookSecret = process.env.LIQUIDITY_WEBHOOK_SECRET || 'liquidity-secret';
      
      if (!signature || !verifyWebhookSignature(req.body, signature, webhookSecret)) {
        console.log('[LIQUIDITY_WEBHOOK] Invalid webhook signature');
        return res.status(401).json({
          success: false,
          message: 'Invalid webhook signature'
        });
      }
      
      const {
        event,
        data: {
          orderId,
          errorCode,
          errorMessage,
          retryable,
          occurredAt
        }
      } = req.body;
      
      console.log(`[LIQUIDITY_WEBHOOK] Error event: ${event}, Order: ${orderId}, Error: ${errorMessage}`);
      
      // Find the business onramp order
      const order = await BusinessOnrampOrder.findOne({ orderId });
      
      if (!order) {
        console.log(`[LIQUIDITY_WEBHOOK] Order not found: ${orderId}`);
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }
      
      // Update order with error information
      if (!retryable) {
        // If error is not retryable, mark order as failed
        order.markAsFailed(`Liquidity server error: ${errorMessage} (Code: ${errorCode})`);
        await order.save();
        
        // Send failure webhook to business (optional)
        if (order.webhookUrl) {
          const orderData = {
            orderId: order.orderId,
            businessOrderReference: order.businessOrderReference,
            status: order.status,
            errorMessage: order.errorMessage,
            errorCode,
            metadata: order.metadata
          };
          
          await sendBusinessWebhook(
            order.webhookUrl, 
            orderData, 
            'order.failed'
          );
        }
        
        console.log(`[LIQUIDITY_WEBHOOK] Order ${orderId} marked as failed due to non-retryable error`);
      } else {
        // If error is retryable, just update notes
        order.notes = `Liquidity server error (retryable): ${errorMessage} (Code: ${errorCode})`;
        order.updatedAt = new Date();
        await order.save();
        
        console.log(`[LIQUIDITY_WEBHOOK] Order ${orderId} updated with retryable error`);
      }
      
      res.json({
        success: true,
        message: 'Liquidity error processed successfully',
        orderId,
        retryable
      });
      
    } catch (error) {
      console.error('[LIQUIDITY_WEBHOOK] Error processing liquidity error webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process liquidity error webhook'
      });
    }
  }
};

module.exports = liquidityWebhookController;