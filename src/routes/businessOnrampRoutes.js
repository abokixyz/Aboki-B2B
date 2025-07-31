/**
 * Complete Business Onramp Routes with Universal Token Support
 * Supports original, enhanced, and universal token controllers
 * Works with any token configured in business settings
 */

const express = require('express');
const router = express.Router();
const { authenticateApiKey, validateBusinessOnrampRequest, apiRateLimit } = require('../middleware/apiAuth');

// Enhanced controller toggle with universal token support
const USE_ENHANCED = process.env.USE_ENHANCED_ONRAMP === 'true';
const USE_UNIVERSAL = process.env.USE_UNIVERSAL_TOKENS === 'true';

console.log(`[ROUTES] Using ${USE_UNIVERSAL ? 'UNIVERSAL' : USE_ENHANCED ? 'ENHANCED' : 'ORIGINAL'} onramp controller`);

// Controller selection with universal token support
let businessOnrampController;

if (USE_UNIVERSAL) {
    // Use the new universal token controller
    businessOnrampController = require('../controllers/genericTokenOnrampController');
    console.log('[ROUTES] ✅ Universal token controller loaded - supports any configured token');
} else if (USE_ENHANCED) {
    businessOnrampController = require('../controllers/enhancedBusinessOnrampController');
    console.log('[ROUTES] ✅ Enhanced controller loaded');
} else {
    businessOnrampController = require('../controllers/businessOnrampController');
    console.log('[ROUTES] ✅ Original controller loaded');
}

// Create different middleware chains based on security requirements
const readOnlyAuth = [authenticateApiKey, apiRateLimit]; // API key only
const fullAuth = [authenticateApiKey, validateBusinessOnrampRequest, apiRateLimit]; // Both keys

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
 *           example: "ENB"
 *           description: "Token symbol that customer wants to receive (e.g., ENB, USDC, ETH)"
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
 *           example: "Onramp order created successfully for ENB"
 *         data:
 *           type: object
 *           properties:
 *             orderId:
 *               type: string
 *               example: "OR_1234567890_ABCDEF"
 *             businessOrderReference:
 *               type: string
 *               example: "ONRAMP-ENB-UUID123"
 *             amount:
 *               type: number
 *               example: 50000
 *             targetToken:
 *               type: string
 *               example: "ENB"
 *             targetNetwork:
 *               type: string
 *               example: "base"
 *             estimatedTokenAmount:
 *               type: number
 *               example: 125.5
 *             exchangeRate:
 *               type: number
 *               example: 398.01
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
 *             validation:
 *               type: object
 *               description: "Available when using universal/enhanced controller"
 *               properties:
 *                 tokenValidated:
 *                   type: boolean
 *                   example: true
 *                 validationReason:
 *                   type: string
 *                   example: "FULLY_VALIDATED"
 *                 pricingMethod:
 *                   type: string
 *                   example: "smart_contract_dex"
 *             smartContractData:
 *               type: object
 *               description: "Available for Base network tokens"
 *               properties:
 *                 usdcValue:
 *                   type: number
 *                   example: 125.5
 *                   description: "Token value in USDC"
 *                 pricePerTokenUsdc:
 *                   type: number
 *                   example: 1.004
 *                   description: "Price per token in USDC"
 *                 bestRoute:
 *                   type: string
 *                   example: "V3 Direct (0.3% fee)"
 *                   description: "Best DEX route found"
 *                 reserveSupported:
 *                   type: boolean
 *                   example: true
 *                 liquidityAdequate:
 *                   type: boolean
 *                   example: true
 *                 swapRoute:
 *                   type: object
 *                   properties:
 *                     inputToken:
 *                       type: string
 *                     outputToken:
 *                       type: string
 *                     expectedUsdcOut:
 *                       type: number
 *             tokenInfo:
 *               type: object
 *               properties:
 *                 symbol:
 *                   type: string
 *                 address:
 *                   type: string
 *                 network:
 *                   type: string
 *                 decimals:
 *                   type: number
 */

/**
 * @swagger
 * tags:
 *   - name: Business Onramp API
 *     description: Universal API endpoints for business integration - supports any configured token
 */

// ================== CORE ONRAMP ROUTES ==================
/**
 * @swagger
 * /api/v1/business-onramp/supported-tokens:
 *   get:
 *     summary: Get supported tokens for business onramp
 *     description: Retrieve all tokens supported by the business for onramp orders with current fees and validation status. Universal controller shows real-time validation status.
 *     tags: [Business Onramp API]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: validateAll
 *         schema:
 *           type: boolean
 *           default: false
 *         description: "Perform real-time validation on all tokens (universal controller only)"
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
 *                                 example: "ENB"
 *                               name:
 *                                 type: string
 *                                 example: "ENB Token"
 *                               contractAddress:
 *                                 type: string
 *                                 example: "0x..."
 *                               decimals:
 *                                 type: number
 *                                 example: 18
 *                               feePercentage:
 *                                 type: number
 *                                 example: 1.5
 *                               supportLevel:
 *                                 type: string
 *                                 enum: [fully_supported, partially_supported, not_supported]
 *                                 description: "Universal controller only"
 *                               validation:
 *                                 type: object
 *                                 description: "Universal controller only"
 *                                 properties:
 *                                   contractSupported:
 *                                     type: boolean
 *                                   hasLiquidity:
 *                                     type: boolean
 *                                   canProcessOnramp:
 *                                     type: boolean
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
 *                         totalTokens:
 *                           type: number
 *                         fullySupported:
 *                           type: number
 *                           description: "Universal controller only"
 *                         partiallySupported:
 *                           type: number
 *                           description: "Universal controller only"
 *                         notSupported:
 *                           type: number
 *                           description: "Universal controller only"
 *                     businessInfo:
 *                       type: object
 *                       properties:
 *                         businessId:
 *                           type: string
 *                         businessName:
 *                           type: string
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: "Universal controller only"
 *       401:
 *         description: Invalid API key
 */
