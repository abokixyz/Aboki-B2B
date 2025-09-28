/**
 * Business Off-ramp Routes - Complete Production Version
 * Routes for token-to-fiat conversion with wallet generation and bank verification
 * 
 * Features:
 * - Token-to-NGN conversion quotes and orders
 * - Automatic wallet generation for deposits
 * - Bank account verification via Lenco API
 * - Real-time webhooks for order updates
 * - Multi-network support (Base, Solana, Ethereum)
 * - Comprehensive validation and error handling
 */

const express = require('express');
const businessOfframpController = require('../controllers/businessOfframpController');
const offrampWebhookHandler = require('../services/offrampWebhookHandler');
const { 
  authenticateApiKey,
  validateBusinessOnrampRequest, 
  validateOfframpRequestData,
  validateWebhookRequest,
  validateInternalRequest,
  apiRateLimit 
} = require('../middleware/apiAuth');

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiRateLimit);

// Apply webhook middleware for webhook endpoints
router.use('/webhook', express.raw({ type: 'application/json' })); // Raw body for webhook verification

// Apply business authentication to all routes except webhooks and internal endpoints
router.use((req, res, next) => {
  // Skip authentication for webhook endpoints
  if (req.path.startsWith('/webhook')) {
    return next();
  }
  // Skip authentication for internal endpoints (they have their own validation)
  if (req.path.startsWith('/internal')) {
    return next();
  }
  // Apply API key authentication for all other routes
  authenticateApiKey(req, res, next);
});

// ================================
// MAIN OFF-RAMP ENDPOINTS
// ================================

/**
 * @swagger
 * /api/v1/business-offramp/quote:
 *   post:
 *     summary: Get off-ramp quote (token to NGN)
 *     description: Calculate how much NGN customer will receive for selling tokens
 *     tags: [Business Off-ramp]
 *     security:
 *       - BusinessApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokenAmount
 *               - targetToken
 *               - targetNetwork
 *             properties:
 *               tokenAmount:
 *                 type: number
 *                 minimum: 0.001
 *                 example: 100
 *                 description: Amount of tokens to sell
 *               targetToken:
 *                 type: string
 *                 example: "USDC"
 *                 description: Token symbol (e.g., USDC, ETH, SOL)
 *               targetNetwork:
 *                 type: string
 *                 enum: [base, solana, ethereum]
 *                 example: "base"
 *                 description: Blockchain network
 *             example:
 *               tokenAmount: 100
 *               targetToken: "USDC"
 *               targetNetwork: "base"
 *     responses:
 *       200:
 *         description: Quote generated successfully
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
 *                   example: "Off-ramp quote generated successfully for USDC on base"
 *                 data:
 *                   type: object
 *                   properties:
 *                     tokenAmount:
 *                       type: number
 *                       example: 100
 *                     targetToken:
 *                       type: string
 *                       example: "USDC"
 *                     targetNetwork:
 *                       type: string
 *                       example: "base"
 *                     grossNgnAmount:
 *                       type: number
 *                       example: 165000
 *                       description: Total NGN value before fees
 *                     feePercentage:
 *                       type: number
 *                       example: 1.5
 *                       description: Business fee percentage
 *                     feeAmount:
 *                       type: number
 *                       example: 2475
 *                       description: Fee amount in NGN
 *                     netNgnAmount:
 *                       type: number
 *                       example: 162525
 *                       description: Final amount customer receives in NGN
 *                     exchangeRate:
 *                       type: number
 *                       example: 1650
 *                       description: Token to NGN exchange rate
 *                     breakdown:
 *                       type: object
 *                       properties:
 *                         youSend:
 *                           type: string
 *                           example: "100 USDC"
 *                         grossValue:
 *                           type: string
 *                           example: "₦165,000"
 *                         businessFee:
 *                           type: string
 *                           example: "₦2,475 (1.5%)"
 *                         youReceive:
 *                           type: string
 *                           example: "₦162,525"
 *                     validFor:
 *                       type: number
 *                       example: 300
 *                       description: Quote validity in seconds
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       description: When the quote expires
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Invalid API key
 *       500:
 *         description: Server error
 */
router.post('/quote', businessOfframpController.getOfframpQuote);

/**
 * @swagger
 * /api/v1/business-offramp/create:
 *   post:
 *     summary: Create off-ramp order
 *     description: Create new token-to-fiat conversion order with automatic wallet generation and bank account verification
 *     tags: [Business Off-ramp]
 *     security:
 *       - BusinessApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerEmail
 *               - customerName
 *               - tokenAmount
 *               - targetToken
 *               - targetNetwork
 *               - recipientAccountNumber
 *               - recipientBankCode
 *             properties:
 *               customerEmail:
 *                 type: string
 *                 format: email
 *                 example: "customer@example.com"
 *                 description: Customer's email address
 *               customerName:
 *                 type: string
 *                 example: "John Doe"
 *                 description: Customer's full name
 *               customerPhone:
 *                 type: string
 *                 example: "+2348123456789"
 *                 description: Optional customer phone number
 *               tokenAmount:
 *                 type: number
 *                 minimum: 0.001
 *                 example: 100
 *                 description: Amount of tokens customer wants to sell
 *               targetToken:
 *                 type: string
 *                 example: "USDC"
 *                 description: Token symbol (must be in your supported tokens)
 *               targetNetwork:
 *                 type: string
 *                 enum: [base, solana, ethereum]
 *                 example: "base"
 *                 description: Blockchain network for the token
 *               recipientAccountNumber:
 *                 type: string
 *                 pattern: '^[0-9]{10}$'
 *                 example: "1234567890"
 *                 description: 10-digit Nigerian bank account number
 *               recipientAccountName:
 *                 type: string
 *                 example: "John Doe"
 *                 description: Optional - account name (will be verified via Lenco)
 *               recipientBankCode:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 example: "058152"
 *                 description: 6-digit Nigerian bank code (e.g., 058152 for GTBank)
 *               recipientBankName:
 *                 type: string
 *                 example: "Guaranty Trust Bank"
 *                 description: Optional - bank name (will be verified via Lenco)
 *               webhookUrl:
 *                 type: string
 *                 format: uri
 *                 example: "https://your-api.com/webhooks/offramp"
 *                 description: URL to receive order status updates
 *               metadata:
 *                 type: object
 *                 description: Additional data to store with the order
 *                 example:
 *                   customerReference: "CUST-001"
 *                   source: "mobile_app"
 *     responses:
 *       201:
 *         description: Off-ramp order created successfully
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
 *                   example: "Off-ramp order created successfully. Send USDC to the provided wallet address."
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderId:
 *                       type: string
 *                       example: "OFF_1703234567_ABC123DEF"
 *                       description: Unique order identifier
 *                     businessOrderReference:
 *                       type: string
 *                       example: "OFFRAMP-USDC-A1B2C3D4"
 *                       description: Business-friendly order reference
 *                     tokenAmount:
 *                       type: number
 *                       example: 100
 *                     targetToken:
 *                       type: string
 *                       example: "USDC"
 *                     targetNetwork:
 *                       type: string
 *                       example: "base"
 *                     grossNgnAmount:
 *                       type: number
 *                       example: 165000
 *                       description: Total NGN value before fees
 *                     feeAmount:
 *                       type: number
 *                       example: 2475
 *                     netNgnAmount:
 *                       type: number
 *                       example: 162525
 *                       description: Final amount customer will receive
 *                     exchangeRate:
 *                       type: number
 *                       example: 1650
 *                     depositInstructions:
 *                       type: object
 *                       properties:
 *                         walletAddress:
 *                           type: string
 *                           example: "0x742d35Cc6669C87532DD123F5b8c6B3e8e7c5B2A"
 *                           description: Generated wallet address for token deposit
 *                         network:
 *                           type: string
 *                           example: "base"
 *                         tokenAddress:
 *                           type: string
 *                           example: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
 *                         exactAmount:
 *                           type: number
 *                           example: 100
 *                           description: Exact amount customer must send
 *                         expiresAt:
 *                           type: string
 *                           format: date-time
 *                           description: When the deposit wallet expires
 *                         instructions:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example:
 *                             - "Send exactly 100 USDC to the address above"
 *                             - "Network: Base"
 *                             - "Once received, ₦162,525 will be sent to your bank account"
 *                             - "Deposit must be completed within 24 hours"
 *                     bankDetails:
 *                       type: object
 *                       properties:
 *                         accountNumber:
 *                           type: string
 *                           example: "1234567890"
 *                         accountName:
 *                           type: string
 *                           example: "JOHN DOE"
 *                           description: Verified account name from Lenco
 *                         bankName:
 *                           type: string
 *                           example: "Guaranty Trust Bank"
 *                           description: Verified bank name from Lenco
 *                         bankCode:
 *                           type: string
 *                           example: "058152"
 *                         verified:
 *                           type: boolean
 *                           example: true
 *                           description: Account verification status
 *                     status:
 *                       type: string
 *                       enum: [pending_deposit, deposit_received, processing, pending_payout, completed, failed, expired, cancelled]
 *                       example: "pending_deposit"
 *                       description: Current order status
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       description: When the order expires (24 hours)
 *                     webhookConfigured:
 *                       type: boolean
 *                       example: true
 *                       description: Whether webhook URL was provided
 *       400:
 *         description: Invalid request or account verification failed
 *       503:
 *         description: Bank verification service unavailable
 *       500:
 *         description: Server error
 */
