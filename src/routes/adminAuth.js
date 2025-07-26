// routes/adminAuth.js
const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/adminAuthController');
const { authenticateAdmin, requireRole } = require('../middleware/adminAuth');

/**
 * @swagger
 * components:
 *   schemas:
 *     AdminLoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: admin@company.com
 *         password:
 *           type: string
 *           example: adminpassword123
 *         twoFactorCode:
 *           type: string
 *           example: "123456"
 *           description: 2FA code if enabled
 *     AdminLoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             admin:
 *               $ref: '#/components/schemas/AdminUser'
 *             token:
 *               type: string
 *               description: JWT token for admin authentication
 *             permissions:
 *               type: array
 *               items:
 *                 type: string
 *     AdminUser:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Admin ID
 *         email:
 *           type: string
 *           format: email
 *           description: Admin email
 *         fullName:
 *           type: string
 *           description: Admin full name
 *         role:
 *           type: string
 *           enum: [super_admin, admin, moderator]
 *           description: Admin role
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *           description: Admin permissions
 *         isActive:
 *           type: boolean
 *           description: Admin account status
 *         createdAt:
 *           type: string
 *           format: date-time
 *         lastLogin:
 *           type: string
 *           format: date-time
 *     AdminCreateRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - fullName
 *         - role
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: newadmin@company.com
 *         password:
 *           type: string
 *           minLength: 8
 *           example: securepassword123
 *         fullName:
 *           type: string
 *           example: John Admin
 *         role:
 *           type: string
 *           enum: [super_admin, admin, moderator]
 *           example: moderator
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *           example: ["user_verification", "business_verification"]
 *     AdminErrorResponse:
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
 *     adminAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: Admin JWT token required
 */

/**
 * @swagger
 * tags:
 *   name: Admin Authentication
 *   description: Admin authentication and account management
 */

/**
 * @swagger
 * /api/v1/admin/auth/login:
 *   post:
 *     summary: Admin login
 *     description: Authenticate admin user and get access token
 *     tags: [Admin Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminLoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminLoginResponse'
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminErrorResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminErrorResponse'
 *       423:
 *         description: Account locked due to too many failed attempts
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
 *                 lockUntil:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminErrorResponse'
 */
router.post('/login', adminAuthController.login);

/**
 * @swagger
 * /api/v1/admin/auth/profile:
 *   get:
 *     summary: Get admin profile
 *     description: Get current admin profile information
 *     tags: [Admin Authentication]
 *     security:
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/AdminUser'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminErrorResponse'
 */
router.get('/profile', authenticateAdmin, adminAuthController.getProfile);

/**
 * @swagger
 * /api/v1/admin/auth/change-password:
 *   post:
 *     summary: Change admin password
 *     description: Change password for authenticated admin
 *     tags: [Admin Authentication]
 *     security:
 *       - adminAuth: []
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
 *                 minLength: 8
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
 *               $ref: '#/components/schemas/AdminErrorResponse'
 *       401:
 *         description: Current password incorrect
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminErrorResponse'
 */
router.post('/change-password', authenticateAdmin, adminAuthController.changePassword);

/**
 * @swagger
 * /api/v1/admin/auth/create-admin:
 *   post:
 *     summary: Create new admin account
 *     description: Create a new admin account (super admin only)
 *     tags: [Admin Authentication]
 *     security:
 *       - adminAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminCreateRequest'
 *     responses:
 *       201:
 *         description: Admin created successfully
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
 *                 data:
 *                   $ref: '#/components/schemas/AdminUser'
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminErrorResponse'
 *       403:
 *         description: Forbidden - super admin required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminErrorResponse'
 *       409:
 *         description: Admin already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminErrorResponse'
 */
router.post('/create-admin', authenticateAdmin, requireRole(['super_admin']), adminAuthController.createAdmin);

/**
 * @swagger
 * /api/v1/admin/auth/admins:
 *   get:
 *     summary: Get all admin accounts
 *     description: List all admin accounts (super admin only)
 *     tags: [Admin Authentication]
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
 *         name: role
 *         schema:
 *           type: string
 *           enum: [super_admin, admin, moderator]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Admins retrieved successfully
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
 *                     admins:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AdminUser'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       403:
 *         description: Forbidden - super admin required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminErrorResponse'
 */
router.get('/admins', authenticateAdmin, requireRole(['super_admin']), adminAuthController.getAdmins);

/**
 * @swagger
 * /api/v1/admin/auth/admins/{adminId}/toggle-status:
 *   put:
 *     summary: Toggle admin account status
 *     description: Activate or deactivate admin account (super admin only)
 *     tags: [Admin Authentication]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: adminId
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin ID to toggle
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 example: false
 *               reason:
 *                 type: string
 *                 example: Account deactivated for security review
 *     responses:
 *       200:
 *         description: Admin status updated successfully
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     adminId:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                     reason:
 *                       type: string
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - cannot deactivate own account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminErrorResponse'
 *       403:
 *         description: Forbidden - super admin required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminErrorResponse'
 *       404:
 *         description: Admin not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminErrorResponse'
 */
router.put('/admins/:adminId/toggle-status', authenticateAdmin, requireRole(['super_admin']), adminAuthController.toggleAdminStatus);

/**
 * @swagger
 * /api/v1/admin/auth/logout:
 *   post:
 *     summary: Admin logout
 *     description: Logout admin and invalidate session
 *     tags: [Admin Authentication]
 *     security:
 *       - adminAuth: []
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
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminErrorResponse'
 */
router.post('/logout', authenticateAdmin, adminAuthController.logout);

module.exports = router;