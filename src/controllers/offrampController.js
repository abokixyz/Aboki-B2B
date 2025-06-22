const axios = require('axios');

class OfframpController {
  // Get NGN amount for selling specific crypto amount
  async getCryptoToNgnOfframp(req, res) {
    try {
      const { 
        cryptoSymbol = 'BTC', 
        cryptoAmount = 0.1 // Amount of crypto user wants to sell
      } = req.query;

      // Validate required parameters
      if (!cryptoSymbol) {
        return res.status(400).json({
          success: false,
          error: 'cryptoSymbol is required (e.g., BTC, ETH, USDT)'
        });
      }

      if (!cryptoAmount || isNaN(cryptoAmount) || parseFloat(cryptoAmount) <= 0) {
        return res.status(400).json({
          success: false,
          error: 'cryptoAmount must be a valid positive number'
        });
      }

      // Use fallback URL if environment variable is not set
      const baseUrl = process.env.PAYCREST_BASE_URL || 'https://api.paycrest.io/v1';

      if (!clientId || !clientSecret) {
        return res.status(500).json({
          success: false,
          error: 'Paycrest API credentials not configured'
        });
      }

      // Generate basic auth header
      const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      // Call Paycrest API to get off-ramp rate using correct endpoint structure
      // Endpoint format: GET {baseUrl}/rates/:token/:amount/:fiat
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

      // The rate is returned as a string, convert to number
      const exchangeRate = parseFloat(responseData);
      const totalNgnToReceive = parseFloat(cryptoAmount) * exchangeRate;
      
      // Paycrest typically includes fees in their rates, but we'll assume 0.5% fee for display
      const estimatedFees = totalNgnToReceive * 0.005; // 0.5% fee
      const netAmount = totalNgnToReceive - estimatedFees;

      res.json({
        success: true,
        data: {
          cryptoSymbol: cryptoSymbol.toUpperCase(),
          cryptoAmount: parseFloat(cryptoAmount),
          exchangeRate: exchangeRate,
          grossNgnAmount: parseFloat(totalNgnToReceive.toFixed(2)),
          fees: parseFloat(estimatedFees.toFixed(2)),
          netNgnAmount: parseFloat(netAmount.toFixed(2)),
          formattedAmount: `₦${netAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          rateDisplay: `1 ${cryptoSymbol.toUpperCase()} = ₦${exchangeRate.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          breakdown: {
            youSell: `${cryptoAmount} ${cryptoSymbol.toUpperCase()}`,
            youReceive: `₦${netAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            processingFees: `₦${estimatedFees.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          },
          timestamp: new Date().toISOString(),
          source: 'Paycrest',
          environment: process.env.PAYCREST_ENVIRONMENT || 'sandbox'
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

  // Get supported cryptocurrencies for off-ramp
  async getSupportedCryptocurrencies(req, res) {
    try {
      const baseUrl = process.env.PAYCREST_BASE_URL || 'https://api.paycrest.io/v1';

      // For supported currencies, we don't need authentication
      const response = await axios.get(`${baseUrl}/currencies`, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      res.json({
        success: true,
        data: {
          supportedCryptocurrencies: response.data.data || response.data,
          timestamp: new Date().toISOString(),
          source: 'Paycrest'
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
}

module.exports = new OfframpController();