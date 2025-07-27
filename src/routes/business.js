const express = require('express');
const router = express.Router();
const businessController = require('../controllers/businessController');
const businessTokenController = require('../controllers/businessTokenController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * components:
 *   schemas:
 *     Business:
 *       type: object
 *       properties:
 *         businessId:
 *           type: string
 *           description: Unique business identifier
 *         businessName:
 *           type: string
 *           description: Business name
 *         businessType:
 *           type: string
 *           enum: [LLC, Corporation, Partnership, Sole Proprietorship, Non-Profit, Other]
 *           description: Type of business
 *         description:
 *           type: string
 *           description: Business description
 *         industry:
 *           type: string
 *           enum: [Technology, Finance, Healthcare, Education, E-commerce, Manufacturing, Real Estate, Consulting, Marketing, Food & Beverage, Entertainment, Transportation, Energy, Agriculture, Fintech, Cryptocurrency, Other]
 *           description: Business industry
 *         country:
 *           type: string
 *           description: Business country
 *         website:
 *           type: string
 *           description: Business website URL
 *         phoneNumber:
 *           type: string
 *           description: Business phone number
 *         address:
 *           type: object
 *           properties:
 *             street:
 *               type: string
 *             city:
 *               type: string
 *             state:
 *               type: string
 *             zipCode:
 *               type: string
 *             country:
 *               type: string
 *         logo:
 *           type: string
 *           description: Business logo URL
 *         status:
 *           type: string
 *           enum: [pending_verification, verified, rejected, suspended, deleted]
 *           description: Business verification status
 *         supportedTokens:
 *           type: object
 *           properties:
 *             base:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SupportedToken'
 *             solana:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SupportedToken'
 *             ethereum:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SupportedToken'
 *         paymentWallets:
 *           type: object
 *           properties:
 *             solana:
 *               type: string
 *             base:
 *               type: string
 *             ethereum:
 *               type: string
 *         bankAccount:
 *           $ref: '#/components/schemas/BankAccount'
 *         createdAt:
 *           type: string
 *           format: date-time
 *     SupportedToken:
 *       type: object
 *       properties:
 *         symbol:
 *           type: string
 *           example: "USDC"
 *         name:
 *           type: string
 *           example: "USD Coin"
 *         contractAddress:
 *           type: string
 *           example: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
 *         decimals:
 *           type: number
 *           example: 6
 *         network:
 *           type: string
 *           example: "base"
 *         type:
 *           type: string
 *           example: "ERC-20"
 *         isActive:
 *           type: boolean
 *           example: true
 *         isTradingEnabled:
 *           type: boolean
 *           example: true
 *         isDefault:
 *           type: boolean
 *           example: true
 *           description: "Whether this is a default token (ETH, USDC, USDT, SOL)"
 *         logoUrl:
 *           type: string
 *         addedAt:
 *           type: string
 *           format: date-time
 *     FeeConfiguration:
 *       type: object
 *       properties:
 *         contractAddress:
 *           type: string
 *         symbol:
 *           type: string
 *         feePercentage:
 *           type: number
 *           minimum: 0
 *           maximum: 10
 *         isActive:
 *           type: boolean
 *         isDefault:
 *           type: boolean
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     BankAccount:
 *       type: object
 *       properties:
 *         accountName:
 *           type: string
 *           example: "TechCorp Limited"
 *         accountNumber:
 *           type: string
 *           example: "0123456789"
 *         bankName:
 *           type: string
 *           example: "First Bank of Nigeria"
 *         bankCode:
 *           type: string
 *           example: "011"
 *         currency:
 *           type: string
 *           example: "NGN"
 *         isVerified:
 *           type: boolean
 *         addedAt:
 *           type: string
 *           format: date-time
 *     ApiCredentials:
 *       type: object
 *       properties:
 *         publicKey:
 *           type: string
 *           description: Public API key for identification
 *           example: pk_live_1a2b3c4d5e6f7g8h
 *         clientKey:
 *           type: string
 *           description: Client key for frontend use
 *           example: ck_1a2b3c4d5e6f
 *         secretKey:
 *           type: string
 *           description: Secret key for server-side authentication (shown only once)
 *           example: ***REMOVED***1a2b3c4d5e6f7g8h9i0j1k2l
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *           description: API permissions
 *         isActive:
 *           type: boolean
 *           description: Whether the API key is active
 *         createdAt:
 *           type: string
 *           format: date-time
 *         lastUsedAt:
 *           type: string
 *           format: date-time
 *     BusinessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             business:
 *               $ref: '#/components/schemas/Business'
 *             apiCredentials:
 *               $ref: '#/components/schemas/ApiCredentials'
 *     BusinessErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *         error:
 *           type: string
 */

/**
 * @swagger
 * tags:
 *   - name: Business Management
 *     description: Business registration, management, and API key generation (requires admin approval)
 *   - name: Business Token Management
 *     description: Manage supported destination tokens, fees, and payment configuration
 *   - name: Debug
 *     description: Debug endpoints for development and troubleshooting
 */

// ============= DEBUG ENDPOINTS (for development) =============

/**
 * @swagger
 * /api/v1/business/debug-user-status:
 *   get:
 *     summary: Debug current user verification status
 *     description: Check what verification requirements are missing for the current user
 *     tags: [Debug]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User debug information retrieved
 *       500:
 *         description: Internal server error
 */
router.get('/debug-user-status', async (req, res) => {
  try {
    const userId = req.user.id;
    const { User } = require('../models');
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Show user verification details (excluding sensitive data)
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.resetPasswordToken;
    delete userObj.resetPasswordExpiry;
    delete userObj.emailVerificationToken;

    const analysis = {
      emailVerified: user.isVerified || false,
      verificationStatus: user.verificationStatus || 'NOT_SET',
      isApiEnabled: user.isApiEnabled || false,
      accountStatus: user.accountStatus || 'NOT_SET',
      
      // Check what's missing
      issues: [],
      canCreateBusiness: false
    };

    // Analyze issues
    if (!user.isVerified) {
      analysis.issues.push('EMAIL_NOT_VERIFIED');
    }
    
    if (!user.verificationStatus || user.verificationStatus !== 'approved') {
      analysis.issues.push('ADMIN_APPROVAL_PENDING');
    }
    
    if (!user.isApiEnabled) {
      analysis.issues.push('API_ACCESS_NOT_ENABLED');
    }
    
    if (user.accountStatus && user.accountStatus !== 'active') {
      analysis.issues.push('ACCOUNT_NOT_ACTIVE');
    }

    // Check if user can create business
    analysis.canCreateBusiness = analysis.issues.length === 0;

    res.json({
      success: true,
      message: 'User debug information',
      userId,
      email: user.email,
      fullName: user.fullName,
      analysis,
      rawUserFields: {
        isVerified: user.isVerified,
        verificationStatus: user.verificationStatus,
        isApiEnabled: user.isApiEnabled,
        accountStatus: user.accountStatus,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      
      // Quick fix suggestions
      quickFixes: {
        forceVerifyEmail: !user.isVerified,
        needsAdminApproval: !user.verificationStatus || user.verificationStatus !== 'approved',
        needsApiAccess: !user.isApiEnabled,
        needsActiveStatus: user.accountStatus && user.accountStatus !== 'active'
      },
      
      // What the middleware checks
      middlewareChecks: {
        emailVerified: user.isVerified || false,
        adminApproved: (user.verificationStatus || 'pending') === 'approved',
        apiEnabled: user.isApiEnabled || false,
        accountActive: (user.accountStatus || 'active') === 'active',
        allPassed: (user.isVerified || false) && 
                  ((user.verificationStatus || 'pending') === 'approved') && 
                  (user.isApiEnabled || false) && 
                  ((user.accountStatus || 'active') === 'active')
      }
    });

  } catch (error) {
    console.error('Debug user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting debug info',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/business/check-activation:
 *   get:
 *     summary: Check account activation status (public endpoint)
 *     description: Check if user can create businesses without admin approval middleware
 *     tags: [Business Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account activation status
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /api/v1/business/check-activation:
 *   get:
 *     summary: Check account activation status (working version)
 *     description: Check if user can create businesses without admin approval middleware
 *     tags: [Business Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account activation status
 *       500:
 *         description: Internal server error
 */
router.get('/check-activation', async (req, res) => {
  try {
    const userId = req.user.id;
    const { User } = require('../models');
    
    const user = await User.findById(userId).select('verificationStatus isApiEnabled accountStatus isVerified createdAt email fullName');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check all requirements
    const emailVerified = user.isVerified || false;
    const adminApproved = (user.verificationStatus || 'pending') === 'approved';
    const apiEnabled = user.isApiEnabled || false;
    const accountActive = (user.accountStatus || 'active') === 'active';
    
    const canCreateBusiness = emailVerified && adminApproved && apiEnabled && accountActive;

    // Helper function to get next steps
    const getNextSteps = () => {
      if (!emailVerified) {
        return 'Please verify your email address by clicking the link sent to your email';
      }
      
      if (!adminApproved) {
        return 'Your account is pending admin approval. Please wait for verification (1-2 business days)';
      }

      if (!apiEnabled) {
        return 'Your API access needs to be enabled by admin. Contact support if this is taking too long.';
      }
      
      if (!accountActive) {
        return 'Your account status is not active. Please contact support for assistance';
      }
      
      return 'You can now create and manage your business';
    };

    res.json({
      success: true,
      data: {
        userId,
        email: user.email,
        fullName: user.fullName,
        isEmailVerified: emailVerified,
        verificationStatus: user.verificationStatus || 'pending',
        isApiEnabled: apiEnabled,
        accountStatus: user.accountStatus || 'active',
        registeredAt: user.createdAt,
        canCreateBusiness,
        message: canCreateBusiness
          ? 'Your account is fully verified and you can create businesses'
          : 'Your account requires additional verification steps',
        nextSteps: getNextSteps(),
        requirements: {
          emailVerified,
          adminApproved,
          apiEnabled,
          accountActive
        },
        // Debug info
        debugInfo: {
          rawVerificationStatus: user.verificationStatus,
          rawIsApiEnabled: user.isApiEnabled,
          rawAccountStatus: user.accountStatus,
          rawIsVerified: user.isVerified
        }
      }
    });

  } catch (error) {
    console.error('Check activation status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking activation status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/business/test-middleware-check:
 *   get:
 *     summary: Test what the middleware would do
 *     description: Simulate the middleware check to see exactly where it would fail
 *     tags: [Debug]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Middleware simulation results
 *       500:
 *         description: Internal server error
 */
router.get('/test-middleware-check', async (req, res) => {
  try {
    const userId = req.user.id;
    const { User } = require('../models');
    
    const user = await User.findById(userId).select('verificationStatus isApiEnabled accountStatus isVerified email fullName');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`🔍 Middleware simulation for user: ${user.email}`, {
      isVerified: user.isVerified,
      verificationStatus: user.verificationStatus,
      isApiEnabled: user.isApiEnabled,
      accountStatus: user.accountStatus
    });

    // Simulate the exact middleware checks
    const checks = {
      step1_emailVerified: user.isVerified || false,
      step2_verificationStatus: user.verificationStatus || 'NOT_SET',
      step2_isApproved: (user.verificationStatus || 'pending') === 'approved',
      step3_isApiEnabled: user.isApiEnabled || false,
      step4_accountStatus: user.accountStatus || 'NOT_SET',
      step4_isActive: (user.accountStatus || 'active') === 'active'
    };

    let failedAt = null;
    let canPass = true;
    let errorResponse = null;

    // Check if user email is verified FIRST
    if (!checks.step1_emailVerified) {
      failedAt = 'EMAIL_VERIFICATION';
      canPass = false;
      errorResponse = {
        success: false,
        message: 'Please verify your email address first before creating a business.',
        emailVerified: false,
        verificationStatus: checks.step2_verificationStatus,
        isApiEnabled: false,
        step: 1,
        nextStep: 'Check your email and click the verification link'
      };
    }
    // Check admin approval
    else if (!checks.step2_isApproved) {
      failedAt = 'ADMIN_APPROVAL';
      canPass = false;
      errorResponse = {
        success: false,
        message: 'Your account is pending admin approval. Please wait for admin verification before creating a business.',
        verificationStatus: checks.step2_verificationStatus,
        isApiEnabled: checks.step3_isApiEnabled,
        emailVerified: checks.step1_emailVerified,
        step: 2,
        currentStatus: checks.step2_verificationStatus,
        nextStep: 'Wait for admin verification (1-2 business days)'
      };
    }
    // Check API access
    else if (!checks.step3_isApiEnabled) {
      failedAt = 'API_ACCESS';
      canPass = false;
      errorResponse = {
        success: false,
        message: 'Your API access is not enabled. Please contact admin for API access.',
        verificationStatus: 'approved',
        isApiEnabled: false,
        emailVerified: checks.step1_emailVerified,
        step: 3,
        nextStep: 'Contact admin to enable API access'
      };
    }
    // Check account status
    else if (!checks.step4_isActive) {
      failedAt = 'ACCOUNT_STATUS';
      canPass = false;
      errorResponse = {
        success: false,
        message: `Your account status is ${checks.step4_accountStatus}. Contact support for assistance.`,
        accountStatus: checks.step4_accountStatus,
        verificationStatus: checks.step2_verificationStatus,
        isApiEnabled: checks.step3_isApiEnabled,
        emailVerified: checks.step1_emailVerified
      };
    }

    res.json({
      success: true,
      message: 'Middleware simulation complete',
      userEmail: user.email,
      middlewareWouldPass: canPass,
      failedAt,
      checks,
      simulatedErrorResponse: errorResponse,
      actualDatabaseValues: {
        isVerified: user.isVerified,
        verificationStatus: user.verificationStatus,
        isApiEnabled: user.isApiEnabled,
        accountStatus: user.accountStatus
      }
    });

  } catch (error) {
    console.error('Test middleware check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing middleware',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============= CORE BUSINESS MANAGEMENT =============

/**
 * @swagger
 * /api/v1/business/create:
 *   post:
 *     summary: Register a new business and generate API credentials (requires admin approval)
 *     description: Creates a new business with automatic default tokens (ETH, USDC, USDT, SOL) and generates API credentials. User must be admin-approved first.
 *     tags: [Business Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - businessName
 *               - businessType
 *               - industry
 *               - country
 *             properties:
 *               businessName:
 *                 type: string
 *                 example: "Tech Innovations LLC"
 *               businessType:
 *                 type: string
 *                 enum: [LLC, Corporation, Partnership, Sole Proprietorship, Non-Profit, Other]
 *                 example: "LLC"
 *               description:
 *                 type: string
 *                 example: "Innovative technology solutions for modern businesses"
 *               industry:
 *                 type: string
 *                 enum: [Technology, Finance, Healthcare, Education, E-commerce, Manufacturing, Real Estate, Consulting, Marketing, Food & Beverage, Entertainment, Transportation, Energy, Agriculture, Fintech, Cryptocurrency, Other]
 *                 example: "Technology"
 *               country:
 *                 type: string
 *                 example: "Nigeria"
 *               registrationNumber:
 *                 type: string
 *                 example: "REG123456789"
 *               taxId:
 *                 type: string
 *                 example: "TAX987654321"
 *               website:
 *                 type: string
 *                 example: "https://techinnovations.com"
 *               phoneNumber:
 *                 type: string
 *                 example: "+234-555-123-4567"
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                     example: "123 Tech Street"
 *                   city:
 *                     type: string
 *                     example: "Lagos"
 *                   state:
 *                     type: string
 *                     example: "Lagos State"
 *                   zipCode:
 *                     type: string
 *                     example: "100001"
 *                   country:
 *                     type: string
 *                     example: "Nigeria"
 *               logo:
 *                 type: string
 *                 example: "https://example.com/logo.png"
 *     responses:
 *       201:
 *         description: Business created successfully with API credentials and default tokens
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
 *                   example: "Business created successfully with API credentials and default supported tokens"
 *                 data:
 *                   $ref: '#/components/schemas/Business'
 *                 apiCredentials:
 *                   $ref: '#/components/schemas/ApiCredentials'
 *       403:
 *         description: Account not approved - admin verification required
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
 *                   example: "Your account is pending admin approval. Please wait for admin verification before creating a business."
 *                 verificationStatus:
 *                   type: string
 *                   example: "pending"
 *                 isApiEnabled:
 *                   type: boolean
 *                   example: false
 *                 emailVerified:
 *                   type: boolean
 *                   example: true
 *                 step:
 *                   type: number
 *                   example: 2
 *                 nextStep:
 *                   type: string
 *                   example: "Wait for admin verification (1-2 business days)"
 *                 note:
 *                   type: string
 *                   example: "Admin verification is required for business creation and API access"
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 *       409:
 *         description: Business already exists or name taken
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 */
router.post('/create', businessController.constructor.checkAccountActivation, businessController.createBusiness);

/**
 * @swagger
 * /api/v1/business/profile:
 *   get:
 *     summary: Get business profile with API credentials info
 *     description: Retrieve complete business profile including default tokens and API credentials
 *     tags: [Business Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Business profile retrieved successfully
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
 *                     business:
 *                       $ref: '#/components/schemas/Business'
 *                     apiCredentials:
 *                       type: object
 *                       properties:
 *                         publicKey:
 *                           type: string
 *                         clientKey:
 *                           type: string
 *                         permissions:
 *                           type: array
 *                           items:
 *                             type: string
 *                         isActive:
 *                           type: boolean
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         lastUsedAt:
 *                           type: string
 *                           format: date-time
 *       404:
 *         description: Business not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 */
router.get('/profile', businessController.constructor.checkAccountActivation, businessController.getBusinessProfile);

/**
 * @swagger
 * /api/v1/business/update:
 *   put:
 *     summary: Update business profile
 *     description: Update editable business profile fields
 *     tags: [Business Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 example: "Updated business description"
 *               website:
 *                 type: string
 *                 example: "https://newwebsite.com"
 *               phoneNumber:
 *                 type: string
 *                 example: "+234-555-987-6543"
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   zipCode:
 *                     type: string
 *                   country:
 *                     type: string
 *               logo:
 *                 type: string
 *                 example: "https://example.com/new-logo.png"
 *     responses:
 *       200:
 *         description: Business updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessResponse'
 *       404:
 *         description: Business not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 */
router.put('/update', businessController.constructor.checkAccountActivation, businessController.updateBusiness);

/**
 * @swagger
 * /api/v1/business/verification-status:
 *   get:
 *     summary: Get business verification status
 *     description: Check the current verification status of the business
 *     tags: [Business Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification status retrieved successfully
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
 *                     businessName:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [pending_verification, verified, rejected, suspended, deleted]
 *                     documentsSubmitted:
 *                       type: number
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Business not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 */
router.get('/verification-status', businessController.constructor.checkAccountActivation, businessController.getVerificationStatus);

/**
 * @swagger
 * /api/v1/business/api-keys:
 *   get:
 *     summary: Get API key information (without secret key)
 *     description: Retrieve API key details for security purposes (secret key never shown)
 *     tags: [Business Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: API key information retrieved successfully
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
 *                     publicKey:
 *                       type: string
 *                       example: pk_live_1a2b3c4d5e6f7g8h
 *                     clientKey:
 *                       type: string
 *                       example: ck_1a2b3c4d5e6f
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["read", "write", "validate"]
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     lastUsedAt:
 *                       type: string
 *                       format: date-time
 *                     note:
 *                       type: string
 *                       example: "Secret key is never displayed for security reasons"
 *       404:
 *         description: Business or API keys not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 */
router.get('/api-keys', businessController.constructor.checkAccountActivation, businessController.getApiKeyInfo);

/**
 * @swagger
 * /api/v1/business/regenerate-api-keys:
 *   post:
 *     summary: Regenerate API keys for business
 *     description: Generate new API keys and deactivate old ones
 *     tags: [Business Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: API keys regenerated successfully
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
 *                   example: "API keys regenerated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     publicKey:
 *                       type: string
 *                       example: pk_live_9z8y7x6w5v4u3t2s
 *                     clientKey:
 *                       type: string
 *                       example: ck_9z8y7x6w5v4u
 *                     secretKey:
 *                       type: string
 *                       example: ***REMOVED***9z8y7x6w5v4u3t2s1r0q9p8o
 *                     warning:
 *                       type: string
 *                       example: "Store these credentials securely. The secret key will not be shown again."
 *       404:
 *         description: Business not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 */
router.post('/regenerate-api-keys', businessController.constructor.checkAccountActivation, businessController.regenerateApiKeys);

/**
 * @swagger
 * /api/v1/business/delete:
 *   delete:
 *     summary: Delete business (soft delete) and deactivate API keys
 *     description: Soft delete business and deactivate all associated API keys
 *     tags: [Business Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - confirmDelete
 *             properties:
 *               confirmDelete:
 *                 type: boolean
 *                 example: true
 *                 description: Must be true to confirm deletion
 *     responses:
 *       200:
 *         description: Business deleted successfully
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
 *                   example: "Business and associated API keys deleted successfully"
 *       400:
 *         description: Bad request - confirmation required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 *       404:
 *         description: Business not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 */
router.delete('/delete', businessController.constructor.checkAccountActivation, businessController.deleteBusiness);

// ============= TOKEN MANAGEMENT =============

/**
 * @swagger
 * /api/v1/business/tokens/supported:
 *   get:
 *     summary: Get all supported tokens for business (includes default tokens)
 *     description: Retrieve all configured destination tokens including default tokens (ETH, USDC, USDT, SOL) with their fee settings
 *     tags: [Business Token Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved supported tokens with defaults
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
 *                     businessName:
 *                       type: string
 *                     supportedTokens:
 *                       type: object
 *                       properties:
 *                         base:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/SupportedToken'
 *                         solana:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/SupportedToken'
 *                         ethereum:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/SupportedToken'
 *                     feeConfiguration:
 *                       type: object
 *                       properties:
 *                         base:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/FeeConfiguration'
 *                         solana:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/FeeConfiguration'
 *                         ethereum:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/FeeConfiguration'
 *                     tokenStatistics:
 *                       type: object
 *                       properties:
 *                         breakdown:
 *                           type: object
 *                         summary:
 *                           type: object
 *                           properties:
 *                             totalTokens:
 *                               type: number
 *                             defaultTokens:
 *                               type: number
 *                             customTokens:
 *                               type: number
 *                             activeTokens:
 *                               type: number
 *                     defaultTokensInfo:
 *                       type: object
 *                       properties:
 *                         description:
 *                           type: string
 *                           example: "Default tokens are automatically provided with 0% fees. You can customize their fees."
 *                         feesCustomizable:
 *                           type: string
 *                         defaultFeePercentage:
 *                           type: string
 *       404:
 *         description: Business not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 */
router.get('/tokens/supported', businessTokenController.getSupportedTokens);

/**
 * @swagger
 * /api/v1/business/tokens/breakdown:
 *   get:
 *     summary: Get detailed breakdown of default vs custom tokens
 *     description: View default tokens (provided automatically) vs custom tokens (manually added) with their fees
 *     tags: [Business Token Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token breakdown retrieved successfully
 *       404:
 *         description: Business not found
 *       500:
 *         description: Internal server error
 */
router.get('/tokens/breakdown', businessTokenController.getTokensBreakdown);

/**
 * @swagger
 * /api/v1/business/tokens/add:
 *   post:
 *     summary: Add custom destination tokens
 *     description: Add new custom tokens that users can trade to on your platform (in addition to default tokens)
 *     tags: [Business Token Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - network
 *               - tokens
 *             properties:
 *               network:
 *                 type: string
 *                 enum: [base, solana, ethereum]
 *                 example: base
 *               tokens:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - address
 *                     - symbol
 *                     - name
 *                   properties:
 *                     address:
 *                       type: string
 *                       example: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
 *                       description: Token contract address
 *                     symbol:
 *                       type: string
 *                       example: "CUSTOM"
 *                       description: Token symbol
 *                     name:
 *                       type: string
 *                       example: "Custom Token"
 *                       description: Token name
 *                     decimals:
 *                       type: number
 *                       example: 18
 *                       description: Token decimals
 *                     feePercentage:
 *                       type: number
 *                       example: 1.5
 *                       minimum: 0
 *                       maximum: 10
 *                       description: Trading fee percentage
 *     responses:
 *       200:
 *         description: Custom tokens added successfully
 *       400:
 *         description: Invalid token data or validation failed
 *       404:
 *         description: Business not found
 *       500:
 *         description: Internal server error
 */
router.post('/tokens/add', businessTokenController.addSupportedTokens);

/**
 * @swagger
 * /api/v1/business/tokens/update:
 *   put:
 *     summary: Update token configuration (works for both default and custom tokens)
 *     description: Update fee percentage and active status for existing tokens (including default tokens like ETH, USDC)
 *     tags: [Business Token Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - network
 *               - address
 *               - updates
 *             properties:
 *               network:
 *                 type: string
 *                 enum: [base, solana, ethereum]
 *               address:
 *                 type: string
 *                 example: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
 *                 description: "Token contract address (works for default tokens too)"
 *               updates:
 *                 type: object
 *                 properties:
 *                   feePercentage:
 *                     type: number
 *                     example: 2.0
 *                     minimum: 0
 *                     maximum: 10
 *                     description: "Set custom fee for default or custom tokens"
 *                   isActive:
 *                     type: boolean
 *                     example: true
 *                     description: "Enable/disable token trading"
 *                   isTradingEnabled:
 *                     type: boolean
 *                     example: true
 *     responses:
 *       200:
 *         description: Token configuration updated successfully
 *       400:
 *         description: Invalid update data
 *       404:
 *         description: Token or business not found
 *       500:
 *         description: Internal server error
 */
router.put('/tokens/update', businessTokenController.updateTokenConfiguration);

/**
 * @swagger
 * /api/v1/business/tokens/bulk-update-fees:
 *   put:
 *     summary: Bulk update fees for multiple tokens
 *     description: Convenient way to set fees for multiple tokens at once (both default and custom)
 *     tags: [Business Token Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Fees updated successfully
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Business not found
 *       500:
 *         description: Internal server error
 */
router.put('/tokens/bulk-update-fees', businessTokenController.bulkUpdateFees);

/**
 * @swagger
 * /api/v1/business/tokens/remove:
 *   delete:
 *     summary: Remove supported token (with default token protection)
 *     description: Remove a token from the supported destination tokens list. Default tokens cannot be deleted, only disabled.
 *     tags: [Business Token Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token removed successfully
 *       400:
 *         description: Cannot remove default tokens or invalid request
 *       404:
 *         description: Token or business not found
 *       500:
 *         description: Internal server error
 */
router.delete('/tokens/remove', businessTokenController.removeSupportedToken);

/**
 * @swagger
 * /api/v1/business/tokens/clear:
 *   delete:
 *     summary: Clear all tokens for a network (with default token protection)
 *     description: Remove all tokens from a specific network. By default, only custom tokens are removed to protect default tokens.
 *     tags: [Business Token Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tokens cleared successfully
 *       400:
 *         description: Confirmation required
 *       404:
 *         description: Business not found
 *       500:
 *         description: Internal server error
 */
router.delete('/tokens/clear', businessTokenController.clearNetworkTokens);

/**
 * @swagger
 * /api/v1/business/tokens/wallets:
 *   put:
 *     summary: Set payment wallets for fee collection
 *     description: Configure crypto wallets to receive trading fees from different networks
 *     tags: [Business Token Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               solanaWallet:
 *                 type: string
 *                 example: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
 *                 description: Solana wallet address for receiving SOL-based token fees
 *               baseWallet:
 *                 type: string
 *                 example: "0x742d35Cc6634C0532925a3b8D1D8ce28D2e67F5c"
 *                 description: Base network wallet address for receiving Base token fees
 *               ethereumWallet:
 *                 type: string
 *                 example: "0x742d35Cc6634C0532925a3b8D1D8ce28D2e67F5c"
 *                 description: Ethereum wallet address for receiving ETH-based token fees
 *     responses:
 *       200:
 *         description: Payment wallets updated successfully
 *       400:
 *         description: Invalid wallet address format
 *       404:
 *         description: Business not found
 *       500:
 *         description: Internal server error
 */
router.put('/tokens/wallets', businessTokenController.setPaymentWallets);

/**
 * @swagger
 * /api/v1/business/tokens/bank-account:
 *   put:
 *     summary: Set bank account for fiat payments
 *     description: Configure bank account to receive fiat currency fees and payments
 *     tags: [Business Token Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accountName
 *               - accountNumber
 *               - bankName
 *             properties:
 *               accountName:
 *                 type: string
 *                 example: "TechCorp Limited"
 *                 description: Account holder name
 *               accountNumber:
 *                 type: string
 *                 example: "0123456789"
 *                 description: 10-digit bank account number
 *               bankName:
 *                 type: string
 *                 example: "First Bank of Nigeria"
 *                 description: Bank name
 *               bankCode:
 *                 type: string
 *                 example: "011"
 *                 description: Bank code (optional)
 *               currency:
 *                 type: string
 *                 example: "NGN"
 *                 default: "NGN"
 *                 description: Account currency
 *     responses:
 *       200:
 *         description: Bank account information saved successfully
 *       400:
 *         description: Invalid account information
 *       404:
 *         description: Business not found
 *       500:
 *         description: Internal server error
 */
router.put('/tokens/bank-account', businessTokenController.setBankAccount);

/**
 * @swagger
 * /api/v1/business/tokens/configuration:
 *   get:
 *     summary: Get complete payment configuration
 *     description: Retrieve all token configuration, fees, wallets, and bank account info with summary statistics
 *     tags: [Business Token Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved payment configuration
 *       404:
 *         description: Business not found
 *       500:
 *         description: Internal server error
 */
router.get('/tokens/configuration', businessTokenController.getPaymentConfiguration);

// ============= QUICK ACCESS ENDPOINTS =============

/**
 * @swagger
 * /api/v1/business/trading-status:
 *   get:
 *     summary: Get business trading readiness status
 *     description: Quick check if business is ready to accept trades (includes default token check)
 *     tags: [Business Token Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trading status retrieved successfully
 *       404:
 *         description: Business not found
 *       500:
 *         description: Internal server error
 */
router.get('/trading-status', businessController.constructor.checkAccountActivation, async (req, res) => {
  try {
    const userId = req.user.id;
    const { Business } = require('../models');

    const business = await Business.findOne({ ownerId: userId });
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Ensure business has default tokens
    const BusinessController = require('../controllers/businessController');
    await BusinessController.constructor.addDefaultTokensToExistingBusiness(business);

    const paymentStatus = business.canReceivePayments();
    const activeTokensCount = business.activeTokensCount;
    const hasDefaultTokens = business.supportedTokens && 
      (business.supportedTokens.base.some(t => t.isDefault) ||
       business.supportedTokens.solana.some(t => t.isDefault) ||
       business.supportedTokens.ethereum.some(t => t.isDefault));

    res.json({
      success: true,
      data: {
        businessId: business.businessId,
        businessName: business.businessName,
        isReadyForTrading: paymentStatus.isFullyConfigured && business.isActive(),
        canReceiveCrypto: paymentStatus.canReceiveCrypto,
        canReceiveFiat: paymentStatus.canReceiveFiat,
        hasActiveTokens: paymentStatus.hasActiveTokens,
        hasDefaultTokens,
        activeTokensCount,
        requirements: {
          tokensConfigured: paymentStatus.hasActiveTokens,
          defaultTokensAvailable: hasDefaultTokens,
          walletsConfigured: paymentStatus.hasWallets,
          bankAccountConfigured: paymentStatus.hasBankAccount,
          businessVerified: business.status === 'verified'
        },
        defaultTokensInfo: {
          message: 'Default tokens (ETH, USDC, USDT, SOL) are automatically available with 0% fees',
          customizable: 'You can adjust fees for default tokens and add custom tokens'
        }
      }
    });

  } catch (error) {
    console.error('Get trading status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/business/tokens/validate-for-trading:
 *   post:
 *     summary: Check if token is supported for trading
 *     description: Validate if a specific token can be used as destination token (includes default tokens)
 *     tags: [Business Token Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - address
 *               - network
 *             properties:
 *               address:
 *                 type: string
 *                 example: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
 *               network:
 *                 type: string
 *                 enum: [base, solana, ethereum]
 *                 example: "base"
 *     responses:
 *       200:
 *         description: Token validation result
 *       400:
 *         description: Invalid request parameters
 *       404:
 *         description: Token not supported or business not found
 *       500:
 *         description: Internal server error
 */
router.post('/tokens/validate-for-trading', businessController.constructor.checkAccountActivation, async (req, res) => {
  try {
    const userId = req.user.id;
    const { address, network } = req.body;

    if (!address || !network) {
      return res.status(400).json({
        success: false,
        message: 'Address and network are required'
      });
    }

    const { Business } = require('../models');
    const business = await Business.findOne({ ownerId: userId });
    
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Ensure business has default tokens
    const BusinessController = require('../controllers/businessController');
    await BusinessController.constructor.addDefaultTokensToExistingBusiness(business);

    const isSupported = business.isTokenSupportedForTrading(address, network);
    const token = business.getTokenByAddress(address, network);
    const feePercentage = business.getFeeForToken(address, network);
    const paymentWallet = business.paymentWallets?.[network.toLowerCase()];

    res.json({
      success: true,
      data: {
        isSupported,
        token: isSupported ? {
          ...token.toObject(),
          isDefaultToken: token.isDefault
        } : null,
        feePercentage: isSupported ? feePercentage : 0,
        paymentWallet: isSupported ? paymentWallet : null,
        networkSupported: ['base', 'solana', 'ethereum'].includes(network.toLowerCase()),
        tokenType: isSupported ? (token.isDefault ? 'default' : 'custom') : null
      }
    });

  } catch (error) {
    console.error('Validate token for trading error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;