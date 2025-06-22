const axios = require('axios');

class OfframpController {
  // Get NGN amount for selling specific crypto amount
  async getCryptoToNgnOfframp(req, res) {
    try {
      const { 
        cryptoSymbol = 'USDT', 
        cryptoAmount = 100 // Amount of crypto user wants to sell
      } = req.query;

      // Validate required parameters
      if (!cryptoSymbol) {
        return res.status(400).json({
          success: false,
          error: 'cryptoSymbol is required (e.g., USDT, USDC)'
        });
      }

      if (!cryptoAmount || isNaN(cryptoAmount) || parseFloat(cryptoAmount) <= 0) {
        return res.status(400).json({
          success: false,
          error: 'cryptoAmount must be a valid positive number'
        });
      }

      // Validate supported tokens according to Paycrest documentation
      const supportedTokens = ['USDT', 'USDC'];
      if (!supportedTokens.includes(cryptoSymbol.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: `Token ${cryptoSymbol.toUpperCase()} is not supported. Supported tokens: ${supportedTokens.join(', ')}`
        });
      }

      // Use fallback URL if environment variable is not set
      const baseUrl = process.env.PAYCREST_BASE_URL || 'https://api.paycrest.io/v1';

      // Call Paycrest API to get off-ramp rate using correct endpoint structure
      // Endpoint format: GET /v1/rates/:token/:amount/:fiat
      const response = await axios.get(`${baseUrl}/rates/${cryptoSymbol.toLowerCase()}/${parseFloat(cryptoAmount)}/ngn`, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Aboki-B2B-Platform/1.0.0'
        },
        timeout: 15000
      });

      // Extract rate data from Paycrest response
      // Paycrest returns: { "message": "OK", "status": "success", "data": "1500" }
      const { data: responseData, status, message } = response.data;
      
      if (status !== 'success' || !responseData) {
        return res.status(404).json({
          success: false,
          error: `Off-ramp rate not available: ${message || 'Unknown error'}`
        });
      }

      // The rate represents total NGN amount for the crypto amount requested
      const totalNgnToReceive = parseFloat(responseData);
      
      // Calculate per-unit rate
      const exchangeRate = totalNgnToReceive / parseFloat(cryptoAmount);
      
      // Paycrest fees are built into their rates, but we'll show an estimated breakdown
      const estimatedFeePercentage = 0.5; // 0.5% estimated fee
      const estimatedFees = totalNgnToReceive * (estimatedFeePercentage / 100);
      const netAmount = totalNgnToReceive - estimatedFees;

      res.json({
        success: true,
        data: {
          cryptoSymbol: cryptoSymbol.toUpperCase(),
          cryptoAmount: parseFloat(cryptoAmount),
          exchangeRate: parseFloat(exchangeRate.toFixed(2)),
          grossNgnAmount: parseFloat(totalNgnToReceive.toFixed(2)),
          estimatedFees: parseFloat(estimatedFees.toFixed(2)),
          netNgnAmount: parseFloat(netAmount.toFixed(2)),
          formattedAmount: `₦${netAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          rateDisplay: `1 ${cryptoSymbol.toUpperCase()} = ₦${exchangeRate.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          breakdown: {
            youSell: `${cryptoAmount} ${cryptoSymbol.toUpperCase()}`,
            youReceive: `₦${netAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            estimatedFees: `₦${estimatedFees.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${estimatedFeePercentage}%)`
          },
          supportedTokens: supportedTokens,
          timestamp: new Date().toISOString(),
          source: 'Paycrest',
          environment: process.env.PAYCREST_ENVIRONMENT || 'production'
        }
      });

    } catch (error) {
      console.error('Error fetching off-ramp price from Paycrest:', error);
      
      if (error.response) {
        // Log the full error response for debugging
        console.error('Paycrest API Error Response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
        
        return res.status(error.response.status).json({
          success: false,
          error: error.response.data.message || error.response.data.error || 'Paycrest API error'
        });
      }

      if (error.code === 'ECONNABORTED') {
        return res.status(408).json({
          success: false,
          error: 'Request timeout - please try again'
        });
      }

      if (error.code === 'ERR_INVALID_URL') {
        console.error('Environment variables:', {
          PAYCREST_BASE_URL: process.env.PAYCREST_BASE_URL
        });
        
        return res.status(500).json({
          success: false,
          error: 'API configuration error - please contact support'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to fetch off-ramp price'
      });
    }
  }

  // Get supported cryptocurrencies for off-ramp (from Paycrest documentation)
  async getSupportedCryptocurrencies(req, res) {
    try {
      // Based on Paycrest documentation, supported tokens are USDT and USDC
      const supportedTokens = [
        {
          symbol: 'USDT',
          name: 'Tether USD',
          networks: ['tron', 'polygon', 'arbitrum-one', 'bnb-smart-chain'],
          note: 'Not supported on Base network'
        },
        {
          symbol: 'USDC',
          name: 'USD Coin',
          networks: ['base', 'polygon', 'arbitrum-one', 'bnb-smart-chain'],
          note: 'Not supported on Tron network'
        }
      ];

      res.json({
        success: true,
        data: {
          supportedCryptocurrencies: supportedTokens,
          supportedNetworks: ['tron', 'base', 'bnb-smart-chain', 'polygon', 'arbitrum-one'],
          note: 'Only USDT and USDC are supported for off-ramp transactions',
          timestamp: new Date().toISOString(),
          source: 'Paycrest Documentation'
        }
      });

    } catch (error) {
      console.error('Error fetching supported cryptocurrencies:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch supported cryptocurrencies'
      });
    }
  }

  // Get supported institutions for NGN (from Paycrest API)
  async getSupportedInstitutions(req, res) {
    try {
      const baseUrl = process.env.PAYCREST_BASE_URL || 'https://api.paycrest.io/v1';
      
      // Call Paycrest API to get supported institutions for NGN
      const response = await axios.get(`${baseUrl}/institutions/ngn`, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      res.json({
        success: true,
        data: {
          institutions: response.data.data || response.data,
          currency: 'NGN',
          timestamp: new Date().toISOString(),
          source: 'Paycrest'
        }
      });

    } catch (error) {
      console.error('Error fetching supported institutions:', error);
      
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

  // Get all supported currencies (from Paycrest API)
  async getSupportedCurrencies(req, res) {
    try {
      const baseUrl = process.env.PAYCREST_BASE_URL || 'https://api.paycrest.io/v1';
      
      // Call Paycrest API to get supported currencies
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
      console.error('Error fetching supported currencies:', error);
      
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
}

module.exports = new OfframpController();