const express = require('express');
const router = express.Router();
const businessController = require('../controllers/businessController');
const businessTokenController = require('../controllers/businessTokenController');
const { authenticateToken, requireActivatedAccount, requireAccountActivationAndApiAccess } = require('../middleware/auth');

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
 *         approvedBy:
 *           type: string
 *           description: Admin who approved the API key
 *         approvedAt:
 *           type: string
 *           format: date-time
 *           description: When API access was approved
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
 *             apiAccessNote:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 nextSteps:
 *                   type: string
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
 *     ActivationRequiredError:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Your account is pending admin activation. Please wait for admin approval before you can create or manage businesses."
 *         accountStatus:
 *           type: string
 *           example: "pending_activation"
 *         registeredAt:
 *           type: string
 *           format: date-time
 *         note:
 *           type: string
 *           example: "Contact support if your account has been pending for more than 48 hours"
 *     ApiAccessRequiredError:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Your API access is pending admin approval. You can create a business but cannot access API credentials until approved."
 *         accountStatus:
 *           type: string
 *         apiAccessStatus:
 *           type: string
 *           example: "pending_approval"
 *         activatedAt:
 *           type: string
 *           format: date-time
 *         note:
 *           type: string
 *           example: "Contact support if your API access has been pending for more than 72 hours"
 */

/**
 * @swagger
 * tags:
 *   - name: Business Management
 *     description: Business registration, management, and API key generation (requires admin approval)
 *   - name: Business Token Management
 *     description: Manage supported destination tokens, fees, and payment configuration
 */

// ============= CORE BUSINESS MANAGEMENT =============

