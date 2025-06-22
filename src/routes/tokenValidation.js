const express = require('express');
const router = express.Router();
const tokenVerificationController = require('../controllers/tokenVerificationController');

/**
 * @swagger
 * components:
 *   schemas:
 *     TokenDetails:
 *       type: object
 *       properties:
 *         address:
 *           type: string
 *           description: Token contract address
 *         name:
 *           type: string
 *           description: Token name
 *         symbol:
 *           type: string
 *           description: Token symbol
 *         decimals:
 *           type: number
 *           description: Token decimals
 *         totalSupply:
 *           type: string
 *           description: Total supply (for ERC-20)
 *         supply:
 *           type: string
 *           description: Current supply (for SPL)
 *         network:
 *           type: string
 *           description: Network name
 *         type:
 *           type: string
 *           enum: [erc20, base-erc20, spl-token, native]
 *           description: Token type
 *         isVerified:
 *           type: boolean
 *           description: Whether token is in verified token lists
 *         tokenListInfo:
 *           type: object
 *           description: Information from token lists
 *         validationTimestamp:
 *           type: string
 *           format: date-time
 *           description: When the token was validated
 *         validatedBy:
 *           type: object
 *           properties:
 *             businessId:
 *               type: string
 *             businessName:
 *               type: string
 *     TokenValidationResult:
 *       type: object
 *       properties:
 *         address:
 *           type: string
 *           description: Token address
 *         isValid:
 *           type: boolean
 *           description: Whether the token is valid
 *         tokenDetails:
 *           $ref: '#/components/schemas/TokenDetails'
 *         error:
 *           type: string
 *           description: Error message if validation failed
 *     ValidationResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             address:
 *               type: string
 *             network:
 *               type: string
 *             isValid:
 *               type: boolean
 *             tokenDetails:
 *               $ref: '#/components/schemas/TokenDetails'
 *             validation:
 *               type: object
 *               properties:
 *                 method:
 *                   type: string
 *                   enum: [ERC-20, SPL]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 rpcEndpoint:
 *                   type: string
 *     BatchValidationResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             network:
 *               type: string
 *             summary:
 *               type: object
 *               properties:
 *                 total:
 *                   type: number
 *                 valid:
 *                   type: number
 *                 invalid:
 *                   type: number
 *                 verified:
 *                   type: number
 *             results:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TokenValidationResult'
 *             validation:
 *               type: object
 *               properties:
 *                 method:
 *                   type: string
 *                   enum: [ERC-20, SPL]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 validatedBy:
 *                   type: object
 *                   properties:
 *                     businessId:
 *                       type: string
 *                     businessName:
 *                       type: string
 *     ValidationErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *         details:
 *           type: string
 *         address:
 *           type: string
 *         network:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *         example:
 *           type: object
 *         supportedNetworks:
 *           type: array
 *           items:
 *             type: string
 *   securitySchemes:
 *     ApiKeyAuth:
 *       type: apiKey
 *       in: header
 *       name: X-API-Key
 *       description: Business API public key
 *     ApiSecretAuth:
 *       type: apiKey
 *       in: header
 *       name: X-API-Secret
 *       description: Business API secret key
 */

/**
 * @swagger
 * tags:
 *   name: Token Verification
 *   description: Token validation and metadata retrieval using business API keys
 */

