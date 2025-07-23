const express = require('express');
const router = express.Router();

// Import controllers
const BusinessController = require('../controllers/businessController');
const AdminController = require('../controllers/AdminController');

// Import middleware
const { authenticateToken } = require('../middleware/auth');

// Account activation check middleware
const checkAccountActivation = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { User } = require('../models');
    
    const user = await User.findById(userId).select('isAccountActivated accountStatus activatedAt activatedBy createdAt');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isAccountActivated || user.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin activation. Please wait for admin approval before you can create or manage businesses.',
        accountStatus: user.accountStatus || 'pending_activation',
        registeredAt: user.createdAt,
        note: 'Contact support if your account has been pending for more than 48 hours'
      });
    }

    req.userActivationInfo = {
      isActivated: user.isAccountActivated,
      status: user.accountStatus,
      activatedAt: user.activatedAt,
      activatedBy: user.activatedBy
    };

    next();
  } catch (error) {
    console.error('Account activation check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking account activation status'
    });
  }
};

// Admin role check middleware
const checkAdminRole = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { User } = require('../models');
    
    const user = await User.findById(userId).select('role isAdmin isAccountActivated accountStatus email username fullName');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('🔍 Admin check for user:', {
      userId,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      isAccountActivated: user.isAccountActivated,
      accountStatus: user.accountStatus,
      role: user.role,
      isAdmin: user.isAdmin
    });

    if (!user.isAccountActivated || user.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is not activated',
        userInfo: {
          email: user.email,
          accountStatus: user.accountStatus,
          isAccountActivated: user.isAccountActivated
        }
      });
    }

    if (!user.isAdmin && user.role !== 'admin' && user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
        userInfo: {
          email: user.email,
          role: user.role || 'user',
          isAdmin: user.isAdmin || false,
          note: 'Contact an administrator to get admin privileges'
        }
      });
    }

    req.adminInfo = {
      adminId: userId,
      role: user.role,
      isAdmin: user.isAdmin,
      email: user.email,
      fullName: user.fullName
    };

    console.log('✅ Admin access granted for:', user.email);
    next();
  } catch (error) {
    console.error('Admin role check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking admin privileges'
    });
  }
};

// Activation status check function
const checkActivationStatus = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { User } = require('../models');
    
    const user = await User.findById(userId).select('isAccountActivated accountStatus activatedAt activatedBy createdAt email username');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        userId,
        email: user.email,
        username: user.username,
        isAccountActivated: user.isAccountActivated || false,
        accountStatus: user.accountStatus || 'pending_activation',
        registeredAt: user.createdAt,
        activatedAt: user.activatedAt,
        activatedBy: user.activatedBy,
        message: user.isAccountActivated 
          ? 'Your account is activated and you can create businesses'
          : 'Your account is pending admin activation. Please wait for approval.',
        nextSteps: user.isAccountActivated 
          ? 'You can now create and manage your business'
          : 'Contact support if your account has been pending for more than 48 hours'
      }
    });
  } catch (error) {
    console.error('Check activation status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking activation status'
    });
  }
};

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     Error:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *         error:
 *           type: string
 *     ActivationStatus:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             userId:
 *               type: string
 *             email:
 *               type: string
 *             username:
 *               type: string
 *             isAccountActivated:
 *               type: boolean
 *             accountStatus:
 *               type: string
 *               enum: [pending_activation, active, suspended, banned]
 *             registeredAt:
 *               type: string
 *               format: date-time
 *             activatedAt:
 *               type: string
 *               format: date-time
 *             message:
 *               type: string
 *             nextSteps:
 *               type: string
 */

// ===========================================
// USER ACCOUNT STATUS ROUTES
// ===========================================

