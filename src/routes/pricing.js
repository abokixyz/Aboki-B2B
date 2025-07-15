const express = require('express');
const offrampController = require('../controllers/offramp-price-Controller');
const onrampController = require('../controllers/onramp-price-Controller');
const webhookController = require('../controllers/webhookController');

const router = express.Router();

// ============= PRICING ENDPOINTS =============

/**
 * @swagger
 * /api/v1/onramp-price:
 *   get:
 *     summary: Get NGN price for buying cryptocurrency
 *     description: Calculate how much Nigerian Naira is needed to buy a specific amount of cryptocurrency
 *     tags: [Pricing]
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
 *       404:
 *         description: Cryptocurrency not found
 *       500:
 *         description: Server error
 */
router.get('/onramp-price', onrampController.getCryptoToNgnPrice);

/**
 * @swagger
 * /api/v1/offramp-price:
 *   get:
 *     summary: Get NGN amount for selling tokens
 *     description: Get NGN amount you'll receive for selling USDT or USDC
 *     tags: [Pricing]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *           enum: [USDT, USDC]
 *         description: Token symbol (USDT or USDC)
 *       - in: query
 *         name: amount
 *         required: true
 *         schema:
 *           type: number
 *         description: Amount of tokens to sell
 *       - in: query
 *         name: providerId
 *         schema:
 *           type: string
 *         description: Optional specific provider ID
 *     responses:
 *       200:
 *         description: Successfully fetched token rate
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
 *                     token:
 *                       type: string
 *                       example: "USDT"
 *                     amount:
 *                       type: number
 *                       example: 100
 *                     ngnAmount:
 *                       type: number
 *                       example: 165000
 *                     rate:
 *                       type: number
 *                       example: 1650
 *                     formattedAmount:
 *                       type: string
 *                       example: "₦165,000.00"
 *                     exchangeRate:
 *                       type: string
 *                       example: "1 USDT = ₦1,650"
 *                     breakdown:
 *                       type: object
 *                       properties:
 *                         youSell:
 *                           type: string
 *                           example: "100 USDT"
 *                         youReceive:
 *                           type: string
 *                           example: "₦165,000.00"
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Server error
 */
router.get('/offramp-price', offrampController.getTokenRate);

// ============= OFFRAMP ENDPOINTS =============

/**
 * @swagger
 * /api/v1/offramp/verify-account:
 *   post:
 *     summary: Verify bank account details
 *     description: Verify recipient bank account name
 *     tags: [Offramp]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               institution:
 *                 type: string
 *                 description: Bank institution code
 *               accountIdentifier:
 *                 type: string
 *                 description: Account number
 *     responses:
 *       200:
 *         description: Account verified successfully
 */
router.post('/offramp/verify-account', offrampController.verifyAccount);

/**
 * @swagger
 * /api/v1/offramp/institutions:
 *   get:
 *     summary: Get supported Nigerian banks
 *     description: Get list of supported banks and mobile money providers
 *     tags: [Offramp]
 *     responses:
 *       200:
 *         description: Successfully fetched institutions
 */
router.get('/offramp/institutions', offrampController.getSupportedInstitutions);

/**
 * @swagger
 * /api/v1/offramp/currencies:
 *   get:
 *     summary: Get supported currencies
 *     description: Get all supported fiat currencies
 *     tags: [Offramp]
 *     responses:
 *       200:
 *         description: Successfully fetched currencies
 */
router.get('/offramp/currencies', offrampController.getSupportedCurrencies);

/**
 * @swagger
 * /api/v1/offramp/tokens:
 *   get:
 *     summary: Get supported tokens and networks
 *     description: Get USDT and USDC with their supported networks
 *     tags: [Offramp]
 *     responses:
 *       200:
 *         description: Successfully fetched supported tokens
 */
router.get('/offramp/tokens', offrampController.getSupportedTokens);

/**
 * @swagger
 * /api/v1/offramp/orders:
 *   post:
 *     summary: Initiate payment order
 *     description: Create a new off-ramp payment order
 *     tags: [Offramp]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               token:
 *                 type: string
 *                 enum: [USDT, USDC]
 *               rate:
 *                 type: number
 *               network:
 *                 type: string
 *                 enum: [tron, base, polygon, arbitrum-one, bnb-smart-chain]
 *               recipient:
 *                 type: object
 *                 properties:
 *                   institution:
 *                     type: string
 *                   accountIdentifier:
 *                     type: string
 *                   accountName:
 *                     type: string
 *                   memo:
 *                     type: string
 *               returnAddress:
 *                 type: string
 *               reference:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment order initiated successfully
 */
router.post('/offramp/orders', offrampController.initiatePaymentOrder);

/**
 * @swagger
 * /api/v1/offramp/orders:
 *   get:
 *     summary: Get all payment orders
 *     description: Retrieve all payment orders with optional filtering
 *     tags: [Offramp]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by order status
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: Filter by token
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Successfully fetched payment orders
 */
router.get('/offramp/orders', offrampController.getAllPaymentOrders);

/**
 * @swagger
 * /api/v1/offramp/orders/{orderId}:
 *   get:
 *     summary: Get payment order by ID
 *     description: Retrieve specific payment order details
 *     tags: [Offramp]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment order ID
 *     responses:
 *       200:
 *         description: Successfully fetched payment order
 */
router.get('/offramp/orders/:orderId', offrampController.getPaymentOrder);

/**
 * @swagger
 * /api/v1/offramp/webhook:
 *   post:
 *     summary: Handle Paycrest webhooks
 *     description: Receive payment order status updates
 *     tags: [Offramp]
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 */
router.post('/offramp/webhook', webhookController.handlePaycrestWebhook);



module.exports = router;