/**
 * @swagger
 * /api/v1/validate/token:
 *   post:
 *     summary: Verify a single token and get detailed information
 *     description: Validates a token address on the specified blockchain network and returns comprehensive token information including metadata, verification status, and token list information.
 *     tags: [Token Verification]
 *     security:
 *       - ApiKeyAuth: []
 *       - ApiSecretAuth: []
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
 *                 description: Token contract address or mint address
 *                 example: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
 *               network:
 *                 type: string
 *                 enum: [base, ethereum, solana, base-sepolia, solana-devnet]
 *                 description: Blockchain network
 *                 example: "base"
 *           examples:
 *             baseToken:
 *               summary: Base network USDC
 *               value:
 *                 address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
 *                 network: "base"
 *             ethereumToken:
 *               summary: Ethereum USDC
 *               value:
 *                 address: "0xA0b86a33E6441e14d792fE21909f5c578F8F4A52"
 *                 network: "ethereum"
 *             solanaToken:
 *               summary: Solana USDC
 *               value:
 *                 address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
 *                 network: "solana"
 *     responses:
 *       200:
 *         description: Token validation successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationResponse'
 *             examples:
 *               successfulValidation:
 *                 summary: Successful token validation
 *                 value:
 *                   success: true
 *                   data:
 *                     address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
 *                     network: "base"
 *                     isValid: true
 *                     tokenDetails:
 *                       address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
 *                       name: "USD Coin"
 *                       symbol: "USDC"
 *                       decimals: 6
 *                       totalSupply: "1000000000000000"
 *                       network: "base"
 *                       type: "base-erc20"
 *                       isVerified: true
 *                       tokenListInfo:
 *                         listName: "Base Token List"
 *                         listTokenInfo:
 *                           name: "USD Coin"
 *                           symbol: "USDC"
 *                       validationTimestamp: "2025-06-22T08:45:00Z"
 *                       validatedBy:
 *                         businessId: "biz_123456789"
 *                         businessName: "Your Business Name"
 *                     validation:
 *                       method: "ERC-20"
 *                       timestamp: "2025-06-22T08:45:00Z"
 *                       rpcEndpoint: "https://mainnet.base.org"
 *               solanaValidation:
 *                 summary: Solana token validation
 *                 value:
 *                   success: true
 *                   data:
 *                     address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
 *                     network: "solana"
 *                     isValid: true
 *                     tokenDetails:
 *                       address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
 *                       name: "USD Coin"
 *                       symbol: "USDC"
 *                       decimals: 6
 *                       supply: "1000000000000"
 *                       network: "solana"
 *                       type: "spl-token"
 *                       isVerified: true
 *                       validationTimestamp: "2025-06-22T08:45:00Z"
 *                       validatedBy:
 *                         businessId: "biz_123456789"
 *                         businessName: "Your Business Name"
 *                     validation:
 *                       method: "SPL"
 *                       timestamp: "2025-06-22T08:45:00Z"
 *                       rpcEndpoint: "https://api.mainnet-beta.solana.com"
 *       400:
 *         description: Bad request - invalid input or token validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *             examples:
 *               missingFields:
 *                 summary: Missing required fields
 *                 value:
 *                   success: false
 *                   error: "Token address and network are required"
 *                   example:
 *                     address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
 *                     network: "base"
 *               unsupportedNetwork:
 *                 summary: Unsupported network
 *                 value:
 *                   success: false
 *                   error: "Unsupported network"
 *                   supportedNetworks: ["base", "ethereum", "solana", "base-sepolia", "solana-devnet"]
 *               invalidToken:
 *                 summary: Invalid token address
 *                 value:
 *                   success: false
 *                   error: "Invalid token address format"
 *                   address: "0x123"
 *                   network: "base"
 *                   timestamp: "2025-06-22T08:45:00Z"
 *       401:
 *         description: Unauthorized - invalid API keys
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *             examples:
 *               missingKeys:
 *                 summary: Missing API keys
 *                 value:
 *                   success: false
 *                   error: "API key and secret are required. Use X-API-Key and X-API-Secret headers."
 *                   documentation: "https://docs.yourapi.com/authentication"
 *               invalidKey:
 *                 summary: Invalid API key
 *                 value:
 *                   success: false
 *                   error: "Invalid API key"
 *               invalidSecret:
 *                 summary: Invalid API secret
 *                 value:
 *                   success: false
 *                   error: "Invalid API secret"
 *       403:
 *         description: Forbidden - insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *             examples:
 *               insufficientPermissions:
 *                 summary: Insufficient permissions
 *                 value:
 *                   success: false
 *                   error: "Insufficient permissions. Required: validate"
 *               inactiveBusiness:
 *                 summary: Inactive business account
 *                 value:
 *                   success: false
 *                   error: "Business account is not active"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *             example:
 *               success: false
 *               error: "Internal server error during token verification"
 *               details: "Connection timeout to RPC endpoint"
 */