/**
 * @swagger
 * /api/v1/activation-status:
 *   get:
 *     tags:
 *       - User Account
 *     summary: Check user account activation status
 *     description: Returns the current activation status of the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Activation status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivationStatus'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/activation-status', authenticateToken, checkActivationStatus);

// ===========================================
// BUSINESS ROUTES (WITH ACTIVATION CHECK)
// ===========================================

/**
 * @swagger
 * /api/v1/business:
 *   post:
 *     tags:
 *       - Business Management
 *     summary: Create a new business
 *     description: Creates a new business for the authenticated and activated user
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
 *                 maxLength: 100
 *                 example: "Tech Solutions Inc"
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
 *     responses:
 *       201:
 *         description: Business created successfully
 *       400:
 *         description: Bad request - Invalid input data
 *       403:
 *         description: Forbidden - Account not activated
 *       409:
 *         description: Conflict - Business already exists
 *       500:
 *         description: Internal server error
 */
router.post('/business', authenticateToken, checkAccountActivation, BusinessController.createBusiness);

/**
 * @swagger
 * /api/v1/business/profile:
 *   get:
 *     tags:
 *       - Business Management
 *     summary: Get business profile
 *     description: Retrieves the business profile for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Business profile retrieved successfully
 *       403:
 *         description: Forbidden - Account not activated
 *       404:
 *         description: No active business found
 *       500:
 *         description: Internal server error
 */
router.get('/business/profile', authenticateToken, checkAccountActivation, BusinessController.getBusinessProfile);

/**
 * @swagger
 * /api/v1/business:
 *   put:
 *     tags:
 *       - Business Management
 *     summary: Update business profile
 *     description: Updates the business profile for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Business updated successfully
 *       403:
 *         description: Forbidden - Account not activated
 *       404:
 *         description: No active business found
 *       500:
 *         description: Internal server error
 */
router.put('/business', authenticateToken, checkAccountActivation, BusinessController.updateBusiness);

/**
 * @swagger
 * /api/v1/business:
 *   delete:
 *     tags:
 *       - Business Management
 *     summary: Delete business (soft delete)
 *     description: Soft deletes the business and deactivates associated API keys
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Business deleted successfully
 *       400:
 *         description: Bad request - Confirmation required
 *       403:
 *         description: Forbidden - Account not activated
 *       404:
 *         description: No active business found
 *       500:
 *         description: Internal server error
 */
router.delete('/business', authenticateToken, checkAccountActivation, BusinessController.deleteBusiness);

/**
 * @swagger
 * /api/v1/business/verification-status:
 *   get:
 *     tags:
 *       - Business Verification
 *     summary: Get business verification status
 *     description: Returns the verification status of the user's business
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification status retrieved successfully
 *       403:
 *         description: Forbidden - Account not activated
 *       404:
 *         description: No active business found
 *       500:
 *         description: Internal server error
 */
router.get('/business/verification-status', authenticateToken, checkAccountActivation, BusinessController.getVerificationStatus);

/**
 * @swagger
 * /api/v1/business/api-keys:
 *   get:
 *     tags:
 *       - API Key Management
 *     summary: Get API key information
 *     description: Returns the API key information (excluding secret key)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: API key information retrieved successfully
 *       403:
 *         description: Forbidden - Account not activated
 *       404:
 *         description: No active business or API keys found
 *       500:
 *         description: Internal server error
 */
router.get('/business/api-keys', authenticateToken, checkAccountActivation, BusinessController.getApiKeyInfo);

/**
 * @swagger
 * /api/v1/business/api-keys/regenerate:
 *   post:
 *     tags:
 *       - API Key Management
 *     summary: Regenerate API keys
 *     description: Deactivates old API keys and generates new ones
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: API keys regenerated successfully
 *       403:
 *         description: Forbidden - Account not activated
 *       404:
 *         description: No active business found
 *       500:
 *         description: Internal server error
 */
router.post('/business/api-keys/regenerate', authenticateToken, checkAccountActivation, BusinessController.regenerateApiKeys);

// ===========================================
// ADMIN ROUTES (ADMIN ROLE REQUIRED)
// ===========================================

/**
 * @swagger
 * /api/v1/admin/test:
 *   get:
 *     tags:
 *       - Admin - Testing
 *     summary: Test admin access
 *     description: Test route to verify admin access is working correctly (Admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin access confirmed
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
 *                   example: "Admin access confirmed"
 *                 admin:
 *                   type: object
 *                   properties:
 *                     adminId:
 *                       type: string
 *                     role:
 *                       type: string
 *                     isAdmin:
 *                       type: boolean
 *                     email:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       403:
 *         description: Forbidden - Admin privileges required
 *       500:
 *         description: Internal server error
 */