router.get('/supported-tokens', readOnlyAuth, async (req, res) => {
    try {
        if (USE_UNIVERSAL && businessOnrampController.getSupportedTokensWithValidation) {
            // Use enhanced method that includes validation status
            return businessOnrampController.getSupportedTokensWithValidation(req, res);
        } else {
            // Use standard method
            return businessOnrampController.getSupportedTokens(req, res);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get supported tokens',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/v1/business-onramp/quote:
 *   post:
 *     summary: Get price quote for any supported token
 *     description: Get a detailed price quote for converting NGN to specified token. Universal version validates token support and provides detailed routing information.
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
 *                 example: "ENB"
 *                 description: "Any token symbol configured for your business"
 *               targetNetwork:
 *                 type: string
 *                 enum: [base, solana, ethereum]
 *                 example: "base"
 *           examples:
 *             enbToken:
 *               summary: ENB Token Quote
 *               value:
 *                 amount: 50000
 *                 targetToken: "ENB"
 *                 targetNetwork: "base"
 *             usdcToken:
 *               summary: USDC Token Quote
 *               value:
 *                 amount: 100000
 *                 targetToken: "USDC"
 *                 targetNetwork: "base"
 *             solanaToken:
 *               summary: Solana Token Quote
 *               value:
 *                 amount: 75000
 *                 targetToken: "SOL"
 *                 targetNetwork: "solana"
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
 *                 message:
 *                   type: string
 *                   example: "Quote generated successfully for ENB"
 *                 data:
 *                   type: object
 *                   properties:
 *                     amount:
 *                       type: number
 *                       example: 50000
 *                     targetToken:
 *                       type: string
 *                       example: "ENB"
 *                     targetNetwork:
 *                       type: string
 *                       example: "base"
 *                     exchangeRate:
 *                       type: number
 *                       example: 398.01
 *                       description: "1 ENB = ₦398.01"
 *                     tokenAmount:
 *                       type: number
 *                       example: 125.62
 *                       description: "Total tokens for gross amount"
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
 *                       example: 123.74
 *                       description: "Actual tokens customer receives after fees"
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
 *                           example: "123.74 ENB"
 *                     tokenInfo:
 *                       type: object
 *                       description: "Universal controller only"
 *                       properties:
 *                         symbol:
 *                           type: string
 *                         address:
 *                           type: string
 *                         network:
 *                           type: string
 *                         decimals:
 *                           type: number
 *                     pricingInfo:
 *                       type: object
 *                       properties:
 *                         source:
 *                           type: string
 *                           enum: [smart_contract_dex, internal_api]
 *                           example: "smart_contract_dex"
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *                         exchangeRateString:
 *                           type: string
 *                           example: "1 ENB = ₦398.01"
 *                         usdcRateString:
 *                           type: string
 *                           example: "1 ENB = $0.241 USDC"
 *                           description: "Universal controller only"
 *                     smartContractData:
 *                       type: object
 *                       description: "Available for Base network tokens with universal controller"
 *                       properties:
 *                         usdcValue:
 *                           type: number
 *                           example: 30.25
 *                         pricePerTokenUsdc:
 *                           type: number
 *                           example: 0.241
 *                         bestRoute:
 *                           type: string
 *                           example: "V3 Direct (0.3% fee)"
 *                         swapRoute:
 *                           type: object
 *                           properties:
 *                             inputToken:
 *                               type: string
 *                             outputToken:
 *                               type: string
 *                             expectedUsdcOut:
 *                               type: number
 *                             slippageTolerance:
 *                               type: number
 *                     validation:
 *                       type: object
 *                       description: "Universal controller only"
 *                       properties:
 *                         tokenValidated:
 *                           type: boolean
 *                         validationReason:
 *                           type: string
 *                         pricingMethod:
 *                           type: string
 *                     validFor:
 *                       type: number
 *                       example: 300
 *                       description: "Quote valid for X seconds"
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid request or token validation failed
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
 *                   example: "Token ENB is not supported by the smart contract reserve"
 *                 details:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     network:
 *                       type: string
 *                     step:
 *                       type: string
 *                       example: "quote_validation"
 *                 code:
 *                   type: string
 *                   example: "QUOTE_VALIDATION_FAILED"
 *       401:
 *         description: Invalid API key
 *       403:
 *         description: Token not configured for business
 *       500:
 *         description: Internal server error
 */
router.post('/quote', readOnlyAuth, businessOnrampController.getQuote);

/**
 * @swagger
 * /api/v1/business-onramp/create:
 *   post:
 *     summary: Create onramp order for any supported token
 *     description: Create a new onramp order for any token configured in your business. Universal controller automatically validates token support, checks smart contract compatibility, and initializes transactions.
 *     tags: [Business Onramp API]
 *     security:
 *       - ApiKeyAuth: []
 *         SecretKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BusinessOnrampRequest'
 *           examples:
 *             enbOrder:
 *               summary: Create ENB Order
 *               value:
 *                 customerEmail: "customer@example.com"
 *                 customerName: "John Doe"
 *                 customerPhone: "+234-123-456-7890"
 *                 amount: 50000
 *                 targetToken: "ENB"
 *                 targetNetwork: "base"
 *                 customerWallet: "0x742d35Cc6634C0532925a3b8D1D8ce28D2e67F5c"
 *                 redirectUrl: "https://yourdomain.com/payment/success"
 *                 webhookUrl: "https://yourdomain.com/webhooks/onramp"
 *                 metadata:
 *                   userId: "user_123"
 *                   source: "mobile_app"
 *             usdcOrder:
 *               summary: Create USDC Order
 *               value:
 *                 customerEmail: "customer@example.com"
 *                 customerName: "Jane Smith"
 *                 amount: 100000
 *                 targetToken: "USDC"
 *                 targetNetwork: "base"
 *                 customerWallet: "0x742d35Cc6634C0532925a3b8D1D8ce28D2e67F5c"
 *     responses:
 *       201:
 *         description: Onramp order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessOnrampResponse'
 *       400:
 *         description: Invalid request parameters or token validation failed
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
 *                   example: "Token ENB is not supported by the smart contract reserve. Please contact support to add this token."
 *                 details:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: "ENB"
 *                     network:
 *                       type: string
 *                       example: "base"
 *                     step:
 *                       type: string
 *                       example: "token_validation"
 *                 code:
 *                   type: string
 *                   example: "TOKEN_VALIDATION_FAILED"
 *             examples:
 *               tokenNotConfigured:
 *                 summary: Token not configured for business
 *                 value:
 *                   success: false
 *                   message: "Token XYZ is not configured in your business supported tokens"
 *                   details:
 *                     token: "XYZ"
 *                     network: "base"
 *                     step: "token_validation"
 *                   code: "TOKEN_VALIDATION_FAILED"
 *               contractNotSupported:
 *                 summary: Token not supported by smart contract
 *                 value:
 *                   success: false
 *                   message: "Token ENB is not supported by the smart contract reserve. Please contact support to add this token."
 *                   details:
 *                     token: "ENB"
 *                     network: "base"
 *                     step: "token_validation"
 *                   code: "TOKEN_VALIDATION_FAILED"
 *               insufficientLiquidity:
 *                 summary: Token has insufficient liquidity
 *                 value:
 *                   success: false
 *                   message: "Insufficient liquidity for ENB. Current liquidity: $45.23 USDC"
 *                   details:
 *                     token: "ENB"
 *                     network: "base"
 *                     step: "token_validation"
 *                   code: "TOKEN_VALIDATION_FAILED"
 *       401:
 *         description: Invalid API credentials
 *       500:
 *         description: Internal server error
 */
router.post('/create', fullAuth, businessOnrampController.createOnrampOrder);

// ================== ORDER MANAGEMENT ROUTES ==================

/**
 * @swagger
 * /api/v1/business-onramp/orders/{orderId}:
 *   get:
 *     summary: Get onramp order details by ID
 *     description: Retrieve complete details of a specific onramp order including current status and transaction information
 *     tags: [Business Onramp API]
 *     security:
 *       - ApiKeyAuth: []
 *         SecretKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Business onramp order ID or business order reference
 *         example: "OR_1234567890_ABCDEF"
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
 *                   type: object
 *                   properties:
 *                     orderId:
 *                       type: string
 *                     businessOrderReference:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [initiated, pending, processing, completed, failed, cancelled, expired]
 *                     amount:
 *                       type: number
 *                     targetToken:
 *                       type: string
 *                     targetNetwork:
 *                       type: string
 *                     estimatedTokenAmount:
 *                       type: number
 *                     actualTokenAmount:
 *                       type: number
 *                     customerEmail:
 *                       type: string
 *                     customerWallet:
 *                       type: string
 *                     exchangeRate:
 *                       type: number
 *                     feeAmount:
 *                       type: number
 *                     transactionHash:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                     completedAt:
 *                       type: string
 *                       format: date-time
 *                     metadata:
 *                       type: object
 *                     validation:
 *                       type: object
 *                       description: "Universal controller only"
 *                       properties:
 *                         tokenValidated:
 *                           type: boolean
 *                         validationReason:
 *                           type: string
 *                         contractSupported:
 *                           type: boolean
 *                     pricingInfo:
 *                       type: object
 *                       description: "Universal controller only"
 *                       properties:
 *                         source:
 *                           type: string
 *                         smartContractData:
 *                           type: object
 *       404:
 *         description: Order not found
 *       401:
 *         description: Invalid API credentials
 */
router.get('/orders/:orderId', fullAuth, businessOnrampController.getOrderById);

/**
 * @swagger
 * /api/v1/business-onramp/orders:
 *   get:
 *     summary: Get all onramp orders for business
 *     description: Retrieve all onramp orders created by this business with optional filtering and pagination
 *     tags: [Business Onramp API]
 *     security:
 *       - ApiKeyAuth: []
 *         SecretKeyAuth: []
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
 *         description: Filter by target token (e.g., ENB, USDC, ETH)
 *         example: "ENB"
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
description: Sort order
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
 *                         type: object
 *                         properties:
 *                           orderId:
 *                             type: string
 *                           businessOrderReference:
 *                             type: string
 *                           status:
 *                             type: string
 *                           amount:
 *                             type: number
 *                           targetToken:
 *                             type: string
 *                           targetNetwork:
 *                             type: string
 *                           estimatedTokenAmount:
 *                             type: number
 *                           actualTokenAmount:
 *                             type: number
 *                           customerEmail:
 *                             type: string
 *                           customerWallet:
 *                             type: string
 *                           feeAmount:
 *                             type: number
 *                           transactionHash:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           completedAt:
 *                             type: string
 *                             format: date-time
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
 *       401:
 *         description: Invalid API credentials
 */
router.get('/orders', fullAuth, businessOnrampController.getAllOrders);

/**
 * @swagger
 * /api/v1/business-onramp/stats:
 *   get:
 *     summary: Get business onramp statistics
 *     description: Retrieve comprehensive statistics about business onramp orders and performance across all supported tokens
 *     tags: [Business Onramp API]
 *     security:
 *       - ApiKeyAuth: []
 *         SecretKeyAuth: []
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
 *                     timeframe:
 *                       type: string
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
 *                         smartContractUsageRate:
 *                           type: number
 *                           description: "Universal controller only"
 *                     statusBreakdown:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           count:
 *                             type: number
 *                           totalAmount:
 *                             type: number
 *                     tokenBreakdown:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           count:
 *                             type: number
 *                           totalAmount:
 *                             type: number
 *                           totalTokenAmount:
 *                             type: number
 *                     networkBreakdown:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           count:
 *                             type: number
 *                           totalAmount:
 *                             type: number
 *                     pricingSourceBreakdown:
 *                       type: object
 *                       description: "Universal controller only"
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           count:
 *                             type: number
 *                           totalAmount:
 *                             type: number
 *                     timeSeriesData:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           orders:
 *                             type: number
 *                           amount:
 *                             type: number
 *                           fees:
 *                             type: number
 *                           completed:
 *                             type: number
 *       401:
 *         description: Invalid API credentials
 */
router.get('/stats', fullAuth, businessOnrampController.getBusinessStats);

// ================== WEBHOOK ROUTES ==================

/**
 * @swagger
 * /api/v1/business-onramp/webhook/monnify:
 *   post:
 *     summary: Handle Monnify payment webhooks (Internal)
 *     description: Internal endpoint to handle payment notifications from Monnify. This endpoint does not require API keys as it uses webhook signature verification.
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
 *                 example: "ONRAMP-ENB-UUID123"
 *               paymentStatus:
 *                 type: string
 *                 enum: [PAID, FAILED, PENDING]
 *                 example: "PAID"
 *               paidAmount:
 *                 type: number
 *                 example: 50000
 *               transactionReference:
 *                 type: string
 *                 example: "MONNIFY_TXN_123456"
 *               customerEmail:
 *                 type: string
 *                 example: "customer@example.com"
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Payment processed and settlement initiated"
 *                 orderStatus:
 *                   type: string
 *                   example: "processing"
 *       400:
 *         description: Invalid webhook data or payment verification failed
 *       404:
 *         description: Order not found
 */
router.post('/webhook/monnify', businessOnrampController.handleMonnifyWebhook);

// ================== UNIVERSAL TOKEN ROUTES (New Features) ==================

if (USE_UNIVERSAL) {
    /**
     * @swagger
     * /api/v1/business-onramp/check-support:
     *   post:
     *     summary: Check if a specific token is supported for onramp
     *     description: Validate if a token is properly configured and can be used for onramp orders. Performs comprehensive validation including business config, smart contract support, and liquidity checks.
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
     *               - targetToken
     *               - targetNetwork
     *             properties:
     *               targetToken:
     *                 type: string
     *                 example: "ENB"
     *                 description: "Token symbol to check"
     *               targetNetwork:
     *                 type: string
     *                 enum: [base, solana, ethereum]
     *                 example: "base"
     *                 description: "Network to check on"
     *           examples:
     *             checkENB:
     *               summary: Check ENB Token Support
     *               value:
     *                 targetToken: "ENB"
     *                 targetNetwork: "base"
     *             checkUSDC:
     *               summary: Check USDC Token Support
     *               value:
     *                 targetToken: "USDC"
     *                 targetNetwork: "base"
     *             checkSOL:
     *               summary: Check Solana Token Support
     *               value:
     *                 targetToken: "SOL"
     *                 targetNetwork: "solana"
     *     responses:
     *       200:
     *         description: Token support check completed
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *                 message:
     *                   type: string
     *                   example: "ENB is ready for onramp orders"
     *                 data:
     *                   type: object
     *                   properties:
     *                     token:
     *                       type: string
     *                       example: "ENB"
     *                     network:
     *                       type: string
     *                       example: "base"
     *                     checks:
     *                       type: array
     *                       items:
     *                         type: object
     *                         properties:
     *                           name:
     *                             type: string
     *                             example: "Business Configuration"
     *                           status:
     *                             type: string
     *                             enum: [passed, failed, error]
     *                             example: "passed"
     *                           result:
     *                             type: object
     *                           error:
     *                             type: string
     *                       example:
     *                         - name: "Business Configuration"
     *                           status: "passed"
     *                           result:
     *                             configured: true
     *                             tokenInfo:
     *                               symbol: "ENB"
     *                               contractAddress: "0x..."
     *                         - name: "Smart Contract Support"
     *                           status: "passed"
     *                           result:
     *                             reserveSupported: true
     *                         - name: "Liquidity and Pricing"
     *                           status: "passed"
     *                           result:
     *                             hasLiquidity: true
     *                             usdcValue: 125.5
     *                             bestRoute: "V3 Direct (0.3% fee)"
     *                     summary:
     *                       type: object
     *                       properties:
     *                         overallStatus:
     *                           type: string
     *                           enum: [fully_supported, partially_supported, not_supported]
     *                           example: "fully_supported"
     *                         canProcessOnramp:
     *                           type: boolean
     *                           example: true
     *                         totalChecks:
     *                           type: number
     *                           example: 4
     *                         passedChecks:
     *                           type: number
     *                           example: 4
     *                     recommendation:
     *                       type: string
     *                       example: "ENB is ready for onramp orders"
     *             examples:
     *               tokenSupported:
     *                 summary: Token is fully supported
     *                 value:
     *                   success: true
     *                   message: "ENB is ready for onramp orders"
     *                   data:
     *                     summary:
     *                       overallStatus: "fully_supported"
     *                       canProcessOnramp: true
     *               tokenNotSupported:
     *                 summary: Token is not supported
     *                 value:
     *                   success: false
     *                   message: "ENB cannot be used for onramp - fix failing checks"
     *                   data:
     *                     summary:
     *                       overallStatus: "not_supported"
     *                       canProcessOnramp: false
     *       400:
     *         description: Token is not supported or validation failed
     *       401:
     *         description: Invalid API key
     */
    router.post('/check-support', readOnlyAuth, businessOnrampController.checkTokenSupport);

    /**
     * @swagger
     * /api/v1/business-onramp/test-token:
     *   post:
     *     summary: Test any token for onramp compatibility
     *     description: Comprehensive test of a token's compatibility with the onramp system. Runs all validation tests and provides detailed results with recommendations.
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
     *               - targetToken
     *               - targetNetwork
     *             properties:
     *               targetToken:
     *                 type: string
     *                 example: "ENB"
     *               targetNetwork:
     *                 type: string
     *                 enum: [base, solana, ethereum]
     *                 example: "base"
     *               testAmount:
     *                 type: number
     *                 default: 1
     *                 example: 1
     *                 description: "Amount to test pricing with"
     *           examples:
     *             testENB:
     *               summary: Test ENB Token
     *               value:
     *                 targetToken: "ENB"
     *                 targetNetwork: "base"
     *                 testAmount: 1
     *             testCustomToken:
     *               summary: Test Custom Token
     *               value:
     *                 targetToken: "CUSTOM"
     *                 targetNetwork: "base"
     *                 testAmount: 5
     *     responses:
     *       200:
     *         description: Token test completed
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *                 message:
     *                   type: string
     *                   example: "ENB is fully compatible with onramp system"
     *                 data:
     *                   type: object
     *                   properties:
     *                     input:
     *                       type: object
     *                       properties:
     *                         token:
     *                           type: string
     *                         network:
     *                           type: string
     *                         testAmount:
     *                           type: number
     *                     tests:
     *                       type: array
     *                       items:
     *                         type: object
     *                         properties:
     *                           name:
     *                             type: string
     *                           status:
     *                             type: string
     *                             enum: [passed, failed, error]
     *                           result:
     *                             type: object
     *                           error:
     *                             type: string
     *                       example:
     *                         - name: "Business Configuration Check"
     *                           status: "passed"
     *                           result:
     *                             configured: true
     *                             tokenInfo:
     *                               symbol: "ENB"
     *                               contractAddress: "0x..."
     *                         - name: "Price and Validation Check"
     *                           status: "passed"
     *                           result:
     *                             pricingSuccessful: true
     *                             unitPriceInNgn: 398.01
     *                             source: "smart_contract_dex"
     *                         - name: "Fee Calculation"
     *                           status: "passed"
     *                           result:
     *                             feeCalculationWorking: true
     *                             feePercentage: 1.5
     *                     summary:
     *                       type: object
     *                       properties:
     *                         totalTests:
     *                           type: number
     *                         passedTests:
     *                           type: number
     *                         overallStatus:
     *                           type: string
     *                           enum: [passed, failed]
     *                         canProcessOnramp:
     *                           type: boolean
     *                     conclusion:
     *                       type: string
     *                     nextSteps:
     *                       type: array
     *                       items:
     *                         type: string
     *                       example:
     *                         - "Create quote: POST /api/v1/business-onramp/quote"
     *                         - "Create order: POST /api/v1/business-onramp/create"
     *       400:
     *         description: Token test failed
     *       401:
     *         description: Invalid API key
     */
    router.post('/test-token', readOnlyAuth, businessOnrampController.testToken);

    /**
     * @swagger
     * /api/v1/business-onramp/supported-tokens/validate:
     *   get:
     *     summary: Get all supported tokens with real-time validation status
     *     description: Retrieve all configured tokens with their current validation status, smart contract support, and liquidity information
     *     tags: [Business Onramp API]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: query
     *         name: validateAll
     *         schema:
     *           type: boolean
     *           default: false
     *         description: "Perform full validation on all tokens (may take longer)"
     *     responses:
     *       200:
     *         description: Tokens retrieved with validation status
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *                 message:
     *                   type: string
     *                   example: "Found 12 configured tokens"
     *                 data:
     *                   type: object
     *                   properties:
     *                     business:
     *                       type: object
     *                       properties:
     *                         businessId:
     *                           type: string
     *                         name:
     *                           type: string
     *                     networks:
     *                       type: object
     *                       properties:
     *                         base:
     *                           type: object
     *                           properties:
     *                             totalTokens:
     *                               type: number
     *                             tokens:
     *                               type: array
     *                               items:
     *                                 type: object
     *                                 properties:
     *                                   symbol:
     *                                     type: string
     *                                   name:
     *                                     type: string
     *                                   contractAddress:
     *                                     type: string
     *                                   supportLevel:
     *                                     type: string
     *                                     enum: [fully_supported, partially_supported, not_supported, not_validated]
     *                                   validation:
     *                                     type: object
     *                                     properties:
     *                                       businessSupported:
     *                                         type: boolean
     *                                       contractSupported:
     *                                         type: boolean
     *                                       hasLiquidity:
     *                                         type: boolean
     *                                       canProcessOnramp:
     *                                         type: boolean
     *                                   priceInfo:
     *                                     type: object
     *                                     properties:
     *                                       usdcValue:
     *                                         type: number
     *                                       pricePerToken:
     *                                         type: number
     *                                       bestRoute:
     *                                         type: string
     *                         solana:
     *                           type: object
     *                         ethereum:
     *                           type: object
     *                     summary:
     *                       type: object
     *                       properties:
     *                         totalTokens:
     *                           type: number
     *                         fullySupported:
     *                           type: number
     *                         partiallySupported:
     *                           type: number
     *                         notSupported:
     *                           type: number
     *                     recommendations:
     *                       type: array
     *                       items:
     *                         type: string
     *                       example:
     *                         - "2 tokens are not fully supported - check smart contract configuration"
     *                         - "1 token has limited liquidity - consider adding DEX liquidity"
     */
    router.get('/supported-tokens/validate', readOnlyAuth, businessOnrampController.getSupportedTokensWithValidation);

    /**
     * @swagger
     * /api/v1/business-onramp/debug/token/{tokenSymbol}:
     *   get:
     *     summary: Debug specific token configuration and compatibility
     *     description: Comprehensive debugging for a specific token to identify configuration issues and provide solutions
     *     tags: [Business Onramp API]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: tokenSymbol
     *         required: true
     *         schema:
     *           type: string
     *         example: "ENB"
     *         description: "Token symbol to debug"
     *       - in: query
     *         name: network
     *         schema:
     *           type: string
     *           enum: [base, solana, ethereum]
     *           default: "base"
     *         description: "Network to debug on"
     *     responses:
     *       200:
     *         description: Debug information retrieved
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 message:
     *                   type: string
     *                 data:
     *                   type: object
     *                   properties:
     *                     debugSteps:
     *                       type: array
     *                       items:
     *                         type: object
     *                         properties:
     *                           step:
     *                             type: number
     *                           name:
     *                             type: string
     *                           status:
     *                             type: string
     *                           result:
     *                             type: string
     *                           error:
     *                             type: string
     *                     recommendations:
     *                       type: array
     *                       items:
     *                         type: string
     *                     overallStatus:
     *                       type: string
     */
    router.get('/debug/token/:tokenSymbol', readOnlyAuth, async (req, res) => {
        try {
            const { tokenSymbol } = req.params;
            const { network = 'base' } = req.query;
            
            // Use the check support functionality with detailed debugging
            const mockReq = {
                ...req,
                body: { targetToken: tokenSymbol, targetNetwork: network }
            };
            
            return businessOnrampController.checkTokenSupport(mockReq, res);
            
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Token debug failed',
                error: error.message
            });
        }
    });
}

// ================== HEALTH CHECK ROUTES ==================

/**
 * @swagger
 * /api/v1/business-onramp/health:
 *   get:
 *     summary: Comprehensive health check
 *     description: Check health of the entire onramp system including smart contracts, APIs, and payment services. Universal controller provides detailed service status.
 *     tags: [Business Onramp API]
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Onramp system is healthy"
 *                 data:
 *                   type: object
 *                   properties:
 *                     version:
 *                       type: string
 *                       example: "universal-v1.0"
 *                     controllerType:
 *                       type: string
 *                       example: "universal"
 *                     overallStatus:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                     services:
 *                       type: object
 *                       description: "Universal controller only"
 *                       properties:
 *                         smartContract:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               enum: [healthy, unhealthy]
 *                             details:
 *                               type: object
 *                               properties:
 *                                 connected:
 *                                   type: boolean
 *                                 contractAddress:
 *                                   type: string
 *                                 rpcUrl:
 *                                   type: string
 *                         internalApi:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                             details:
 *                               type: object
 *                         paymentService:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                             details:
 *                               type: object
 *                     capabilities:
 *                       type: object
 *                       properties:
 *                         baseTokenSupport:
 *                           type: boolean
 *                         fallbackPricing:
 *                           type: boolean
 *                         paymentProcessing:
 *                           type: boolean
 *                         universalTokenSupport:
 *                           type: boolean
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       207:
 *         description: System is degraded (some services unhealthy)
 *       503:
 *         description: System is unhealthy
 */
router.get('/health', async (req, res) => {
    try {
        if (USE_UNIVERSAL && businessOnrampController.healthCheck) {
            // Use comprehensive health check from universal controller
            return businessOnrampController.healthCheck(req, res);
        } else {
            // Basic health check for other controllers
            res.json({
                success: true,
                message: 'Business onramp service is operational',
                data: {
                    version: USE_UNIVERSAL ? 'universal' : USE_ENHANCED ? 'enhanced' : 'original',
                    controllerType: USE_UNIVERSAL ? 'universal' : USE_ENHANCED ? 'enhanced' : 'original',
                    timestamp: new Date().toISOString(),
                    environment: process.env.NODE_ENV || 'development',
                    capabilities: {
                        universalTokenSupport: USE_UNIVERSAL,
                        enhancedValidation: USE_ENHANCED || USE_UNIVERSAL,
                        smartContractIntegration: USE_ENHANCED || USE_UNIVERSAL
                    }
                }
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Service health check failed',
            error: error.message
        });
    }
});

// Enhanced health check for enhanced/universal controllers
if (USE_ENHANCED || USE_UNIVERSAL) {
    /**
     * @swagger
     * /api/v1/business-onramp/health/detailed:
     *   get:
     *     summary: Detailed health check with smart contract validation
     *     description: Comprehensive health check including smart contract connectivity, reserve validation, and service dependencies
     *     tags: [Business Onramp API]
     *     responses:
     *       200:
     *         description: Detailed health information
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *                 message:
     *                   type: string
     *                   example: "Enhanced onramp system is healthy"
     *                 data:
     *                   type: object
     *                   properties:
     *                     version:
     *                       type: string
     *                       example: "universal"
     *                     overallStatus:
     *                       type: string
     *                       enum: [healthy, unhealthy]
     *                     services:
     *                       type: object
     *                       properties:
     *                         smartContract:
     *                           type: object
     *                           properties:
     *                             status:
     *                               type: string
     *                             details:
     *                               type: object
     *                               properties:
     *                                 connected:
     *                                   type: boolean
     *                                 configuration:
     *                                   type: object
     *                                 contractAddress:
     *                                   type: string
     *                                 rpcUrl:
     *                                   type: string
     *                         internalApi:
     *                           type: object
     *                           properties:
     *                             status:
     *                               type: string
     *                             details:
     *                               type: object
     *                               properties:
     *                                 baseUrl:
     *                                   type: string
     *                                 responseStatus:
     *                                   type: number
     *                     capabilities:
     *                       type: object
     *                       properties:
     *                         smartContractValidation:
     *                           type: boolean
     *                         fallbackPricing:
 *                           type: boolean
 *                         universalTokenSupport:
 *                           type: boolean
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       503:
 *         description: System is unhealthy
 */
    router.get('/health/detailed', async (req, res) => {
        try {
            // Test smart contract connection
            const { OnrampPriceChecker } = require('../services/onrampPriceChecker');
            const checker = new OnrampPriceChecker();
            
            const contractHealth = {
                status: 'checking',
                details: {}
            };
            
            try {
                const isConnected = await checker.validateConnection();
                const config = await checker.getContractConfiguration();
                
                contractHealth.status = isConnected ? 'healthy' : 'unhealthy';
                contractHealth.details = {
                    connected: isConnected,
                    configuration: config,
                    contractAddress: process.env.ABOKI_V2_CONTRACT || 'Not configured',
                    rpcUrl: process.env.BASE_RPC_URL || 'Not configured'
                };
            } catch (error) {
                contractHealth.status = 'unhealthy';
                contractHealth.error = error.message;
            }
            
            // Test internal API
            const apiHealth = {
                status: 'checking',
                details: {}
            };
            
            try {
                const axios = require('axios');
                const baseUrl = process.env.INTERNAL_API_BASE_URL || 'http://localhost:5002';
                const response = await axios.get(`${baseUrl}/api/v1/health`, { timeout: 5000 });
                
                apiHealth.status = response.status === 200 ? 'healthy' : 'unhealthy';
                apiHealth.details = {
                    baseUrl: baseUrl,
                    responseStatus: response.status
                };
            } catch (error) {
                apiHealth.status = 'unhealthy';
                apiHealth.error = error.message;
            }
            
            const overallHealthy = contractHealth.status === 'healthy' || apiHealth.status === 'healthy';
            
            res.status(overallHealthy ? 200 : 503).json({
                success: overallHealthy,
                message: overallHealthy ? 'Enhanced onramp system is healthy' : 'Enhanced onramp system has issues',
                data: {
                    version: USE_UNIVERSAL ? 'universal' : 'enhanced',
                    overallStatus: overallHealthy ? 'healthy' : 'unhealthy',
                    services: {
                        smartContract: contractHealth,
                        internalApi: apiHealth
                    },
                    capabilities: {
                        smartContractValidation: contractHealth.status === 'healthy',
                        fallbackPricing: apiHealth.status === 'healthy',
                        universalTokenSupport: USE_UNIVERSAL
                    },
                    timestamp: new Date().toISOString()
                }
            });
            
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Detailed health check failed',
                error: error.message
            });
        }
    });
}

// ================== CONFIGURATION AND SYSTEM INFO ROUTES ==================

/**
 * @swagger
 * /api/v1/business-onramp/config:
 *   get:
 *     summary: Get current controller configuration and available features
 *     description: Returns information about which controller is active, available features, and system configuration
 *     tags: [Business Onramp API]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Configuration information
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
 *                     controllerType:
 *                       type: string
 *                       enum: [original, enhanced, universal]
 *                       example: "universal"
 *                     features:
 *                       type: object
 *                       properties:
 *                         universalTokenSupport:
 *                           type: boolean
 *                           example: true
 *                           description: "Can process any configured token"
 *                         smartContractValidation:
 *                           type: boolean
 *                           example: true
 *                           description: "Validates tokens against smart contract"
 *                         tokenTesting:
 *                           type: boolean
 *                           example: true
 *                           description: "Can test token compatibility"
 *                         detailedHealthChecks:
 *                           type: boolean
 *                           example: true
 *                           description: "Provides detailed system health info"
 *                         reserveValidation:
 *                           type: boolean
 *                           example: true
 *                           description: "Validates against reserve contract"
 *                     availableEndpoints:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example:
 *                         - "GET /supported-tokens"
 *                         - "POST /quote"
 *                         - "POST /create"
 *                         - "POST /check-support"
 *                         - "POST /test-token"
 *                         - "GET /health"
 *                     environmentVariables:
 *                       type: object
 *                       properties:
 *                         USE_ENHANCED_ONRAMP:
 *                           type: string
 *                         USE_UNIVERSAL_TOKENS:
 *                           type: string
 *                         ABOKI_V2_CONTRACT:
 *                           type: string
 *                         BASE_RPC_URL:
 *                           type: string
 */
router.get('/config', readOnlyAuth, (req, res) => {
    try {
        const config = {
            controllerType: USE_UNIVERSAL ? 'universal' : USE_ENHANCED ? 'enhanced' : 'original',
            features: {
                universalTokenSupport: USE_UNIVERSAL,
                smartContractValidation: USE_ENHANCED || USE_UNIVERSAL,
                tokenTesting: USE_UNIVERSAL,
                detailedHealthChecks: USE_ENHANCED || USE_UNIVERSAL,
                reserveValidation: USE_ENHANCED || USE_UNIVERSAL,
                fallbackPricing: true,
                webhookSupport: true,
                feeConfiguration: true
            },
            availableEndpoints: [
                'GET /supported-tokens',
                'POST /quote',
                'POST /create',
                'GET /orders/{orderId}',
                'GET /orders',
                'GET /stats',
                'POST /webhook/monnify',
                'GET /health',
                'GET /config'
            ]
        };
        
        if (USE_UNIVERSAL) {
            config.availableEndpoints.push(
                'POST /check-support',
                'POST /test-token',
                'GET /supported-tokens/validate',
                'GET /debug/token/{tokenSymbol}'
            );
        }
        
        if (USE_ENHANCED || USE_UNIVERSAL) {
            config.availableEndpoints.push('GET /health/detailed');
        }
        
        config.environmentVariables = {
            USE_ENHANCED_ONRAMP: process.env.USE_ENHANCED_ONRAMP || 'false',
            USE_UNIVERSAL_TOKENS: process.env.USE_UNIVERSAL_TOKENS || 'false',
            ABOKI_V2_CONTRACT: process.env.ABOKI_V2_CONTRACT ? 'Set' : 'Not set',
            BASE_RPC_URL: process.env.BASE_RPC_URL ? 'Set' : 'Not set',
            INTERNAL_API_BASE_URL: process.env.INTERNAL_API_BASE_URL ? 'Set' : 'Not set'
        };
        
        config.recommendations = [];
        
        if (!USE_UNIVERSAL && !USE_ENHANCED) {
            config.recommendations.push('Consider enabling USE_UNIVERSAL_TOKENS=true for better token support');
        }
        
        if (!process.env.ABOKI_V2_CONTRACT) {
            config.recommendations.push('Set ABOKI_V2_CONTRACT environment variable for smart contract features');
        }
        
        if (!process.env.BASE_RPC_URL) {
            config.recommendations.push('Set BASE_RPC_URL environment variable for Base network connectivity');
        }
        
        res.json({
            success: true,
            data: config
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get configuration',
            error: error.message
        });
    }
});

// ================== SYSTEM STATUS AND MONITORING ROUTES ==================

/**
 * @swagger
 * /api/v1/business-onramp/status:
 *   get:
 *     summary: Get real-time system status
 *     description: Quick status check for monitoring systems
 *     tags: [Business Onramp API]
 *     responses:
 *       200:
 *         description: System status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [operational, degraded, down]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                 uptime:
 *                   type: number
 */
router.get('/status', (req, res) => {
    try {
        res.json({
            status: 'operational',
            timestamp: new Date().toISOString(),
            version: USE_UNIVERSAL ? 'universal' : USE_ENHANCED ? 'enhanced' : 'original',
            uptime: process.uptime(),
            controllerType: USE_UNIVERSAL ? 'universal' : USE_ENHANCED ? 'enhanced' : 'original'
        });
    } catch (error) {
        res.status(500).json({
            status: 'down',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// ================== ERROR HANDLING MIDDLEWARE ==================

// Global error handler for this router
router.use((error, req, res, next) => {
    console.error(`[ONRAMP_ROUTES] Error on ${req.method} ${req.path}:`, error);
    
    // Don't handle if response already sent
    if (res.headersSent) {
        return next(error);
    }
    
    // Determine error type and status code
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    
    if (error.message.includes('not configured')) {
        statusCode = 400;
        errorCode = 'CONFIGURATION_ERROR';
        message = error.message;
    } else if (error.message.includes('not supported')) {
        statusCode = 400;
        errorCode = 'TOKEN_NOT_SUPPORTED';
        message = error.message;
    } else if (error.message.includes('validation failed')) {
        statusCode = 400;
        errorCode = 'VALIDATION_FAILED';
        message = error.message;
    } else if (error.message.includes('insufficient liquidity')) {
        statusCode = 400;
        errorCode = 'INSUFFICIENT_LIQUIDITY';
        message = error.message;
    }
    
    res.status(statusCode).json({
        success: false,
        message: message,
        code: errorCode,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

// ================== ROUTE DOCUMENTATION AND EXAMPLES ==================

/**
 * Usage Examples:
 * 
 * 1. Check if ENB token is supported:
 * curl -X POST 'http://localhost:5002/api/v1/business-onramp/check-support' \
 *   -H 'X-API-Key: YOUR_API_KEY' \
 *   -H 'Content-Type: application/json' \
 *   -d '{"targetToken": "ENB", "targetNetwork": "base"}'
 * 
 * 2. Test ENB token compatibility:
 * curl -X POST 'http://localhost:5002/api/v1/business-onramp/test-token' \
 *   -H 'X-API-Key: YOUR_API_KEY' \
 *   -H 'Content-Type: application/json' \
 *   -d '{"targetToken": "ENB", "targetNetwork": "base", "testAmount": 1}'
 * 
 * 3. Get quote for ENB:
 * curl -X POST 'http://localhost:5002/api/v1/business-onramp/quote' \
 *   -H 'X-API-Key: YOUR_API_KEY' \
 *   -H 'Content-Type: application/json' \
 *   -d '{"amount": 50000, "targetToken": "ENB", "targetNetwork": "base"}'
 * 
 * 4. Create ENB order:
 * curl -X POST 'http://localhost:5002/api/v1/business-onramp/create' \
 *   -H 'X-API-Key: YOUR_API_KEY' \
 *   -H 'X-Secret-Key: YOUR_SECRET_KEY' \
 *   -H 'Content-Type: application/json' \
 *   -d '{
 *     "customerEmail": "customer@example.com",
 *     "customerName": "John Doe",
 *     "amount": 50000,
 *     "targetToken": "ENB",
 *     "targetNetwork": "base",
 *     "customerWallet": "0x742d35Cc6634C0532925a3b8D1D8ce28D2e67F5c"
 *   }'
 * 
 * 5. Check system health:
 * curl -X GET 'http://localhost:5002/api/v1/business-onramp/health' \
 *   -H 'X-API-Key: YOUR_API_KEY'
 * 
 * 6. Get all supported tokens with validation:
 * curl -X GET 'http://localhost:5002/api/v1/business-onramp/supported-tokens/validate?validateAll=true' \
 *   -H 'X-API-Key: YOUR_API_KEY'
 * 
 * 7. Debug specific token (ENB):
 * curl -X GET 'http://localhost:5002/api/v1/business-onramp/debug/token/ENB?network=base' \
 *   -H 'X-API-Key: YOUR_API_KEY'
 * 
 * 8. Get system configuration:
 * curl -X GET 'http://localhost:5002/api/v1/business-onramp/config' \
 *   -H 'X-API-Key: YOUR_API_KEY'
 */

// ================== ROUTE EXPORTS AND SUMMARY ==================

/**
 * Route Summary:
 * 
 * Core Routes (Always Available):
 * - GET  /supported-tokens        - Get business supported tokens
 * - POST /quote                   - Get price quote for any token
 * - POST /create                  - Create onramp order (requires secret key)
 * - GET  /orders/:orderId         - Get specific order details (requires secret key)
 * - GET  /orders                  - Get all orders with filtering (requires secret key)
 * - GET  /stats                   - Get business statistics (requires secret key)
 * - POST /webhook/monnify         - Handle payment webhooks (internal)
 * - GET  /health                  - System health check
 * - GET  /status                  - Quick status check
 * - GET  /config                  - System configuration info
 * 
 * Universal Controller Routes (USE_UNIVERSAL_TOKENS=true):
 * - POST /check-support           - Check if token is supported
 * - POST /test-token              - Test token compatibility
 * - GET  /supported-tokens/validate - Get tokens with validation status
 * - GET  /debug/token/:symbol     - Debug specific token issues
 * 
 * Enhanced/Universal Controller Routes:
 * - GET  /health/detailed         - Detailed health check with smart contract info
 * 
 * Authentication Requirements:
 * - Read-only routes: X-API-Key only
 * - Transactional routes: X-API-Key + X-Secret-Key
 * - Webhook routes: No auth (signature verification)
 * - Health/config routes: X-API-Key only
 * 
 * Controller Toggle:
 * Set environment variables to choose controller:
 * - USE_UNIVERSAL_TOKENS=true  -> Universal controller (recommended)
 * - USE_ENHANCED_ONRAMP=true   -> Enhanced controller
 * - Both false                 -> Original controller
 * 
 * Universal Controller Benefits:
 * - Works with any token configured in business.supportedTokens
 * - Automatic smart contract validation for Base tokens
 * - Fallback to internal API for other networks
 * - Detailed error messages with specific solutions
 * - Comprehensive testing and debugging endpoints
 * - Real-time liquidity and pricing checks
 * - Transaction initialization for Base tokens
 */

console.log(`[ROUTES] Business Onramp Routes loaded successfully`);
console.log(`[ROUTES] Controller: ${USE_UNIVERSAL ? 'Universal' : USE_ENHANCED ? 'Enhanced' : 'Original'}`);
console.log(`[ROUTES] Available endpoints: ${router.stack.length}`);

if (USE_UNIVERSAL) {
    console.log(`[ROUTES] ✅ Universal token support enabled - any configured token can be processed`);
    console.log(`[ROUTES] ✅ Smart contract validation enabled for Base network tokens`);
    console.log(`[ROUTES] ✅ Debug and testing endpoints available`);
} else if (USE_ENHANCED) {
    console.log(`[ROUTES] ✅ Enhanced controller enabled with smart contract integration`);
} else {
    console.log(`[ROUTES] ℹ️  Original controller - consider enabling universal support`);
}

module.exports = router;

/**
 * Quick Start Guide:
 * 
 * 1. Set environment variables:
 *    USE_UNIVERSAL_TOKENS=true
 *    ABOKI_V2_CONTRACT=0x14157cA08Ed86531355f1DE8c918dE85CA6bCDa1
 *    BASE_RPC_URL=https://mainnet.base.org
 * 
 * 2. Create genericTokenOnrampController.js file
 * 
 * 3. Test configuration:
 *    GET /config
 * 
 * 4. Check system health:
 *    GET /health
 * 
 * 5. Test your tokens:
 *    POST /check-support
 *    POST /test-token
 * 
 * 6. Create orders:
 *    POST /create
 * 
 * This system will automatically:
 * - Validate tokens against your business configuration
 * - Check smart contract support for Base tokens
 * - Find best pricing routes
 * - Provide clear error messages
 * - Handle any token you configure
 */