router.post('/token', 
  tokenVerificationController.authenticateBusinessApiKey, 
  tokenVerificationController.verifyToken
);

/**
 * @swagger
 * /api/v1/validate/batch:
 *   post:
 *     summary: Verify multiple tokens in a single request (max 20)
 *     description: Validates multiple token addresses on the specified blockchain network in a single request. Maximum of 20 tokens per batch.
 *     tags: [Token Verification]
 *     security:
 *       - ApiKeyAuth: []
 *       - ApiSecretAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokens
 *               - network
 *             properties:
 *               tokens:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 1
 *                 maxItems: 20
 *                 description: Array of token addresses (max 20)
 *                 example: ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "0x4200000000000000000000000000000000000006"]
 *               network:
 *                 type: string
 *                 enum: [base, ethereum, solana, base-sepolia, solana-devnet]
 *                 description: Blockchain network
 *                 example: "base"
 *           examples:
 *             baseTokens:
 *               summary: Multiple Base network tokens
 *               value:
 *                 tokens: ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "0x4200000000000000000000000000000000000006"]
 *                 network: "base"
 *             solanaTokens:
 *               summary: Multiple Solana tokens
 *               value:
 *                 tokens: ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"]
 *                 network: "solana"
 *     responses:
 *       200:
 *         description: Batch validation successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BatchValidationResponse'
 *             example:
 *               success: true
 *               data:
 *                 network: "base"
 *                 summary:
 *                   total: 2
 *                   valid: 2
 *                   invalid: 0
 *                   verified: 2
 *                 results:
 *                   - address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
 *                     isValid: true
 *                     tokenDetails:
 *                       name: "USD Coin"
 *                       symbol: "USDC"
 *                       decimals: 6
 *                       isVerified: true
 *                   - address: "0x4200000000000000000000000000000000000006"
 *                     isValid: true
 *                     tokenDetails:
 *                       name: "Wrapped Ethereum"
 *                       symbol: "WETH"
 *                       decimals: 18
 *                       isVerified: true
 *                 validation:
 *                   method: "ERC-20"
 *                   timestamp: "2025-06-22T08:45:00Z"
 *                   validatedBy:
 *                     businessId: "biz_123456789"
 *                     businessName: "Your Business Name"
 *       400:
 *         description: Bad request - invalid input or too many tokens
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *             examples:
 *               emptyTokensArray:
 *                 summary: Empty tokens array
 *                 value:
 *                   success: false
 *                   error: "Tokens array is required and cannot be empty"
 *                   example:
 *                     tokens: ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "0xfde4c96c8593536e31f229ea441755bf6bb6b9fb"]
 *                     network: "base"
 *               tooManyTokens:
 *                 summary: Too many tokens in batch
 *                 value:
 *                   success: false
 *                   error: "Maximum 20 tokens can be verified in a single batch request"
 *       401:
 *         description: Unauthorized - invalid API keys
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 */
router.post('/batch', 
  tokenVerificationController.authenticateBusinessApiKey, 
  tokenVerificationController.verifyTokensBatch
);