router.get('/admin/test', authenticateToken, checkAdminRole, (req, res) => {
  res.json({
    success: true,
    message: 'Admin access confirmed',
    admin: req.adminInfo,
    timestamp: new Date().toISOString(),
    note: 'This endpoint confirms that admin authentication and authorization are working properly'
  });
});

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     tags:
 *       - Admin - User Management
 *     summary: Get all users with filters
 *     description: Returns a paginated list of users with optional filters (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Users per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, pending, active, suspended, banned]
 *           default: all
 *         description: Filter by account status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by email, username, or full name
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       403:
 *         description: Forbidden - Admin privileges required
 *       500:
 *         description: Internal server error
 *       501:
 *         description: Not implemented - Admin functionality not yet available
 */
router.get('/admin/users', authenticateToken, checkAdminRole, (req, res) => {
  if (AdminController && AdminController.getAllUsers) {
    return AdminController.getAllUsers(req, res);
  }
  res.status(501).json({
    success: false,
    message: 'Admin functionality not yet implemented. Please create AdminController with getAllUsers method.',
    admin: req.adminInfo
  });
});

/**
 * @swagger
 * /api/v1/admin/users/pending:
 *   get:
 *     tags:
 *       - Admin - User Management
 *     summary: Get pending user activations
 *     description: Returns users that are pending admin activation (Admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending users retrieved successfully
 *       403:
 *         description: Forbidden - Admin privileges required
 *       500:
 *         description: Internal server error
 *       501:
 *         description: Not implemented - Admin functionality not yet available
 */
router.get('/admin/users/pending', authenticateToken, checkAdminRole, (req, res) => {
  if (AdminController && AdminController.getPendingActivations) {
    return AdminController.getPendingActivations(req, res);
  }
  res.status(501).json({
    success: false,
    message: 'Admin functionality not yet implemented. Please create AdminController with getPendingActivations method.',
    admin: req.adminInfo
  });
});

/**
 * @swagger
 * /api/v1/admin/users/{userId}:
 *   get:
 *     tags:
 *       - Admin - User Management
 *     summary: Get user details with businesses
 *     description: Returns detailed information about a specific user including their businesses (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *       400:
 *         description: Bad request - User ID required
 *       403:
 *         description: Forbidden - Admin privileges required
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 *       501:
 *         description: Not implemented - Admin functionality not yet available
 */
router.get('/admin/users/:userId', authenticateToken, checkAdminRole, (req, res) => {
  if (AdminController && AdminController.getUserDetails) {
    return AdminController.getUserDetails(req, res);
  }
  res.status(501).json({
    success: false,
    message: 'Admin functionality not yet implemented. Please create AdminController with getUserDetails method.',
    admin: req.adminInfo
  });
});

/**
 * @swagger
 * /api/v1/admin/users/{userId}/activate:
 *   post:
 *     tags:
 *       - Admin - User Activation
 *     summary: Activate a user account
 *     description: Activates a pending user account (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to activate
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for activation
 *                 example: "Account verified and approved"
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: User activated successfully
 *       400:
 *         description: Bad request - User already activated
 *       403:
 *         description: Forbidden - Admin privileges required
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 *       501:
 *         description: Not implemented - Admin functionality not yet available
 */
router.post('/admin/users/:userId/activate', authenticateToken, checkAdminRole, (req, res) => {
  if (AdminController && AdminController.activateUser) {
    return AdminController.activateUser(req, res);
  }
  res.status(501).json({
    success: false,
    message: 'Admin functionality not yet implemented. Please create AdminController with activateUser method.',
    admin: req.adminInfo
  });
});

/**
 * @swagger
 * /api/v1/admin/users/{userId}/suspend:
 *   post:
 *     tags:
 *       - Admin - User Activation
 *     summary: Suspend a user account
 *     description: Suspends an active user account (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to suspend
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for suspension (required)
 *                 example: "Violation of terms of service"
 *                 minLength: 10
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: User suspended successfully
 *       400:
 *         description: Bad request - Reason required or user already suspended
 *       403:
 *         description: Forbidden - Admin privileges required
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 *       501:
 *         description: Not implemented - Admin functionality not yet available
 */
