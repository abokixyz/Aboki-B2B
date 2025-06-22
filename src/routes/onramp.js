const express = require('express');
const onrampController = require('../controllers/onrampController');

const router = express.Router();

/**
 * @swagger
 * /api/v1/onramp/ngn-to-crypto:
 *   get:
 *     summary: Convert NGN amount to cryptocurrency
 *     description: Get the amount of cryptocurrency that can be purchased with Nigerian Naira
 *     tags: [Onramp]
 *     parameters:
 *       - in: query
 *         name: cryptoSymbol
 *         required: true
 *         schema:
 *           type: string
 *           example: BTC
 *         description: Cryptocurrency symbol (e.g., BTC, ETH, USDT)
 *       - in: query
 *         name: ngnAmount
 *         required: true
 *         schema:
 *           type: number
 *           example: 1000000
 *         description: Amount in Nigerian Naira
 *     responses:
 *       200:
 *         description: Successfully calculated crypto amount for NGN
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     fromCurrency:
 *                       type: string
 *                       example: "NGN"
 *                     toCurrency:
 *                       type: string
 *                       example: "BTC"
 *                     ngnAmount:
 *                       type: number
 *                       example: 1000000
 *                     cryptoPriceInNgn:
 *                       type: number
 *                       example: 65000000
 *                     cryptoAmountToBuy:
 *                       type: number
 *                       example: 0.01538462
 *                     exchangeRate:
 *                       type: string
 *                       example: "1 BTC = ₦65,000,000"
 *                     timestamp:
 *                       type: string
 *                       example: "2025-06-22T10:30:00.000Z"
 *                     source:
 *                       type: string
 *                       example: "CryptoCompare"
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Cryptocurrency not found
 *       500:
 *         description: Server error
 */
router.get('/ngn-to-crypto', onrampController.getNgnToCryptoPrice);

module.exports = router;