/**
 * @swagger
 * /api/v1/validate/networks:
 *   get:
 *     summary: Get supported networks and validation capabilities
 *     description: Returns information about supported blockchain networks, their capabilities, and business account details.
 *     tags: [Token Verification]
 *     security:
 *       - ApiKeyAuth: []
 *       - ApiSecretAuth: []
 *     responses:
 *       200:
 *         description: Supported networks and capabilities
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
 *                     networks:
 *                       type: object
 *                       properties:
 *                         mainnet:
 *                           type: object
 *                           properties:
 *                             base:
 *                               type: object
 *                               properties:
 *                                 name:
 *                                   type: string
 *                                   example: "Base"
 *                                 chainId:
 *                                   type: number
 *                                   example: 8453
 *                                 rpcEndpoint:
 *                                   type: string
 *                                   example: "https://mainnet.base.org"
 *                                 tokenStandard:
 *                                   type: string
 *                                   example: "ERC-20"
 *                                 features:
 *                                   type: array
 *                                   items:
 *                                     type: string
 *                                   example: ["token_validation", "metadata_fetching", "token_lists"]
 *                             ethereum:
 *                               type: object
 *                             solana:
 *                               type: object
 *                         testnet:
 *                           type: object
 *                           properties:
 *                             base-sepolia:
 *                               type: object
 *                             solana-devnet:
 *                               type: object
 *                     capabilities:
 *                       type: object
 *                       properties:
 *                         maxBatchSize:
 *                           type: number
 *                           example: 20
 *                         supportedStandards:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["ERC-20", "SPL"]
 *                         features:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["Format validation", "Blockchain verification", "Metadata retrieval", "Token list checking", "Batch processing"]
 *                     rateLimit:
 *                       type: object
 *                       properties:
 *                         requestsPerMinute:
 *                           type: number
 *                           example: 60
 *                         batchLimit:
 *                           type: number
 *                           example: 20
 *                     business:
 *                       type: object
 *                       properties:
 *                         businessId:
 *                           type: string
 *                         businessName:
 *                           type: string
 *                         permissions:
 *                           type: array
 *                           items:
 *                             type: string
 *       401:
 *         description: Unauthorized - invalid API keys
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 */
router.get('/networks', 
  tokenVerificationController.authenticateBusinessApiKey, 
  tokenVerificationController.getSupportedNetworks
);

/**
 * @swagger
 * /api/v1/validate/examples:
 *   get:
 *     summary: Get validation examples for different networks
 *     description: Returns example token addresses for testing validation across different supported networks, along with usage examples.
 *     tags: [Token Verification]
 *     security:
 *       - ApiKeyAuth: []
 *       - ApiSecretAuth: []
 *     responses:
 *       200:
 *         description: Validation examples and usage guide
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
 *                     examples:
 *                       type: object
 *                       properties:
 *                         base:
 *                           type: object
 *                           properties:
 *                             network:
 *                               type: string
 *                               example: "base"
 *                             validTokens:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   address:
 *                                     type: string
 *                                   name:
 *                                     type: string
 *                                   symbol:
 *                                     type: string
 *                                   description:
 *                                     type: string
 *                               example:
 *                                 - address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
 *                                   name: "USD Coin"
 *                                   symbol: "USDC"
 *                                   description: "USDC on Base network"
 *                             invalidAddresses:
 *                               type: array
 *                               items:
 *                                 type: string
 *                               example: ["0x123", "invalid-address", "0x0000000000000000000000000000000000000000"]
 *                         ethereum:
 *                           type: object
 *                         solana:
 *                           type: object
 *                     usage:
 *                       type: object
 *                       properties:
 *                         singleValidation:
 *                           type: object
 *                           properties:
 *                             endpoint:
 *                               type: string
 *                               example: "POST /api/v1/validate/token"
 *                             headers:
 *                               type: object
 *                               properties:
 *                                 X-API-Key:
 *                                   type: string
 *                                 X-API-Secret:
 *                                   type: string
 *                                 Content-Type:
 *                                   type: string
 *                                   example: "application/json"
 *                             body:
 *                               type: object
 *                               properties:
 *                                 address:
 *                                   type: string
 *                                   example: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
 *                                 network:
 *                                   type: string
 *                                   example: "base"
 *                         batchValidation:
 *                           type: object
 *                           properties:
 *                             endpoint:
 *                               type: string
 *                               example: "POST /api/v1/validate/batch"
 *                             body:
 *                               type: object
 *                               properties:
 *                                 tokens:
 *                                   type: array
 *                                   items:
 *                                     type: string
 *                                   example: ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "0x4200000000000000000000000000000000000006"]
 *                                 network:
 *                                   type: string
 *                                   example: "base"
 *                     business:
 *                       type: object
 *                       properties:
 *                         businessId:
 *                           type: string
 *                         businessName:
 *                           type: string
 *       401:
 *         description: Unauthorized - invalid API keys
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 */
router.get('/examples', 
  tokenVerificationController.authenticateBusinessApiKey, 
  tokenVerificationController.getValidationExamples
);

module.exports = router;