router.post('/admin/users/:userId/suspend', authenticateToken, checkAdminRole, (req, res) => {
  if (AdminController && AdminController.suspendUser) {
    return AdminController.suspendUser(req, res);
  }
  res.status(501).json({
    success: false,
    message: 'Admin functionality not yet implemented. Please create AdminController with suspendUser method.',
    admin: req.adminInfo
  });
});

/**
 * @swagger
 * /api/v1/admin/users/{userId}/reactivate:
 *   post:
 *     tags:
 *       - Admin - User Activation
 *     summary: Reactivate a suspended user
 *     description: Reactivates a suspended user account (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to reactivate
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for reactivation
 *                 example: "Issue resolved, account restored"
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: User reactivated successfully
 *       400:
 *         description: Bad request - User not suspended
 *       403:
 *         description: Forbidden - Admin privileges required
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 *       501:
 *         description: Not implemented - Admin functionality not yet available
 */
router.post('/admin/users/:userId/reactivate', authenticateToken, checkAdminRole, (req, res) => {
  if (AdminController && AdminController.reactivateUser) {
    return AdminController.reactivateUser(req, res);
  }
  res.status(501).json({
    success: false,
    message: 'Admin functionality not yet implemented. Please create AdminController with reactivateUser method.',
    admin: req.adminInfo
  });
});

/**
 * @swagger
 * /api/v1/admin/users/bulk-activate:
 *   post:
 *     tags:
 *       - Admin - User Activation
 *     summary: Bulk activate multiple users
 *     description: Activates multiple user accounts at once (max 50 users) (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 1
 *                 maxItems: 50
 *                 description: Array of user IDs to activate
 *                 example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"]
 *               reason:
 *                 type: string
 *                 description: Reason for bulk activation
 *                 example: "Batch approval after verification"
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Users activated successfully
 *       400:
 *         description: Bad request - Invalid user IDs or too many users
 *       403:
 *         description: Forbidden - Admin privileges required
 *       404:
 *         description: No eligible users found
 *       500:
 *         description: Internal server error
 *       501:
 *         description: Not implemented - Admin functionality not yet available
 */
router.post('/admin/users/bulk-activate', authenticateToken, checkAdminRole, (req, res) => {
  if (AdminController && AdminController.bulkActivateUsers) {
    return AdminController.bulkActivateUsers(req, res);
  }
  res.status(501).json({
    success: false,
    message: 'Admin functionality not yet implemented. Please create AdminController with bulkActivateUsers method.',
    admin: req.adminInfo
  });
});

/**
 * @swagger
 * /api/v1/admin/stats/activation:
 *   get:
 *     tags:
 *       - Admin - Statistics
 *     summary: Get activation statistics
 *     description: Returns comprehensive statistics about user activations (Admin only)
 *     security:
 *       - bearerAuth: []
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
 *                         totalUsers:
 *                           type: integer
 *                           example: 1250
 *                         activeUsers:
 *                           type: integer
 *                           example: 980
 *                         pendingUsers:
 *                           type: integer
 *                           example: 150
 *                         suspendedUsers:
 *                           type: integer
 *                           example: 15
 *                         bannedUsers:
 *                           type: integer
 *                           example: 5
 *                     recentActivations:
 *                       type: integer
 *                       description: Activations in the last 7 days
 *                       example: 25
 *                     pendingByDate:
 *                       type: array
 *                       description: Pending registrations by date (last 7 days)
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             format: date
 *                             example: "2024-01-15"
 *                           count:
 *                             type: integer
 *                             example: 12
 *       403:
 *         description: Forbidden - Admin privileges required
 *       500:
 *         description: Internal server error
 *       501:
 *         description: Not implemented - Admin functionality not yet available
 */
router.get('/admin/stats/activation', authenticateToken, checkAdminRole, (req, res) => {
  if (AdminController && AdminController.getActivationStats) {
    return AdminController.getActivationStats(req, res);
  }
  res.status(501).json({
    success: false,
    message: 'Admin functionality not yet implemented. Please create AdminController with getActivationStats method.',
    admin: req.adminInfo
  });
});

