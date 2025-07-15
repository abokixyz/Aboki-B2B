// src/services/monnifyService.js
const axios = require('axios');
const crypto = require('crypto');

class MonnifyService {
  constructor() {
    // Direct Monnify Config
    this.baseUrl = process.env.MONNIFY_BASE_URL || 'https://api.monnify.com';
    this.apiKey = process.env.MONNIFY_API_KEY;
    this.secretKey = process.env.MONNIFY_SECRET_KEY;
    this.contractCode = process.env.MONNIFY_CONTRACT_CODE;
    this.accessToken = null;
    this.tokenExpiry = null;

    // Proxy API Config
    this.apiBaseUrl = process.env.MONNIFY_PROXY_BASE_URL || 'https://web3nova-payment-gateway-99cz.onrender.com/api';
    this.proxyInstance = axios.create({
      baseURL: this.apiBaseUrl,
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' }
    });

    // Logging for proxy
    this.proxyInstance.interceptors.request.use(config => {
      console.log(`[Monnify Proxy] ${config.method.toUpperCase()} ${config.url}`);
      return config;
    });
    this.proxyInstance.interceptors.response.use(
      res => res,
      err => {
        console.error('[Monnify Proxy Error]', err.message);
        if (err.response) console.error('[Response Data]', err.response.data);
        return Promise.reject(err);
      }
    );

    // Configuration Check
    if (!this.apiKey || !this.secretKey || !this.contractCode) {
      console.warn('Monnify direct service not fully configured.');
    }
  }

