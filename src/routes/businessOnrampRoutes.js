const express = require('express');
const router = express.Router();
const businessOnrampController = require('../controllers/businessOnrampController');
const { authenticateApiKey, validateBusinessOnrampRequest, apiRateLimit } = require('../middleware/apiAuth');

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     ApiKeyAuth:
 *       type: apiKey
 *       in: header
 *       name: X-API-Key
 *     SecretKeyAuth:
 *       type: apiKey
 *       in: header
 *       name: X-Secret-Key
 *   schemas:
 *     BusinessOnrampRequest:
 *       type: object
 *       required:
 *         - customerEmail
 *         - customerName
 *         - amount
 *         - targetToken
 *         - targetNetwork
 *         - customerWallet
 *       properties:
 *         customerEmail:
 *           type: string
 *           format: email
 *           example: "customer@example.com"
 *         customerName:
 *           type: string
 *           example: "John Doe"
 *         customerPhone:
 *           type: string
 *           example: "+234-123-456-7890"
 *         amount:
 *           type: number
 *           minimum: 1000
 *           maximum: 10000000
 *           example: 50000
 *           description: "Amount in NGN (minimum ₦1,000, maximum ₦10,000,000)"
 *         targetToken:
 *           type: string
 *           example: "USDC"
 *           description: "Token symbol that customer wants to receive"
 *         targetNetwork:
 *           type: string
 *           enum: [base, solana, ethereum]
 *           example: "base"
 *         customerWallet:
 *           type: string
 *           example: "0x742d35Cc6634C0532925a3b8D1D8ce28D2e67F5c"
 *           description: "Customer's wallet address to receive tokens"
 *         redirectUrl:
 *           type: string
 *           format: uri
 *           example: "https://yourdomain.com/payment/success"
 *           description: "Optional URL to redirect customer after payment completion"
 *         webhookUrl:
 *           type: string
 *           format: uri
 *           example: "https://yourdomain.com/webhooks/onramp"
 *           description: "Optional webhook URL to receive order status updates"
 *         metadata:
 *           type: object
 *           description: "Optional additional data you want to store with this order"
 *           example:
 *             userId: "user_123"
 *             orderId: "order_456"
 *             source: "mobile_app"
 *     BusinessOnrampResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Business onramp order created successfully"
 *         data:
 *           type: object
 *           properties:
 *             orderId:
 *               type: string
 *               example: "BO_1234567890_ABCDEF"
 *             businessOrderReference:
 *               type: string
 *               example: "BIZRAMP-uuid-here"
 *             amount:
 *               type: number
 *               example: 50000
 *             targetToken:
 *               type: string
 *               example: "USDC"
 *             targetNetwork:
 *               type: string
 *               example: "base"
 *             estimatedTokenAmount:
 *               type: number
 *               example: 30.25
 *             exchangeRate:
 *               type: number
 *               example: 1653.5
 *             feeAmount:
 *               type: number
 *               example: 750
 *             feePercentage:
 *               type: number
 *               example: 1.5
 *             status:
 *               type: string
 *               example: "initiated"
 *             expiresAt:
 *               type: string
 *               format: date-time
 *             paymentDetails:
 *               type: object
 *               properties:
 *                 paymentUrl:
 *                   type: string
 *                   example: "https://checkout.monnify.com/..."
 *                 paymentReference:
 *                   type: string
 *                   example: "MONNIFY_REF_123"
 *                 expiresIn:
 *                   type: number
 *                   example: 1800
 *     BusinessOrderStatus:
 *       type: object
 *       properties:
 *         orderId:
 *           type: string
 *         businessOrderReference:
 *           type: string
 *         status:
 *           type: string
 *           enum: [initiated, pending, processing, completed, failed, cancelled, expired]
 *         amount:
 *           type: number
 *         targetToken:
 *           type: string
 *         targetNetwork:
 *           type: string
 *         estimatedTokenAmount:
 *           type: number
 *         actualTokenAmount:
 *           type: number
 *         customerEmail:
 *           type: string
 *         customerWallet:
 *           type: string
 *         exchangeRate:
 *           type: number
 *         feeAmount:
 *           type: number
 *         feePercentage:
 *           type: number
 *         transactionHash:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         expiresAt:
 *           type: string
 *           format: date-time
 *         completedAt:
 *           type: string
 *           format: date-time
 *         paymentCompletedAt:
 *           type: string
 *           format: date-time
 *         settlementCompletedAt:
 *           type: string
 *           format: date-time
 *         metadata:
 *           type: object
 *         errorMessage:
 *           type: string
 */