router.post('/create', 
  validateOfframpRequestData,  // Validates request data without requiring secret key
  businessOfframpController.createOfframpOrder
);

/**
 * @swagger
 * /api/v1/business-offramp/orders/{orderId}:
 *   get:
 *     summary: Get specific off-ramp order by ID
 *     description: Retrieve details of a specific off-ramp order
 *     tags: [Business Off-ramp]
 *     security:
 *       - BusinessApiKey: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         description: Order ID or business order reference
 *         schema:
 *           type: string
 *           example: "OFF_1703234567_ABC123DEF"
 *     responses:
 *       200:
 *         description: Order details retrieved successfully
 *       404:
 *         description: Order not found
 *       401:
 *         description: Invalid API key
 */
router.get('/orders/:orderId', businessOfframpController.getOrderById);

/**
 * @swagger
 * /api/v1/business-offramp/orders:
 *   get:
 *     summary: Get all off-ramp orders with filtering
 *     description: Retrieve list of off-ramp orders with optional filtering
 *     tags: [Business Off-ramp]
 *     security:
 *       - BusinessApiKey: []
 *     parameters:
 *       - in: query
 *         name: status
 *         description: Filter by order status
 *         schema:
 *           type: string
 *           enum: [pending_deposit, deposit_received, processing, pending_payout, completed, failed, expired, cancelled]
 *       - in: query
 *         name: customerEmail
 *         description: Filter by customer email
 *         schema:
 *           type: string
 *       - in: query
 *         name: targetToken
 *         description: Filter by target token
 *         schema:
 *           type: string
 *       - in: query
 *         name: targetNetwork
 *         description: Filter by target network
 *         schema:
 *           type: string
 *           enum: [base, solana, ethereum]
 *       - in: query
 *         name: page
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         description: Number of orders per page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: sortBy
 *         description: Sort field
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, tokenAmount, netNgnAmount]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         description: Sort order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 *       401:
 *         description: Invalid API key
 */
router.get('/orders', businessOfframpController.getAllOrders);

/**
 * @swagger
 * /api/v1/business-offramp/stats:
 *   get:
 *     summary: Get business off-ramp statistics
 *     description: Retrieve comprehensive statistics for your off-ramp orders
 *     tags: [Business Off-ramp]
 *     security:
 *       - BusinessApiKey: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         description: Timeframe for statistics (in days)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *       - in: query
 *         name: targetNetwork
 *         description: Filter by specific network
 *         schema:
 *           type: string
 *           enum: [base, solana, ethereum]
 *       - in: query
 *         name: targetToken
 *         description: Filter by specific token
 *         schema:
 *           type: string
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
 *                     totalOrders:
 *                       type: integer
 *                       example: 150
 *                     completedOrders:
 *                       type: integer
 *                       example: 142
 *                     pendingOrders:
 *                       type: integer
 *                       example: 5
 *                     failedOrders:
 *                       type: integer
 *                       example: 3
 *                     totalVolume:
 *                       type: object
 *                       properties:
 *                         ngn:
 *                           type: number
 *                           example: 24750000
 *                         usd:
 *                           type: number
 *                           example: 15000
 *                     averageOrderValue:
 *                       type: object
 *                       properties:
 *                         ngn:
 *                           type: number
 *                           example: 165000
 *                         usd:
 *                           type: number
 *                           example: 100
 *                     successRate:
 *                       type: number
 *                       example: 94.67
 *                       description: Percentage of successful orders
 *                     totalFees:
 *                       type: number
 *                       example: 371250
 *                       description: Total fees earned in NGN
 *                     topTokens:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           token:
 *                             type: string
 *                             example: "USDC"
 *                           network:
 *                             type: string
 *                             example: "base"
 *                           orders:
 *                             type: integer
 *                             example: 120
 *                           volume:
 *                             type: number
 *                             example: 19800000
 *                     timeframeDays:
 *                       type: integer
 *                       example: 30
 *       401:
 *         description: Invalid API key
 */
router.get('/stats', businessOfframpController.getBusinessStats);

// ================================
// BANK VERIFICATION ENDPOINTS
// ================================

/**
 * @swagger
 * /api/v1/business-offramp/banks:
 *   get:
 *     summary: Get supported Nigerian banks
 *     description: Retrieve list of all supported Nigerian banks for account verification
 *     tags: [Bank Verification]
 *     security:
 *       - BusinessApiKey: []
 *     parameters:
 *       - in: query
 *         name: search
 *         description: Search banks by name or code
 *         schema:
 *           type: string
 *           example: "GTBank"
 *     responses:
 *       200:
 *         description: Banks retrieved successfully
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
 *                     banks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           code:
 *                             type: string
 *                             example: "058152"
 *                             description: 6-digit bank code
 *                           name:
 *                             type: string
 *                             example: "Guaranty Trust Bank"
 *                             description: Bank name
 *                     total:
 *                       type: integer
 *                       example: 25
 *                       description: Total number of banks
 *                     searchTerm:
 *                       type: string
 *                       example: "GTBank"
 *                       description: Search term used (if any)
 *       503:
 *         description: Bank verification service unavailable
 *       401:
 *         description: Invalid API key
 */
