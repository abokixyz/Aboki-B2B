const express = require('express');
const offrampController = require('../controllers/offrampController');

const router = express.Router();

/**
 * @swagger
 * /api/v1/offramp/crypto-to-ngn:
 *   get:
 *     summary: Get NGN amount for selling cryptocurrency (Off-ramp)
 *     description: Calculate how much Nigerian Naira you will receive for selling a specific amount of cryptocurrency
 *     tags: [Offramp]
 *     parameters:
 *       - in: query
 *         name: cryptoSymbol
 *         required: true
 *         schema:
 *           type: string
 *           example: BTC
 *         description: Cryptocurrency symbol to sell (e.g., BTC, ETH, USDT)
 *       - in: query
 *         name: cryptoAmount
 *         required: true
 *         schema:
 *           type: number
 *           example: 0.1
 *         description: Amount of cryptocurrency you want to sell
 *     responses:
 *       200:
 *         description: Successfully calculated NGN amount for crypto sale
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
 *                     cryptoSymbol:
 *                       type: string
 *                       example: "BTC"
 *                     cryptoAmount:
 *                       type: number
 *                       example: 0.1
 *                     exchangeRate:
 *                       type: number
 *                       example: 63000000
 *                     grossNgnAmount:
 *                       type: number
 *                       example: 6300000
 *                     fees:
 *                       type: number
 *                       example: 31500
 *                     netNgnAmount:
 *                       type: number
 *                       example: 6268500
 *                     formattedAmount:
 *                       type: string
 *                       example: "₦6,268,500.00"
 *                     rateDisplay:
 *                       type: string
 *                       example: "1 BTC = ₦63,000,000.00"
 *                     breakdown:
 *                       type: object
 *                       properties:
 *                         youSell:
 *                           type: string
 *                           example: "0.1 BTC"
 *                         youReceive:
 *                           type: string
 *                           example: "₦6,268,500.00"
 *                         processingFees:
 *                           type: string
 *                           example: "₦31,500.00"
 *                     timestamp:
 *                       type: string
 *                       example: "2025-06-22T10:30:00.000Z"
 *                     source:
 *                       type: string
 *                       example: "Paycrest"
 *                     environment:
 *                       type: string
 *                       example: "sandbox"
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Cryptocurrency not supported for off-ramp
 *       500:
 *         description: Server error
 */
router.get('/crypto-to-ngn', offrampController.getCryptoToNgnOfframp);

/**
 * @swagger
 * /api/v1/offramp/supported-currencies:
 *   get:
 *     summary: Get list of supported cryptocurrencies for off-ramp
 *     description: Retrieve all cryptocurrencies that can be sold for NGN through Paycrest
 *     tags: [Offramp]
 *     responses:
 *       200:
 *         description: Successfully fetched supported cryptocurrencies
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
 *                     supportedCryptocurrencies:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["BTC", "ETH", "USDT", "USDC", "BNB"]
 *                     timestamp:
 *                       type: string
 *                       example: "2025-06-22T10:30:00.000Z"
 *                     source:
 *                       type: string
 *                       example: "Paycrest"
 *       500:
 *         description: Server error
 */
router.get('/supported-currencies', offrampController.getSupportedCryptocurrencies);

module.exports = router;