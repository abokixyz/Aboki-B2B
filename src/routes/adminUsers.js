// routes/adminUsers.js
const express = require('express');
const router = express.Router();
const adminUserController = require('../controllers/adminUserController');
const { authenticateAdmin, requirePermission, requireRole } = require('../middleware/adminAuth');

/**
 * @swagger
 * components:
 *   schemas:
 *     UserVerificationRequest:
 *       type: object
 *       required:
 *         - action
 *       properties:
 *         action:
 *           type: string
 *           enum: [approve, reject]
 *           example: approve
 *         rejectionReason:
 *           type: string
 *           example: Insufficient documentation provided
 *         enableApi:
 *           type: boolean
 *           example: true
 *           description: Whether to enable API access (only for approve action)
 *         notes:
 *           type: string
 *           example: Verified business documents
 */

/**
 * @swagger
 * tags:
 *   name: Admin User Management
 *   description: Admin endpoints for managing and verifying users
 */

// IMPORTANT: Specific routes MUST come BEFORE parameterized routes (/:userId)

/**
 * @swagger
 * /api/v1/admin/users/pending-verification:
 *   get:
 *     summary: Get users pending verification
 *     description: List all users waiting for admin verification
 *     tags: [Admin User Management]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, lastLogin]
 *           default: createdAt
 *     responses:
 *       200:
 *         description: Pending users retrieved successfully
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/pending-verification', authenticateAdmin, requirePermission(['user_verification']), adminUserController.getPendingVerification);

/**
 * @swagger
 * /api/v1/admin/users/stats:
 *   get:
 *     summary: Get user statistics
 *     description: Get comprehensive user statistics for admin dashboard
 *     tags: [Admin User Management]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Time period for statistics
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/stats', authenticateAdmin, requirePermission(['analytics_view']), adminUserController.getUserStats);

/**
 * @swagger
 * /api/v1/admin/users/bulk-actions:
 *   post:
 *     summary: Perform bulk actions on users
 *     description: Execute bulk operations on multiple users
 *     tags: [Admin User Management]
 *     security:
 *       - adminAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *               - action
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["userId1", "userId2"]
 *               action:
 *                 type: string
 *                 enum: [approve, reject, suspend, activate, enable_api, disable_api]
 *                 example: approve
 *               reason:
 *                 type: string
 *                 example: Bulk approval after document review
 *               sendNotification:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Bulk action completed
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post('/bulk-actions', authenticateAdmin, requirePermission(['bulk_operations']), adminUserController.bulkUserActions);

/**
 * @swagger
 * /api/v1/admin/users/migrate-fields:
 *   post:
 *     summary: Migrate user fields (super admin only)
 *     description: Add missing verificationStatus, accountStatus, and other required fields to existing users
 *     tags: [Admin User Management]
 *     security:
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Migration completed successfully
 *       403:
 *         description: Only super admins can run migration
 *       500:
 *         description: Internal server error
 */
router.post('/migrate-fields', authenticateAdmin, requireRole(['super_admin']), adminUserController.migrateUserFields);

// NOW the parameterized routes can come after the specific ones

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Get all users with filtering and pagination
 *     description: List all users with advanced filtering options for admin management
 *     tags: [Admin User Management]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by email, name, or phone
 *       - in: query
 *         name: verificationStatus
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, suspended]
 *       - in: query
 *         name: accountStatus
 *         schema:
 *           type: string
 *           enum: [active, suspended, deactivated]
 *       - in: query
 *         name: isVerified
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: isApiEnabled
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, lastLogin, email, verificationStatus]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateAdmin, requirePermission(['user_management', 'user_verification']), adminUserController.getUsers);

/**
 * @swagger
 * /api/v1/admin/users/{userId}:
 *   get:
 *     summary: Get detailed user information
 *     description: Get comprehensive user details including verification history and business information
 *     tags: [Admin User Management]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *       404:
 *         description: User not found
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/:userId', authenticateAdmin, requirePermission(['user_management', 'user_verification']), adminUserController.getUserDetails);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/verify:
 *   post:
 *     summary: Verify or reject user account
 *     description: Approve or reject user verification for API access
 *     tags: [Admin User Management]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to verify
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserVerificationRequest'
 *     responses:
 *       200:
 *         description: User verification status updated successfully
 *       400:
 *         description: Invalid request or user already processed
 *       404:
 *         description: User not found
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post('/:userId/verify', authenticateAdmin, requirePermission(['user_verification']), adminUserController.verifyUser);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/manage:
 *   put:
 *     summary: Manage user account status
 *     description: Update user account status, API access, and other management functions
 *     tags: [Admin User Management]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to manage
 *     responses:
 *       200:
 *         description: User account updated successfully
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: User not found
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.put('/:userId/manage', authenticateAdmin, requirePermission(['user_management']), adminUserController.manageUser);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/api-access:
 *   put:
 *     summary: Toggle user API access
 *     description: Enable or disable API access for verified users
 *     tags: [Admin User Management]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isApiEnabled
 *             properties:
 *               isApiEnabled:
 *                 type: boolean
 *                 example: true
 *               reason:
 *                 type: string
 *                 example: API access granted after verification
 *     responses:
 *       200:
 *         description: API access updated successfully
 *       400:
 *         description: Invalid request or user not verified
 *       404:
 *         description: User not found
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.put('/:userId/api-access', authenticateAdmin, requirePermission(['user_management', 'api_key_management']), adminUserController.toggleApiAccess);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/reset-password:
 *   post:
 *     summary: Reset user password
 *     description: Force reset user password (admin only)
 *     tags: [Admin User Management]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: newpassword123
 *                 description: Leave empty to generate random password
 *               sendEmail:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to send new password via email
 *               reason:
 *                 type: string
 *                 example: Password reset requested by user
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       404:
 *         description: User not found
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post('/:userId/reset-password', authenticateAdmin, requirePermission(['user_management']), adminUserController.resetUserPassword);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/history:
 *   get:
 *     summary: Get user action history
 *     description: Get detailed history of all admin actions performed on a user
 *     tags: [Admin User Management]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: User history retrieved successfully
 *       404:
 *         description: User not found
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/:userId/history', authenticateAdmin, requirePermission(['user_management']), adminUserController.getUserHistory);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/force-verify-email:
 *   post:
 *     summary: Force verify user email (admin only)
 *     description: Admin can force verify a user's email address for testing or special cases
 *     tags: [Admin User Management]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: Force verified for testing purposes
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Email already verified
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post('/:userId/force-verify-email', authenticateAdmin, requirePermission(['user_management']), adminUserController.forceVerifyEmail);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/resend-verification:
 *   post:
 *     summary: Resend verification email
 *     description: Admin can resend verification email to user
 *     tags: [Admin User Management]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Verification email sent successfully
 *       400:
 *         description: Email already verified
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post('/:userId/resend-verification', authenticateAdmin, requirePermission(['user_management']), adminUserController.resendVerificationEmail);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/debug:
 *   get:
 *     summary: Debug user status (development only)
 *     description: Get detailed user information for debugging verification issues
 *     tags: [Admin User Management]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to debug
 *     responses:
 *       200:
 *         description: User debug information retrieved successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/:userId/debug', authenticateAdmin, adminUserController.debugUserStatus);

module.exports = router;