/**
 * @swagger
 * /api/v1/business/create:
 *   post:
 *     summary: Register a new business (requires account activation, API credentials require admin approval)
 *     description: Creates a new business with automatic default tokens. API credentials are only generated if admin has approved API access. Account must be activated by admin first.
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
 *         description: Business created successfully (API credentials depend on admin approval)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/BusinessResponse'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Business created successfully with default supported tokens. API credentials will be available after admin approval."
 *                     apiCredentials:
 *                       type: object
 *                       description: "Only present if admin has approved API access"
 *                     apiAccessNote:
 *                       type: object
 *                       description: "Present if API access not yet approved"
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "pending_approval"
 *                         message:
 *                           type: string
 *                           example: "Your API access is pending admin approval. You will receive API credentials once approved."
 *                         nextSteps:
 *                           type: string
 *                           example: "Contact support for API access approval status updates"
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 *       403:
 *         description: Account not activated by admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivationRequiredError'
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
router.post('/create', requireActivatedAccount, businessController.createBusiness);

/**
 * @swagger
 * /api/v1/business/activation-status:
 *   get:
 *     summary: Check account activation and API access status
 *     description: Returns detailed information about account activation and API access approval status
 *     tags: [Business Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Activation status retrieved successfully
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
 *                     userId:
 *                       type: string
 *                     email:
 *                       type: string
 *                     username:
 *                       type: string
 *                     accountActivation:
 *                       type: object
 *                       properties:
 *                         isAccountActivated:
 *                           type: boolean
 *                         accountStatus:
 *                           type: string
 *                         activatedAt:
 *                           type: string
 *                           format: date-time
 *                         message:
 *                           type: string
 *                     apiAccess:
 *                       type: object
 *                       properties:
 *                         isApiAccessApproved:
 *                           type: boolean
 *                         apiAccessStatus:
 *                           type: string
 *                         apiAccessApprovedAt:
 *                           type: string
 *                           format: date-time
 *                         message:
 *                           type: string
 *                     overallStatus:
 *                       type: object
 *                       properties:
 *                         canCreateBusiness:
 *                           type: boolean
 *                         canAccessApiCredentials:
 *                           type: boolean
 *                         nextSteps:
 *                           type: string
 *       401:
 *         description: Unauthorized - invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 *       404:
 *         description: User not found
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
router.get('/activation-status', async (req, res) => {
  try {
    const userId = req.user.id;
    const { User } = require('../models');
    
    const user = await User.findById(userId).select(
      'email username firstName lastName isAccountActivated accountStatus activatedAt activatedBy ' +
      'isApiAccessApproved apiAccessStatus apiAccessApprovedAt apiAccessApprovedBy apiAccessRequestedAt ' +
      'apiAccessRejectedAt apiAccessRevokedAt createdAt'
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Helper function to get next steps message
    const getNextStepsMessage = (user) => {
      if (!user.isAccountActivated) {
        return 'Wait for admin to activate your account, then you can create businesses';
      } else if (!user.isApiAccessApproved) {
        return 'You can create businesses, but contact support for API access approval to get API credentials';
      } else {
        return 'You have full access - create businesses and access API credentials';
      }
    };

    res.json({
      success: true,
      data: {
        userId: user._id,
        email: user.email,
        username: user.username,
        accountActivation: {
          isAccountActivated: user.isAccountActivated || false,
          accountStatus: user.accountStatus || 'pending_activation',
          activatedAt: user.activatedAt,
          activatedBy: user.activatedBy,
          message: user.isAccountActivated 
            ? 'Your account is activated'
            : 'Your account is pending admin activation'
        },
        apiAccess: {
          isApiAccessApproved: user.isApiAccessApproved || false,
          apiAccessStatus: user.apiAccessStatus || 'pending_approval',
          apiAccessApprovedAt: user.apiAccessApprovedAt,
          apiAccessApprovedBy: user.apiAccessApprovedBy,
          apiAccessRequestedAt: user.apiAccessRequestedAt,
          apiAccessRejectedAt: user.apiAccessRejectedAt,
          apiAccessRevokedAt: user.apiAccessRevokedAt,
          message: user.isApiAccessApproved 
            ? 'Your API access is approved - you can access API credentials'
            : 'Your API access is pending admin approval'
        },
        registeredAt: user.createdAt,
        overallStatus: {
          canCreateBusiness: user.canCreateBusiness ? user.canCreateBusiness() : (user.isAccountActivated || false),
          canAccessApiCredentials: user.canAccessApi ? user.canAccessApi() : ((user.isAccountActivated && user.isApiAccessApproved) || false),
          nextSteps: getNextStepsMessage(user)
        }
      }
    });

  } catch (error) {
    console.error('Get activation status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking activation status'
    });
  }
});

/**
 * @swagger
 * /api/v1/business/request-api-access:
 *   post:
 *     summary: Request API access from admin
 *     description: Submit a request for API access approval. Account must be activated first.
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
 *               reason:
 *                 type: string
 *                 example: "I need API access to integrate payment processing into my e-commerce platform"
 *                 description: "Reason for requesting API access"
 *               businessUseCase:
 *                 type: string
 *                 example: "Online marketplace for digital products with cryptocurrency payment options"
 *                 description: "Detailed business use case"
 *     responses:
 *       200:
 *         description: API access request submitted successfully
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
 *                   example: "API access request submitted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     apiAccessStatus:
 *                       type: string
 *                       example: "pending_approval"
 *                     requestedAt:
 *                       type: string
 *                       format: date-time
 *                     reason:
 *                       type: string
 *                     businessUseCase:
 *                       type: string
 *                     note:
 *                       type: string
 *                       example: "Admin will review your request. You will be notified of the decision."
 *       400:
 *         description: Bad request - account not activated or request already pending
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 *       403:
 *         description: Account not activated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivationRequiredError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 */
router.post('/request-api-access', requireActivatedAccount, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reason, businessUseCase } = req.body;
    const { User } = require('../models');

    const user = await User.findById(userId).select(
      'isAccountActivated accountStatus isApiAccessApproved apiAccessStatus email username'
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already approved
    if (user.isApiAccessApproved && user.apiAccessStatus === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Your API access is already approved'
      });
    }

    // Check if request is already pending
    if (user.apiAccessStatus === 'pending_approval') {
      return res.status(400).json({
        success: false,
        message: 'Your API access request is already pending admin review'
      });
    }

    // Update user with API access request
    user.apiAccessStatus = 'pending_approval';
    user.apiAccessRequestedAt = new Date();
    user.apiAccessReason = reason?.trim();
    user.businessUseCase = businessUseCase?.trim();
    user.updatedAt = new Date();
    
    await user.save();

    // TODO: Send notification to admin about API access request
    
    res.json({
      success: true,
      message: 'API access request submitted successfully',
      data: {
        apiAccessStatus: 'pending_approval',
        requestedAt: user.apiAccessRequestedAt,
        reason: user.apiAccessReason,
        businessUseCase: user.businessUseCase,
        note: 'Admin will review your request. You will be notified of the decision.'
      }
    });

  } catch (error) {
    console.error('Request API access error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting API access request'
    });
  }
});

