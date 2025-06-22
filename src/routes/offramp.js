const express = require('express');
const offrampController = require('../controllers/offrampController');
const webhookController = require('../controllers/webhookController');

const router = express.Router();

/**
 * @swagger
 * /api/v1/offramp/rates:
 *   get:
 *     summary: Get token rate for off-ramp
 *     description: Get NGN amount for selling USDT or USDC
 *     tags: [Offramp]
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
 *       400:
 *         description: Invalid parameters
 */
router.get('/rates', offrampController.getTokenRate);

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
router.post('/verify-account', offrampController.verifyAccount);

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
router.get('/institutions', offrampController.getSupportedInstitutions);

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
router.get('/currencies', offrampController.getSupportedCurrencies);

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
router.get('/tokens', offrampController.getSupportedTokens);

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
router.post('/orders', offrampController.initiatePaymentOrder);

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
router.get('/orders', offrampController.getAllPaymentOrders);

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
router.get('/orders/:orderId', offrampController.getPaymentOrder);

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
router.post('/webhook', webhookController.handlePaycrestWebhook);

module.exports = router;