/**
 * @swagger
 * tags:
 *   - name: Business Onramp API
 *     description: API endpoints for business integration - onramp services
 */

// All routes require API key authentication and rate limiting
router.use(authenticateApiKey);
router.use(apiRateLimit);

/**
 * @swagger
 * /api/v1/business-onramp/create:
 *   post:
 *     summary: Create onramp order for business customer
 *     description: Create a new onramp order for a business customer. The customer will pay in NGN and receive the specified token. Webhook URL is optional - businesses can fetch order status instead.
 *     tags: [Business Onramp API]
 *     security:
 *       - ApiKeyAuth: []
 *       - SecretKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BusinessOnrampRequest'
 *     responses:
 *       201:
 *         description: Onramp order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessOnrampResponse'
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid request parameters"
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: Invalid API credentials
 *       403:
 *         description: Token not supported by business
 *       500:
 *         description: Internal server error
 */
router.post('/create', validateBusinessOnrampRequest, businessOnrampController.createOnrampOrder);

/**
 * @swagger
 * /api/v1/business-onramp/orders/{orderId}:
 *   get:
 *     summary: Get onramp order details by ID
 *     description: Retrieve complete details of a specific onramp order including current status and transaction information
 *     tags: [Business Onramp API]
 *     security:
 *       - ApiKeyAuth: []
 *       - SecretKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Business onramp order ID
 *     responses:
 *       200:
 *         description: Order details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/BusinessOrderStatus'
 *       404:
 *         description: Order not found
 *       401:
 *         description: Invalid API credentials
 */
router.get('/orders/:orderId', businessOnrampController.getOrderById);

/**
 * @swagger
 * /api/v1/business-onramp/orders:
 *   get:
 *     summary: Get all onramp orders for business
 *     description: Retrieve all onramp orders created by this business with optional filtering and pagination
 *     tags: [Business Onramp API]
 *     security:
 *       - ApiKeyAuth: []
 *       - SecretKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [initiated, pending, processing, completed, failed, cancelled, expired]
 *         description: Filter by order status
 *       - in: query
 *         name: targetToken
 *         schema:
 *           type: string
 *         description: Filter by target token (e.g., USDC, ETH)
 *       - in: query
 *         name: targetNetwork
 *         schema:
 *           type: string
 *           enum: [base, solana, ethereum]
 *         description: Filter by target network
 *       - in: query
 *         name: customerEmail
 *         schema:
 *           type: string
 *         description: Filter by customer email
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Items per page (max 100)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter orders from this date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter orders to this date (YYYY-MM-DD)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, amount, completedAt]
 *           default: createdAt
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
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
 *                     orders:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/BusinessOrderStatus'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         page:
 *                           type: number
 *                         limit:
 *                           type: number
 *                         pages:
 *                           type: number
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalAmount:
 *                           type: number
 *                         totalOrders:
 *                           type: number
 *                         completedOrders:
 *                           type: number
 *                         pendingOrders:
 *                           type: number
 *                         totalFees:
 *                           type: number
 */
router.get('/orders', businessOnrampController.getAllOrders);

/**
 * @swagger
 * /api/v1/business-onramp/supported-tokens:
 *   get:
 *     summary: Get supported tokens for business onramp
 *     description: Retrieve all tokens supported by the business for onramp orders with current fees
 *     tags: [Business Onramp API]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Supported tokens retrieved successfully
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
 *                     supportedTokens:
 *                       type: object
 *                       properties:
 *                         base:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               symbol:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               contractAddress:
 *                                 type: string
 *                               decimals:
 *                                 type: number
 *                               feePercentage:
 *                                 type: number
 *                               isActive:
 *                                 type: boolean
 *                               isDefault:
 *                                 type: boolean
 *                         solana:
 *                           type: array
 *                           items:
 *                             type: object
 *                         ethereum:
 *                           type: array
 *                           items:
 *                             type: object
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         totalActiveTokens:
 *                           type: number
 *                         defaultTokens:
 *                           type: number
 *                         customTokens:
 *                           type: number
 *                         networksSupported:
 *                           type: array
 *                           items:
 *                             type: string
 *                     businessInfo:
 *                       type: object
 *                       properties:
 *                         businessId:
 *                           type: string
 *                         businessName:
 *                           type: string
 */