/**
 * @swagger
 * /api/v1/business/profile:
 *   get:
 *     summary: Get business profile with API credentials info (requires account activation)
 *     description: Retrieve complete business profile including default tokens and API credentials (if approved by admin)
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
 *                       description: "Only present if admin has approved API access"
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
 *                         approvedBy:
 *                           type: string
 *                         approvedAt:
 *                           type: string
 *                           format: date-time
 *                     apiAccessStatus:
 *                       type: object
 *                       properties:
 *                         isApproved:
 *                           type: boolean
 *                         status:
 *                           type: string
 *                         message:
 *                           type: string
 *       403:
 *         description: Account not activated by admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivationRequiredError'
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
router.get('/profile', requireActivatedAccount, businessController.getBusinessProfile);

/**
 * @swagger
 * /api/v1/business/update:
 *   put:
 *     summary: Update business profile (requires account activation)
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
 *       403:
 *         description: Account not activated by admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivationRequiredError'
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
router.put('/update', requireActivatedAccount, businessController.updateBusiness);

/**
 * @swagger
 * /api/v1/business/verification-status:
 *   get:
 *     summary: Get business verification status (requires account activation)
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
 *       403:
 *         description: Account not activated by admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivationRequiredError'
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
router.get('/verification-status', requireActivatedAccount, businessController.getVerificationStatus);

/**
 * @swagger
 * /api/v1/business/api-keys:
 *   get:
 *     summary: Get API key information (requires admin approval for API access)
 *     description: Retrieve API key details for security purposes (secret key never shown). Requires both account activation and admin API access approval.
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
 *                     approvedBy:
 *                       type: string
 *                       description: "Admin who approved the API access"
 *                     approvedAt:
 *                       type: string
 *                       format: date-time
 *                       description: "When API access was approved"
 *                     note:
 *                       type: string
 *                       example: "Secret key is never displayed for security reasons"
 *       403:
 *         description: API access not approved by admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiAccessRequiredError'
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
router.get('/api-keys', requireAccountActivationAndApiAccess, businessController.getApiKeyInfo);

/**
 * @swagger
 * /api/v1/business/regenerate-api-keys:
 *   post:
 *     summary: Regenerate API keys for business (requires admin approval for API access)
 *     description: Generate new API keys and deactivate old ones. Requires both account activation and admin API access approval.
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
 *       403:
 *         description: API access not approved by admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiAccessRequiredError'
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
router.post('/regenerate-api-keys', requireAccountActivationAndApiAccess, businessController.regenerateApiKeys);

/**
 * @swagger
 * /api/v1/business/delete:
 *   delete:
 *     summary: Delete business (soft delete) and deactivate API keys (requires account activation)
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
 *       403:
 *         description: Account not activated by admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivationRequiredError'
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
router.delete('/delete', requireActivatedAccount, businessController.deleteBusiness);

// ============= TOKEN MANAGEMENT =============

/**
 * @swagger
 * /api/v1/business/tokens/supported:
 *   get:
 *     summary: Get all supported tokens for business (includes default tokens) - requires account activation
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
 *       403:
 *         description: Account not activated by admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivationRequiredError'
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
router.get('/tokens/supported', requireActivatedAccount, businessTokenController.getSupportedTokens);

/**
 * @swagger
 * /api/v1/business/tokens/breakdown:
 *   get:
 *     summary: Get detailed breakdown of default vs custom tokens (requires account activation)
 *     description: View default tokens (provided automatically) vs custom tokens (manually added) with their fees
 *     tags: [Business Token Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token breakdown retrieved successfully
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
 *                     defaultTokens:
 *                       type: object
 *                       description: "Automatically provided tokens (ETH, USDC, USDT, SOL)"
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
 *                     customTokens:
 *                       type: object
 *                       description: "Manually added tokens"
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
 *                     summary:
 *                       type: object
 *                       properties:
 *                         defaultTokensCount:
 *                           type: object
 *                           properties:
 *                             base:
 *                               type: number
 *                             solana:
 *                               type: number
 *                             ethereum:
 *                               type: number
 *                             total:
 *                               type: number
 *                         customTokensCount:
 *                           type: object
 *                           properties:
 *                             base:
 *                               type: number
 *                             solana:
 *                               type: number
 *                             ethereum:
 *                               type: number
 *                             total:
 *                               type: number
 *                     info:
 *                       type: object
 *                       properties:
 *                         defaultTokensDescription:
 *                           type: string
 *                         feeCustomization:
 *                           type: string
 *                         defaultTokenProtection:
 *                           type: string
 *       403:
 *         description: Account not activated by admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivationRequiredError'
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
router.get('/tokens/breakdown', requireActivatedAccount, businessTokenController.getTokensBreakdown);

/**
 * @swagger
 * /api/v1/business/tokens/add:
 *   post:
 *     summary: Add custom destination tokens (requires account activation)
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
 *                   example: "Successfully added 2 custom tokens to base"
 *                 data:
 *                   type: object
 *                   properties:
 *                     network:
 *                       type: string
 *                     addedTokens:
 *                       type: array
 *                     duplicateTokens:
 *                       type: array
 *                     validationErrors:
 *                       type: array
 *                     totalTokens:
 *                       type: number
 *                     customTokens:
 *                       type: number
 *                     defaultTokens:
 *                       type: number
 *       400:
 *         description: Invalid token data or validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 *       403:
 *         description: Account not activated by admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivationRequiredError'
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
router.post('/tokens/add', requireActivatedAccount, businessTokenController.addSupportedTokens);

/**
 * @swagger
 * /api/v1/business/tokens/update:
 *   put:
 *     summary: Update token configuration (works for both default and custom tokens) - requires account activation
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Token configuration updated successfully (Default token)"
 *                 data:
 *                   type: object
 *                   properties:
 *                     network:
 *                       type: string
 *                     address:
 *                       type: string
 *                     updates:
 *                       type: object
 *                     token:
 *                       $ref: '#/components/schemas/SupportedToken'
 *                     feeConfiguration:
 *                       $ref: '#/components/schemas/FeeConfiguration'
 *                     isDefaultToken:
 *                       type: boolean
 *                     note:
 *                       type: string
 *       400:
 *         description: Invalid update data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 *       403:
 *         description: Account not activated by admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivationRequiredError'
 *       404:
 *         description: Token or business not found
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
router.put('/tokens/update', requireActivatedAccount, businessTokenController.updateTokenConfiguration);

/**
 * @swagger
 * /api/v1/business/tokens/bulk-update-fees:
 *   put:
 *     summary: Bulk update fees for multiple tokens (requires account activation)
 *     description: Convenient way to set fees for multiple tokens at once (both default and custom)
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
 *               - tokenUpdates
 *             properties:
 *               tokenUpdates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - network
 *                     - address
 *                     - feePercentage
 *                   properties:
 *                     network:
 *                       type: string
 *                       enum: [base, solana, ethereum]
 *                     address:
 *                       type: string
 *                       description: "Token contract address"
 *                     feePercentage:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 10
 *                 example:
 *                   - network: "base"
 *                     address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
 *                     feePercentage: 1.0
 *                   - network: "solana"
 *                     address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
 *                     feePercentage: 1.5
 *     responses:
 *       200:
 *         description: Fees updated successfully
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
 *                   example: "Updated fees for 2 tokens"
 *                 data:
 *                   type: object
 *                   properties:
 *                     updatedTokens:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           network:
 *                             type: string
 *                           address:
 *                             type: string
 *                           symbol:
 *                             type: string
 *                           name:
 *                             type: string
 *                           oldFeePercentage:
 *                             type: number
 *                           newFeePercentage:
 *                             type: number
 *                           isDefault:
 *                             type: boolean
 *                     errors:
 *                       type: array
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalUpdates:
 *                           type: number
 *                         defaultTokensUpdated:
 *                           type: number
 *                         customTokensUpdated:
 *                           type: number
 *                         errors:
 *                           type: number
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 *       403:
 *         description: Account not activated by admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivationRequiredError'
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
router.put('/tokens/bulk-update-fees', requireActivatedAccount, businessTokenController.bulkUpdateFees);

/**
 * @swagger
 * /api/v1/business/tokens/remove:
 *   delete:
 *     summary: Remove supported token (with default token protection) - requires account activation
 *     description: Remove a token from the supported destination tokens list. Default tokens cannot be deleted, only disabled.
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
 *             properties:
 *               network:
 *                 type: string
 *                 enum: [base, solana, ethereum]
 *               address:
 *                 type: string
 *                 example: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
 *               forceRemove:
 *                 type: boolean
 *                 example: false
 *                 description: "Set to true to force remove default tokens (not recommended)"
 *     responses:
 *       200:
 *         description: Token removed successfully
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
 *                   example: "Custom token removed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     network:
 *                       type: string
 *                     removedToken:
 *                       $ref: '#/components/schemas/SupportedToken'
 *                     remainingTokens:
 *                       type: number
 *                     wasDefaultToken:
 *                       type: boolean
 *                     warning:
 *                       type: string
 *       400:
 *         description: Cannot remove default tokens or invalid request
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
 *                   example: "Cannot remove default tokens. You can only disable them by setting isActive to false."
 *                 suggestion:
 *                   type: string
 *                 tokenInfo:
 *                   type: object
 *                 alternatives:
 *                   type: array
 *                   items:
 *                     type: string
 *       403:
 *         description: Account not activated by admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivationRequiredError'
 *       404:
 *         description: Token or business not found
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
router.delete('/tokens/remove', requireActivatedAccount, businessTokenController.removeSupportedToken);

/**
 * @swagger
 * /api/v1/business/tokens/clear:
 *   delete:
 *     summary: Clear all tokens for a network (with default token protection) - requires account activation
 *     description: Remove all tokens from a specific network. By default, only custom tokens are removed to protect default tokens.
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
 *               - confirmClear
 *             properties:
 *               network:
 *                 type: string
 *                 enum: [base, solana, ethereum]
 *               confirmClear:
 *                 type: boolean
 *                 example: true
 *               includeDefaults:
                 type: boolean
                 example: false
                 description: "Set to true to also remove default tokens (not recommended)"
     responses:
       200:
         description: Tokens cleared successfully
         content:
           application/json:
             schema:
               type: object
               properties:
                 success:
                   type: boolean
                   example: true
                 message:
                   type: string
                   example: "Successfully cleared 2 custom tokens from base network"
                 data:
                   type: object
                   properties:
                     network:
                       type: string
                     removedTokensCount:
                       type: number
                     remainingTokensCount:
                       type: number
                     removedTokens:
                       type: array
                       items:
                         type: object
                         properties:
                           symbol:
                             type: string
                           name:
                             type: string
                           isDefault:
                             type: boolean
                     keptTokens:
                       type: array
                       items:
                         type: object
                         properties:
                           symbol:
                             type: string
                           name:
                             type: string
                           isDefault:
                             type: boolean
                     warning:
                       type: string
       400:
         description: Confirmation required
         content:
           application/json:
             schema:
               $ref: '#/components/schemas/BusinessErrorResponse'
       403:
         description: Account not activated by admin
         content:
           application/json:
             schema:
               $ref: '#/components/schemas/ActivationRequiredError'
       404:
         description: Business not found
         content:
           application/json:
             schema:
               $ref: '#/components/schemas/BusinessErrorResponse'
       500:
         description: Internal server error
         content:
           application/json:
             schema:
               $ref: '#/components/schemas/BusinessErrorResponse'
 */