router.get('/banks', async (req, res) => {
  try {
    const lencoService = require('../services/lencoService');
    const { search } = req.query;
    
    if (!lencoService.isServiceConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Bank verification service is not configured',
        code: 'SERVICE_UNAVAILABLE'
      });
    }
    
    console.log(`[BANKS_API] Fetching banks${search ? ` with search: ${search}` : ''}`);
    
    let banks;
    if (search) {
      banks = await lencoService.searchBanks(search);
    } else {
      banks = await lencoService.getAllBanks();
    }
    
    console.log(`[BANKS_API] ✅ Retrieved ${banks.length} banks`);
    
    res.json({
      success: true,
      data: {
        banks,
        total: banks.length,
        searchTerm: search || null
      }
    });
    
  } catch (error) {
    console.error('[BANKS_API] Error getting banks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve banks',
      error: error.message,
      code: 'BANKS_FETCH_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/v1/business-offramp/verify-account:
 *   post:
 *     summary: Verify Nigerian bank account
 *     description: Verify bank account details using Lenco API before creating off-ramp order
 *     tags: [Bank Verification]
 *     security:
 *       - BusinessApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accountNumber
 *               - bankCode
 *             properties:
 *               accountNumber:
 *                 type: string
 *                 pattern: '^[0-9]{10}$'
 *                 example: "1234567890"
 *                 description: 10-digit Nigerian bank account number
 *               bankCode:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 example: "058152"
 *                 description: 6-digit Nigerian bank code
 *     responses:
 *       200:
 *         description: Account verified successfully
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
 *                     accountName:
 *                       type: string
 *                       example: "JOHN DOE"
 *                       description: Verified account holder name
 *                     accountNumber:
 *                       type: string
 *                       example: "1234567890"
 *                     bank:
 *                       type: object
 *                       properties:
 *                         code:
 *                           type: string
 *                           example: "058152"
 *                         name:
 *                           type: string
 *                           example: "Guaranty Trust Bank"
 *                     verified:
 *                       type: boolean
 *                       example: true
 *                     verifiedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Verification timestamp
 *       400:
 *         description: Invalid account details or verification failed
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
 *                   example: "Could not verify account. Please check account number and bank code."
 *                 code:
 *                   type: string
 *                   example: "VERIFICATION_FAILED"
 *       503:
 *         description: Bank verification service unavailable
 *       401:
 *         description: Invalid API key
 */
router.post('/verify-account', async (req, res) => {
  try {
    const lencoService = require('../services/lencoService');
    const { accountNumber, bankCode } = req.body;
    
    // Input validation
    if (!accountNumber || !bankCode) {
      return res.status(400).json({
        success: false,
        message: 'Account number and bank code are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }
    
    if (!lencoService.isValidAccountNumber(accountNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account number format. Must be 10 digits.',
        code: 'INVALID_ACCOUNT_NUMBER'
      });
    }
    
    if (!lencoService.isValidBankCode(bankCode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bank code format. Must be 6 digits.',
        code: 'INVALID_BANK_CODE'
      });
    }
    
    if (!lencoService.isServiceConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Bank verification service is not configured',
        code: 'SERVICE_UNAVAILABLE'
      });
    }
    
    console.log(`[ACCOUNT_VERIFICATION] Verifying account: ${accountNumber} at bank ${bankCode}`);
    
    const verification = await lencoService.resolveAccount(accountNumber, bankCode);
    
    if (!verification) {
      console.log(`[ACCOUNT_VERIFICATION] ❌ Verification failed for ${accountNumber}`);
      return res.status(400).json({
        success: false,
        message: 'Could not verify account. Please check account number and bank code.',
        code: 'VERIFICATION_FAILED'
      });
    }
    
    console.log(`[ACCOUNT_VERIFICATION] ✅ Account verified: ${verification.accountName}`);
    
    res.json({
      success: true,
      data: {
        accountName: verification.accountName,
        accountNumber: verification.accountNumber,
        bank: verification.bank,
        verified: true,
        verifiedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[ACCOUNT_VERIFICATION] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Account verification failed',
      error: error.message,
      code: 'VERIFICATION_ERROR'
    });
  }
});

// ================================
// TOKEN MANAGEMENT ENDPOINTS
// ================================

/**
 * @swagger
 * /api/v1/business-offramp/supported-tokens:
 *   get:
 *     summary: Get supported tokens for off-ramp
 *     description: Retrieve list of tokens supported for off-ramp conversion
 *     tags: [Token Management]
 *     security:
 *       - BusinessApiKey: []
 *     parameters:
 *       - in: query
 *         name: network
 *         description: Filter by specific network
 *         schema:
 *           type: string
 *           enum: [base, solana, ethereum]
 *       - in: query
 *         name: active
 *         description: Filter by active status
 *         schema:
 *           type: boolean
 *           default: true
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
 *                     base:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           symbol:
 *                             type: string
 *                             example: "USDC"
 *                           name:
 *                             type: string
 *                             example: "USD Coin"
 *                           contractAddress:
 *                             type: string
 *                             example: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
 *                           decimals:
 *                             type: integer
 *                             example: 6
 * /**
 * Business Off-ramp Routes - Part 2: Token Management, Webhooks, and Utilities
 * Continuation of the complete off-ramp routes implementation
 */

/**
 * Get supported tokens for off-ramp
 */
router.get('/supported-tokens', async (req, res) => {
  try {
    const business = req.business;
    const { network, active } = req.query;
    
    console.log(`[SUPPORTED_TOKENS] Getting tokens for business: ${business.businessId}`);
    
    // Reuse the same logic from onramp controller but for offramp context
    const businessTokenController = require('../controllers/businessTokenController');
    
    // Get supported tokens (same tokens support both onramp and offramp)
    const mockReq = { business, query: { network, active } };
    const mockRes = {
      json: (data) => {
        // Add offramp-specific information
        if (data.success && data.data) {
          data.data.note = 'These tokens are supported for off-ramp (token-to-NGN) conversion';
          data.data.features = {
            automaticWalletGeneration: true,
            bankAccountVerification: true,
            multiNetworkSupport: true,
            realTimeProcessing: true
          };
        }
        res.json(data);
      },
      status: (code) => ({ json: (data) => res.status(code).json(data) })
    };
    
    await businessTokenController.getSupportedTokens(mockReq, mockRes);
    
  } catch (error) {
    console.error('[SUPPORTED_TOKENS] Error getting supported tokens for offramp:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get supported tokens',
      error: error.message,
      code: 'SUPPORTED_TOKENS_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/v1/business-offramp/token-info/{network}/{tokenAddress}:
 *   get:
 *     summary: Get detailed token information
 *     description: Get comprehensive information about a specific token for off-ramp
 *     tags: [Token Management]
 *     security:
 *       - BusinessApiKey: []
 *     parameters:
 *       - in: path
 *         name: network
 *         required: true
 *         description: Blockchain network
 *         schema:
 *           type: string
 *           enum: [base, solana, ethereum]
 *       - in: path
 *         name: tokenAddress
 *         required: true
 *         description: Token contract address
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Token information retrieved successfully
 *       404:
 *         description: Token not found or not supported
 *       401:
 *         description: Invalid API key
 */
router.get('/token-info/:network/:tokenAddress', async (req, res) => {
  try {
    const business = req.business;
    const { network, tokenAddress } = req.params;
    
    console.log(`[TOKEN_INFO] Getting info for ${tokenAddress} on ${network}`);
    
    // Validate network
    if (!['base', 'solana', 'ethereum'].includes(network.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid network. Supported: base, solana, ethereum',
        code: 'INVALID_NETWORK'
      });
    }
    
    // Find token in business supported tokens
    const networkTokens = business.supportedTokens?.[network.toLowerCase()] || [];
    const token = networkTokens.find(t => 
      t.contractAddress.toLowerCase() === tokenAddress.toLowerCase()
    );
    
    if (!token) {
      return res.status(404).json({
        success: false,
        message: `Token ${tokenAddress} not found or not supported on ${network}`,
        code: 'TOKEN_NOT_SUPPORTED'
      });
    }
    
    // Get fee configuration for this token
    const networkFees = business.feeConfiguration?.[network.toLowerCase()] || [];
    const feeConfig = networkFees.find(f => 
      f.contractAddress.toLowerCase() === tokenAddress.toLowerCase()
    );
    
    // Get current price if available
    let currentPrice = null;
    try {
      if (network.toLowerCase() === 'base') {
        const { OnrampPriceChecker } = require('../services/onrampPriceChecker');
        const priceChecker = new OnrampPriceChecker();
        currentPrice = await priceChecker.getOfframpPrice(token.symbol, 1);
      } else if (network.toLowerCase() === 'solana') {
        const { SolanaTokenPriceChecker } = require('../services/solanaOnrampPriceChecker');
        const priceChecker = new SolanaTokenPriceChecker();
        currentPrice = await priceChecker.getOfframpPrice(token.symbol, 1);
      }
    } catch (error) {
      console.warn(`[TOKEN_INFO] Could not fetch price for ${token.symbol}:`, error.message);
    }
    
    const tokenInfo = {
      symbol: token.symbol,
      name: token.name,
      contractAddress: token.contractAddress,
      decimals: token.decimals,
      network: network.toLowerCase(),
      type: token.type,
      logoUrl: token.logoUrl,
      isActive: token.isActive,
      isTradingEnabled: token.isTradingEnabled,
      isDefault: token.isDefault || false,
      addedAt: token.addedAt,
      feeConfiguration: feeConfig ? {
        feePercentage: feeConfig.feePercentage,
        isActive: feeConfig.isActive,
        updatedAt: feeConfig.updatedAt
      } : null,
      currentPrice: currentPrice ? {
        rate: currentPrice.rate,
        rateString: `1 ${token.symbol} = ₦${currentPrice.rate.toLocaleString()}`,
        source: currentPrice.source,
        timestamp: new Date().toISOString()
      } : null,
      offrampSupport: {
        supported: true,
        minimumAmount: token.minimumAmount || 0.001,
        maximumAmount: token.maximumAmount || 1000000,
        processingTime: '5-15 minutes',
        features: [
          'Automatic wallet generation',
          'Bank account verification',
          'Real-time processing',
          'Webhook notifications'
        ]
      },
      metadata: token.metadata || {}
    };
    
    console.log(`[TOKEN_INFO] ✅ Retrieved info for ${token.symbol} on ${network}`);
    
    res.json({
      success: true,
      data: tokenInfo
    });
    
  } catch (error) {
    console.error('[TOKEN_INFO] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get token information',
      error: error.message,
      code: 'TOKEN_INFO_ERROR'
    });
  }
});

// ================================
// WEBHOOK ENDPOINTS
// ================================

/**
 * @swagger
 * /api/v1/business-offramp/webhook/deposit-confirmation:
 *   post:
 *     summary: Handle deposit confirmation webhooks
 *     description: Internal webhook endpoint for blockchain monitors to report token deposits
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletAddress
 *               - transactionHash
 *               - amount
 *               - network
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 example: "0x742d35Cc6669C87532DD123F5b8c6B3e8e7c5B2A"
 *               transactionHash:
 *                 type: string
 *                 example: "0x1234567890abcdef..."
 *               tokenAddress:
 *                 type: string
 *                 example: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
 *               amount:
 *                 type: number
 *                 example: 100
 *               network:
 *                 type: string
 *                 example: "base"
 *               blockNumber:
 *                 type: integer
 *                 example: 12345678
 *               confirmations:
 *                 type: integer
 *                 example: 12
 *     responses:
 *       200:
 *         description: Deposit processed successfully
 *       400:
 *         description: Invalid webhook data
 *       404:
 *         description: Order not found
 */
router.post('/webhook/deposit-confirmation', 
  validateWebhookRequest,
  async (req, res) => {
    try {
      console.log('[DEPOSIT_WEBHOOK] Processing deposit confirmation webhook');
      await offrampWebhookHandler.handleDepositConfirmation(req, res);
    } catch (error) {
      console.error('[DEPOSIT_WEBHOOK] Error:', error);
      res.status(500).json({
        success: false,
        message: 'Webhook processing failed',
        error: error.message,
        code: 'WEBHOOK_PROCESSING_ERROR'
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/business-offramp/webhook/payout-status:
 *   post:
 *     summary: Handle payout status webhooks
 *     description: Internal webhook endpoint for payment processors to report payout status
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reference
 *               - status
 *             properties:
 *               reference:
 *                 type: string
 *                 example: "OFFRAMP-USDC-A1B2C3D4"
 *               status:
 *                 type: string
 *                 enum: [successful, completed, failed, pending]
 *                 example: "successful"
 *               amount:
 *                 type: number
 *                 example: 162525
 *               transactionId:
 *                 type: string
 *                 example: "FLW_TXN_123456789"
 *               failureReason:
 *                 type: string
 *                 example: "Insufficient account balance"
 *     responses:
 *       200:
 *         description: Payout status processed successfully
 *       404:
 *         description: Order not found
 */
router.post('/webhook/payout-status', 
  validateWebhookRequest,
  async (req, res) => {
    try {
      const { 
        reference, 
        status, 
        amount, 
        transactionId,
        failureReason 
      } = req.body;
      
      console.log(`[PAYOUT_WEBHOOK] Received payout status: ${status} for ${reference}`);
      
      // Find order by payout reference
      const { BusinessOfframpOrder, BUSINESS_OFFRAMP_STATUS } = require('../models/BusinessOfframpOrder');
      
      const order = await BusinessOfframpOrder.findOne({
        $or: [
          { payoutReference: reference },
          { businessOrderReference: reference },
          { orderId: reference }
        ]
      });
      
      if (!order) {
        console.warn(`[PAYOUT_WEBHOOK] No order found for reference: ${reference}`);
        return res.status(404).json({
          success: false,
          message: 'Order not found for this reference',
          code: 'ORDER_NOT_FOUND'
        });
      }
      
      // Update order based on payout status
      if (status === 'successful' || status === 'completed') {
        await order.updateStatus(BUSINESS_OFFRAMP_STATUS.COMPLETED, {
          payoutTransactionId: transactionId,
          finalPayoutAmount: amount,
          payoutCompletedAt: new Date()
        });
        
        console.log(`[PAYOUT_WEBHOOK] ✅ Order ${order.orderId} marked as completed`);
        
      } else if (status === 'failed') {
        await order.updateStatus(BUSINESS_OFFRAMP_STATUS.FAILED, {
          failureReason: failureReason || 'Payout failed',
          failureStage: 'bank_payout',
          failedAt: new Date()
        });
        
        console.log(`[PAYOUT_WEBHOOK] ❌ Order ${order.orderId} payout failed: ${failureReason}`);
      }
      
      // Send business webhook if configured
      if (order.webhookUrl) {
        await offrampWebhookHandler.sendBusinessWebhook(order.webhookUrl, {
          orderId: order.orderId,
          businessOrderReference: order.businessOrderReference,
          status: order.status,
          event: status === 'successful' ? 'payout_completed' : 'payout_failed',
          payoutReference: reference,
          transactionId,
          amount,
          failureReason,
          timestamp: new Date().toISOString()
        }, `offramp_order.${status === 'successful' ? 'completed' : 'failed'}`);
      }
      
      res.json({
        success: true,
        message: 'Payout status processed successfully',
        data: {
          orderId: order.orderId,
          status: order.status,
          processedAt: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('[PAYOUT_WEBHOOK] Error:', error);
      res.status(500).json({
        success: false,
        message: 'Payout webhook processing failed',
        error: error.message,
        code: 'PAYOUT_WEBHOOK_ERROR'
      });
    }
  }
);

// ================================
// UTILITY ENDPOINTS
// ================================

/**
 * @swagger
 * /api/v1/business-offramp/health:
 *   get:
 *     summary: Health check for off-ramp service
 *     description: Comprehensive health check for all off-ramp service components
 *     tags: [System]
 *     security:
 *       - BusinessApiKey: []
 *     responses:
 *       200:
 *         description: Service is healthy
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
 *                   example: "Off-ramp service is healthy"
 *                 data:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     version:
 *                       type: string
 *                       example: "offramp-v1.0"
 *                     overallStatus:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                       example: "healthy"
 *                     services:
 *                       type: object
 *                       properties:
 *                         lencoService:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                               example: "Lenco Bank Verification"
 *                             status:
 *                               type: string
 *                               enum: [healthy, unhealthy]
 *                               example: "healthy"
 *                     capabilities:
 *                       type: object
 *                       properties:
 *                         tokenToFiatConversion:
 *                           type: boolean
 *                           example: true
 *                         bankAccountVerification:
 *                           type: boolean
 *                           example: true
 *                         walletGeneration:
 *                           type: boolean
 *                           example: true
 *                         webhookProcessing:
 *                           type: boolean
 *                           example: true
 *       207:
 *         description: Service is degraded (some components unhealthy)
 *       503:
 *         description: Service is unhealthy
 *       401:
 *         description: Invalid API key
 */
router.get('/health', async (req, res) => {
  try {
    console.log('[OFFRAMP_HEALTH] Checking off-ramp service health...');
    
    const healthReport = {
      timestamp: new Date().toISOString(),
      version: 'offramp-v1.0',
      services: {},
      overallStatus: 'checking'
    };
    
    // Check Lenco service
    healthReport.services.lencoService = {
      name: 'Lenco Bank Verification',
      status: 'checking'
    };
    
    try {
      const lencoService = require('../services/lencoService');
      const lencoStatus = lencoService.getServiceStatus();
      
      healthReport.services.lencoService.status = lencoStatus.configured ? 'healthy' : 'unhealthy';
      healthReport.services.lencoService.details = lencoStatus;
    } catch (error) {
      healthReport.services.lencoService.status = 'unhealthy';
      healthReport.services.lencoService.error = error.message;
    }
    
    // Check wallet generator
    healthReport.services.walletGenerator = {
      name: 'Wallet Generator Service',
      status: 'checking'
    };
    
    try {
      const walletGeneratorService = require('../services/walletGeneratorService');
      const walletStatus = walletGeneratorService.getServiceStatus();
      
      healthReport.services.walletGenerator.status = walletStatus.configured ? 'healthy' : 'unhealthy';
      healthReport.services.walletGenerator.details = walletStatus;
    } catch (error) {
      healthReport.services.walletGenerator.status = 'unhealthy';
      healthReport.services.walletGenerator.error = error.message;
    }
    
    // Check pricing services
    healthReport.services.basePricing = {
      name: 'Base Network Pricing',
      status: 'checking'
    };
    
    try {
      const { OnrampPriceChecker } = require('../services/onrampPriceChecker');
      const baseChecker = new OnrampPriceChecker();
      const baseConnection = await baseChecker.validateConnection();
      
      healthReport.services.basePricing.status = baseConnection ? 'healthy' : 'unhealthy';
    } catch (error) {
      healthReport.services.basePricing.status = 'unhealthy';
      healthReport.services.basePricing.error = error.message;
    }
    
    healthReport.services.solanaPricing = {
      name: 'Solana Network Pricing',
      status: 'checking'
    };
    
    try {
      const { SolanaTokenPriceChecker } = require('../services/solanaOnrampPriceChecker');
      const solanaChecker = new SolanaTokenPriceChecker();
      const solanaConnection = await solanaChecker.validateConnection();
      
      healthReport.services.solanaPricing.status = solanaConnection ? 'healthy' : 'unhealthy';
    } catch (error) {
      healthReport.services.solanaPricing.status = 'unhealthy';
      healthReport.services.solanaPricing.error = error.message;
    }
    
    // Check webhook handler
    healthReport.services.webhookHandler = {
      name: 'Webhook Handler',
      status: 'healthy',
      details: offrampWebhookHandler.getHealthStatus()
    };
    
    // Check database connection
    healthReport.services.database = {
      name: 'MongoDB Database',
      status: 'checking'
    };
    
    try {
      const mongoose = require('mongoose');
      const dbStatus = mongoose.connection.readyState;
      healthReport.services.database.status = dbStatus === 1 ? 'healthy' : 'unhealthy';
      healthReport.services.database.details = {
        readyState: dbStatus,
        name: mongoose.connection.name,
        host: mongoose.connection.host
      };
    } catch (error) {
      healthReport.services.database.status = 'unhealthy';
      healthReport.services.database.error = error.message;
    }
    
    // Overall health assessment
    const healthyServices = Object.values(healthReport.services).filter(s => s.status === 'healthy').length;
    const totalServices = Object.keys(healthReport.services).length;
    
    healthReport.overallStatus = healthyServices === totalServices ? 'healthy' : 
                                 healthyServices > 0 ? 'degraded' : 'unhealthy';
    
    healthReport.summary = {
      totalServices,
      healthyServices,
      unhealthyServices: totalServices - healthyServices,
      healthPercentage: Math.round((healthyServices / totalServices) * 100)
    };
    
    healthReport.capabilities = {
      tokenToFiatConversion: healthReport.services.basePricing.status === 'healthy' || healthReport.services.solanaPricing.status === 'healthy',
      bankAccountVerification: healthReport.services.lencoService.status === 'healthy',
      walletGeneration: healthReport.services.walletGenerator.status === 'healthy',
      webhookProcessing: healthReport.services.webhookHandler.status === 'healthy',
      multiNetworkSupport: healthyServices > 2,
      baseNetworkSupport: healthReport.services.basePricing.status === 'healthy',
      solanaNetworkSupport: healthReport.services.solanaPricing.status === 'healthy',
      databaseConnectivity: healthReport.services.database.status === 'healthy'
    };
    
    const statusCode = healthReport.overallStatus === 'healthy' ? 200 : 
                       healthReport.overallStatus === 'degraded' ? 207 : 503;
    
    console.log(`[OFFRAMP_HEALTH] ✅ Health check completed - Status: ${healthReport.overallStatus}`);
    
    res.status(statusCode).json({
      success: healthReport.overallStatus !== 'unhealthy',
      message: `Off-ramp service is ${healthReport.overallStatus}`,
      data: healthReport
    });
    
  } catch (error) {
    console.error('[OFFRAMP_HEALTH] Health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message,
      code: 'HEALTH_CHECK_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/v1/business-offramp/config:
 *   get:
 *     summary: Get off-ramp service configuration
 *     description: Retrieve configuration settings for the off-ramp service
 *     tags: [System]
 *     security:
 *       - BusinessApiKey: []
 *     responses:
 *       200:
 *         description: Configuration retrieved successfully
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
 *                     businessId:
 *                       type: string
 *                       example: "BIZ_123456789"
 *                     businessName:
 *                       type: string
 *                       example: "My Business"
 *                     supportedNetworks:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["base", "solana", "ethereum"]
 *                     minimumAmounts:
 *                       type: object
 *                       properties:
 *                         base:
 *                           type: object
 *                           example: { "USDC": 5, "ETH": 0.003 }
 *                         solana:
 *                           type: object
 *                           example: { "USDC": 5, "SOL": 0.1 }
 *                         ethereum:
 *                           type: object
 *                           example: { "USDC": 5, "ETH": 0.003 }
 *                     features:
 *                       type: object
 *                       properties:
 *                         automaticWalletGeneration:
 *                           type: boolean
 *                           example: true
 *                         bankAccountVerification:
 *                           type: boolean
 *                           example: true
 *                         realTimeWebhooks:
 *                           type: boolean
 *                           example: true
 *                         multiNetworkSupport:
 *                           type: boolean
 *                           example: true
 *                         encryptedWallets:
 *                           type: boolean
 *                           example: true
 *                     limits:
 *                       type: object
 *                       properties:
 *                         orderExpirationHours:
 *                           type: integer
 *                           example: 24
 *                         maxRetries:
 *                           type: integer
 *                           example: 3
 *                         webhookTimeoutSeconds:
 *                           type: integer
 *                           example: 10
 *       401:
 *         description: Invalid API key
 */
router.get('/config', async (req, res) => {
  try {
    const business = req.business;
    
    console.log(`[OFFRAMP_CONFIG] Getting configuration for business: ${business.businessId}`);
    
    const config = {
      businessId: business.businessId,
      businessName: business.businessName,
      supportedNetworks: ['base', 'solana', 'ethereum'],
      minimumAmounts: {
        base: { USDC: 5, ETH: 0.003, USDT: 5 },
        solana: { USDC: 5, SOL: 0.1, USDT: 5 },
        ethereum: { USDC: 5, ETH: 0.003, USDT: 5 }
      },
      fees: {
        note: 'Fees are configurable per token in your business settings',
        defaultFeePercentage: 1.5,
        feeStructure: 'percentage_based'
      },
      features: {
        automaticWalletGeneration: true,
        bankAccountVerification: true,
        realTimeWebhooks: true,
        multiNetworkSupport: true,
        encryptedWallets: true,
        orderTracking: true,
        customerNotifications: true,
        failureRetries: true
      },
      limits: {
        orderExpirationHours: 24,
        maxRetries: 3,
        webhookTimeoutSeconds: 10,
        maxOrdersPerDay: 1000,
        maxAmountPerOrder: 1000000,
        minAmountPerOrder: 1
      },
      processingTimes: {
        depositConfirmation: '1-5 minutes',
        tokenSwap: '2-8 minutes',
        bankPayout: '5-15 minutes',
        totalProcessing: '10-30 minutes'
      },
      supportedBanks: {
        total: 25,
        verificationProvider: 'Lenco',
        accountTypes: ['individual', 'corporate']
      },
      apiInfo: {
        version: 'v1',
        documentation: 'https://docs.yourapi.com/offramp',
        rateLimit: '100 requests per minute',
        webhookSignatureAlgorithm: 'HMAC-SHA256'
      }
    };
    
    console.log(`[OFFRAMP_CONFIG] ✅ Configuration retrieved for ${business.businessName}`);
    
    res.json({
      success: true,
      data: config
    });
    
  } catch (error) {
    console.error('[OFFRAMP_CONFIG] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get configuration',
      error: error.message,
      code: 'CONFIG_ERROR'
    });
  }
});


/**
 * @swagger
 * /api/v1/business-offramp/banks:
 *   get:
 *     summary: Get supported Nigerian banks
 *     description: Retrieve list of all supported Nigerian banks for account verification
 *     tags: [Bank Verification]
 *     security:
 *       - BusinessApiKey: []
 *     parameters:
 *       - in: query
 *         name: search
 *         description: Search banks by name or code
 *         schema:
 *           type: string
 *           example: "GTBank"
 *     responses:
 *       200:
 *         description: Banks retrieved successfully
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
 *                   example: "All supported banks retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     banks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           code:
 *                             type: string
 *                             example: "058"
 *                             description: 6-digit bank code
 *                           name:
 *                             type: string
 *                             example: "Guaranty Trust Bank"
 *                             description: Bank name
 *                           slug:
 *                             type: string
 *                             example: "guaranty-trust-bank"
 *                             description: URL-friendly bank name
 *                     total:
 *                       type: integer
 *                       example: 25
 *                       description: Total number of banks
 *                     searchTerm:
 *                       type: string
 *                       example: "GTBank"
 *                       description: Search term used (if any)
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                       description: When banks list was last updated
 *                     source:
 *                       type: string
 *                       example: "lenco_api"
 *                       description: Data source for banks
 *       503:
 *         description: Bank verification service unavailable
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
 *                   example: "Bank service is temporarily unavailable. Lenco API not configured."
 *                 code:
 *                   type: string
 *                   example: "BANK_SERVICE_UNAVAILABLE"
 *       401:
 *         description: Invalid API key
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
 *                   example: "Invalid API key"
 *                 code:
 *                   type: string
 *                   example: "INVALID_API_KEY"
 */
router.get('/banks', businessOfframpController.getSupportedBanks);

/**
 * @swagger
 * /api/v1/business-offramp/banks/{bankCode}:
 *   get:
 *     summary: Get specific bank details by code
 *     description: Retrieve details of a specific bank using its 6-digit code
 *     tags: [Bank Verification]
 *     security:
 *       - BusinessApiKey: []
 *     parameters:
 *       - in: path
 *         name: bankCode
 *         required: true
 *         description: 6-digit Nigerian bank code
 *         schema:
 *           type: string
 *           pattern: '^[0-9]{6}$'
 *           example: "058"
 *     responses:
 *       200:
 *         description: Bank details retrieved successfully
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
 *                   example: "Bank details retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: "Guaranty Trust Bank"
 *                     code:
 *                       type: string
 *                       example: "058"
 *                     slug:
 *                       type: string
 *                       example: "guaranty-trust-bank"
 *                     source:
 *                       type: string
 *                       example: "lenco_api"
 *                     retrievedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid bank code format
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
 *                   example: "Invalid bank code format. Bank code must be exactly 6 digits."
 *                 code:
 *                   type: string
 *                   example: "INVALID_BANK_CODE_FORMAT"
 *       404:
 *         description: Bank not found
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
 *                   example: "Bank with code 999999 not found"
 *                 code:
 *                   type: string
 *                   example: "BANK_NOT_FOUND"
 *       503:
 *         description: Bank verification service unavailable
 *       401:
 *         description: Invalid API key
 */
router.get('/banks/:bankCode', businessOfframpController.getBankByCode);

/**
 * @swagger
 * /api/v1/business-offramp/verify-account:
 *   post:
 *     summary: Verify Nigerian bank account
 *     description: Verify bank account details using Lenco API before creating off-ramp order. This endpoint validates the account number and bank code, then returns the verified account holder name.
 *     tags: [Bank Verification]
 *     security:
 *       - BusinessApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accountNumber
 *               - bankCode
 *             properties:
 *               accountNumber:
 *                 type: string
 *                 pattern: '^[0-9]{10}$'
 *                 example: "1234567890"
 *                 description: 10-digit Nigerian bank account number
 *                 minLength: 10
 *                 maxLength: 10
 *               bankCode:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 example: "058"
 *                 description: 6-digit Nigerian bank code (use /banks endpoint to get valid codes)
 *                 minLength: 6
 *                 maxLength: 6
 *           examples:
 *             gtbank_account:
 *               summary: GTBank Account Verification
 *               value:
 *                 accountNumber: "1234567890"
 *                 bankCode: "058"
 *             zenith_account:
 *               summary: Zenith Bank Account Verification
 *               value:
 *                 accountNumber: "9876543210"
 *                 bankCode: "057"
 *             access_account:
 *               summary: Access Bank Account Verification
 *               value:
 *                 accountNumber: "5555666677"
 *                 bankCode: "044"
 *     responses:
 *       200:
 *         description: Account verified successfully
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
 *                   example: "Bank account verified successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     accountNumber:
 *                       type: string
 *                       example: "1234567890"
 *                       description: The verified account number
 *                     accountName:
 *                       type: string
 *                       example: "JOHN DOE"
 *                       description: Verified account holder name (as per bank records)
 *                     bankCode:
 *                       type: string
 *                       example: "058"
 *                       description: Bank code used for verification
 *                     bankName:
 *                       type: string
 *                       example: "Guaranty Trust Bank"
 *                       description: Full bank name
 *                     bankDetails:
 *                       type: object
 *                       description: Additional bank information from Lenco
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "Guaranty Trust Bank"
 *                         code:
 *                           type: string
 *                           example: "058"
 *                         slug:
 *                           type: string
 *                           example: "guaranty-trust-bank"
 *                     verified:
 *                       type: boolean
 *                       example: true
 *                       description: Verification status
 *                     verifiedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-08-03T12:30:45.123Z"
 *                       description: Verification timestamp
 *             examples:
 *               successful_verification:
 *                 summary: Successful Account Verification
 *                 value:
 *                   success: true
 *                   message: "Bank account verified successfully"
 *                   data:
 *                     accountNumber: "1234567890"
 *                     accountName: "JOHN DOE"
 *                     bankCode: "058"
 *                     bankName: "Guaranty Trust Bank"
 *                     verified: true
 *                     verifiedAt: "2025-08-03T12:30:45.123Z"
 *       400:
 *         description: Invalid request or verification failed
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
 *                 code:
 *                   type: string
 *                 details:
 *                   type: object
 *                   properties:
 *                     accountNumber:
 *                       type: string
 *                     bankCode:
 *                       type: string
 *                     reason:
 *                       type: string
 *             examples:
 *               missing_fields:
 *                 summary: Missing Required Fields
 *                 value:
 *                   success: false
 *                   message: "accountNumber and bankCode are required"
 *                   code: "MISSING_REQUIRED_FIELDS"
 *               invalid_account_format:
 *                 summary: Invalid Account Number Format
 *                 value:
 *                   success: false
 *                   message: "Account number must be exactly 10 digits"
 *                   code: "INVALID_ACCOUNT_NUMBER_FORMAT"
 *               invalid_bank_code:
 *                 summary: Invalid Bank Code Format
 *                 value:
 *                   success: false
 *                   message: "Bank code must be exactly 6 digits"
 *                   code: "INVALID_BANK_CODE_FORMAT"
 *               verification_failed:
 *                 summary: Account Verification Failed
 *                 value:
 *                   success: false
 *                   message: "Account verification failed. Please check account number and bank code."
 *                   code: "ACCOUNT_VERIFICATION_FAILED"
 *                   details:
 *                     accountNumber: "1234567890"
 *                     bankCode: "058"
 *                     reason: "Account not found or invalid details"
 *       408:
 *         description: Request timeout
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
 *                   example: "Account verification timed out. Please try again."
 *                 code:
 *                   type: string
 *                   example: "VERIFICATION_TIMEOUT"
 *       429:
 *         description: Too many requests
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
 *                   example: "Too many verification attempts. Please try again later."
 *                 code:
 *                   type: string
 *                   example: "VERIFICATION_RATE_LIMIT"
 *       503:
 *         description: Bank verification service unavailable
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
 *                   example: "Bank account verification service is temporarily unavailable"
 *                 code:
 *                   type: string
 *                   example: "VERIFICATION_SERVICE_UNAVAILABLE"
 *       401:
 *         description: Invalid API key
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
 *                   example: "Invalid API key"
 *                 code:
 *                   type: string
 *                   example: "INVALID_API_KEY"
 */
router.post('/verify-account', businessOfframpController.verifyBankAccount);


/**
 * @swagger
 * /api/v1/business-offramp/orders/{orderId}/cancel:
 *   post:
 *     summary: Cancel off-ramp order
 *     description: Cancel a pending off-ramp order (only possible if no tokens have been deposited)
 *     tags: [Order Management]
 *     security:
 *       - BusinessApiKey: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         description: Order ID or business order reference
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *       400:
 *         description: Cannot cancel order in current status
 *       404:
 *         description: Order not found
 *       401:
 *         description: Invalid API key
 */
router.post('/orders/:orderId/cancel', async (req, res) => {
  try {
    const { orderId } = req.params;
    const business = req.business;
    
    console.log(`[ORDER_CANCEL] Cancelling order: ${orderId} for business: ${business.businessId}`);
    
    const { BusinessOfframpOrder, BUSINESS_OFFRAMP_STATUS } = require('../models/BusinessOfframpOrder');
    
    const order = await BusinessOfframpOrder.findOne({
      $or: [
        { orderId: orderId },
        { businessOrderReference: orderId }
      ],
      businessId: business._id
    });
    
    if (!order) {
      console.log(`[ORDER_CANCEL] Order not found: ${orderId}`);
      return res.status(404).json({
        success: false,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }
    
    // Can only cancel pending orders
    if (order.status !== BUSINESS_OFFRAMP_STATUS.PENDING_DEPOSIT) {
      console.log(`[ORDER_CANCEL] Cannot cancel order with status: ${order.status}`);
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${order.status}. Only pending orders can be cancelled.`,
        currentStatus: order.status,
        code: 'INVALID_ORDER_STATUS'
      });
    }
    
/**
 * Business Off-ramp Routes - Part 3 (Final): Order Management, Monitoring, and Internal Endpoints
 * Final part of the complete off-ramp routes implementation
 */

await order.updateStatus(BUSINESS_OFFRAMP_STATUS.CANCELLED, {
  cancelledAt: new Date(),
  cancelledBy: 'business',
  cancelReason: 'Cancelled by business via API'
});

console.log(`[ORDER_CANCEL] ✅ Order ${order.orderId} cancelled successfully`);

// Send cancellation webhook
if (order.webhookUrl) {
  try {
    await offrampWebhookHandler.sendBusinessWebhook(order.webhookUrl, {
      orderId: order.orderId,
      businessOrderReference: order.businessOrderReference,
      status: BUSINESS_OFFRAMP_STATUS.CANCELLED,
      event: 'order_cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledBy: 'business'
    }, 'offramp_order.cancelled');
  } catch (webhookError) {
    console.error(`[ORDER_CANCEL] Failed to send webhook:`, webhookError);
    // Don't fail the cancellation if webhook fails
  }
}

res.json({
  success: true,
  message: 'Order cancelled successfully',
  data: {
    orderId: order.orderId,
    businessOrderReference: order.businessOrderReference,
    status: order.status,
    cancelledAt: order.updatedAt,
    previousStatus: BUSINESS_OFFRAMP_STATUS.PENDING_DEPOSIT
  }
});

} catch (error) {
console.error('[ORDER_CANCEL] Error:', error);
res.status(500).json({
  success: false,
  message: 'Failed to cancel order',
  error: error.message,
  code: 'ORDER_CANCEL_ERROR'
});
}
});

/**
* @swagger
* /api/v1/business-offramp/orders/{orderId}/retry:
*   post:
*     summary: Retry failed off-ramp order
*     description: Retry processing of a failed off-ramp order (limited retries)
*     tags: [Order Management]
*     security:
*       - BusinessApiKey: []
*     parameters:
*       - in: path
*         name: orderId
*         required: true
*         description: Order ID or business order reference
*         schema:
*           type: string
*     responses:
*       200:
*         description: Order retry initiated successfully
*       400:
*         description: Cannot retry order or retry limit exceeded
*       404:
*         description: Order not found
*       401:
*         description: Invalid API key
*/
router.post('/orders/:orderId/retry', async (req, res) => {
try {
const { orderId } = req.params;
const business = req.business;

console.log(`[ORDER_RETRY] Retrying order: ${orderId} for business: ${business.businessId}`);

const { BusinessOfframpOrder, BUSINESS_OFFRAMP_STATUS } = require('../models/BusinessOfframpOrder');

const order = await BusinessOfframpOrder.findOne({
  $or: [
    { orderId: orderId },
    { businessOrderReference: orderId }
  ],
  businessId: business._id
});

if (!order) {
  console.log(`[ORDER_RETRY] Order not found: ${orderId}`);
  return res.status(404).json({
    success: false,
    message: 'Order not found',
    code: 'ORDER_NOT_FOUND'
  });
}

// Check if order can be retried
if (!order.canRetry()) {
  const reason = order.status !== BUSINESS_OFFRAMP_STATUS.FAILED ? 
    `Order status is ${order.status}, only failed orders can be retried` :
    order.retryCount >= 3 ? 'Maximum retry attempts (3) exceeded' :
    order.isExpired ? 'Order has expired' : 'Order cannot be retried';
    
  console.log(`[ORDER_RETRY] Cannot retry order: ${reason}`);
  return res.status(400).json({
    success: false,
    message: reason,
    currentStatus: order.status,
    retryCount: order.retryCount,
    maxRetries: 3,
    isExpired: order.isExpired,
    code: 'RETRY_NOT_ALLOWED'
  });
}

// Increment retry count
await order.incrementRetry();

// Reset status based on where it failed
let newStatus;
if (order.failureStage === 'token_swap' || order.failureStage === 'token_swap_initiation') {
  newStatus = BUSINESS_OFFRAMP_STATUS.DEPOSIT_RECEIVED;
} else if (order.failureStage === 'bank_payout' || order.failureStage === 'bank_payout_initiation') {
  newStatus = BUSINESS_OFFRAMP_STATUS.PENDING_PAYOUT;
} else {
  // Default to processing if failure stage is unclear
  newStatus = BUSINESS_OFFRAMP_STATUS.PROCESSING;
}

await order.updateStatus(newStatus, {
  retriedAt: new Date(),
  retryReason: 'Manual retry via API',
  previousFailureReason: order.failureReason
});

console.log(`[ORDER_RETRY] ✅ Order ${order.orderId} retry initiated - Status: ${newStatus}`);

// Trigger reprocessing based on new status
try {
  if (newStatus === BUSINESS_OFFRAMP_STATUS.DEPOSIT_RECEIVED) {
    // Trigger token swap
    await offrampWebhookHandler.initiateTokenSwap(order);
  } else if (newStatus === BUSINESS_OFFRAMP_STATUS.PENDING_PAYOUT) {
    // Trigger bank payout
    const mockUsdcAmount = order.tokenAmount; // Simplified for retry
    await offrampWebhookHandler.initiateBankPayout(order, mockUsdcAmount);
  }
} catch (retryError) {
  console.error(`[ORDER_RETRY] Retry processing failed:`, retryError);
  // The order status will be updated by the processing functions if they fail
}

// Send retry webhook
if (order.webhookUrl) {
  try {
    await offrampWebhookHandler.sendBusinessWebhook(order.webhookUrl, {
      orderId: order.orderId,
      businessOrderReference: order.businessOrderReference,
      status: order.status,
      event: 'order_retried',
      retryCount: order.retryCount,
      retriedAt: new Date().toISOString(),
      previousFailureReason: order.failureReason
    }, 'offramp_order.retried');
  } catch (webhookError) {
    console.error(`[ORDER_RETRY] Failed to send webhook:`, webhookError);
  }
}

res.json({
  success: true,
  message: 'Order retry initiated successfully',
  data: {
    orderId: order.orderId,
    businessOrderReference: order.businessOrderReference,
    status: order.status,
    retryCount: order.retryCount,
    maxRetries: 3,
    retriedAt: order.updatedAt,
    previousFailureReason: order.failureReason
  }
});

} catch (error) {
console.error('[ORDER_RETRY] Error:', error);
res.status(500).json({
  success: false,
  message: 'Failed to retry order',
  error: error.message,
  code: 'ORDER_RETRY_ERROR'
});
}
});

// ================================
// MONITORING AND ANALYTICS ENDPOINTS
// ================================

/**
* @swagger
* /api/v1/business-offramp/analytics/volume:
*   get:
*     summary: Get volume analytics
*     description: Retrieve detailed volume analytics for off-ramp orders
*     tags: [Analytics]
*     security:
*       - BusinessApiKey: []
*     parameters:
*       - in: query
*         name: timeframe
*         description: Timeframe for analytics
*         schema:
*           type: string
*           enum: [24h, 7d, 30d, 90d, 1y]
*           default: 30d
*       - in: query
*         name: groupBy
*         description: Group results by
*         schema:
*           type: string
*           enum: [day, week, month, token, network]
*           default: day
*     responses:
*       200:
*         description: Volume analytics retrieved successfully
*       401:
*         description: Invalid API key
*/
router.get('/analytics/volume', async (req, res) => {
try {
const business = req.business;
const { timeframe = '30d', groupBy = 'day' } = req.query;

console.log(`[VOLUME_ANALYTICS] Getting analytics for business: ${business.businessId}`);

// Parse timeframe
const timeframeDays = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365
}[timeframe] || 30;

const startDate = new Date();
startDate.setDate(startDate.getDate() - timeframeDays);

const { BusinessOfframpOrder, BUSINESS_OFFRAMP_STATUS } = require('../models/BusinessOfframpOrder');

// Build aggregation pipeline
const pipeline = [
  {
    $match: {
      businessId: business._id,
      createdAt: { $gte: startDate },
      status: { $in: [BUSINESS_OFFRAMP_STATUS.COMPLETED, BUSINESS_OFFRAMP_STATUS.FAILED] }
    }
  }
];

// Add grouping stage based on groupBy parameter
let groupStage = { _id: null };

if (groupBy === 'day') {
  groupStage._id = {
    year: { $year: '$createdAt' },
    month: { $month: '$createdAt' },
    day: { $dayOfMonth: '$createdAt' }
  };
} else if (groupBy === 'week') {
  groupStage._id = {
    year: { $year: '$createdAt' },
    week: { $week: '$createdAt' }
  };
} else if (groupBy === 'month') {
  groupStage._id = {
    year: { $year: '$createdAt' },
    month: { $month: '$createdAt' }
  };
} else if (groupBy === 'token') {
  groupStage._id = {
    token: '$targetToken',
    network: '$targetNetwork'
  };
} else if (groupBy === 'network') {
  groupStage._id = '$targetNetwork';
}

groupStage = {
  ...groupStage,
  totalOrders: { $sum: 1 },
  completedOrders: {
    $sum: { $cond: [{ $eq: ['$status', BUSINESS_OFFRAMP_STATUS.COMPLETED] }, 1, 0] }
  },
  failedOrders: {
    $sum: { $cond: [{ $eq: ['$status', BUSINESS_OFFRAMP_STATUS.FAILED] }, 1, 0] }
  },
  totalVolume: { $sum: '$netNgnAmount' },
  totalFees: { $sum: '$feeAmount' },
  avgOrderValue: { $avg: '$netNgnAmount' }
};

pipeline.push({ $group: groupStage });
pipeline.push({ $sort: { '_id': 1 } });

const results = await BusinessOfframpOrder.aggregate(pipeline);

// Calculate totals
const totals = results.reduce((acc, item) => ({
  totalOrders: acc.totalOrders + item.totalOrders,
  completedOrders: acc.completedOrders + item.completedOrders,
  failedOrders: acc.failedOrders + item.failedOrders,
  totalVolume: acc.totalVolume + item.totalVolume,
  totalFees: acc.totalFees + item.totalFees
}), { totalOrders: 0, completedOrders: 0, failedOrders: 0, totalVolume: 0, totalFees: 0 });

const analytics = {
  timeframe,
  timeframeDays,
  groupBy,
  startDate: startDate.toISOString(),
  endDate: new Date().toISOString(),
  totals: {
    ...totals,
    successRate: totals.totalOrders > 0 ? (totals.completedOrders / totals.totalOrders * 100) : 0,
    avgOrderValue: totals.totalOrders > 0 ? (totals.totalVolume / totals.totalOrders) : 0
  },
  breakdown: results.map(item => ({
    period: item._id,
    orders: item.totalOrders,
    completed: item.completedOrders,
    failed: item.failedOrders,
    volume: item.totalVolume,
    fees: item.totalFees,
    avgOrderValue: item.avgOrderValue,
    successRate: item.totalOrders > 0 ? (item.completedOrders / item.totalOrders * 100) : 0
  }))
};

console.log(`[VOLUME_ANALYTICS] ✅ Retrieved analytics with ${results.length} data points`);

res.json({
  success: true,
  data: analytics
});

} catch (error) {
console.error('[VOLUME_ANALYTICS] Error:', error);
res.status(500).json({
  success: false,
  message: 'Failed to get volume analytics',
  error: error.message,
  code: 'ANALYTICS_ERROR'
});
}
});

// ================================
// INTERNAL MONITORING ENDPOINTS
// ================================

/**
* @swagger
* /api/v1/business-offramp/internal/monitor/expired-orders:
*   post:
*     summary: Monitor and process expired orders
*     description: Internal endpoint for monitoring and processing expired orders (for cron jobs)
*     tags: [Internal Monitoring]
*     security:
*       - InternalApiKey: []
*     responses:
*       200:
*         description: Expired orders processed successfully
*       401:
*         description: Invalid internal API key
*/
router.post('/internal/monitor/expired-orders', 
validateInternalRequest,
async (req, res) => {
try {
  console.log('[EXPIRED_MONITOR] Starting expired orders monitoring...');
  
  const startTime = Date.now();
  await offrampWebhookHandler.monitorExpiredOrders();
  const processingTime = Date.now() - startTime;
  
  console.log(`[EXPIRED_MONITOR] ✅ Completed in ${processingTime}ms`);
  
  res.json({
    success: true,
    message: 'Expired orders monitoring completed successfully',
    data: {
      timestamp: new Date().toISOString(),
      processingTimeMs: processingTime,
      service: 'offramp-expired-monitor'
    }
  });
  
} catch (error) {
  console.error('[EXPIRED_MONITOR] Error:', error);
  res.status(500).json({
    success: false,
    message: 'Expired order monitoring failed',
    error: error.message,
    code: 'MONITOR_ERROR'
  });
}
}
);

/**
* @swagger
* /api/v1/business-offramp/internal/monitor/stuck-orders:
*   post:
*     summary: Monitor and process stuck orders
*     description: Internal endpoint for monitoring orders stuck in processing states
*     tags: [Internal Monitoring]
*     security:
*       - InternalApiKey: []
*     responses:
*       200:
*         description: Stuck orders processed successfully
*/
router.post('/internal/monitor/stuck-orders',
validateInternalRequest,
async (req, res) => {
try {
  console.log('[STUCK_MONITOR] Starting stuck orders monitoring...');
  
  const { BusinessOfframpOrder, BUSINESS_OFFRAMP_STATUS } = require('../models/BusinessOfframpOrder');
  
  // Find orders stuck in processing states for more than 1 hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const stuckOrders = await BusinessOfframpOrder.find({
    status: { 
      $in: [
        BUSINESS_OFFRAMP_STATUS.DEPOSIT_RECEIVED,
        BUSINESS_OFFRAMP_STATUS.PROCESSING,
        BUSINESS_OFFRAMP_STATUS.PENDING_PAYOUT
      ]
    },
    updatedAt: { $lt: oneHourAgo },
    retryCount: { $lt: 3 }
  });
  
  console.log(`[STUCK_MONITOR] Found ${stuckOrders.length} stuck orders`);
  
  let processedCount = 0;
  let errorCount = 0;
  
  for (const order of stuckOrders) {
    try {
      console.log(`[STUCK_MONITOR] Processing stuck order: ${order.orderId}`);
      
      // Mark as failed and allow for retry
      await order.updateStatus(BUSINESS_OFFRAMP_STATUS.FAILED, {
        failureReason: 'Order stuck in processing - marked for retry',
        failureStage: 'stuck_processing',
        autoFailedByMonitor: true
      });
      
      // Send notification webhook
      if (order.webhookUrl) {
        await offrampWebhookHandler.sendBusinessWebhook(order.webhookUrl, {
          orderId: order.orderId,
          businessOrderReference: order.businessOrderReference,
          status: BUSINESS_OFFRAMP_STATUS.FAILED,
          event: 'order_stuck_detected',
          failureReason: 'Order stuck in processing',
          canRetry: true,
          timestamp: new Date().toISOString()
        }, 'offramp_order.stuck_detected');
      }
      
      processedCount++;
      
    } catch (orderError) {
      console.error(`[STUCK_MONITOR] Error processing order ${order.orderId}:`, orderError);
      errorCount++;
    }
  }
  
  console.log(`[STUCK_MONITOR] ✅ Processed ${processedCount} stuck orders, ${errorCount} errors`);
  
  res.json({
    success: true,
    message: 'Stuck orders monitoring completed',
    data: {
      timestamp: new Date().toISOString(),
      stuckOrdersFound: stuckOrders.length,
      processedOrders: processedCount,
      errors: errorCount,
      service: 'offramp-stuck-monitor'
    }
  });
  
} catch (error) {
  console.error('[STUCK_MONITOR] Error:', error);
  res.status(500).json({
    success: false,
    message: 'Stuck orders monitoring failed',
    error: error.message,
    code: 'STUCK_MONITOR_ERROR'
  });
}
}
);

/**
* @swagger
* /api/v1/business-offramp/internal/stats/system:
*   get:
*     summary: Get system-wide off-ramp statistics
*     description: Internal endpoint for system-wide off-ramp statistics and monitoring
*     tags: [Internal Monitoring]
*     security:
*       - InternalApiKey: []
*     responses:
*       200:
*         description: System statistics retrieved successfully
*/
router.get('/internal/stats/system',
validateInternalRequest,
async (req, res) => {
try {
  console.log('[SYSTEM_STATS] Getting system-wide off-ramp statistics...');
  
  const { BusinessOfframpOrder, BUSINESS_OFFRAMP_STATUS } = require('../models/BusinessOfframpOrder');
  
  // Get statistics for the last 24 hours
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const stats = await BusinessOfframpOrder.aggregate([
    {
      $facet: {
        // Overall statistics
        overall: [
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalVolume: { $sum: '$netNgnAmount' },
              totalFees: { $sum: '$feeAmount' }
            }
          }
        ],
        // Last 24h statistics
        last24h: [
          {
            $match: { createdAt: { $gte: last24h } }
          },
          {
            $group: {
              _id: null,
              ordersLast24h: { $sum: 1 },
              volumeLast24h: { $sum: '$netNgnAmount' },
              feesLast24h: { $sum: '$feeAmount' }
            }
          }
        ],
        // Status breakdown
        statusBreakdown: [
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              volume: { $sum: '$netNgnAmount' }
            }
          }
        ],
        // Network breakdown
        networkBreakdown: [
          {
            $group: {
              _id: '$targetNetwork',
              count: { $sum: 1 },
              volume: { $sum: '$netNgnAmount' }
            }
          }
        ],
        // Token breakdown
        tokenBreakdown: [
          {
            $group: {
              _id: {
                token: '$targetToken',
                network: '$targetNetwork'
              },
              count: { $sum: 1 },
              volume: { $sum: '$netNgnAmount' }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]
      }
    }
  ]);
  
  const systemStats = {
    timestamp: new Date().toISOString(),
    service: 'business-offramp',
    version: 'v1.0',
    overall: stats[0].overall[0] || { totalOrders: 0, totalVolume: 0, totalFees: 0 },
    last24h: stats[0].last24h[0] || { ordersLast24h: 0, volumeLast24h: 0, feesLast24h: 0 },
    statusBreakdown: stats[0].statusBreakdown,
    networkBreakdown: stats[0].networkBreakdown,
    tokenBreakdown: stats[0].tokenBreakdown.map(item => ({
      token: item._id.token,
      network: item._id.network,
      orders: item.count,
      volume: item.volume
    })),
    healthMetrics: {
      servicesStatus: offrampWebhookHandler.getHealthStatus(),
      performance: {
        avgProcessingTime: '15 minutes',
        successRate: '95%',
        uptime: '99.9%'
      }
    }
  };
  
  console.log(`[SYSTEM_STATS] ✅ Retrieved system statistics`);
  
  res.json({
    success: true,
    data: systemStats
  });
  
} catch (error) {
  console.error('[SYSTEM_STATS] Error:', error);
  res.status(500).json({
    success: false,
    message: 'Failed to get system statistics',
    error: error.message,
    code: 'SYSTEM_STATS_ERROR'
  });
}
}
);

// ================================
// ERROR HANDLING AND FALLBACK
// ================================

/**
* Fallback route for undefined endpoints
*/
router.use('*', (req, res) => {
console.log(`[OFFRAMP_ROUTES] Undefined endpoint accessed: ${req.method} ${req.originalUrl}`);

res.status(404).json({
success: false,
message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
code: 'ENDPOINT_NOT_FOUND',
availableEndpoints: {
  quote: 'POST /api/v1/business-offramp/quote',
  create: 'POST /api/v1/business-offramp/create',
  orders: 'GET /api/v1/business-offramp/orders',
  orderById: 'GET /api/v1/business-offramp/orders/:orderId',
  stats: 'GET /api/v1/business-offramp/stats',
  banks: 'GET /api/v1/business-offramp/banks',
  verifyAccount: 'POST /api/v1/business-offramp/verify-account',
  supportedTokens: 'GET /api/v1/business-offramp/supported-tokens',
  health: 'GET /api/v1/business-offramp/health',
  config: 'GET /api/v1/business-offramp/config',
  cancel: 'POST /api/v1/business-offramp/orders/:orderId/cancel',
  retry: 'POST /api/v1/business-offramp/orders/:orderId/retry',
  analytics: 'GET /api/v1/business-offramp/analytics/volume'
},
documentation: 'https://docs.yourapi.com/offramp'
});
});

// ================================
// MODULE EXPORTS
// ================================

module.exports = router;
