const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth'); // Use destructuring

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: User ID
 *         email:
 *           type: string
 *           format: email
 *           description: User email
 *         fullName:
 *           type: string
 *           description: User full name
 *         phone:
 *           type: string
 *           description: User phone number
 *         isVerified:
 *           type: boolean
 *           description: Email verification status
 *         isAccountActivated:
 *           type: boolean
 *           description: Admin account activation status
 *         accountStatus:
 *           type: string
 *           enum: [pending_activation, active, suspended, banned]
 *           description: Account status
 *         isApiAccessApproved:
 *           type: boolean
 *           description: Admin API access approval status
 *         apiAccessStatus:
 *           type: string
 *           enum: [pending_approval, approved, rejected, revoked]
 *           description: API access status
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Account creation date
 *         lastLogin:
 *           type: string
 *           format: date-time
 *           description: Last login date
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               $ref: '#/components/schemas/User'
 *             token:
 *               type: string
 *             activationInfo:
 *               type: object
 *               properties:
 *                 accountActivated:
 *                   type: boolean
 *                 apiAccessApproved:
 *                   type: boolean
 *                 canCreateBusiness:
 *                   type: boolean
 *                 canAccessApiCredentials:
 *                   type: boolean
 *                 nextSteps:
 *                   type: string
 *     ApiAccessRequest:
 *       type: object
 *       properties:
 *         reason:
 *           type: string
 *           description: Reason for requesting API access
 *           example: "I need API access to integrate payment processing into my e-commerce platform"
 *         businessUseCase:
 *           type: string
 *           description: Detailed business use case
 *           example: "Online marketplace for digital products with cryptocurrency payment options"
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
 *             accountActivation:
 *               type: object
 *               properties:
 *                 isAccountActivated:
 *                   type: boolean
 *                 accountStatus:
 *                   type: string
 *                 activatedAt:
 *                   type: string
 *                   format: date-time
 *                 message:
 *                   type: string
 *             apiAccess:
 *               type: object
 *               properties:
 *                 isApiAccessApproved:
 *                   type: boolean
 *                 apiAccessStatus:
 *                   type: string
 *                 apiAccessApprovedAt:
 *                   type: string
 *                   format: date-time
 *                 message:
 *                   type: string
 *             overallStatus:
 *               type: object
 *               properties:
 *                 canCreateBusiness:
 *                   type: boolean
 *                 canAccessApiCredentials:
 *                   type: boolean
 *                 nextSteps:
 *                   type: string
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success: 
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *         error:
 *           type: string
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and authorization endpoints with admin approval system
 */

/**
 * @swagger
 * /api/v1/auth/signup:
 *   post:
 *     summary: Register a new user (requires admin activation)
 *     tags: [Authentication]
 *     description: Creates a new user account that requires admin activation before the user can create businesses. API access requires separate admin approval.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: password123
 *               fullName:
 *                 type: string
 *                 example: John Doe
 *               phone:
 *                 type: string
 *                 example: +1234567890
 *     responses:
 *       201:
 *         description: User registered successfully (pending admin activation)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/AuthResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         activationRequired:
 *                           type: boolean
 *                           example: true
 *                         message:
 *                           type: string
 *                           example: "Account created successfully. Admin activation required before you can create businesses."
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/signup', authController.signup);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user with activation status
 *     tags: [Authentication]
 *     description: Authenticates user and returns account activation and API access status information
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful with activation status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/v1/auth/activation-status:
 *   get:
 *     summary: Check account activation and API access status
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     description: Returns detailed information about account activation and API access approval status
 *     responses:
 *       200:
 *         description: Activation status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivationStatus'
 *       401:
 *         description: Unauthorized - invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/activation-status', authenticateToken, authController.getActivationStatus);

/**
 * @swagger
 * /api/v1/auth/request-api-access:
 *   post:
 *     summary: Request API access from admin
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     description: Submit a request for API access approval. Account must be activated first.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApiAccessRequest'
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
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Account not activated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/request-api-access', authenticateToken, authController.requestApiAccess);

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
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
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Password reset link sent (if user exists)
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
 *                 resetToken:
 *                   type: string
 *                   description: Only in development mode
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *                 example: "abc123def456..."
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: newpassword123
 *     responses:
 *       200:
 *         description: Password reset successfully
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
 *       400:
 *         description: Bad request - validation error or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/reset-password', authController.resetPassword);

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Change password for authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: oldpassword123
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: newpassword123
 *     responses:
 *       200:
 *         description: Password changed successfully
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
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - invalid current password or token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/change-password', authenticateToken, authController.changePassword);

/**
 * @swagger
 * /api/v1/auth/profile:
 *   get:
 *     summary: Get user profile with activation status
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     description: Returns user profile including account activation and API access status
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/User'
 *                     - type: object
 *                       properties:
 *                         accountSummary:
 *                           type: object
 *                           properties:
 *                             canCreateBusiness:
 *                               type: boolean
 *                             canAccessApi:
 *                               type: boolean
 *                             activationStatus:
 *                               type: string
 *                             apiAccessStatus:
 *                               type: string
 *       401:
 *         description: Unauthorized - invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/profile', authenticateToken, authController.getProfile);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
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
 *       401:
 *         description: Unauthorized - invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/logout', authenticateToken, authController.logout);

module.exports = router;