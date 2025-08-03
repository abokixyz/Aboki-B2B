const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Complete Authentication, Business Management, Admin System & Onramp/Offramp API',
      version: '1.0.0',
      description: `
        A comprehensive API for user authentication, business management, admin user verification system, 
        API key generation, token validation, pricing services, offramp operations, business onramp 
        integration, and business offramp services with JWT tokens and secure credential management.

        ## 🚀 NEW: Complete Admin User Management System
        - **User Verification Workflow**: Complete admin approval system for user accounts
        - **API Access Control**: Granular control over user API access permissions
        - **Bulk Operations**: Efficiently manage multiple users with bulk actions
        - **Dashboard Analytics**: Comprehensive statistics and user insights
        - **Audit Trail**: Complete history tracking for compliance and security
        - **Role-based Permissions**: Super admin, admin, and moderator roles with specific capabilities

        ## 🆕 NEW: Business Off-ramp API
        - **Token-to-Fiat Conversion**: Convert crypto tokens to Nigerian Naira (NGN)
        - **Automatic Wallet Generation**: Generate unique deposit wallets for each order
        - **Bank Account Verification**: Real-time Nigerian bank account verification via Lenco
        - **Multi-Network Support**: Base, Solana, and Ethereum networks
        - **Automatic Payouts**: Direct NGN transfers to customer bank accounts
        - **Real-time Webhooks**: Complete order status notifications

        ## Features
        - **User Authentication**: JWT-based authentication with email verification
        - **Admin System**: Complete user verification, approval/rejection, and API access management
        - **Business Management**: Business registration, token configuration, API key generation
        - **Token Validation**: Multi-chain token validation and metadata retrieval
        - **Pricing Services**: Real-time crypto-to-fiat pricing
        - **Offramp Services**: Crypto-to-fiat withdrawal services
        - **Business Onramp**: Integrated onramp services for businesses (NGN → Crypto)
        - **Business Offramp**: Integrated offramp services for businesses (Crypto → NGN)
        - **Liquidity Integration**: Settlement and liquidity management

        ## Admin Verification Flow
        1. **User Registration**: User registers account (pending verification status)
        2. **Admin Notification**: Admin receives email notification about new user
        3. **Admin Review**: Admin reviews user information via dashboard
        4. **Approval/Rejection**: Admin approves or rejects with detailed reasoning
        5. **User Notification**: User receives email notification of decision
        6. **API Access**: API access automatically enabled for approved users only
        7. **Audit Trail**: All actions logged for compliance and security

        ## Business Off-ramp Flow (NEW)
        1. **Quote Generation**: Business gets token-to-NGN conversion quote
        2. **Bank Verification**: Verify customer Nigerian bank account via Lenco
        3. **Order Creation**: Create order with automatic wallet generation
        4. **Token Deposit**: Customer sends exact tokens to generated wallet
        5. **Processing**: System detects deposit and initiates NGN payout
        6. **Completion**: Customer receives NGN in verified bank account

        ## Authentication Types
        - **User Auth**: JWT Bearer tokens for user operations
        - **Admin Auth**: JWT Bearer tokens for admin operations (shorter expiry, enhanced security)
        - **Business Auth**: API Key only for business operations (secret key managed securely server-side)
        - **Business Onramp Auth**: API Key for onramp integration
        - **Business Offramp Auth**: API Key for offramp integration

        ## Admin Roles & Permissions
        - **Super Admin**: Full system access including admin management and system settings
        - **Admin**: User verification, business management, API operations, analytics
        - **Moderator**: User verification and basic analytics only

        ## Business API Key Types
        - **Public Key (pk_live_...)**: For API identification and all business operations
        - **Note**: Secret keys are managed securely server-side and not exposed in API documentation

        ## Security Features
        - Account lockout after failed attempts
        - Admin action audit trails
        - Role-based permission system
        - IP address logging and optional whitelisting
        - Rate limiting on admin endpoints
        - Session token validation
        - Encrypted wallet generation
        - Bank account verification
        - Webhook signature verification
      `,
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        // Production server - make sure PRODUCTION_URL is set correctly
        url: process.env.NODE_ENV === 'production' 
          ? process.env.PRODUCTION_URL || 'https://aboki-b2b-eobk.onrender.com'  // Replace with your actual domain
          : `http://localhost:${process.env.PORT || 5002}`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      },
      // Add multiple server options for flexibility
      {
        url: 'https://aboki-b2b-eobk.onrender.com',  // Replace with your actual production URL
        description: 'Production API server'
      },
      {
        url: 'https://api-staging.yourdomain.com',  // Replace with your staging URL if you have one
        description: 'Staging API server'
      },
      {
        url: 'http://localhost:5002',
        description: 'Local development server'
      },
      // Dynamic server based on current host (recommended for live server)
      {
        url: '{protocol}://{host}',
        description: 'Current server',
        variables: {
          protocol: {
            enum: ['http', 'https'],
            default: 'https'
          },
          host: {
            default: 'api.yourdomain.com'  // Replace with your domain
          }
        }
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token in the format: Bearer <token>. Used for user authentication.',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzU5Nzg4YWI...'
        },
        adminAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter admin JWT token in the format: Bearer <token>. Used for admin operations. Shorter expiry (8h) for enhanced security.',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZG1pbklkIjoiNjc1OTc4OGFi...'
        },
        BusinessApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Public API key for business authentication. Format: pk_live_... or pk_test_... for test mode.',
          example: 'pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
        },
        // Legacy naming for backward compatibility
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Public API key for business authentication. Format: pk_live_... or pk_test_... for test mode.',
          example: 'pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            error: {
              type: 'string',
              example: 'Detailed error information'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Operation successful'
            },
            data: {
              type: 'object',
              description: 'Response data'
            }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            currentPage: {
              type: 'integer',
              example: 1
            },
            totalPages: {
              type: 'integer',
              example: 10
            },
            totalItems: {
              type: 'integer',
              example: 100
            },
            hasNext: {
              type: 'boolean',
              example: true
            },
            hasPrev: {
              type: 'boolean',
              example: false
            },
            limit: {
              type: 'integer',
              example: 20
            }
          }
        },
        AdminUser: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Admin ID'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Admin email'
            },
            fullName: {
              type: 'string',
              description: 'Admin full name'
            },
            role: {
              type: 'string',
              enum: ['super_admin', 'admin', 'moderator'],
              description: 'Admin role'
            },
            permissions: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Admin permissions'
            },
            isActive: {
              type: 'boolean',
              description: 'Admin account status'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            lastLogin: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        UserAccount: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'User ID'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email'
            },
            fullName: {
              type: 'string',
              description: 'User full name'
            },
            phone: {
              type: 'string',
              description: 'User phone number'
            },
            isVerified: {
              type: 'boolean',
              description: 'Email verification status'
            },
            verificationStatus: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected', 'suspended'],
              description: 'Admin verification status'
            },
            isApiEnabled: {
              type: 'boolean',
              description: 'API access status'
            },
            accountStatus: {
              type: 'string',
              enum: ['active', 'suspended', 'deactivated'],
              description: 'Account status'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            lastLogin: {
              type: 'string',
              format: 'date-time'
            },
            businessCount: {
              type: 'integer',
              description: 'Number of businesses owned by user'
            }
          }
        },
        // NEW: Business Off-ramp Schemas
        OfframpOrder: {
          type: 'object',
          properties: {
            orderId: {
              type: 'string',
              example: 'OFF_1703234567_ABC123DEF',
              description: 'Unique order identifier'
            },
            businessOrderReference: {
              type: 'string',
              example: 'OFFRAMP-USDC-A1B2C3D4',
              description: 'Business-friendly order reference'
            },
            tokenAmount: {
              type: 'number',
              example: 100,
              description: 'Amount of tokens to convert'
            },
            targetToken: {
              type: 'string',
              example: 'USDC',
              description: 'Token symbol'
            },
            targetNetwork: {
              type: 'string',
              example: 'base',
              description: 'Blockchain network'
            },
            grossNgnAmount: {
              type: 'number',
              example: 165000,
              description: 'Total NGN value before fees'
            },
            feeAmount: {
              type: 'number',
              example: 2475,
              description: 'Business fee amount'
            },
            netNgnAmount: {
              type: 'number',
              example: 162525,
              description: 'Final amount customer receives'
            },
            status: {
              type: 'string',
              enum: ['pending_deposit', 'deposit_received', 'processing', 'pending_payout', 'completed', 'failed', 'expired', 'cancelled'],
              description: 'Current order status'
            },
            customerEmail: {
              type: 'string',
              format: 'email',
              description: 'Customer email'
            },
            customerName: {
              type: 'string',
              description: 'Customer name'
            },
            bankDetails: {
              type: 'object',
              properties: {
                accountNumber: {
                  type: 'string',
                  example: '1234567890'
                },
                accountName: {
                  type: 'string',
                  example: 'JOHN DOE'
                },
                bankName: {
                  type: 'string',
                  example: 'Guaranty Trust Bank'
                },
                bankCode: {
                  type: 'string',
                  example: '058152'
                }
              }
            },
            depositInstructions: {
              type: 'object',
              properties: {
                walletAddress: {
                  type: 'string',
                  example: '0x742d35Cc6669C87532DD123F5b8c6B3e8e7c5B2A'
                },
                network: {
                  type: 'string',
                  example: 'base'
                },
                exactAmount: {
                  type: 'number',
                  example: 100
                },
                expiresAt: {
                  type: 'string',
                  format: 'date-time'
                }
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            expiresAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        NigerianBank: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'Guaranty Trust Bank'
            },
            code: {
              type: 'string',
              example: '058152'
            },
            slug: {
              type: 'string',
              example: 'gtbank'
            },
            longcode: {
              type: 'string',
              example: '058152001'
            },
            gateway: {
              type: 'string',
              example: 'gtb'
            },
            pay_with_bank: {
              type: 'boolean',
              example: true
            },
            supports_transfer: {
              type: 'boolean',
              example: true
            },
            active: {
              type: 'boolean',
              example: true
            },
            country: {
              type: 'string',
              example: 'Nigeria'
            },
            currency: {
              type: 'string',
              example: 'NGN'
            },
            type: {
              type: 'string',
              example: 'nuban'
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication information is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Authentication required'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Insufficient permissions'
              }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Resource not found'
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Validation failed',
                error: 'Invalid input data'
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Internal server error'
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication endpoints'
      },
      {
        name: 'Admin Authentication',
        description: 'Admin authentication and account management'
      },
      {
        name: 'Admin User Management',
        description: 'Complete admin system for managing user verification, approval, and API access control'
      },
      {
        name: 'Business Management',
        description: 'Business registration, management, and API key generation'
      },
      {
        name: 'Business Token Management',
        description: 'Manage supported destination tokens, fees, and payment configuration'
      },
      {
        name: 'Business Onramp',
        description: 'Business onramp integration API for customer order management (NGN → Crypto)'
      },
      {
        name: 'Business Off-ramp',
        description: 'Business offramp integration API for customer token-to-fiat conversion (Crypto → NGN)'
      },
      {
        name: 'Bank Verification',
        description: 'Nigerian bank account verification and management endpoints for offramp operations. Includes bank listing and real-time account verification via Lenco API.'
      },
      {
        name: 'Token Validation',
        description: 'Multi-chain token validation and metadata retrieval'
      },
      {
        name: 'Pricing',
        description: 'Real-time crypto-to-fiat pricing services'
      },
      {
        name: 'Offramp',
        description: 'Crypto-to-fiat withdrawal services'
      },
      {
        name: 'Liquidity Webhooks',
        description: 'Internal liquidity server integration webhooks'
      },
      {
        name: 'Token Management',
        description: 'User token selection and management'
      }
    ]
  },
  apis: [
    './src/routes/auth.js',                    // Authentication routes
    './src/routes/adminAuth.js',               // Admin authentication routes
    './src/routes/adminUsers.js',              // Admin user management routes
    './src/routes/business.js',                // Business management routes  
    './src/routes/businessOnrampRoutes.js',    // Business onramp API routes
    './src/routes/businessOfframpRoutes.js',   // NEW: Business offramp API routes
    './src/routes/liquidityWebhookRoutes.js',  // Liquidity webhook routes
    './src/routes/pricing.js',                 // Pricing routes
    './src/routes/tokenValidation.js',         // Token validation routes
    './src/routes/tokens.js',                  // Token management routes
    './src/controllers/*.js',                  // Include controllers if they have swagger docs
    './src/middleware/*.js'                    // Include middleware docs if any
  ]
};

