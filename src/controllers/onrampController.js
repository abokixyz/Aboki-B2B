const axios = require('axios');

class OnrampController {
  // Get NGN to crypto price conversion
  async getNgnToCryptoPrice(req, res) {
    try {
      const { 
        cryptoSymbol = 'BTC', 
        ngnAmount = 1000000 // Default 1 million NGN
      } = req.query;

      // Validate required parameters
      if (!cryptoSymbol) {
        return res.status(400).json({
          success: false,
          error: 'cryptoSymbol is required'
        });
      }

      if (!ngnAmount || isNaN(ngnAmount) || parseFloat(ngnAmount) <= 0) {
        return res.status(400).json({
          success: false,
          error: 'ngnAmount must be a valid positive number'
        });
      }

      // Call CryptoCompare API to get crypto price in NGN
      const response = await axios.get(`${process.env.CRYPTOCOMPARE_BASE_URL}/price`, {
        params: {
          fsym: cryptoSymbol.toUpperCase(),
          tsyms: 'NGN',
          api_key: process.env.CRYPTOCOMPARE_API_KEY
        },
        timeout: 10000
      });

      const cryptoPriceInNgn = response.data.NGN;
      
      if (!cryptoPriceInNgn) {
        return res.status(404).json({
          success: false,
          error: `Price data not found for ${cryptoSymbol.toUpperCase()} in NGN`
        });
      }

      // Calculate how much crypto user can buy with NGN amount
      const cryptoAmount = parseFloat(ngnAmount) / cryptoPriceInNgn;

      res.json({
        success: true,
        data: {
          fromCurrency: 'NGN',
          toCurrency: cryptoSymbol.toUpperCase(),
          ngnAmount: parseFloat(ngnAmount),
          cryptoPriceInNgn: cryptoPriceInNgn,
          cryptoAmountToBuy: parseFloat(cryptoAmount.toFixed(8)),
          exchangeRate: `1 ${cryptoSymbol.toUpperCase()} = ₦${cryptoPriceInNgn.toLocaleString()}`,
          timestamp: new Date().toISOString(),
          source: 'CryptoCompare'
        }
      });

    } catch (error) {
      console.error('Error fetching NGN to crypto price:', error);
      
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          error: error.response.data.Message || 'External API error'
        });
      }

      if (error.code === 'ECONNABORTED') {
        return res.status(408).json({
          success: false,
          error: 'Request timeout - please try again'
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