// ===========================================
// PUBLIC ROUTES (NO AUTHENTICATION REQUIRED)
// ===========================================

/**
 * @swagger
 * /api/v1/config/default-tokens:
 *   get:
 *     tags:
 *       - Configuration
 *     summary: Get default tokens configuration
 *     description: Returns the default tokens configuration (public reference)
 *     responses:
 *       200:
 *         description: Default tokens configuration retrieved successfully
 *         content:application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Default tokens configuration not yet implemented"
 *                     info:
 *                       type: object
 *                       properties:
 *                         description:
 *                           type: string
 *                           example: "Default tokens will be automatically added to businesses when the feature is implemented"
 *                         defaultFeePercentage:
 *                           type: number
 *                           example: 0
 *                         customizable:
 *                           type: string
 *                           example: "Businesses will be able to customize fees and add more tokens"
 *       500:
 *         description: Internal server error
 */
router.get('/config/default-tokens', (req, res) => {
    try {
      if (BusinessController && BusinessController.getDefaultTokensConfig) {
        res.json({
          success: true,
          data: BusinessController.getDefaultTokensConfig()
        });
      } else {
        res.json({
          success: true,
          data: {
            message: 'Default tokens configuration not yet implemented',
            info: {
              description: 'Default tokens will be automatically added to businesses when the feature is implemented',
              defaultFeePercentage: 0,
              customizable: 'Businesses will be able to customize fees and add more tokens'
            }
          }
        });
      }
    } catch (error) {
      console.error('Default tokens config error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving default tokens configuration'
      });
    }
  });
  
  // ===========================================
  // TEMPORARY ADMIN CREATION ROUTE (REMOVE AFTER CREATING ADMIN)
  // ===========================================
  
  /**
   * @swagger
   * /api/v1/make-admin:
   *   post:
   *     tags:
   *       - Temporary - Admin Creation
   *     summary: Make a user admin (TEMPORARY ROUTE)
   *     description: Temporarily creates an admin user - REMOVE THIS ROUTE AFTER CREATING YOUR ADMIN
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 example: "user@example.com"
   *                 description: Email of the user to make admin
   *     responses:
   *       200:
   *         description: User successfully made admin
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
   *                   example: "User successfully made admin"
   *                 user:
   *                   type: object
   *                   properties:
   *                     email:
   *                       type: string
   *                     username:
   *                       type: string
   *                     fullName:
   *                       type: string
   *                     isAdmin:
   *                       type: boolean
   *                       example: true
   *                     role:
   *                       type: string
   *                       example: "admin"
   *                     accountStatus:
   *                       type: string
   *                       example: "active"
   *                     isAccountActivated:
   *                       type: boolean
   *                       example: true
   *                 note:
   *                   type: string
   *                   example: "REMEMBER TO REMOVE THIS ROUTE AFTER CREATING YOUR ADMIN!"
   *       400:
   *         description: Bad request - Email required
   *       404:
   *         description: User not found
   *       500:
   *         description: Internal server error
   */
  router.post('/make-admin', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }
      
      const { User } = require('../models');
      const user = await User.findOneAndUpdate(
        { email },
        {
          isAdmin: true,
          role: 'admin',
          isAccountActivated: true,
          accountStatus: 'active'
        },
        { new: true }
      ).select('email username fullName isAdmin role accountStatus isAccountActivated');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found with that email'
        });
      }
      
      console.log('👑 New admin created:', {
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        isAdmin: user.isAdmin,
        role: user.role,
        accountStatus: user.accountStatus
      });
      
      res.json({
        success: true,
        message: 'User successfully made admin',
        user: {
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          isAdmin: user.isAdmin,
          role: user.role,
          accountStatus: user.accountStatus,
          isAccountActivated: user.isAccountActivated
        },
        note: 'REMEMBER TO REMOVE THIS ROUTE AFTER CREATING YOUR ADMIN!'
      });
      
    } catch (error) {
      console.error('Make admin error:', error);
      res.status(500).json({
        success: false,
        message: 'Error making user admin',
        error: error.message
      });
    }
  });
  
  module.exports = router;