  // === Direct Monnify ===
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      console.log('Requesting new Monnify access token...');
      const credentials = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64');
      const res = await axios.post(`${this.baseUrl}/api/v1/auth/login`, {}, {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json'
        }
      });

      const token = res.data.responseBody?.accessToken;
      if (token) {
        this.accessToken = token;
        this.tokenExpiry = new Date(Date.now() + 5 * 60 * 60 * 1000);
        console.log('✓ Monnify token acquired');
        return token;
      } else throw new Error('Invalid token response from Monnify');
    } catch (err) {
      console.error('Auth error:', err.response?.data || err.message);
      throw new Error(`Monnify auth failed: ${err.message}`);
    }
  }

  /**
   * Generate a payment link for onramp operations
   * @param {Object} options Payment options
   * @param {number} options.amount Amount to be paid in NGN
   * @param {string} options.reference Unique payment reference
   * @param {string} options.customerName Customer's name
   * @param {string} options.customerEmail Customer's email (optional)
   * @param {string} options.redirectUrl URL to redirect after payment
   * @returns {Promise<Object>} Payment details including checkout URL
   */
  async generatePaymentLink(options) {
    try {
      const { amount, reference, customerName, customerEmail, redirectUrl } = options;
      
      if (!amount || !reference) {
        throw new Error('Amount and reference are required');
      }
      
      const token = await this.getAccessToken();
      
      console.log('Generating payment link:', reference);
      
      const payload = {
        amount,
        customerName: customerName || 'Customer',
        customerEmail: customerEmail || `${reference}@example.com`, // Fallback email if not provided
        paymentReference: reference,
        paymentDescription: `Onramp order ${reference}`,
        currencyCode: 'NGN',
        contractCode: this.contractCode,
        redirectUrl: redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/status`,
        paymentMethods: ['CARD', 'ACCOUNT_TRANSFER', 'USSD'], // Available payment methods
      };
      
      const response = await axios.post(
        `${this.baseUrl}/api/v1/merchant/transactions/init-transaction`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data.responseBody || !response.data.responseBody.checkoutUrl) {
        throw new Error('Invalid response from Monnify payment initialization');
      }
      
      console.log('✓ Payment link generated successfully');
      
      return {
        success: true,
        reference: reference,
        amount: amount,
        checkoutUrl: response.data.responseBody.checkoutUrl,
        paymentReference: response.data.responseBody.paymentReference,
        transactionReference: response.data.responseBody.transactionReference,
        paymentMethods: response.data.responseBody.paymentMethods || [],
        expiresAt: response.data.responseBody.expiresAt
      };
    } catch (error) {
      console.error('Payment link generation error:', error.response?.data || error.message);
      
      // Return a fallback payment link for development/testing
      if (process.env.NODE_ENV === 'development') {
        console.log('Returning mock payment link for development mode');
        return {
          success: true,
          reference: options.reference,
          amount: options.amount,
          checkoutUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/mock-payment?ref=${options.reference}&amount=${options.amount}`,
          paymentReference: options.reference,
          transactionReference: `TR-${Date.now()}`,
          mockPayment: true // Flag to indicate this is a mock
        };
      }
      
      return {
        success: false,
        message: 'Failed to generate payment link',
        error: error.response?.data?.responseMessage || error.message
      };
    }
  }

  /**
   * Verify a payment status by reference
   * @param {string} paymentReference The payment reference to verify
   * @returns {Promise<boolean>} True if payment is valid and confirmed
   */
  async verifyPayment(paymentReference) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        `${this.baseUrl}/api/v1/merchant/transactions/query?paymentReference=${paymentReference}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Check for successful payment status
      if (response.data.responseBody && 
          response.data.responseBody.paymentStatus === 'PAID') {
        return true;
      }
      
      // For development mode, consider all payments valid
      if (process.env.NODE_ENV === 'development') {
        console.log('DEV MODE: Bypassing payment verification');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Payment verification error:', error.response?.data || error.message);
      
      // For development mode, consider all payments valid even if verification fails
      if (process.env.NODE_ENV === 'development') {
        console.log('DEV MODE: Bypassing payment verification after error');
        return true;
      }
      
      return false;
    }
  }

  async verifyBankAccount(accountNumber, bankCode) {
    try {
      const token = await this.getAccessToken();
      const res = await axios.get(`${this.baseUrl}/api/v1/disbursements/account/validate`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: { accountNumber, bankCode }
      });

      return { success: true, data: res.data.responseBody };
    } catch (err) {
      const msg = err.response?.data?.responseMessage || err.message;
      return { success: false, message: 'Verification failed', error: msg };
    }
  }

  async createVirtualAccount(customerName, customerEmail, bvn) {
    try {
      const token = await this.getAccessToken();
      const accountReference = crypto.randomBytes(16).toString('hex');

      const payload = {
        accountReference,
        accountName: `${customerName} - Liquidity`,
        currencyCode: 'NGN',
        contractCode: this.contractCode,
        customerEmail,
        customerName,
        bvn,
        getAllAvailableBanks: true
      };

      const res = await axios.post(`${this.baseUrl}/api/v2/bank-transfer/reserved-accounts`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return { success: true, data: res.data.responseBody };
    } catch (err) {
      return {
        success: false,
        message: 'Virtual account creation failed',
        error: err.response?.data?.responseMessage || err.message
      };
    }
  }

  async getVirtualAccountBalance(accountReference) {
    try {
      const token = await this.getAccessToken();
      const res = await axios.get(`${this.baseUrl}/api/v1/bank-transfer/reserved-accounts/${accountReference}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        balance: res.data.responseBody.balance || 0,
        data: res.data.responseBody
      };
    } catch (err) {
      return {
        success: false,
        message: 'Balance fetch failed',
        error: err.response?.data?.responseMessage || err.message
      };
    }
  }

  async getTransactionHistory(accountReference, page = 0, size = 20) {
    try {
      const token = await this.getAccessToken();
      const res = await axios.get(`${this.baseUrl}/api/v1/bank-transfer/reserved-accounts/transactions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: { accountReference, page, size }
      });

      return {
        success: true,
        transactions: res.data.responseBody.content || [],
        totalElements: res.data.responseBody.totalElements,
        data: res.data.responseBody
      };
    } catch (err) {
      return {
        success: false,
        message: 'Transaction history fetch failed',
        error: err.response?.data?.responseMessage || err.message
      };
    }
  }

  verifyWebhookSignature(payload, signature) {
    const hash = crypto.createHash('sha512');
    hash.update(JSON.stringify(payload) + this.secretKey);
    const computed = hash.digest('hex');
    return computed === signature;
  }

  async processWebhook(payload, signature) {
    try {
      if (!this.verifyWebhookSignature(payload, signature)) {
        throw new Error('Invalid webhook signature');
      }

      const { eventType, eventData } = payload;

      if (eventType === 'SUCCESSFUL_TRANSACTION') {
        return {
          success: true,
          type: 'DEPOSIT',
          data: {
            accountReference: eventData.accountReference,
            amount: eventData.amountPaid,
            customerEmail: eventData.customerEmail,
            transactionReference: eventData.transactionReference,
            paymentReference: eventData.paymentReference,
            paidOn: eventData.paidOn
          }
        };
      }

      return { success: true, type: eventType, data: eventData };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async healthCheck() {
    try {
      await this.getAccessToken();
      return { status: 'connected', service: 'monnify' };
    } catch (err) {
      return { status: 'disconnected', service: 'monnify', error: err.message };
    }
  }

  // === Proxy API Methods ===
  async verifyAccount(accountNumber, bankCode) {
    try {
      const res = await this.proxyInstance.get('/verify-account', {
        params: { accountNumber, bankCode }
      });
      return res.data;
    } catch (err) {
      throw new Error(`Proxy verifyAccount failed: ${err.message}`);
    }
  }

  async getBanks() {
    try {
      const res = await this.proxyInstance.get('/banks');
      return res.data;
    } catch (err) {
      throw new Error(`Proxy getBanks failed: ${err.message}`);
    }
  }

  async checkHealth() {
    try {
      const res = await this.proxyInstance.get('/health');
      return res.data;
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }
}

// Export a singleton
module.exports = new MonnifyService();