router.delete('/tokens/clear', requireActivatedAccount, businessTokenController.clearNetworkTokens);

/**
 * @swagger
 * /api/v1/business/tokens/wallets:
 *   put:
 *     summary: Set payment wallets for fee collection (requires account activation)
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
 *                   example: "Payment wallets updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentWallets:
 *                       type: object
 *                       properties:
 *                         solana:
 *                           type: string
 *                         base:
 *                           type: string
 *                         ethereum:
 *                           type: string
 *       400:
 *         description: Invalid wallet address format
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
 *                   example: "Invalid wallet address format"
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *       403:
 *         description: Account not activated by admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivationRequiredError'
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
router.put('/tokens/wallets', requireActivatedAccount, businessTokenController.setPaymentWallets);

/**
 * @swagger
 * /api/v1/business/tokens/bank-account:
 *   put:
 *     summary: Set bank account for fiat payments (requires account activation)
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
 *                   example: "Bank account information saved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     bankAccount:
 *                       $ref: '#/components/schemas/BankAccount'
 *                     note:
 *                       type: string
 *                       example: "Bank account verification will be performed during the first transaction"
 *       400:
 *         description: Invalid account information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 *       403:
 *         description: Account not activated by admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivationRequiredError'
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
router.put('/tokens/bank-account', requireActivatedAccount, businessTokenController.setBankAccount);

/**
 * @swagger
 * /api/v1/business/tokens/configuration:
 *   get:
 *     summary: Get complete payment configuration (requires account activation)
 *     description: Retrieve all token configuration, fees, wallets, and bank account info with summary statistics
 *     tags: [Business Token Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved payment configuration
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
 *                     businessInfo:
 *                       type: object
 *                       properties:
 *                         businessId:
 *                           type: string
 *                         businessName:
 *                           type: string
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalTokens:
 *                           type: object
 *                           properties:
 *                             base:
 *                               type: number
 *                             solana:
 *                               type: number
 *                             ethereum:
 *                               type: number
 *                         defaultTokens:
 *                           type: object
 *                           properties:
 *                             base:
 *                               type: number
 *                             solana:
 *                               type: number
 *                             ethereum:
 *                               type: number
 *                         customTokens:
 *                           type: object
 *                           properties:
 *                             base:
 *                               type: number
 *                             solana:
 *                               type: number
 *                             ethereum:
 *                               type: number
 *                         activeTokens:
 *                           type: object
 *                           properties:
 *                             base:
 *                               type: number
 *                             solana:
 *                               type: number
 *                             ethereum:
 *                               type: number
 *                         averageFees:
 *                           type: object
 *                           properties:
 *                             base:
 *                               type: string
 *                             solana:
 *                               type: string
 *                             ethereum:
 *                               type: string
 *                         walletConfigured:
 *                           type: object
 *                           properties:
 *                             solana:
 *                               type: boolean
 *                             base:
 *                               type: boolean
 *                             ethereum:
 *                               type: boolean
 *                         bankAccountConfigured:
 *                           type: boolean
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
 *                     paymentWallets:
 *                       type: object
 *                       properties:
 *                         solana:
 *                           type: string
 *                         base:
 *                           type: string
 *                         ethereum:
 *                           type: string
 *                     bankAccount:
 *                       $ref: '#/components/schemas/BankAccount'
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                     defaultTokensInfo:
 *                       type: object
 *                       properties:
 *                         description:
 *                           type: string
 *                         feeCustomization:
 *                           type: string
 *                         defaultTokenProtection:
 *                           type: string
 *       403:
 *         description: Account not activated by admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivationRequiredError'
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
router.get('/tokens/configuration', requireActivatedAccount, businessTokenController.getPaymentConfiguration);

// ============= QUICK ACCESS ENDPOINTS =============

/**
 * @swagger
 * /api/v1/business/trading-status:
 *   get:
 *     summary: Get business trading readiness status (requires account activation)
 *     description: Quick check if business is ready to accept trades (includes default token check)
 *     tags: [Business Token Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trading status retrieved successfully
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
 *                     isReadyForTrading:
 *                       type: boolean
 *                       example: true
 *                       description: "True if business can accept trades with default tokens"
 *                     canReceiveCrypto:
 *                       type: boolean
 *                     canReceiveFiat:
 *                       type: boolean
 *                     hasActiveTokens:
 *                       type: boolean
 *                     hasDefaultTokens:
 *                       type: boolean
 *                       description: "Whether default tokens are configured"
 *                     requirements:
 *                       type: object
 *                       properties:
 *                         tokensConfigured:
 *                           type: boolean
 *                         defaultTokensAvailable:
 *                           type: boolean
 *                         walletsConfigured:
 *                           type: boolean
 *                         bankAccountConfigured:
 *                           type: boolean
 *                         businessVerified:
 *                           type: boolean
 *                     defaultTokensInfo:
 *                       type: object
 *                       properties:
 *                         message:
 *                           type: string
 *                           example: "Default tokens (ETH, USDC, USDT, SOL) are automatically available with 0% fees"
 *                         customizable:
 *                           type: string
 *       403:
 *         description: Account not activated by admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivationRequiredError'
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
router.get('/trading-status', requireActivatedAccount, async (req, res) => {
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

    // Get basic payment status
    const hasActiveTokens = business.supportedTokens && 
      (business.supportedTokens.base?.some(t => t.isActive) ||
       business.supportedTokens.solana?.some(t => t.isActive) ||
       business.supportedTokens.ethereum?.some(t => t.isActive));

    const hasWallets = !!(business.paymentWallets?.solana || business.paymentWallets?.base || business.paymentWallets?.ethereum);
    const hasBankAccount = !!(business.bankAccount?.accountNumber);

    const hasDefaultTokens = business.supportedTokens && 
      (business.supportedTokens.base?.some(t => t.isDefault) ||
       business.supportedTokens.solana?.some(t => t.isDefault) ||
       business.supportedTokens.ethereum?.some(t => t.isDefault));

    res.json({
      success: true,
      data: {
        businessId: business.businessId,
        businessName: business.businessName,
        isReadyForTrading: hasActiveTokens && hasWallets && business.status !== 'deleted',
        canReceiveCrypto: hasWallets && hasActiveTokens,
        canReceiveFiat: hasBankAccount,
        hasActiveTokens,
        hasDefaultTokens,
        requirements: {
          tokensConfigured: hasActiveTokens,
          defaultTokensAvailable: hasDefaultTokens,
          walletsConfigured: hasWallets,
          bankAccountConfigured: hasBankAccount,
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
 *     summary: Check if token is supported for trading (requires account activation)
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
 *                     isSupported:
 *                       type: boolean
 *                       example: true
 *                     token:
 *                       allOf:
 *                         - $ref: '#/components/schemas/SupportedToken'
 *                         - type: object
 *                           properties:
 *                             isDefaultToken:
 *                               type: boolean
 *                               description: "Whether this is a default token"
 *                     feePercentage:
 *                       type: number
 *                       example: 1.5
 *                     paymentWallet:
 *                       type: string
 *                       example: "0x742d35Cc6634C0532925a3b8D1D8ce28D2e67F5c"
 *                     networkSupported:
 *                       type: boolean
 *                       example: true
 *                     tokenType:
 *                       type: string
 *                       enum: [default, custom]
 *                       example: "default"
 *                       description: "Whether token is default or custom"
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessErrorResponse'
 *       403:
 *         description: Account not activated by admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivationRequiredError'
 *       404:
 *         description: Token not supported or business not found
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
router.post('/tokens/validate-for-trading', requireActivatedAccount, async (req, res) => {
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

    // Check if token is supported
    const networkTokens = business.supportedTokens?.[network.toLowerCase()] || [];
    const token = networkTokens.find(t => t.contractAddress.toLowerCase() === address.toLowerCase());
    const isSupported = token && token.isActive && token.isTradingEnabled;

    // Get fee configuration
    const feeConfig = business.feeConfiguration?.[network.toLowerCase()] || [];
    const feeEntry = feeConfig.find(f => f.contractAddress.toLowerCase() === address.toLowerCase());
    const feePercentage = feeEntry ? feeEntry.feePercentage : 0;

    const paymentWallet = business.paymentWallets?.[network.toLowerCase()];

    res.json({
      success: true,
      data: {
        isSupported: !!isSupported,
        token: isSupported ? {
          ...token,
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