// Create specs with error handling
let specs;
try {
  specs = swaggerJsdoc(options);
  console.log('✅ Swagger specs generated successfully');
  console.log(`📄 Found ${Object.keys(specs.paths || {}).length} API endpoints`);
  
  // Log the endpoint groups found
  const paths = Object.keys(specs.paths || {});
  const groups = {
    auth: paths.filter(p => p.includes('/auth') && !p.includes('/admin')).length,
    adminAuth: paths.filter(p => p.includes('/admin/auth')).length,
    adminUsers: paths.filter(p => p.includes('/admin/users')).length,
    admin: paths.filter(p => p.includes('/admin') && !p.includes('/admin/auth') && !p.includes('/admin/users')).length,
    business: paths.filter(p => p.includes('/business') && !p.includes('/business-onramp') && !p.includes('/business-offramp')).length,
    businessOnramp: paths.filter(p => p.includes('/business-onramp')).length,
    businessOfframp: paths.filter(p => p.includes('/business-offramp')).length, // NEW
    pricing: paths.filter(p => p.includes('/onramp-price') || p.includes('/offramp-price')).length,
    offramp: paths.filter(p => p.includes('/offramp') && !p.includes('/business-offramp')).length,
    validation: paths.filter(p => p.includes('/validate')).length,
    webhooks: paths.filter(p => p.includes('/webhook')).length,
    tokens: paths.filter(p => p.includes('/tokens')).length
  };
  
  console.log('📊 Endpoint breakdown:', groups);
  console.log(`🆕 Admin user management endpoints: ${groups.adminUsers}`);
  console.log(`🚀 Business offramp endpoints: ${groups.businessOfframp}`); // NEW
  
} catch (error) {
  console.error('❌ Error generating Swagger specs:', error.message);
  console.error('Stack trace:', error.stack);
  
  // Create a minimal fallback spec
  specs = {
    openapi: '3.0.0',
    info: {
      title: 'Complete Authentication, Business Management, Admin System & Onramp/Offramp API',
      version: '1.0.0',
      description: 'API documentation generation failed. Check server logs for details.'
    },
    paths: {
      '/health': {
        get: {
          summary: 'Health check endpoint',
          responses: {
            200: {
              description: 'API is healthy'
            }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        adminAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        BusinessApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      }
    }
  };
}

const swaggerSetup = (app) => {
  try {
    // Generate example API key for documentation (not real key)
    const generateExampleKey = (prefix, length) => {
      const chars = 'abcdef0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return `${prefix}${result}`;
    };

    const exampleApiKey = generateExampleKey('pk_live_', 32);

    // Swagger page with custom styling
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
      explorer: true,
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info { margin: 50px 0 }
        .swagger-ui .scheme-container { 
          background: #f7f7f7; 
          padding: 20px; 
          border-radius: 5px;
          margin: 20px 0;
        }
        .swagger-ui .auth-wrapper { margin: 20px 0; }
        .swagger-ui .model-box { 
          background: #fafafa; 
          border-radius: 4px; 
        }
        .swagger-ui .opblock.opblock-post {
          border-color: #49cc90;
          background: rgba(73, 204, 144, 0.1);
        }
        .swagger-ui .opblock.opblock-get {
          border-color: #61affe;
          background: rgba(97, 175, 254, 0.1);
        }
        .swagger-ui .opblock.opblock-put {
          border-color: #fca130;
          background: rgba(252, 161, 48, 0.1);
        }
        .swagger-ui .opblock.opblock-delete {
          border-color: #f93e3e;
          background: rgba(249, 62, 62, 0.1);
        }
        .swagger-ui .auth-container {
          border: 2px solid #e8e8e8;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
        }
        .swagger-ui .info .title {
          color: #3b4151;
          font-size: 2.5em;
        }
        .swagger-ui .info .description {
          color: #3b4151;
          margin: 20px 0;
        }
        .swagger-ui .opblock-tag {
          border-bottom: 1px solid #e8e8e8;
          margin-bottom: 10px;
        }
        .swagger-ui .opblock-summary-description {
          color: #3b4151;
        }
        .swagger-ui .btn.authorize {
          background-color: #4990e2;
          border-color: #4990e2;
        }
        .swagger-ui .btn.authorize:hover {
          background-color: #357abd;
          border-color: #357abd;
        }
        /* Enhanced auth section styling */
        .swagger-ui .auth-wrapper .auth-container {
          background: #f8f9fa;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          padding: 20px;
          margin: 15px 0;
        }
        .swagger-ui .auth-wrapper .auth-container h4 {
          color: #495057;
          font-weight: 600;
          margin-bottom: 10px;
        }
        .swagger-ui .auth-wrapper .auth-container .scopes {
          background: #ffffff;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          padding: 10px;
          margin-top: 10px;
        }
        .swagger-ui .auth-wrapper input[type="text"], 
        .swagger-ui .auth-wrapper input[type="password"] {
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 13px;
          background: #ffffff;
          border: 2px solid #dee2e6;
          border-radius: 4px;
          padding: 8px 12px;
          transition: border-color 0.2s ease;
        }
        .swagger-ui .auth-wrapper input[type="text"]:focus, 
        .swagger-ui .auth-wrapper input[type="password"]:focus {
          border-color: #4990e2;
          box-shadow: 0 0 0 2px rgba(73, 144, 226, 0.1);
          outline: none;
        }
        /* API Key specific styling */
        .swagger-ui .auth-wrapper .auth-container[data-name*="BusinessApiKey"] {
          border-left: 4px solid #28a745;
          background: linear-gradient(135deg, #f8fff9 0%, #f0fff4 100%);
        }
        /* JWT Auth styling */
        .swagger-ui .auth-wrapper .auth-container[data-name*="bearerAuth"], 
        .swagger-ui .auth-wrapper .auth-container[data-name*="adminAuth"] {
          border-left: 4px solid #6f42c1;
          background: linear-gradient(135deg, #faf9ff 0%, #f4f0ff 100%);
        }
        /* Admin section styling */
        .swagger-ui .opblock-tag[data-tag*="Admin"] {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .swagger-ui .opblock-tag[data-tag*="Admin"] .opblock-tag-name {
          color: white;
        }
        /* Admin User Management special styling */
        .swagger-ui .opblock-tag[data-tag="Admin User Management"] {
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
          color: white;
          font-weight: bold;
        }
        .swagger-ui .opblock-tag[data-tag="Admin User Management"]:before {
          content: "🆕 ";
          font-size: 1.2em;
        }
        /* Business section styling */
        .swagger-ui .opblock-tag[data-tag*="Business"] {
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          color: white;
        }
        .swagger-ui .opblock-tag[data-tag*="Business"] .opblock-tag-name {
          color: white;
        }
        .swagger-ui .opblock-tag[data-tag="Bank Verification"] {
          background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
          color: white;
          font-weight: bold;
        }
        .swagger-ui .opblock-tag[data-tag="Bank Verification"] .opblock-tag-name {
          color: white;
        }
        .swagger-ui .opblock-tag[data-tag="Bank Verification"]:before {
          content: "🏦 ";
          font-size: 1.2em;
        }
       /* Business Off-ramp special styling (NEW) */
        .swagger-ui .opblock-tag[data-tag="Business Off-ramp"] {
          background: linear-gradient(135deg, #fd79a8 0%, #fdcb6e 100%);
          color: white;
          font-weight: bold;
        }
        .swagger-ui .opblock-tag[data-tag="Business Off-ramp"]:before {
          content: "🚀 ";
          font-size: 1.2em;
        }
        /* New feature highlight */
        .swagger-ui .info .description h2:contains("NEW") {
          color: #ff6b6b;
          font-weight: bold;
        }
        /* Example values styling */
        .swagger-ui .auth-wrapper .auth-container .wrapper p {
          background: #e9ecef;
          padding: 8px 12px;
          border-radius: 4px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 12px;
          margin: 5px 0;
          color: #495057;
          border-left: 3px solid #6c757d;
        }
      `,
      customSiteTitle: "Complete Business, Admin & Onramp/Offramp API Documentation",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'none',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
        validatorUrl: null,
        tagsSorter: (a, b) => {
          // Custom tag ordering: Auth, Admin, Business (with new offramp), then others
          const order = [
            'Authentication',
            'Admin Authentication', 
            'Admin User Management',
            'Business Management',
            'Business Token Management',
            'Business Onramp',
            'Business Off-ramp',
            'Bank Verification',
            'Token Management',
            'Token Validation',
            'Pricing',
            'Offramp',
            'Liquidity Webhooks'
          ];
          return order.indexOf(a) - order.indexOf(b);
        },
        operationsSorter: 'alpha',
        // Pre-fill authorization examples with generated API key only
        preauthorizeApiKey: {
          'X-API-Key': exampleApiKey
        }
      },
      customJs: [
        // Add custom JavaScript for better auth UX
        `
        window.addEventListener('DOMContentLoaded', function() {
          // Add placeholder text to auth inputs
          setTimeout(function() {
            const apiKeyInput = document.querySelector('input[placeholder="X-API-Key"]');
            if (apiKeyInput) {
              apiKeyInput.placeholder = '${exampleApiKey}';
              apiKeyInput.style.fontSize = '13px';
            }
          }, 1000);
        });
        `
      ]
    }));

    // API JSON endpoint
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(specs);
    });

    // Health check for swagger
    app.get('/api-docs/health', (req, res) => {
      const paths = Object.keys(specs.paths || {});
      const endpointGroups = {
        authentication: paths.filter(p => p.includes('/auth') && !p.includes('/admin')).length,
        adminAuthentication: paths.filter(p => p.includes('/admin/auth')).length,
        adminUserManagement: paths.filter(p => p.includes('/admin/users')).length,
        adminManagement: paths.filter(p => p.includes('/admin') && !p.includes('/admin/auth') && !p.includes('/admin/users')).length,
        business: paths.filter(p => p.includes('/business') && !p.includes('/business-onramp') && !p.includes('/business-offramp')).length,
        businessOnramp: paths.filter(p => p.includes('/business-onramp')).length,
        businessOfframp: paths.filter(p => p.includes('/business-offramp')).length,
        pricing: paths.filter(p => p.includes('/onramp-price') || p.includes('/offramp-price')).length,
        offramp: paths.filter(p => p.includes('/offramp') && !p.includes('/business-offramp')).length,
        validation: paths.filter(p => p.includes('/validate')).length,
        webhooks: paths.filter(p => p.includes('/webhook')).length,
        tokens: paths.filter(p => p.includes('/tokens')).length
      };
      
      res.json({
        success: true,
        message: 'Swagger documentation is healthy',
        totalEndpoints: paths.length,
        endpointGroups,
        features: [
          'User Authentication',
          'Admin User Verification System',
          'Admin Dashboard and Management',
          'User Account Approval/Rejection',
          'API Access Control',
          'Verification History Tracking',
          'Bulk User Operations',
          'Business Management', 
          'Business Onramp API',
          'Business Offramp API (NEW)',
          'Token Validation',
          'Pricing Services',
          'Offramp Operations',
          'Liquidity Webhooks',
          'API Key Management'
        ],
        authenticationExamples: {
          apiKey: exampleApiKey,
          jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzU5Nzg4YWI...',
          adminToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZG1pbklkIjoiNjc1OTc4OGFi...'
        },
        newFeatures: {
          adminUserManagement: {
            description: 'Complete admin system for user verification and management',
            endpoints: endpointGroups.adminUserManagement,
            status: 'FULLY IMPLEMENTED',
            capabilities: [
              'User verification workflow (approve/reject)',
              'API access management and control',
              'Bulk user operations for efficiency',
              'Advanced user filtering and search',
              'Dashboard analytics and statistics',
              'Verification history and audit trail',
              'Account status management',
              'Force password reset functionality',
              'Email notifications for account changes',
              'Role-based admin permissions'
            ]
          },
          businessOfframp: {
            description: 'Complete business offramp API for token-to-fiat conversion',
            endpoints: endpointGroups.businessOfframp,
            status: 'FULLY IMPLEMENTED',
            capabilities: [
              'Token-to-NGN conversion quotes',
              'Automatic wallet generation for deposits',
              'Nigerian bank account verification via Lenco',
              'Real-time order tracking and management',
              'Automatic NGN payout to customer bank accounts',
              'Comprehensive webhook notifications',
              'Multi-network support (Base, Solana, Ethereum)',
              'Business analytics and statistics',
              'Order cancellation and management',
              'Health monitoring and service status'
            ]
          }
        },
        swagger: {
          version: '3.0.0',
          title: specs.info.title,
          specGeneration: 'successful'
        }
      });
    });

    // Admin-specific documentation endpoint
    app.get('/api-docs/admin', (req, res) => {
      const adminAuthPaths = Object.keys(specs.paths || {}).filter(p => p.includes('/admin/auth'));
      const adminUserPaths = Object.keys(specs.paths || {}).filter(p => p.includes('/admin/users'));
      const allAdminPaths = [...adminAuthPaths, ...adminUserPaths];
      
      const adminEndpoints = allAdminPaths.map(path => ({
        path,
        methods: Object.keys(specs.paths[path] || {}),
        category: path.includes('/admin/auth') ? 'authentication' : 'user_management'
      }));

      res.json({
        success: true,
        message: 'Complete Admin API documentation',
        totalAdminEndpoints: allAdminPaths.length,
        endpointBreakdown: {
          authentication: adminAuthPaths.length,
          userManagement: adminUserPaths.length
        },
        endpoints: adminEndpoints,
        adminSystem: {
          status: 'FULLY IMPLEMENTED AND ACTIVE',
          authentication: {
            description: 'JWT-based admin authentication with enhanced security',
            roles: ['super_admin', 'admin', 'moderator'],
            tokenExpiry: '8 hours (shorter than user tokens for security)',
            security: [
              'Account lockout after 5 failed attempts',
              'IP address logging and optional whitelisting',
              'Session token validation',
              'Role-based permission system'
            ]
          },
          userManagement: {
            description: 'Complete user verification and management system',
            capabilities: [
              'User account verification workflow',
              'API access control and management',
              'Bulk operations for multiple users',
              'Advanced filtering and search',
              'Dashboard analytics and statistics',
              'Verification history tracking',
              'Account status management',
              'Force password reset',
              'Email notifications'
            ],
            verificationFlow: [
              '1. User registers account (pending status)',
              '2. Admin receives notification email',
              '3. Admin reviews user via dashboard',
              '4. Admin approves/rejects with reason',
              '5. User receives notification email',
              '6. API access enabled for approved users',
              '7. Complete audit trail maintained'
            ],
            bulkOperations: [
              'Bulk approve users',
              'Bulk reject users', 
              'Bulk suspend accounts',
              'Bulk activate accounts',
              'Bulk enable API access',
              'Bulk disable API access'
            ],
            analytics: [
              'User verification statistics',
              'Account status breakdown',
              'API access metrics',
              'Growth trends and registration analytics',
              'Email verification rates',
              'Admin activity monitoring'
            ]
          },
          permissions: {
            super_admin: [
              'All user management functions',
              'Admin account management', 
              'System settings access',
              'Full analytics access',
              'Bulk operations',
              'Admin creation and management'
            ],
            admin: [
              'User verification and management',
              'Business verification and management',
              'API key management',
              'Analytics viewing',
              'Bulk operations',
              'User password reset'
            ],
            moderator: [
              'User verification only',
              'Basic analytics viewing',
              'Limited user management'
            ]
          }
        },
        security: [
          'Enhanced JWT token security',
          'Account lockout protection',
          'Admin action audit trails',
          'Role-based permissions',
          'IP address logging',
          'Rate limiting on admin endpoints',
          'Session management and invalidation'
        ]
      });
    });

    // Business Off-ramp specific documentation
    app.get('/api-docs/business/offramp', (req, res) => {
      const offrampPaths = Object.keys(specs.paths || {}).filter(p => p.includes('/business-offramp'));
      
      res.json({
        success: true,
        message: 'Business Off-ramp API Documentation',
        description: 'Complete token-to-fiat conversion API for businesses to integrate offramp services',
        totalEndpoints: offrampPaths.length,
        endpoints: offrampPaths.map(path => ({
          path,
          methods: Object.keys(specs.paths[path] || {}),
          description: getOfframpEndpointDescription(path)
        })),
        workflows: {
          basicOfframpFlow: {
            description: 'Standard token-to-NGN conversion process',
            steps: [
              'POST /business-offramp/quote - Get conversion quote',
              'POST /business-offramp/verify-account - Verify customer bank account',
              'POST /business-offramp/create - Create offramp order',
              'Customer sends tokens to generated wallet address',
              'GET /business-offramp/orders/{orderId} - Monitor order status',
              'Customer receives NGN in bank account'
            ]
          },
          orderManagement: {
            description: 'Managing offramp orders',
            steps: [
              'GET /business-offramp/orders - List all orders with filtering',
              'GET /business-offramp/orders/{orderId} - Get specific order details',
              'POST /business-offramp/orders/{orderId}/cancel - Cancel pending orders',
              'GET /business-offramp/stats - View business analytics'
            ]
          }
        },
        authentication: {
          required: ['X-API-Key'],
          format: {
            apiKey: 'pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
          },
          note: 'Secret keys are managed securely server-side and not exposed in documentation',
          rateLimits: {
            quote: '100 requests/minute',
            create: '10 requests/minute',
            verifyAccount: '20 requests/minute',
            general: '60 requests/minute'
          }
        },
        integrationExamples: {
          basicQuote: `curl -X POST \\
  'https://aboki-b2b-eobk.onrender.com/api/v1/business-offramp/quote' \\
  -H 'X-API-Key: ${exampleApiKey}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "tokenAmount": 100,
    "targetToken": "USDC",
    "targetNetwork": "base"
  }'`,
          createOrder: `curl -X POST \\
  'https://aboki-b2b-eobk.onrender.com/api/v1/business-offramp/create' \\
  -H 'X-API-Key: ${exampleApiKey}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "customerEmail": "customer@example.com",
    "customerName": "John Doe",
    "tokenAmount": 100,
    "targetToken": "USDC",
    "targetNetwork": "base",
    "recipientAccountNumber": "1234567890",
    "recipientBankCode": "058152",
    "webhookUrl": "https://yourapp.com/webhooks/offramp"
  }'`
        }
      });
    });

    // Business API key examples endpoint (UPDATED - NO SECRET KEYS)
    app.get('/api-docs/business/auth-examples', (req, res) => {
      res.json({
        success: true,
        message: 'Business API Authentication Examples',
        description: 'Examples and guidance for using business API keys across all business services',
        authenticationTypes: {
          apiKeyAuth: {
            description: 'Used for all business operations - secret keys are managed securely server-side',
            endpoints: [
              'GET /business-onramp/supported-tokens',
              'POST /business-onramp/quote',
              'POST /business-onramp/create',
              'GET /business-onramp/orders',
              'GET /business-offramp/supported-tokens',
              'POST /business-offramp/quote',
              'POST /business-offramp/create',
              'GET /business-offramp/orders',
              'GET /business-offramp/banks',
              'POST /business-offramp/verify-account'
            ],
            headers: {
              'X-API-Key': exampleApiKey
            },
            example: `curl -X POST \\
  'https://aboki-b2b-eobk.onrender.com/api/v1/business-offramp/create' \\
  -H 'X-API-Key: ${exampleApiKey}' \\
  -H 'Content-Type: application/json' \\
  -d '{ "customerEmail": "customer@example.com", ... }'`
          }
        },
        keyFormats: {
          apiKey: {
            format: 'pk_{environment}_{32_character_string}',
            examples: {
              live: exampleApiKey,
              test: 'pk_test_' + generateExampleKey('', 32)
            },
            description: 'Public key that identifies your business account'
          }
        },
        businessServices: {
          onramp: {
            description: 'NGN to crypto conversion (customers buy crypto)',
            baseUrl: '/api/v1/business-onramp',
            authentication: 'API Key authentication'
          },
          offramp: {
            description: 'Crypto to NGN conversion (customers sell crypto)',
            baseUrl: '/api/v1/business-offramp',
            authentication: 'API Key authentication'
          }
        },
        security: {
          note: 'Secret keys are securely managed server-side and never exposed in API documentation',
          bestPractices: [
            'Never expose API keys in client-side code',
            'Use environment variables to store keys',
            'Rotate keys regularly',
            'Use test keys for development and testing',
            'Monitor API key usage for suspicious activity',
            'Implement proper error handling for authentication failures',
            'Use webhook signature verification for security',
            'Implement rate limiting on your endpoints'
          ],
          environments: {
            test: {
              description: 'Use test keys for development and testing',
              baseUrl: 'https://api-test.yourdomain.com',
              keyPrefix: 'pk_test_'
            },
            live: {
              description: 'Use live keys for production',
              baseUrl: 'https://aboki-b2b-eobk.onrender.com',
              keyPrefix: 'pk_live_'
            }
          }
        }
      });
    });

    console.log(`📚 Swagger docs available at: http://localhost:${process.env.PORT || 5002}/api-docs`);
    console.log(`📄 API JSON available at: http://localhost:${process.env.PORT || 5002}/api-docs.json`);
    console.log(`🔍 Swagger health check: http://localhost:${process.env.PORT || 5002}/api-docs/health`);
    console.log(`👨‍💼 Admin docs: http://localhost:${process.env.PORT || 5002}/api-docs/admin`);
    console.log(`🚀 Business offramp docs: http://localhost:${process.env.PORT || 5002}/api-docs/business/offramp`);
    console.log(`🔑 Business auth examples: http://localhost:${process.env.PORT || 5002}/api-docs/business/auth-examples`);
    
  } catch (error) {
    console.error('❌ Error setting up Swagger:', error.message);
    
    // Fallback routes if Swagger fails
    app.get('/api-docs', (req, res) => {
      res.status(500).json({
        error: 'Swagger documentation failed to load',
        message: error.message,
        suggestion: 'Check server logs for more details',
        fallback: 'Visit /api/v1 for basic endpoint information'
      });
    });

    app.get('/api-docs.json', (req, res) => {
      res.status(500).json({
        error: 'API documentation JSON failed to generate',
        message: error.message,
        fallback: specs
      });
    });
  }
};

// Helper function to get offramp endpoint descriptions
function getOfframpEndpointDescription(path) {
  const descriptions = {
    '/api/v1/business-offramp/quote': 'Get token-to-NGN conversion quote with current rates',
    '/api/v1/business-offramp/create': 'Create offramp order with automatic wallet generation',
    '/api/v1/business-offramp/orders/{orderId}': 'Get specific offramp order details and status',
    '/api/v1/business-offramp/orders': 'List all offramp orders with filtering and pagination',
    '/api/v1/business-offramp/orders/{orderId}/cancel': 'Cancel pending offramp order',
    '/api/v1/business-offramp/stats': 'Get business offramp analytics and statistics',
    '/api/v1/business-offramp/supported-tokens': 'Get list of supported tokens for offramp',
    '/api/v1/business-offramp/banks': 'Get list of supported Nigerian banks for verification',
    '/api/v1/business-offramp/verify-account': 'Verify Nigerian bank account via Lenco API',
    '/api/v1/business-offramp/config': 'Get business offramp service configuration',
    '/api/v1/business-offramp/health': 'Check offramp service health and dependencies'
  };
  
  return descriptions[path] || 'Business offramp endpoint';
}

module.exports = {
  swaggerSetup,
  specs
};