router.get('/supported-tokens', businessOnrampController.getSupportedTokens);

/**
 * @swagger
 * /api/v1/business-onramp/quote:
 *   post:
 *     summary: Get price quote for business onramp
 *     description: Get a detailed price quote for converting NGN to specified token including business fees and breakdown
 *     tags: [Business Onramp API]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - targetToken
 *               - targetNetwork
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 1000
 *                 maximum: 10000000
 *                 example: 50000
 *                 description: "Amount in NGN"
 *               targetToken:
 *                 type: string
 *                 example: "USDC"
 *               targetNetwork:
 *                 type: string
 *                 enum: [base, solana, ethereum]
 *                 example: "base"
 *     responses:
 *       200:
 *         description: Quote calculated successfully
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
 *                     amount:
 *                       type: number
 *                       example: 50000
 *                     targetToken:
 *                       type: string
 *                       example: "USDC"
 *                     targetNetwork:
 *                       type: string
 *                       example: "base"
 *                     exchangeRate:
 *                       type: number
 *                       example: 1653.5
 *                     tokenAmount:
 *                       type: number
 *                       example: 30.25
 *                     feePercentage:
 *                       type: number
 *                       example: 1.5
 *                     feeAmount:
 *                       type: number
 *                       example: 750
 *                     netAmount:
 *                       type: number
 *                       example: 49250
 *                     finalTokenAmount:
 *                       type: number
 *                       example: 29.78
 *                     breakdown:
 *                       type: object
 *                       properties:
 *                         grossAmount:
 *                           type: string
 *                           example: "₦50,000"
 *                         businessFee:
 *                           type: string
 *                           example: "₦750 (1.5%)"
 *                         netAmount:
 *                           type: string
 *                           example: "₦49,250"
 *                         youReceive:
 *                           type: string
 *                           example: "29.78 USDC"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     validFor:
 *                       type: number
 *                       example: 300
 *                       description: "Quote valid for X seconds"
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 */
router.post('/quote', businessOnrampController.getQuote);

/**
 * @swagger
 * /api/v1/business-onramp/stats:
 *   get:
 *     summary: Get business onramp statistics
 *     description: Retrieve comprehensive statistics about business onramp orders and performance
 *     tags: [Business Onramp API]
 *     security:
 *       - ApiKeyAuth: []
 *       - SecretKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y, all]
 *           default: 30d
 *         description: Time period for statistics
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *         description: Group statistics by time period
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
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
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalOrders:
 *                           type: number
 *                         totalAmount:
 *                           type: number
 *                         totalFees:
 *                           type: number
 *                         completedOrders:
 *                           type: number
 *                         successRate:
 *                           type: number
 *                         averageOrderValue:
 *                           type: number
 *                     statusBreakdown:
 *                       type: object
 *                     tokenBreakdown:
 *                       type: object
 *                     networkBreakdown:
 *                       type: object
 *                     timeSeriesData:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.get('/stats', businessOnrampController.getBusinessStats);

/**
 * @swagger
 * /api/v1/business-onramp/webhook/monnify:
 *   post:
 *     summary: Handle Monnify payment webhooks (Internal)
 *     description: Internal endpoint to handle payment notifications from Monnify
 *     tags: [Business Onramp API]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentReference:
 *                 type: string
 *               paymentStatus:
 *                 type: string
 *               paidAmount:
 *                 type: number
 *               transactionReference:
 *                 type: string
 *               customerEmail:
 *                 type: string
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook data
 */
router.post('/webhook/monnify', businessOnrampController.handleMonnifyWebhook);

module.exports = router;