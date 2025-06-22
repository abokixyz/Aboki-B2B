const axios = require('axios');

class OnrampController {
  // Get NGN price for specific crypto amount
  async getCryptoToNgnPrice(req, res) {
    try {
      const { 
        cryptoSymbol = 'BTC', 
        cryptoAmount = 0.1 // Default 0.1 crypto
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
      const baseUrl = process.env.CRYPTOCOMPARE_BASE_URL || 'https://min-api.cryptocompare.com/data';
      const apiKey = process.env.CRYPTOCOMPARE_API_KEY;

      // Build request parameters
      const params = {
        fsym: cryptoSymbol.toUpperCase(),
        tsyms: 'NGN'
      };

      // Only add API key if it exists
      if (apiKey) {
        params.api_key = apiKey;
      }

      // Call CryptoCompare API to get crypto price in NGN
      const response = await axios.get(`${baseUrl}/price`, {
        params,
        timeout: 10000,
        headers: {
          'User-Agent': 'Aboki-B2B-Platform/1.0.0'
        }
      });

      const cryptoPriceInNgn = response.data.NGN;
      
      if (!cryptoPriceInNgn) {
        return res.status(404).json({
          success: false,
          error: `Price data not found for ${cryptoSymbol.toUpperCase()} in NGN`
        });
      }

      // Calculate total NGN needed for the crypto amount
      const totalNgnNeeded = parseFloat(cryptoAmount) * cryptoPriceInNgn;

      res.json({
        success: true,
        data: {
          cryptoSymbol: cryptoSymbol.toUpperCase(),
          cryptoAmount: parseFloat(cryptoAmount),
          unitPriceInNgn: cryptoPriceInNgn,
          totalNgnNeeded: parseFloat(totalNgnNeeded.toFixed(2)),
          formattedPrice: `₦${totalNgnNeeded.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          exchangeRate: `1 ${cryptoSymbol.toUpperCase()} = ₦${cryptoPriceInNgn.toLocaleString('en-NG')}`,
          breakdown: {
            youWant: `${cryptoAmount} ${cryptoSymbol.toUpperCase()}`,
            youPay: `₦${totalNgnNeeded.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          },
          timestamp: new Date().toISOString(),
          source: 'CryptoCompare'
        }
      });

    } catch (error) {
      console.error('Error fetching crypto to NGN price:', error);
      
      if (error.response) {
        // Log the full error response for debugging
        console.error('API Error Response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
        
        return res.status(error.response.status).json({
          success: false,
          error: error.response.data.Message || error.response.data.message || 'External API error'
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
          CRYPTOCOMPARE_BASE_URL: process.env.CRYPTOCOMPARE_BASE_URL,
          CRYPTOCOMPARE_API_KEY: process.env.CRYPTOCOMPARE_API_KEY ? 'SET' : 'NOT SET'
        });
        
        return res.status(500).json({
          success: false,
          error: 'API configuration error - please contact support'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to fetch crypto price'
      });
    }
  }
}

module.exports = new OnrampController();