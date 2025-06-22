const express = require('express');
const onrampController = require('../controllers/onrampController');

const router = express.Router();

/**
 * @swagger
 * /api/v1/onramp/crypto-to-ngn:
 *   get:
 *     summary: Get NGN price for specific cryptocurrency amount
 *     description: Calculate how much Nigerian Naira is needed to buy a specific amount of cryptocurrency
 *     tags: [Onramp]
 *     parameters:
 *       - in: query
 *         name: cryptoSymbol
 *         required: true
 *         schema:
 *           type: string
 *           example: BTC
 *         description: Cryptocurrency symbol (e.g., BTC, ETH, USDT, ADA)
 *       - in: query
 *         name: cryptoAmount
 *         required: true
 *         schema:
 *           type: number
 *           example: 0.1
 *         description: Amount of cryptocurrency you want to buy
 *     responses:
 *       200:
 *         description: Successfully calculated NGN price for crypto amount
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
 *                     unitPriceInNgn:
 *                       type: number
 *                       example: 65000000
 *                     totalNgnNeeded:
 *                       type: number
 *                       example: 6500000
 *                     formattedPrice:
 *                       type: string
 *                       example: "₦6,500,000.00"
 *                     exchangeRate:
 *                       type: string
 *                       example: "1 BTC = ₦65,000,000"
 *                     breakdown:
 *                       type: object
 *                       properties:
 *                         youWant:
 *                           type: string
 *                           example: "0.1 BTC"
 *                         youPay:
 *                           type: string
 *                           example: "₦6,500,000.00"
 *                     timestamp:
 *                       type: string
 *                       example: "2025-06-22T10:30:00.000Z"
 *                     source:
 *                       type: string
 *                       example: "CryptoCompare"
 *       400:
 *         description: Invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "cryptoAmount must be a valid positive number"
 *       404:
 *         description: Cryptocurrency not found
 *       500:
 *         description: Server error
 */
router.get('/crypto-to-ngn', onrampController.getCryptoToNgnPrice);

// Keep the old endpoint for backward compatibility (optional)
router.get('/ngn-to-crypto', onrampController.getCryptoToNgnPrice);

module.exports = router;

