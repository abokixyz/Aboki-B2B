const crypto = require('crypto');

class WebhookController {
  // Handle Paycrest webhooks
  async handlePaycrestWebhook(req, res) {
    try {
      const signature = req.headers['x-paycrest-signature'];
      const clientSecret = process.env.PAYCREST_CLIENT_SECRET;

      if (!signature || !clientSecret) {
        return res.status(401).json({
          success: false,
          error: 'Missing signature or client secret'
        });
      }

      // Verify webhook signature
      const calculatedSignature = this.calculateHmacSignature(
        JSON.stringify(req.body),
        clientSecret
      );

      if (signature !== calculatedSignature) {
        return res.status(401).json({
          success: false,
          error: 'Invalid signature'
        });
      }

      const { event, data } = req.body;

      // Handle different webhook events
      switch (event) {
        case 'payment_order.pending':
          await this.handlePendingOrder(data);
          break;
        case 'payment_order.settled':
          await this.handleSettledOrder(data);
          break;
        case 'payment_order.expired':
          await this.handleExpiredOrder(data);
          break;
        case 'payment_order.refunded':
          await this.handleRefundedOrder(data);
          break;
        default:
          console.log('Unknown webhook event:', event);
      }

      res.json({
        success: true,
        message: 'Webhook processed successfully'
      });

    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Webhook processing failed'
      });
    }
  }

  calculateHmacSignature(data, secretKey) {
    const key = Buffer.from(secretKey);
    const hash = crypto.createHmac('sha256', key);
    hash.update(data);
    return hash.digest('hex');
  }

  async handlePendingOrder(data) {
    console.log('Order pending:', data.id);
    // Add your business logic here
  }

  async handleSettledOrder(data) {
    console.log('Order settled:', data.id);
    // Add your business logic here
  }

  async handleExpiredOrder(data) {
    console.log('Order expired:', data.id);
    // Add your business logic here
  }

  async handleRefundedOrder(data) {
    console.log('Order refunded:', data.id);
    // Add your business logic here
  }
}

module.exports = new WebhookController();