const express = require('express');
const router = express.Router();
const businessController = require('../controllers/businessController');
const { authenticateToken } = require('../middleware/auth');

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
 *           enum: [Technology, Finance, Healthcare, Education, E-commerce, Manufacturing, Real Estate, Consulting, Marketing, Food & Beverage, Entertainment, Transportation, Energy, Agriculture, Other]
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
 *           enum: [pending_verification, verified, rejected, deleted]
 *           description: Business verification status
 *         createdAt:
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
 *   name: Business Management
 *   description: Business registration, management, and API key generation
 */

/**
 * @swagger
 * /api/v1/business/create:
 *   post:
 *     summary: Register a new business and generate API credentials
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
 *                 enum: [Technology, Finance, Healthcare, Education, E-commerce, Manufacturing, Real Estate, Consulting, Marketing, Food & Beverage, Entertainment, Transportation, Energy, Agriculture, Other]
 *                 example: "Technology"
 *               country:
 *                 type: string
 *                 example: "United States"
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
 *                 example: "+1-555-123-4567"
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                     example: "123 Tech Street"
 *                   city:
 *                     type: string
 *                     example: "San Francisco"
 *                   state:
 *                     type: string
 *                     example: "CA"
 *                   zipCode:
 *                     type: string
 *                     example: "94105"
 *                   country:
 *                     type: string
 *                     example: "United States"
 *               logo:
 *                 type: string
 *                 example: "https://example.com/logo.png"
 *     responses:
 *       201:
 *         description: Business created successfully with API credentials
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
 *                   example: "Business created successfully with API credentials"
 *                 data:
 *                   $ref: '#/components/schemas/Business'
 *                 apiCredentials:
 *                   $ref: '#/components/schemas/ApiCredentials'
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
router.post('/create', authenticateToken, businessController.createBusiness);

/**
 * @swagger
 * /api/v1/business/profile:
 *   get:
 *     summary: Get business profile with API credentials info
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
router.get('/profile', authenticateToken, businessController.getBusinessProfile);

/**
 * @swagger
 * /api/v1/business/update:
 *   put:
 *     summary: Update business profile
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
 *                 example: "+1-555-987-6543"
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
router.put('/update', authenticateToken, businessController.updateBusiness);

/**
 * @swagger
 * /api/v1/business/verification-status:
 *   get:
 *     summary: Get business verification status
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
 *                       enum: [pending_verification, verified, rejected, deleted]
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
router.get('/verification-status', authenticateToken, businessController.getVerificationStatus);

/**
 * @swagger
 * /api/v1/business/api-keys:
 *   get:
 *     summary: Get API key information (without secret key)
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
router.get('/api-keys', authenticateToken, businessController.getApiKeyInfo);

/**
 * @swagger
 * /api/v1/business/regenerate-api-keys:
 *   post:
 *     summary: Regenerate API keys for business
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
router.post('/regenerate-api-keys', authenticateToken, businessController.regenerateApiKeys);

/**
 * @swagger
 * /api/v1/business/delete:
 *   delete:
 *     summary: Delete business (soft delete) and deactivate API keys
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
router.delete('/delete', authenticateToken, businessController.deleteBusiness);

module.exports = router;