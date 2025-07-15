const axios = require('axios');

class OfframpController {
  // Get token rate for off-ramp
  async getTokenRate(req, res) {
    try {
      const { 
        token = 'USDT', 
        amount = 100,
        providerId = null // Optional specific provider
      } = req.query;

      // Validate supported tokens (from Paycrest docs)
      const supportedTokens = ['USDT', 'USDC'];
      if (!supportedTokens.includes(token.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: `Token ${token.toUpperCase()} not supported. Supported: ${supportedTokens.join(', ')}`
        });
      }

      if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        return res.status(400).json({
          success: false,
          error: 'amount must be a valid positive number'
        });
      }

      const baseUrl = process.env.PAYCREST_BASE_URL || 'https://api.paycrest.io/v1';
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      if (providerId) {
        queryParams.append('provider_id', providerId);
      }
      
      const queryString = queryParams.toString();
      const url = `${baseUrl}/rates/${token.toLowerCase()}/${amount}/ngn${queryString ? '?' + queryString : ''}`;

      // Call Paycrest rates endpoint
      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Aboki-B2B-Platform/1.0.0'
        },
        timeout: 15000
      });

      const { data: totalNgnAmount, status, message } = response.data;
      
      if (status !== 'success' || !totalNgnAmount) {
        return res.status(404).json({
          success: false,
          error: `Rate not available: ${message || 'Unknown error'}`
        });
      }

      // Calculate per-unit rate
      const ngnAmount = parseFloat(totalNgnAmount);
      const exchangeRate = ngnAmount / parseFloat(amount);

      res.json({
        success: true,
        data: {
          token: token.toUpperCase(),
          amount: parseFloat(amount),
          totalNgnAmount: ngnAmount,
          exchangeRate: parseFloat(exchangeRate.toFixed(2)),
          formattedAmount: `₦${ngnAmount.toLocaleString('en-NG')}`,
          rateDisplay: `1 ${token.toUpperCase()} = ₦${exchangeRate.toLocaleString('en-NG')}`,
          providerId: providerId || 'default',
          timestamp: new Date().toISOString(),
          source: 'Paycrest'
        }
      });

    } catch (error) {
      console.error('Error fetching token rate:', error);
      
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          error: error.response.data.message || 'API error'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to fetch token rate'
      });
    }
  }

  // Verify bank account details
  async verifyAccount(req, res) {
    try {
      const { institution, accountIdentifier } = req.body;

      if (!institution || !accountIdentifier) {
        return res.status(400).json({
          success: false,
          error: 'institution and accountIdentifier are required'
        });
      }

      const baseUrl = process.env.PAYCREST_BASE_URL || 'https://api.paycrest.io/v1';

      const response = await axios.post(`${baseUrl}/verify-account`, {
        institution,
        accountIdentifier
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const { data: accountName, status, message } = response.data;

      res.json({
        success: true,
        data: {
          institution,
          accountIdentifier,
          accountName: accountName || 'Verified',
          verified: status === 'success',
          message,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error verifying account:', error);
      
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          error: error.response.data.message || 'Account verification failed'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to verify account'
      });
    }
  }

  // Get supported institutions for NGN
  async getSupportedInstitutions(req, res) {
    try {
      const baseUrl = process.env.PAYCREST_BASE_URL || 'https://api.paycrest.io/v1';

      const response = await axios.get(`${baseUrl}/institutions/ngn`, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      res.json({
        success: true,
        data: {
          currency: 'NGN',
          institutions: response.data.data || response.data,
          timestamp: new Date().toISOString(),
          source: 'Paycrest'
        }
      });

    } catch (error) {
      console.error('Error fetching institutions:', error);
      
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          error: error.response.data.message || 'Failed to fetch institutions'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to fetch supported institutions'
      });
    }
  }

  // Get supported currencies
  async getSupportedCurrencies(req, res) {
    try {
      const baseUrl = process.env.PAYCREST_BASE_URL || 'https://api.paycrest.io/v1';

      const response = await axios.get(`${baseUrl}/currencies`, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      res.json({
        success: true,
        data: {
          currencies: response.data.data || response.data,
          timestamp: new Date().toISOString(),
          source: 'Paycrest'
        }
      });

    } catch (error) {
      console.error('Error fetching currencies:', error);
      
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          error: error.response.data.message || 'Failed to fetch currencies'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to fetch supported currencies'
      });
    }
  }

  // Initiate payment order (requires authentication)
  async initiatePaymentOrder(req, res) {
    try {
      const {
        amount,
        token,
        rate,
        network,
        recipient,
        returnAddress,
        reference
      } = req.body;

      // Validate required fields
      if (!amount || !token || !rate || !network || !recipient) {
        return res.status(400).json({
          success: false,
          error: 'amount, token, rate, network, and recipient are required'
        });
      }

      // Validate recipient object
      const { institution, accountIdentifier, accountName, memo } = recipient;
      if (!institution || !accountIdentifier || !accountName || !memo) {
        return res.status(400).json({
          success: false,
          error: 'recipient must include institution, accountIdentifier, accountName, and memo'
        });
      }

      // Validate token and network combination
      const validCombinations = {
        'USDT': ['tron', 'polygon', 'arbitrum-one', 'bnb-smart-chain'],
        'USDC': ['base', 'polygon', 'arbitrum-one', 'bnb-smart-chain']
      };

      if (!validCombinations[token.toUpperCase()]?.includes(network)) {
        return res.status(400).json({
          success: false,
          error: `Invalid token-network combination. ${token.toUpperCase()} is not supported on ${network}`
        });
      }

      const clientId = process.env.PAYCREST_CLIENT_ID;
      if (!clientId) {
        return res.status(500).json({
          success: false,
          error: 'API configuration error'
        });
      }

      const baseUrl = process.env.PAYCREST_BASE_URL || 'https://api.paycrest.io/v1';

      const response = await axios.post(`${baseUrl}/sender/orders`, {
        amount: parseFloat(amount),
        token: token.toUpperCase(),
        rate: parseFloat(rate),
        network,
        recipient,
        returnAddress,
        reference
      }, {
        headers: {
          'API-Key': clientId,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      res.json({
        success: true,
        data: response.data.data,
        message: response.data.message
      });

    } catch (error) {
      console.error('Error initiating payment order:', error);
      
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          error: error.response.data.message || 'Failed to initiate payment order'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to initiate payment order'
      });
    }
  }

  // Get payment order by ID (requires authentication)
  async getPaymentOrder(req, res) {
    try {
      const { orderId } = req.params;

      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: 'orderId is required'
        });
      }

      const clientId = process.env.PAYCREST_CLIENT_ID;
      if (!clientId) {
        return res.status(500).json({
          success: false,
          error: 'API configuration error'
        });
      }

      const baseUrl = process.env.PAYCREST_BASE_URL || 'https://api.paycrest.io/v1';

      const response = await axios.get(`${baseUrl}/sender/orders/${orderId}`, {
        headers: {
          'API-Key': clientId,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      res.json({
        success: true,
        data: response.data.data,
        message: response.data.message
      });

    } catch (error) {
      console.error('Error fetching payment order:', error);
      
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          error: error.response.data.message || 'Payment order not found'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to fetch payment order'
      });
    }
  }

  // Get all payment orders (requires authentication)
  async getAllPaymentOrders(req, res) {
    try {
      const {
        ordering,
        status,
        token,
        network,
        page = 1,
        pageSize = 20
      } = req.query;

      const clientId = process.env.PAYCREST_CLIENT_ID;
      if (!clientId) {
        return res.status(500).json({
          success: false,
          error: 'API configuration error'
        });
      }

      const baseUrl = process.env.PAYCREST_BASE_URL || 'https://api.paycrest.io/v1';

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (ordering) queryParams.append('ordering', ordering);
      if (status) queryParams.append('status', status);
      if (token) queryParams.append('token', token);
      if (network) queryParams.append('network', network);
      queryParams.append('page', page);
      queryParams.append('pageSize', pageSize);

      const response = await axios.get(`${baseUrl}/sender/orders?${queryParams.toString()}`, {
        headers: {
          'API-Key': clientId,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      res.json({
        success: true,
        data: response.data.data,
        message: response.data.message
      });

    } catch (error) {
      console.error('Error fetching payment orders:', error);
      
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          error: error.response.data.message || 'Failed to fetch payment orders'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to fetch payment orders'
      });
    }
  }

  // Get supported tokens and networks info
  async getSupportedTokens(req, res) {
    try {
      const supportedTokens = [
        {
          symbol: 'USDT',
          name: 'Tether USD',
          networks: ['tron', 'polygon', 'arbitrum-one', 'bnb-smart-chain'],
          restrictions: 'Not supported on Base network'
        },
        {
          symbol: 'USDC',
          name: 'USD Coin',
          networks: ['base', 'polygon', 'arbitrum-one', 'bnb-smart-chain'],
          restrictions: 'Not supported on Tron network'
        }
      ];

      res.json({
        success: true,
        data: {
          supportedTokens,
          supportedNetworks: ['tron', 'base', 'bnb-smart-chain', 'polygon', 'arbitrum-one'],
          timestamp: new Date().toISOString(),
          source: 'Paycrest Documentation'
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch supported tokens'
      });
    }
  }
}

module.exports = new OfframpController();