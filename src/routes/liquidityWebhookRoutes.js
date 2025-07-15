const express = require('express');
const router = express.Router();
const liquidityWebhookController = require('../controllers/liquidityWebhookController');

/**
 * @swagger
 * tags:
 *   - name: Liquidity Webhooks
 *     description: Internal webhooks for liquidity server communication
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     LiquiditySettlementWebhook:
 *       type: object
 *       properties:
 *         event:
 *           type: string
 *           enum: [settlement.completed, settlement.failed]
 *           example: "settlement.completed"
 *         timestamp:
 *           type: string
 *           format: date-time
 *         data:
 *           type: object
 *           properties:
 *             orderId:
 *               type: string
 *               example: "BO_1234567890_ABCDEF"
 *             liquidityServerOrderId:
 *               type: string
 *               example: "LIQ_987654321"
 *             status:
 *               type: string
 *               enum: [completed, failed, processing]
 *               example: "completed"
 *             transactionHash:
 *               type: string
 *               example: "0x1234567890abcdef..."
 *             actualTokenAmount:
 *               type: number
 *               example: 30.25
 *             errorMessage:
 *               type: string
 *               example: "Insufficient liquidity"
 *             processedAt:
 *               type: string
 *               format: date-time
 *     LiquidityUpdateWebhook:
 *       type: object
 *       properties:
 *         event:
 *           type: string
 *           example: "settlement.status_update"
 *         timestamp:
 *           type: string
 *           format: date-time
 *         data:
 *           type: object
 *           properties:
 *             orderId:
 *               type: string
 *             liquidityServerOrderId:
 *               type: string
 *             status:
 *               type: string
 *             statusMessage:
 *               type: string
 *             updatedAt:
 *               type: string
 *               format: date-time
 *     LiquidityErrorWebhook:
 *       type: object
 *       properties:
 *         event:
 *           type: string
 *           example: "settlement.error"
 *         timestamp:
 *           type: string
 *           format: date-time
 *         data:
 *           type: object
 *           properties:
 *             orderId:
 *               type: string
 *             errorCode:
 *               type: string
 *               example: "INSUFFICIENT_LIQUIDITY"
 *             errorMessage:
 *               type: string
 *               example: "Not enough tokens in liquidity pool"
 *             retryable:
 *               type: boolean
 *               example: true
 *             occurredAt:
 *               type: string
 *               format: date-time
 */

/**
 * @swagger
 * /api/v1/webhooks/liquidity/settlement:
 *   post:
 *     summary: Handle settlement completion from liquidity server
 *     description: Receive notifications when token settlement is completed or failed
 *     tags: [Liquidity Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LiquiditySettlementWebhook'
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
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Settlement webhook processed successfully"
 *                 orderId:
 *                   type: string
 *                 orderStatus:
 *                   type: string
 *       401:
 *         description: Invalid webhook signature
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
router.post('/settlement', liquidityWebhookController.handleSettlementCompletion);

/**
 * @swagger
 * /api/v1/webhooks/liquidity/update:
 *   post:
 *     summary: Handle settlement status updates from liquidity server
 *     description: Receive status updates during settlement processing
 *     tags: [Liquidity Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LiquidityUpdateWebhook'
 *     responses:
 *       200:
 *         description: Update webhook processed successfully
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
 *                   example: "Settlement update processed successfully"
 *                 orderId:
 *                   type: string
 *       401:
 *         description: Invalid webhook signature
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
router.post('/update', liquidityWebhookController.handleSettlementUpdate);

/**
 * @swagger
 * /api/v1/webhooks/liquidity/error:
 *   post:
 *     summary: Handle liquidity server errors
 *     description: Receive error notifications from liquidity server
 *     tags: [Liquidity Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LiquidityErrorWebhook'
 *     responses:
 *       200:
 *         description: Error webhook processed successfully
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
 *                   example: "Liquidity error processed successfully"
 *                 orderId:
 *                   type: string
 *                 retryable:
 *                   type: boolean
 *       401:
 *         description: Invalid webhook signature
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
router.post('/error', liquidityWebhookController.handleLiquidityError);

/**
 * @swagger
 * /api/v1/webhooks/liquidity/ping:
 *   get:
 *     summary: Health check endpoint for liquidity server
 *     description: Simple ping endpoint to verify webhook connectivity
 *     tags: [Liquidity Webhooks]
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
 *                   example: "Liquidity webhook service is healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 service:
 *                   type: string
 *                   example: "business-onramp-webhook-service"
 */
router.get('/ping', (req, res) => {
  res.json({
    success: true,
    message: 'Liquidity webhook service is healthy',
    timestamp: new Date().toISOString(),
    service: 'business-onramp-webhook-service'
  });
});

module.exports = router;