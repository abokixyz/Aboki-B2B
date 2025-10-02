/**
 * UPDATED Complete Business Onramp Routes with Universal Token Support
 * Supports Base, Solana, and Ethereum networks with enhanced validation
 * Works with any token configured in business settings
 */

const express = require('express');
const router = express.Router();
const { authenticateApiKey, validateBusinessOnrampRequest, apiRateLimit } = require('../middleware/apiAuth');
const ensureDefaultTokens = require('../middleware/ensureDefaultTokens'); // ← ADD THIS LINE
// Enhanced controller toggle with universal token support
const USE_ENHANCED = process.env.USE_ENHANCED_ONRAMP === 'true';
const USE_UNIVERSAL = process.env.USE_UNIVERSAL_TOKENS === 'true';

console.log(`[ROUTES] Using ${USE_UNIVERSAL ? 'UNIVERSAL' : USE_ENHANCED ? 'ENHANCED' : 'ORIGINAL'} onramp controller`);

// Controller selection with universal token support
let businessOnrampController;

if (USE_UNIVERSAL) {
    // Use the new universal token controller
    businessOnrampController = require('../controllers/genericTokenOnrampController');
    console.log('[ROUTES] ✅ Universal token controller loaded - supports Base, Solana, and Ethereum networks');
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
 *           description: "Token symbol that customer wants to receive (e.g., ENB, USDC, ETH, SOL)"
 *         targetNetwork:
 *           type: string
 *           enum: [base, solana, ethereum]
 *           example: "base"
 *           description: "Network where the token exists"
 *         customerWallet:
 *           type: string
 *           example: "0x742d35Cc6634C0532925a3b8D1D8ce28D2e67F5c"
 *           description: "Customer's wallet address to receive tokens (Base/Ethereum address or Solana public key)"
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
 *             preferredRoute: "jupiter" # For Solana tokens
 */

/**
 * @swagger
 * tags:
 *   - name: Business Onramp API
 *     description: Universal API endpoints for business integration - supports Base, Solana, and Ethereum networks
 */

// ================== CORE ONRAMP ROUTES ==================
/**
 * @swagger
 * /api/v1/business-onramp/supported-tokens:
 *   get:
 *     summary: Get supported tokens for business onramp across all networks
 *     description: Retrieve all tokens supported by the business for onramp orders with current fees and validation status. Universal controller shows real-time validation status for Base and Solana networks.
 *     tags: [Business Onramp API]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: validateAll
 *         schema:
 *           type: boolean
 *           default: false
 *         description: "Perform real-time validation on all tokens across all networks (universal controller only)"
 *       - in: query
 *         name: network
 *         schema:
 *           type: string
 *           enum: [base, solana, ethereum, all]
 *           default: all
 *         description: "Filter tokens by specific network"
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
 *                               network:
 *                                 type: string
 *                                 example: "base"
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
 *                             properties:
 *                               symbol:
 *                                 type: string
 *                                 example: "SOL"
 *                               name:
 *                                 type: string
 *                                 example: "Solana"
 *                               contractAddress:
 *                                 type: string
 *                                 example: "11111111111111111111111111111112"
 *                               decimals:
 *                                 type: number
 *                                 example: 9
 *                               network:
 *                                 type: string
 *                                 example: "solana"
 *                               validation:
 *                                 type: object
 *                                 properties:
 *                                   jupiterSupported:
 *                                     type: boolean
 *                                   hasLiquidity:
 *                                     type: boolean
 *                                   canProcessOnramp:
 *                                     type: boolean
 *                         ethereum:
 *                           type: array
 *                           items:
 *                             type: object
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         totalTokens:
 *                           type: number
 *                         networks:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["base", "solana", "ethereum"]
 *                         baseTokens:
 *                           type: number
 *                         solanaTokens:
 *                           type: number
 *                         ethereumTokens:
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
 *     summary: Get price quote for any supported token across all networks
 *     description: Get a detailed price quote for converting NGN to specified token. Universal version validates token support and provides detailed routing information for Base (smart contracts), Solana (Jupiter), and Ethereum networks.
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
 *               summary: ENB Token Quote (Base)
 *               value:
 *                 amount: 50000
 *                 targetToken: "ENB"
 *                 targetNetwork: "base"
 *             solToken:
 *               summary: SOL Token Quote (Solana)
 *               value:
 *                 amount: 75000
 *                 targetToken: "SOL"
 *                 targetNetwork: "solana"
 *             ethToken:
 *               summary: ETH Token Quote (Base)
 *               value:
 *                 amount: 100000
 *                 targetToken: "ETH"
 *                 targetNetwork: "base"
 *             usdcBase:
 *               summary: USDC Token Quote (Base)
 *               value:
 *                 amount: 100000
 *                 targetToken: "USDC"
 *                 targetNetwork: "base"
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
 *                   example: "Quote generated successfully for ENB on base using current exchange rates"
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
 *                     actualNetwork:
 *                       type: string
 *                       example: "base"
 *                       description: "Actual network used for processing (may differ from requested)"
 *                     exchangeRate:
 *                       type: number
 *                       example: 398.01
 *                       description: "1 ENB = ₦398.01"
 *                     finalTokenAmount:
 *                       type: number
 *                       example: 123.74
 *                       description: "Actual tokens customer receives after fees"
 *                     smartContractData:
 *                       type: object
 *                       description: "Available for Base network tokens with universal controller"
 *                       properties:
 *                         usdcValue:
 *                           type: number
 *                           example: 30.25
 *                         bestRoute:
 *                           type: string
 *                           example: "V3 Direct (0.3% fee)"
 *                         reserveSupported:
 *                           type: boolean
 *                           example: true
 *                         liquidityAdequate:
 *                           type: boolean
 *                           example: true
 *                     jupiterData:
 *                       type: object
 *                       description: "Available for Solana network tokens with universal controller"
 *                       properties:
 *                         usdcValue:
 *                           type: number
 *                           example: 45.67
 *                         bestRoute:
 *                           type: string
 *                           example: "SOL → USDC via Orca"
 *                         priceImpact:
 *                           type: number
 *                           example: 0.12
 *                           description: "Price impact percentage"
 *                         jupiterSupported:
 *                           type: boolean
 *                           example: true
 *                         estimatedConfirmation:
 *                           type: string
 *                           example: "30-60 seconds"
 *                     pricingInfo:
 *                       type: object
 *                       properties:
 *                         source:
 *                           type: string
 *                           enum: [smart_contract_dex_with_current_rates, jupiter_dex_with_current_rates, internal_api]
 *                           example: "smart_contract_dex_with_current_rates"
 *                         currentUsdcRate:
 *                           type: string
 *                           example: "1 USDC = ₦1,720"
 *                         rateSource:
 *                           type: string
 *                           example: "onramp_api"
 *       400:
 *         description: Invalid request or token validation failed
 *         content:
 *           application/json:
 *             examples:
 *               unsupportedNetwork:
 *                 summary: Unsupported network specified
 *                 value:
 *                   success: false
 *                   message: "Unsupported network: polygon. Supported networks: base, solana, ethereum"
 *                   code: "UNSUPPORTED_NETWORK"
 *               solanaTokenNotFound:
 *                 summary: Token not found on Jupiter (Solana)
 *                 value:
 *                   success: false
 *                   message: "Failed to get CUSTOM price from Jupiter: Token not found on Jupiter or insufficient liquidity"
 *                   details:
 *                     token: "CUSTOM"
 *                     network: "solana"
 *                     step: "quote_validation_with_current_rates"
 *                   code: "QUOTE_VALIDATION_FAILED"
 */

router.post('/quote', readOnlyAuth, ensureDefaultTokens, businessOnrampController.getQuote);
/**
 * @swagger
 * /api/v1/business-onramp/create:
 *   post:
 *     summary: Create onramp order for any supported token across all networks
 *     description: Create a new onramp order for any token configured in your business across Base, Solana, or Ethereum networks. Universal controller automatically validates token support, checks smart contract compatibility (Base), Jupiter liquidity (Solana), and initializes transactions.
 *     tags: [Business Onramp API]
 *     security:
 *       - ApiKeyAuth: []
 *         SecretKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           examples:
 *             enbOrder:
 *               summary: Create ENB Order (Base Network)
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
 *             solOrder:
 *               summary: Create SOL Order (Solana Network)
 *               value:
 *                 customerEmail: "customer@example.com"
 *                 customerName: "Jane Smith"
 *                 amount: 75000
 *                 targetToken: "SOL"
 *                 targetNetwork: "solana"
 *                 customerWallet: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
 *             ethOrder:
 *               summary: Create ETH Order (Base Network)
 *               value:
 *                 customerEmail: "customer@example.com"
 *                 customerName: "Bob Wilson"
 *                 amount: 150000
 *                 targetToken: "ETH"
 *                 targetNetwork: "base"
 *                 customerWallet: "0x742d35Cc6634C0532925a3b8D1D8ce28D2e67F5c"
 *     responses:
 *       201:
 *         description: Onramp order created successfully
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
 *                   example: "Onramp order created successfully for ENB on base using current exchange rates"
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderId:
 *                       type: string
 *                       example: "OR_1234567890_ABCDEF"
 *                     targetNetwork:
 *                       type: string
 *                       example: "base"
 *                     tokenInfo:
 *                       type: object
 *                       properties:
 *                         symbol:
 *                           type: string
 *                         network:
 *                           type: string
 *                         isNativeToken:
 *                           type: boolean
 *                           description: "True for ETH on Base or SOL on Solana"
 *                     smartContractData:
 *                       type: object
 *                       description: "Available for Base network orders"
 *                       properties:
 *                         reserveSupported:
 *                           type: boolean
 *                         liquidityAdequate:
 *                           type: boolean
 *                         transactionPreparation:
 *                           type: object
 *                           properties:
 *                             success:
 *                               type: boolean
 *                             transactionId:
 *                               type: string
 *                     jupiterData:
 *                       type: object
 *                       description: "Available for Solana network orders"
 *                       properties:
 *                         jupiterSupported:
 *                           type: boolean
 *                         priceImpact:
 *                           type: number
 *                         routeSteps:
 *                           type: array
 *                           items:
 *                             type: string
 *                         transactionPreparation:
 *                           type: object
 *                           properties:
 *                             success:
 *                               type: boolean
 *                             transactionId:
 *                               type: string
 *                             note:
 *                               type: string
 *       400:
 *         description: Invalid request parameters or token validation failed
 *         content:
 *           application/json:
 *             examples:
 *               unsupportedNetwork:
 *                 summary: Unsupported network
 *                 value:
 *                   success: false
 *                   message: "Unsupported network: polygon. Supported networks: base, solana, ethereum"
 *                   code: "UNSUPPORTED_NETWORK"
 *               baseContractNotSupported:
 *                 summary: Base token not supported by smart contract
 *                 value:
 *                   success: false
 *                   message: "Token CUSTOM is not supported by the smart contract reserve. Please contact support to add this token."
 *                   details:
 *                     token: "CUSTOM"
 *                     network: "base"
 *                     step: "token_validation_with_current_rates"
 *                   code: "TOKEN_VALIDATION_FAILED"
 *               solanaJupiterNotSupported:
 *                 summary: Solana token not found on Jupiter
 *                 value:
 *                   success: false
 *                   message: "Failed to get CUSTOM price from Jupiter: Token not found on Jupiter or insufficient liquidity"
 *                   details:
 *                     token: "CUSTOM"
 *                     network: "solana"
 *                     step: "token_validation_with_current_rates"
 *                   code: "TOKEN_VALIDATION_FAILED"
 */
router.post('/create', fullAuth, ensureDefaultTokens, businessOnrampController.createOnrampOrder);

// ================== UNIVERSAL TOKEN ROUTES (Enhanced for Multi-Network) ==================

if (USE_UNIVERSAL) {
    /**
     * @swagger
     * /api/v1/business-onramp/check-support:
     *   post:
     *     summary: Check if a specific token is supported for onramp across networks
     *     description: Validate if a token is properly configured and can be used for onramp orders. Performs network-specific validation including Base smart contracts, Solana Jupiter support, and Ethereum API availability.
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
     *               summary: Check ENB Token Support (Base)
     *               value:
     *                 targetToken: "ENB"
     *                 targetNetwork: "base"
     *             checkSOL:
     *               summary: Check SOL Token Support (Solana)
     *               value:
     *                 targetToken: "SOL"
     *                 targetNetwork: "solana"
     *             checkETH:
     *               summary: Check ETH Token Support (Base)
     *               value:
     *                 targetToken: "ETH"
     *                 targetNetwork: "base"
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
     *                   example: "ENB is ready for onramp orders on base"
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
     *                           status:
     *                             type: string
     *                             enum: [passed, failed, error]
     *                           result:
     *                             type: object
     *                       example:
     *                         - name: "Business Configuration"
     *                           status: "passed"
     *                         - name: "Smart Contract Support (Base)"
     *                           status: "passed"
     *                           result:
     *                             reserveSupported: true
     *                         - name: "DEX Liquidity and Pricing (Base)"
     *                           status: "passed"
     *                           result:
     *                             hasLiquidity: true
     *                             adequateLiquidity: true
     *                         - name: "Jupiter DEX Support (Solana)"
     *                           status: "passed"
     *                           result:
     *                             jupiterSupported: true
     *                             priceImpact: 0.12
     *                     summary:
     *                       type: object
     *                       properties:
     *                         overallStatus:
     *                           type: string
     *                           enum: [fully_supported, partially_supported, not_supported]
     *                         canProcessOnramp:
     *                           type: boolean
     */
    router.post('/check-support', readOnlyAuth, businessOnrampController.checkTokenSupport);

    /**
     * @swagger
     * /api/v1/business-onramp/test-token:
     *   post:
     *     summary: Test any token for onramp compatibility across networks
     *     description: Comprehensive test of a token's compatibility with the onramp system across Base (smart contracts), Solana (Jupiter), and Ethereum networks. Runs all validation tests and provides detailed results with recommendations.
     *     tags: [Business Onramp API]
     *     security:
     *       - ApiKeyAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           examples:
     *             testENBBase:
     *               summary: Test ENB Token (Base)
     *               value:
     *                 targetToken: "ENB"
     *                 targetNetwork: "base"
     *                 testAmount: 1000
     *             testSOLSolana:
     *               summary: Test SOL Token (Solana)
     *               value:
     *                 targetToken: "SOL"
     *                 targetNetwork: "solana"
     *                 testAmount: 5000
     *             testETHBase:
     *               summary: Test ETH Token (Base)
     *               value:
     *                 targetToken: "ETH"
     *                 targetNetwork: "base"
     *                 testAmount: 10000
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
     *                   example: "ENB is fully compatible with onramp system on base using current rates"
     *                 data:
     *                   type: object
     *                   properties:
     *                     tests:
     *                       type: array
     *                       items:
     *                         type: object
     *                         properties:
     *                           name:
     *                             type: string
     *                             example: "Base Network Support Check"
     *                           status:
     *                             type: string
     *                             enum: [passed, failed, error]
     *                           result:
     *                             type: object
     *                             properties:
     *                               smartContractSupported:
     *                                 type: boolean
     *                               jupiterSupported:
     *                                 type: boolean
     *                               network:
     *                                 type: string
     *                     nextSteps:
     *                       type: array
     *                       items:
     *                         type: string
     *                       example:
     *                         - "Create quote: POST /api/v1/business-onramp/quote"
     *                         - "Create order: POST /api/v1/business-onramp/create"
     *                         - "Current USDC rate: ₦1,720"
     *                         - "Actual network: base"
     */
    router.post('/test-token', readOnlyAuth, businessOnrampController.testToken);

  /**
 * Improved Business Onramp Routes - Part 2
 * Continuation of the routes with all remaining endpoints and improvements
 */

    /**
     * @swagger
     * /api/v1/business-onramp/supported-tokens/validate:
     *   get:
     *     summary: Get all supported tokens with real-time validation status across networks
     *     description: Retrieve all configured tokens with their current validation status, smart contract support (Base), Jupiter support (Solana), and API availability (Ethereum)
     *     tags: [Business Onramp API]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: query
     *         name: validateAll
     *         schema:
     *           type: boolean
     *           default: false
     *         description: "Perform full validation on all tokens across all networks (may take longer)"
     *       - in: query
     *         name: network
     *         schema:
     *           type: string
     *           enum: [base, solana, ethereum, all]
     *           default: all
     *         description: "Validate tokens for specific network only"
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
     *                   example: "Found 12 configured tokens across 3 networks with current USDC rate: ₦1,720"
     *                 data:
     *                   type: object
     *                   properties:
     *                     currentUsdcRate:
     *                       type: number
     *                       example: 1720
     *                     rateSource:
     *                       type: string
     *                       example: "onramp_api"
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
     *                                   supportLevel:
     *                                     type: string
     *                                     enum: [fully_supported, partially_supported, not_supported, not_validated]
     *                                   validation:
     *                                     type: object
     *                                     properties:
     *                                       contractSupported:
     *                                         type: boolean
     *                                       hasLiquidity:
     *                                         type: boolean
     *                                       canProcessOnramp:
     *                                         type: boolean
     *                                   priceInfo:
     *                                     type: object
     *                                     properties:
     *                                       source:
     *                                         type: string
     *                                         example: "base_dex"
     *                                       formattedNgnPrice:
     *                                         type: string
     *                                         example: "₦398"
     *                         solana:
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
     *                                   validation:
     *                                     type: object
     *                                     properties:
     *                                       jupiterSupported:
     *                                         type: boolean
     *                                       hasLiquidity:
     *                                         type: boolean
     *                                       canProcessOnramp:
     *                                         type: boolean
     *                                   priceInfo:
     *                                     type: object
     *                                     properties:
     *                                       source:
     *                                         type: string
     *                                         example: "jupiter_dex"
     *                                       priceImpact:
     *                                         type: number
     *                                       formattedNgnPrice:
     *                                         type: string
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
     *                         - "2 Base tokens need smart contract reserve support"
     *                         - "1 Solana token needs Jupiter liquidity"
     */
    router.get('/supported-tokens/validate', readOnlyAuth, businessOnrampController.getSupportedTokensWithValidation);

    /**
     * @swagger
     * /api/v1/business-onramp/debug/token/{tokenSymbol}:
     *   get:
     *     summary: Debug specific token configuration and compatibility across networks
     *     description: Comprehensive debugging for a specific token to identify configuration issues and provide solutions across Base, Solana, and Ethereum networks
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
     *                     token:
     *                       type: string
     *                     network:
     *                       type: string
     *                     checks:
     *                       type: array
     *                       items:
     *                         type: object
     *                         properties:
     *                           name:
     *                             type: string
     *                             example: "Smart Contract Support (Base)"
     *                           status:
     *                             type: string
     *                             enum: [passed, failed, error]
     *                           result:
     *                             type: object
     *                           error:
     *                             type: string
     *                           recommendation:
     *                             type: string
     *                     recommendations:
     *                       type: array
     *                       items:
     *                         type: string
     *                     overallStatus:
     *                       type: string
     *                       enum: [fully_supported, partially_supported, not_supported]
     */
    router.get('/debug/token/:tokenSymbol', readOnlyAuth, async (req, res) => {
        try {
            const { tokenSymbol } = req.params;
            const { network = 'base' } = req.query;
            
            // Validate network parameter
            const supportedNetworks = ['base', 'solana', 'ethereum'];
            if (!supportedNetworks.includes(network.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    message: `Unsupported network: ${network}. Supported networks: ${supportedNetworks.join(', ')}`,
                    code: 'UNSUPPORTED_NETWORK'
                });
            }
            
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

// ================== ORDER MANAGEMENT ROUTES (Updated) ==================

/**
 * @swagger
 * /api/v1/business-onramp/orders/{orderId}:
 *   get:
 *     summary: Get onramp order details by ID
 *     description: Retrieve complete details of a specific onramp order including current status, transaction information, and network-specific data
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
 *                     targetNetwork:
 *                       type: string
 *                       example: "base"
 *                     validation:
 *                       type: object
 *                       description: "Universal controller only"
 *                       properties:
 *                         tokenValidated:
 *                           type: boolean
 *                         contractSupported:
 *                           type: boolean
 *                         jupiterSupported:
 *                           type: boolean
 *                     pricingInfo:
 *                       type: object
 *                       description: "Universal controller only"
 *                       properties:
 *                         source:
 *                           type: string
 *                           enum: [smart_contract_dex_with_current_rates, jupiter_dex_with_current_rates, internal_api]
 *                         currentUsdcRate:
 *                           type: number
 *                         rateSource:
 *                           type: string
 *                     smartContractData:
 *                       type: object
 *                       description: "Base network orders only"
 *                     jupiterData:
 *                       type: object
 *                       description: "Solana network orders only"
 */
router.get('/orders/:orderId', fullAuth, businessOnrampController.getOrderById);

/**
 * @swagger
 * /api/v1/business-onramp/orders:
 *   get:
 *     summary: Get all onramp orders for business with network filtering
 *     description: Retrieve all onramp orders created by this business with optional filtering by network and pagination
 *     tags: [Business Onramp API]
 *     security:
 *       - ApiKeyAuth: []
 *         SecretKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: targetNetwork
 *         schema:
 *           type: string
 *           enum: [base, solana, ethereum]
 *         description: Filter by target network
 *         example: "base"
 *       - in: query
 *         name: targetToken
 *         schema:
 *           type: string
 *         description: Filter by target token (e.g., ENB, USDC, ETH, SOL)
 *         example: "ENB"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [initiated, pending, processing, completed, failed, cancelled, expired]
 *         description: Filter by order status
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
 *                           targetNetwork:
 *                             type: string
 *                           network:
 *                             type: string
 *                             description: "Actual network used for processing"
 *                           pricingSource:
 *                             type: string
 *                             enum: [smart_contract_dex_with_current_rates, jupiter_dex_with_current_rates, internal_api]
 *                           currentUsdcRate:
 *                             type: number
 *                             description: "USDC rate used at time of order"
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalAmount:
 *                           type: number
 *                         baseOrders:
 *                           type: number
 *                         solanaOrders:
 *                           type: number
 *                         ethereumOrders:
 *                           type: number
 */
router.get('/orders', fullAuth, businessOnrampController.getAllOrders);

/**
 * @swagger
 * /api/v1/business-onramp/stats:
 *   get:
 *     summary: Get business onramp statistics with network breakdown
 *     description: Retrieve comprehensive statistics about business onramp orders and performance across Base, Solana, and Ethereum networks
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
 *                     networkBreakdown:
 *                       type: object
 *                       properties:
 *                         base:
 *                           type: object
 *                           properties:
 *                             count:
 *                               type: number
 *                             totalAmount:
 *                               type: number
 *                             avgOrderValue:
 *                               type: number
 *                             completedOrders:
 *                               type: number
 *                             successRate:
 *                               type: number
 *                         solana:
 *                           type: object
 *                           properties:
 *                             count:
 *                               type: number
 *                             totalAmount:
 *                               type: number
 *                             avgOrderValue:
 *                               type: number
 *                             successRate:
 *                               type: number
 *                         ethereum:
 *                           type: object
 *                           properties:
 *                             count:
 *                               type: number
 *                             totalAmount:
 *                               type: number
 *                     pricingSourceAnalysis:
 *                       type: object
 *                       description: "Universal controller only"
 *                       properties:
 *                         smart_contract_dex_with_current_rates:
 *                           type: object
 *                           properties:
 *                             count:
 *                               type: number
 *                             totalAmount:
 *                               type: number
 *                             networks:
 *                               type: array
 *                               items:
 *                                 type: string
 *                         jupiter_dex_with_current_rates:
 *                           type: object
 *                           properties:
 *                             count:
 *                               type: number
 *                             totalAmount:
 *                               type: number
 *                         internal_api:
 *                           type: object
 *                           properties:
 *                             count:
 *                               type: number
 *                             totalAmount:
 *                               type: number
 */
router.get('/stats', fullAuth, businessOnrampController.getBusinessStats);

// ================== WEBHOOK ROUTES (No changes needed) ==================
router.post('/webhook/monnify', businessOnrampController.handleMonnifyWebhook);

// ================== HEALTH CHECK ROUTES (Enhanced) ==================

/**
 * @swagger
 * /api/v1/business-onramp/health:
 *   get:
 *     summary: Comprehensive health check with multi-network support
 *     description: Check health of the entire onramp system including Base smart contracts, Solana Jupiter API, Ethereum API, and payment services. Universal controller provides detailed service status across all networks.
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
 *                   example: "Onramp system is healthy with Base and Solana support"
 *                 data:
 *                   type: object
 *                   properties:
 *                     version:
 *                       type: string
 *                       example: "generic-v2.0-base-solana-updated"
 *                     overallStatus:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                     services:
 *                       type: object
 *                       description: "Universal controller only"
 *                       properties:
 *                         baseSmartContract:
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
 *                         solanaJupiter:
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
 *                                 jupiterApiUrl:
 *                                   type: string
 *                                 solanaRpcUrl:
 *                                   type: string
 *                         exchangeRates:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                             details:
 *                               type: object
 *                               properties:
 *                                 currentUsdcRate:
 *                                   type: number
 *                                 formattedRate:
 *                                   type: string
 *                                 source:
 *                                   type: string
 *                     capabilities:
 *                       type: object
 *                       properties:
 *                         baseTokenSupport:
 *                           type: boolean
 *                         solanaTokenSupport:
 *                           type: boolean
 *                         fallbackPricing:
 *                           type: boolean
 *                         currentRateFetching:
 *                           type: boolean
 *                         paymentProcessing:
 *                           type: boolean
 *                         universalTokenSupport:
 *                           type: boolean
 *                     networkStatus:
 *                       type: object
 *                       properties:
 *                         base:
 *                           type: string
 *                           enum: [operational, degraded]
 *                         solana:
 *                           type: string
 *                           enum: [operational, degraded]
 *                         ethereum:
 *                           type: string
 *                           enum: [operational, degraded]
 *                     currentRates:
 *                       type: object
 *                       description: "Current exchange rates"
 *                       properties:
 *                         usdcToNgn:
 *                           type: number
 *                         formatted:
 *                           type: string
 *                         source:
 *                           type: string
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
                        smartContractIntegration: USE_ENHANCED || USE_UNIVERSAL,
                        multiNetworkSupport: USE_UNIVERSAL
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

// ================== CONFIGURATION ROUTES (Updated) ==================

/**
 * @swagger
 * /api/v1/business-onramp/config:
 *   get:
 *     summary: Get current controller configuration and available features
 *     description: Returns information about which controller is active, available features, supported networks, and system configuration
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
 *                     supportedNetworks:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["base", "solana", "ethereum"]
 *                     features:
 *                       type: object
 *                       properties:
 *                         universalTokenSupport:
 *                           type: boolean
 *                           example: true
 *                         baseSmartContractValidation:
 *                           type: boolean
 *                           example: true
 *                         solanaJupiterIntegration:
 *                           type: boolean
 *                           example: true
 *                         ethereumApiSupport:
 *                           type: boolean
 *                           example: true
 *                         multiNetworkSupport:
 *                           type: boolean
 *                           example: true
 *                         tokenTesting:
 *                           type: boolean
 *                           example: true
 *                         currentRateFetching:
 *                           type: boolean
 *                           example: true
 *                     networkConfiguration:
 *                       type: object
 *                       properties:
 *                         base:
 *                           type: object
 *                           properties:
 *                             smartContractEnabled:
 *                               type: boolean
 *                             contractAddress:
 *                               type: string
 *                               example: "Set"
 *                             rpcUrl:
 *                               type: string
 *                               example: "Set"
 *                         solana:
 *                           type: object
 *                           properties:
 *                             jupiterEnabled:
 *                               type: boolean
 *                             jupiterApiUrl:
 *                               type: string
 *                             solanaRpcUrl:
 *                               type: string
 *                         ethereum:
 *                           type: object
 *                           properties:
 *                             internalApiEnabled:
 *                               type: boolean
 *                             apiBaseUrl:
 *                               type: string
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example:
 *                         - "Set SOLANA_RPC_URL for better Solana performance"
 *                         - "Enable JUPITER_API_URL for custom Jupiter endpoint"
 */
router.get('/config', readOnlyAuth, (req, res) => {
    try {
        const config = {
            controllerType: USE_UNIVERSAL ? 'universal' : USE_ENHANCED ? 'enhanced' : 'original',
            supportedNetworks: USE_UNIVERSAL ? ['base', 'solana', 'ethereum'] : ['base', 'ethereum'],
            features: {
                universalTokenSupport: USE_UNIVERSAL,
                baseSmartContractValidation: USE_ENHANCED || USE_UNIVERSAL,
                solanaJupiterIntegration: USE_UNIVERSAL,
                ethereumApiSupport: true,
                multiNetworkSupport: USE_UNIVERSAL,
                tokenTesting: USE_UNIVERSAL,
                detailedHealthChecks: USE_ENHANCED || USE_UNIVERSAL,
                reserveValidation: USE_ENHANCED || USE_UNIVERSAL,
                currentRateFetching: true,
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
        
        // Network-specific configuration
        config.networkConfiguration = {
            base: {
                smartContractEnabled: !!(process.env.ABOKI_V2_CONTRACT),
                contractAddress: process.env.ABOKI_V2_CONTRACT ? 'Set' : 'Not set',
                rpcUrl: process.env.BASE_RPC_URL ? 'Set' : 'Not set'
            },
            solana: {
                jupiterEnabled: USE_UNIVERSAL,
                jupiterApiUrl: process.env.JUPITER_API_URL || 'https://quote-api.jup.ag (default)',
                solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com (default)'
            },
            ethereum: {
                internalApiEnabled: !!(process.env.INTERNAL_API_BASE_URL),
                apiBaseUrl: process.env.INTERNAL_API_BASE_URL ? 'Set' : 'Not set'
            }
        };
        
        config.environmentVariables = {
            USE_ENHANCED_ONRAMP: process.env.USE_ENHANCED_ONRAMP || 'false',
            USE_UNIVERSAL_TOKENS: process.env.USE_UNIVERSAL_TOKENS || 'false',
            ABOKI_V2_CONTRACT: process.env.ABOKI_V2_CONTRACT ? 'Set' : 'Not set',
            BASE_RPC_URL: process.env.BASE_RPC_URL ? 'Set' : 'Not set',
            SOLANA_RPC_URL: process.env.SOLANA_RPC_URL ? 'Set' : 'Not set',
            JUPITER_API_URL: process.env.JUPITER_API_URL ? 'Set' : 'Not set',
            INTERNAL_API_BASE_URL: process.env.INTERNAL_API_BASE_URL ? 'Set' : 'Not set'
        };
        
        config.recommendations = [];
        
        if (!USE_UNIVERSAL && !USE_ENHANCED) {
            config.recommendations.push('Consider enabling USE_UNIVERSAL_TOKENS=true for multi-network support');
        }
        
        if (USE_UNIVERSAL) {
            if (!process.env.ABOKI_V2_CONTRACT) {
                config.recommendations.push('Set ABOKI_V2_CONTRACT for Base smart contract features');
            }
            
            if (!process.env.BASE_RPC_URL) {
                config.recommendations.push('Set BASE_RPC_URL for better Base network connectivity');
            }
            
            if (!process.env.SOLANA_RPC_URL) {
                config.recommendations.push('Set SOLANA_RPC_URL for better Solana performance');
            }
            
        /**
 * Improved Business Onramp Routes - Final Part
 * Configuration completion, error handling, and exports
 */

        if (!process.env.JUPITER_API_URL) {
            config.recommendations.push('Set JUPITER_API_URL for custom Jupiter endpoint (optional)');
        }
        
        if (!process.env.INTERNAL_API_BASE_URL) {
            config.recommendations.push('Set INTERNAL_API_BASE_URL for Ethereum network support');
        }
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

// ================== ENHANCED ERROR HANDLING MIDDLEWARE ==================

// Global error handler for this router with network-specific error handling
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
let networkHint = null;

// Network-specific error handling
if (error.message.includes('not configured')) {
    statusCode = 400;
    errorCode = 'CONFIGURATION_ERROR';
    message = error.message;
} else if (error.message.includes('not supported by the smart contract reserve')) {
    statusCode = 400;
    errorCode = 'BASE_CONTRACT_NOT_SUPPORTED';
    message = error.message;
    networkHint = 'This token needs to be added to the Base smart contract reserve';
} else if (error.message.includes('not found on Jupiter')) {
    statusCode = 400;
    errorCode = 'SOLANA_JUPITER_NOT_SUPPORTED';
    message = error.message;
    networkHint = 'This token is not available on Jupiter DEX or has insufficient liquidity';
} else if (error.message.includes('Unsupported network')) {
    statusCode = 400;
    errorCode = 'UNSUPPORTED_NETWORK';
    message = error.message;
    networkHint = 'Supported networks: base, solana, ethereum';
} else if (error.message.includes('validation failed')) {
    statusCode = 400;
    errorCode = 'VALIDATION_FAILED';
    message = error.message;
} else if (error.message.includes('insufficient liquidity')) {
    statusCode = 400;
    errorCode = 'INSUFFICIENT_LIQUIDITY';
    message = error.message;
    
    // Determine network from error message for better hints
    if (error.message.includes('Jupiter')) {
        networkHint = 'Low liquidity on Solana Jupiter DEX';
    } else if (error.message.includes('DEX')) {
        networkHint = 'Low liquidity on Base DEXs';
    }
} else if (error.message.includes('Transaction value') && error.message.includes('below minimum')) {
    statusCode = 400;
    errorCode = 'AMOUNT_TOO_SMALL';
    message = error.message;
}

const errorResponse = {
    success: false,
    message: message,
    code: errorCode,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
};

// Add network hint if available
if (networkHint) {
    errorResponse.networkHint = networkHint;
}

// Add development info
if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
}

res.status(statusCode).json(errorResponse);
});

// ================== SYSTEM STATUS AND MONITORING ROUTES (Enhanced) ==================

/**
* @swagger
* /api/v1/business-onramp/status:
*   get:
*     summary: Get real-time system status with network information
*     description: Quick status check for monitoring systems with multi-network support
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
*                 supportedNetworks:
*                   type: array
*                   items:
*                     type: string
*                   example: ["base", "solana", "ethereum"]
*                 networkStatus:
*                   type: object
*                   properties:
*                     base:
*                       type: string
*                       enum: [operational, degraded]
*                     solana:
*                       type: string
*                       enum: [operational, degraded]
*                     ethereum:
*                       type: string
*                       enum: [operational, degraded]
*/

// ================== WEBHOOK ROUTES ==================

/**
 * @swagger
 * /api/v1/business-onramp/webhook/monnify:
 *   post:
 *     summary: Receive payment confirmation from Monnify
 *     description: Webhook endpoint called by Monnify when customer completes payment. Updates order status and initiates token settlement.
 *     tags: [Business Onramp API]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               transactionReference:
 *                 type: string
 *               paymentStatus:
 *                 type: string
 *                 enum: [PAID, FAILED, OVERPAID]
 *               amountPaid:
 *                 type: string
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 */
router.post('/webhook/monnify', businessOnrampController.handleMonnifyWebhook);

/**
 * @swagger
 * /api/v1/business-onramp/webhook/settlement:
 *   post:
 *     summary: Receive settlement confirmation from liquidity server
 *     description: Webhook endpoint called by liquidity server when blockchain transaction is confirmed. Updates order to completed status.
 *     tags: [Business Onramp API]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *               - status
 *             properties:
 *               orderId:
 *                 type: string
 *                 example: "OR_1759373329109_MNFNDJJC9"
 *               txHash:
 *                 type: string
 *                 example: "0x123abc..."
 *               status:
 *                 type: string
 *                 enum: [confirmed, completed, failed, pending]
 *               confirmations:
 *                 type: number
 *                 example: 12
 *               blockNumber:
 *                 type: number
 *                 example: 1234567
 *               network:
 *                 type: string
 *                 enum: [base, solana, ethereum]
 *     responses:
 *       200:
 *         description: Settlement webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 orderId:
 *                   type: string
 *                 currentStatus:
 *                   type: string
 *       404:
 *         description: Order not found
 */
router.post('/webhook/settlement', businessOnrampController.handleSettlementWebhook);
router.get('/status', (req, res) => {
try {
    const statusResponse = {
        status: 'operational',
        timestamp: new Date().toISOString(),
        version: USE_UNIVERSAL ? 'universal-v2.0' : USE_ENHANCED ? 'enhanced' : 'original',
        uptime: process.uptime(),
        controllerType: USE_UNIVERSAL ? 'universal' : USE_ENHANCED ? 'enhanced' : 'original'
    };
    
    if (USE_UNIVERSAL) {
        statusResponse.supportedNetworks = ['base', 'solana', 'ethereum'];
        statusResponse.networkStatus = {
            base: process.env.ABOKI_V2_CONTRACT && process.env.BASE_RPC_URL ? 'operational' : 'degraded',
            solana: 'operational', // Jupiter is public API
            ethereum: process.env.INTERNAL_API_BASE_URL ? 'operational' : 'degraded'
        };
    } else {
        statusResponse.supportedNetworks = ['base', 'ethereum'];
        statusResponse.networkStatus = {
            base: process.env.ABOKI_V2_CONTRACT ? 'operational' : 'degraded',
            ethereum: process.env.INTERNAL_API_BASE_URL ? 'operational' : 'degraded'
        };
    }
    
    res.json(statusResponse);
} catch (error) {
    res.status(500).json({
        status: 'down',
        timestamp: new Date().toISOString(),
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
 *     summary: Detailed health check with multi-network validation
 *     description: Comprehensive health check including Base smart contract connectivity, Solana Jupiter API, Ethereum API, and service dependencies
 *     tags: [Business Onramp API]
 *     responses:
 *       200:
 *         description: Detailed health information
 */
router.get('/health/detailed', async (req, res) => {
    try {
        const healthReport = {
            timestamp: new Date().toISOString(),
            version: USE_UNIVERSAL ? 'universal-v2.0' : 'enhanced',
            overallStatus: 'checking',
            services: {},
            networkHealth: {}
        };
        
        // Test Base network if universal controller
        if (USE_UNIVERSAL) {
            try {
                const { OnrampPriceChecker } = require('../services/onrampPriceChecker');
                const checker = new OnrampPriceChecker();
                
                const isConnected = await checker.validateConnection();
                const config = await checker.getContractConfiguration();
                
                healthReport.services.baseSmartContract = {
                    status: isConnected ? 'healthy' : 'unhealthy',
                    details: {
                        connected: isConnected,
                        configuration: config,
                        contractAddress: process.env.ABOKI_V2_CONTRACT || 'Not configured',
                        rpcUrl: process.env.BASE_RPC_URL || 'Not configured'
                    }
                };
                
                healthReport.networkHealth.base = isConnected ? 'operational' : 'degraded';
            } catch (error) {
                healthReport.services.baseSmartContract = {
                    status: 'unhealthy',
                    error: error.message
                };
                healthReport.networkHealth.base = 'degraded';
            }
            
            // Test Solana Jupiter
            try {
                const { SolanaTokenPriceChecker } = require('../services/solanaOnrampPriceChecker');
                const solanaChecker = new SolanaTokenPriceChecker();
                
                const jupiterHealth = await solanaChecker.validateConnection();
                
                healthReport.services.solanaJupiter = {
                    status: jupiterHealth ? 'healthy' : 'unhealthy',
                    details: {
                        connected: jupiterHealth,
                        jupiterApiUrl: process.env.JUPITER_API_URL || 'https://quote-api.jup.ag',
                        solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
                    }
                };
                
                healthReport.networkHealth.solana = jupiterHealth ? 'operational' : 'degraded';
            } catch (error) {
                healthReport.services.solanaJupiter = {
                    status: 'unhealthy',
                    error: error.message
                };
                healthReport.networkHealth.solana = 'degraded';
            }
        }
        
        // Test internal API
        try {
            const axios = require('axios');
            const baseUrl = process.env.INTERNAL_API_BASE_URL || 'http://localhost:5002';
            const response = await axios.get(`${baseUrl}/api/v1/health`, { timeout: 5000 });
            
            healthReport.services.internalApi = {
                status: response.status === 200 ? 'healthy' : 'unhealthy',
                details: {
                    baseUrl: baseUrl,
                    responseStatus: response.status
                }
            };
            
            healthReport.networkHealth.ethereum = response.status === 200 ? 'operational' : 'degraded';
        } catch (error) {
            healthReport.services.internalApi = {
                status: 'unhealthy',
                error: error.message
            };
            healthReport.networkHealth.ethereum = 'degraded';
        }
        
        // Determine overall health
        const healthyServices = Object.values(healthReport.services).filter(s => s.status === 'healthy').length;
        const totalServices = Object.keys(healthReport.services).length;
        
        healthReport.overallStatus = healthyServices === totalServices ? 'healthy' : 
                                    healthyServices > 0 ? 'degraded' : 'unhealthy';
        
        healthReport.capabilities = {
            baseTokenSupport: healthReport.services.baseSmartContract?.status === 'healthy',
            solanaTokenSupport: healthReport.services.solanaJupiter?.status === 'healthy',
            ethereumTokenSupport: healthReport.services.internalApi?.status === 'healthy',
            multiNetworkSupport: USE_UNIVERSAL,
            smartContractValidation: healthReport.services.baseSmartContract?.status === 'healthy',
            jupiterIntegration: healthReport.services.solanaJupiter?.status === 'healthy'
        };
        
        const statusCode = healthReport.overallStatus === 'healthy' ? 200 : 
                          healthReport.overallStatus === 'degraded' ? 207 : 503;
        
        res.status(statusCode).json({
            success: healthReport.overallStatus !== 'unhealthy',
            message: `${USE_UNIVERSAL ? 'Universal' : 'Enhanced'} onramp system is ${healthReport.overallStatus}`,
            data: healthReport
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

// ================== USAGE EXAMPLES AND DOCUMENTATION ==================

/**
* UPDATED Usage Examples for Multi-Network Support:
* 
* 1. Check if ENB token is supported on Base:
* curl -X POST 'http://localhost:5002/api/v1/business-onramp/check-support' \
*   -H 'X-API-Key: YOUR_PUBLIC_API_KEY' \
*   -H 'Content-Type: application/json' \
*   -d '{"targetToken": "ENB", "targetNetwork": "base"}'
* 
* 2. Check if SOL token is supported on Solana:
* curl -X POST 'http://localhost:5002/api/v1/business-onramp/check-support' \
*   -H 'X-API-Key: YOUR_PUBLIC_API_KEY' \
*   -H 'Content-Type: application/json' \
*   -d '{"targetToken": "SOL", "targetNetwork": "solana"}'
* 
* 3. Test ETH token on Base:
* curl -X POST 'http://localhost:5002/api/v1/business-onramp/test-token' \
*   -H 'X-API-Key: YOUR_PUBLIC_API_KEY' \
*   -H 'Content-Type: application/json' \
*   -d '{"targetToken": "ETH", "targetNetwork": "base", "testAmount": 10000}'
* 
* 4. Get quote for SOL on Solana:
* curl -X POST 'http://localhost:5002/api/v1/business-onramp/quote' \
*   -H 'X-API-Key: YOUR_PUBLIC_API_KEY' \
*   -H 'Content-Type: application/json' \
*   -d '{"amount": 75000, "targetToken": "SOL", "targetNetwork": "solana"}'
* 
* 5. Create SOL order on Solana:
* curl -X POST 'http://localhost:5002/api/v1/business-onramp/create' \
*   -H 'X-API-Key: YOUR_PUBLIC_API_KEY' \
*   -H 'X-Secret-Key: YOUR_SECRET_API_KEY' \
*   -H 'Content-Type: application/json' \
*   -d '{
*     "customerEmail": "customer@example.com",
*     "customerName": "John Doe",
*     "amount": 75000,
*     "targetToken": "SOL",
*     "targetNetwork": "solana",
*     "customerWallet": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
*   }'
* 
* 6. Get all tokens with validation across networks:
* curl -X GET 'http://localhost:5002/api/v1/business-onramp/supported-tokens/validate?validateAll=true' \
*   -H 'X-API-Key: YOUR_PUBLIC_API_KEY'
* 
* 7. Debug SOL token on Solana:
* curl -X GET 'http://localhost:5002/api/v1/business-onramp/debug/token/SOL?network=solana' \
*   -H 'X-API-Key: YOUR_PUBLIC_API_KEY'
* 
* 8. Check multi-network system health:
* curl -X GET 'http://localhost:5002/api/v1/business-onramp/health/detailed' \
*   -H 'X-API-Key: YOUR_PUBLIC_API_KEY'
* 
* 9. Filter orders by network:
* curl -X GET 'http://localhost:5002/api/v1/business-onramp/orders?targetNetwork=solana&limit=10' \
*   -H 'X-API-Key: YOUR_PUBLIC_API_KEY' \
*   -H 'X-Secret-Key: YOUR_SECRET_API_KEY'
*/

// ================== ROUTE EXPORTS AND SUMMARY (Updated) ==================

/**
* UPDATED Route Summary:
* 
* Core Routes (Always Available):
* - GET  /supported-tokens        - Get business supported tokens (now with network filtering)
* - POST /quote                   - Get price quote for any token (Base/Solana/Ethereum)
* - POST /create                  - Create onramp order (multi-network support)
* - GET  /orders/:orderId         - Get specific order details (with network info)
* - GET  /orders                  - Get all orders with network filtering
* - GET  /stats                   - Get business statistics (with network breakdown)
* - POST /webhook/monnify         - Handle payment webhooks (unchanged)
* - GET  /health                  - System health check (multi-network aware)
* - GET  /status                  - Quick status check (with network status)
* - GET  /config                  - System configuration info (network-aware)
* 
* Universal Controller Routes (USE_UNIVERSAL_TOKENS=true):
* - POST /check-support           - Check token support (Base/Solana/Ethereum)
* - POST /test-token              - Test token compatibility (network-specific)
* - GET  /supported-tokens/validate - Get tokens with validation (all networks)
* - GET  /debug/token/:symbol     - Debug specific token (network-specific)
* 
* Enhanced/Universal Controller Routes:
* - GET  /health/detailed         - Detailed health check (multi-network)
* 
* Network Support:
* - Base: Smart contract validation, DEX liquidity checks, native ETH support
* - Solana: Jupiter DEX integration, native SOL support, price impact calculation
* - Ethereum: Internal API fallback for any ERC-20 token
* 
* Key Improvements:
* 1. Multi-network parameter validation
* 2. Network-specific error messages and hints
* 3. Enhanced configuration with network status
* 4. Updated health checks for all networks
* 5. Network filtering in orders and statistics
* 6. Comprehensive examples for all networks
* 7. Better error handling with network context
* 8. Updated Swagger documentation for all networks
*/

console.log(`[ROUTES] Business Onramp Routes loaded successfully with multi-network support`);
console.log(`[ROUTES] Controller: ${USE_UNIVERSAL ? 'Universal' : USE_ENHANCED ? 'Enhanced' : 'Original'}`);
console.log(`[ROUTES] Available endpoints: ${router.stack.length}`);

if (USE_UNIVERSAL) {
console.log(`[ROUTES] ✅ Universal token support enabled - Base, Solana, and Ethereum networks`);
console.log(`[ROUTES] ✅ Base smart contract validation enabled`);
console.log(`[ROUTES] ✅ Solana Jupiter DEX integration enabled`);
console.log(`[ROUTES] ✅ Ethereum API fallback enabled`);
console.log(`[ROUTES] ✅ Multi-network debug and testing endpoints available`);
} else if (USE_ENHANCED) {
console.log(`[ROUTES] ✅ Enhanced controller enabled with Base smart contract integration`);
} else {
console.log(`[ROUTES] ℹ️  Original controller - consider enabling universal support for multi-network`);
}

module.exports = router;

/**
* UPDATED Quick Start Guide:
* 
* 1. Set environment variables for multi-network support:
*    USE_UNIVERSAL_TOKENS=true
*    ABOKI_V2_CONTRACT=0x14157cA08Ed86531355f1DE8c918dE85CA6bCDa1  # Base
*    BASE_RPC_URL=https://mainnet.base.org
*    SOLANA_RPC_URL=https://api.mainnet-beta.solana.com            # Solana
*    JUPITER_API_URL=https://quote-api.jup.ag                      # Optional
*    INTERNAL_API_BASE_URL=http://localhost:5002                   # Ethereum
* 
* 2. Create the updated genericTokenOnrampController.js file
* 
* 3. Test configuration:
*    GET /config  # Should show all three networks
* 
* 4. Check system health:
*    GET /health/detailed  # Should show Base, Solana, and Ethereum status
* 
* 5. Test tokens on different networks:
*    POST /check-support {"targetToken": "ENB", "targetNetwork": "base"}
*    POST /check-support {"targetToken": "SOL", "targetNetwork": "solana"}
*    POST /test-token {"targetToken": "ETH", "targetNetwork": "base"}
* 
* 6. Create orders on different networks:
*    POST /create with targetNetwork: "base" for Base tokens
*    POST /create with targetNetwork: "solana" for Solana tokens
*    POST /create with targetNetwork: "ethereum" for Ethereum tokens
* 
* This system will now automatically:
* - Route Base tokens through smart contracts with DEX validation
* - Route Solana tokens through Jupiter DEX with price impact calculation
* - Route Ethereum tokens through internal API with fallback pricing
* - Provide network-specific validation and error messages
* - Support native tokens (ETH on Base, SOL on Solana)
* - Handle any token you configure across all networks
*/