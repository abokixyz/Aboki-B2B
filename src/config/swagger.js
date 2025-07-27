const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Complete Authentication, Business Management, Admin System & Onramp API',
      version: '1.0.0',
      description: `
        A comprehensive API for user authentication, business management, admin user verification system, 
        API key generation, token validation, pricing services, offramp operations, and business onramp 
        integration with JWT tokens and secure credential management.

        ## 🚀 NEW: Complete Admin User Management System
        - **User Verification Workflow**: Complete admin approval system for user accounts
        - **API Access Control**: Granular control over user API access permissions
        - **Bulk Operations**: Efficiently manage multiple users with bulk actions
        - **Dashboard Analytics**: Comprehensive statistics and user insights
        - **Audit Trail**: Complete history tracking for compliance and security
        - **Role-based Permissions**: Super admin, admin, and moderator roles with specific capabilities

        ## Features
        - **User Authentication**: JWT-based authentication with email verification
        - **Admin System**: Complete user verification, approval/rejection, and API access management
        - **Business Management**: Business registration, token configuration, API key generation
        - **Token Validation**: Multi-chain token validation and metadata retrieval
        - **Pricing Services**: Real-time crypto-to-fiat pricing
        - **Offramp Services**: Crypto-to-fiat withdrawal services
        - **Business Onramp**: Integrated onramp services for businesses
        - **Liquidity Integration**: Settlement and liquidity management

        ## Admin Verification Flow
        1. **User Registration**: User registers account (pending verification status)
        2. **Admin Notification**: Admin receives email notification about new user
        3. **Admin Review**: Admin reviews user information via dashboard
        4. **Approval/Rejection**: Admin approves or rejects with detailed reasoning
        5. **User Notification**: User receives email notification of decision
        6. **API Access**: API access automatically enabled for approved users only
        7. **Audit Trail**: All actions logged for compliance and security

        ## Authentication Types
        - **User Auth**: JWT Bearer tokens for user operations
        - **Admin Auth**: JWT Bearer tokens for admin operations (shorter expiry, enhanced security)
        - **Business Auth**: API Key + Secret for business operations

        ## Admin Roles & Permissions
        - **Super Admin**: Full system access including admin management and system settings
        - **Admin**: User verification, business management, API operations, analytics
        - **Moderator**: User verification and basic analytics only

        ## Security Features
        - Account lockout after failed attempts
        - Admin action audit trails
        - Role-based permission system
        - IP address logging and optional whitelisting
        - Rate limiting on admin endpoints
        - Session token validation
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
        url: process.env.NODE_ENV === 'production' 
          ? process.env.PRODUCTION_URL || 'https://your-api-domain.com'
          : `http://localhost:${process.env.PORT || 5002}`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
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
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Public API key for business authentication. Format: pk_live_... or pk_test_... for test mode.',
          example: 'pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
        },
        SecretKeyAuth: {
          type: 'apiKey',
          in: 'header', 
          name: 'X-Secret-Key',
          description: 'Secret key for business authentication. Format: ***REMOVED***... or ***REMOVED***... for test mode. Keep this secret and never expose it in client-side code.',
          example: '***REMOVED***xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
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
        description: 'Business onramp integration API for customer order management'
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
    './src/routes/adminUsers.js',              // NEW: Admin user management routes
    './src/routes/business.js',                // Business management routes  
    './src/routes/businessOnrampRoutes.js',    // Business onramp API routes
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
    adminUsers: paths.filter(p => p.includes('/admin/users')).length, // NEW
    admin: paths.filter(p => p.includes('/admin') && !p.includes('/admin/auth') && !p.includes('/admin/users')).length,
    business: paths.filter(p => p.includes('/business') && !p.includes('/business-onramp')).length,
    businessOnramp: paths.filter(p => p.includes('/business-onramp')).length,
    pricing: paths.filter(p => p.includes('/onramp-price') || p.includes('/offramp-price')).length,
    offramp: paths.filter(p => p.includes('/offramp')).length,
    validation: paths.filter(p => p.includes('/validate')).length,
    webhooks: paths.filter(p => p.includes('/webhook')).length,
    tokens: paths.filter(p => p.includes('/tokens')).length
  };
  
  console.log('📊 Endpoint breakdown:', groups);
  console.log(`🆕 Admin user management endpoints: ${groups.adminUsers}`);
  
} catch (error) {
  console.error('❌ Error generating Swagger specs:', error.message);
  console.error('Stack trace:', error.stack);
  
  // Create a minimal fallback spec
  specs = {
    openapi: '3.0.0',
    info: {
      title: 'Complete Authentication, Business Management, Admin System & Onramp API',
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
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        },
        SecretKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Secret-Key'
        }
      }
    }
  };
}

const swaggerSetup = (app) => {
  try {
    // Generate example keys for documentation (not real keys)
    const generateExampleKey = (prefix, length) => {
      const chars = 'abcdef0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return `${prefix}${result}`;
    };

    const exampleApiKey = generateExampleKey('pk_live_', 32);
    const exampleSecretKey = generateExampleKey('***REMOVED***', 64);

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
        .swagger-ui .auth-wrapper .auth-container[data-name*="ApiKeyAuth"] {
          border-left: 4px solid #28a745;
          background: linear-gradient(135deg, #f8fff9 0%, #f0fff4 100%);
        }
        .swagger-ui .auth-wrapper .auth-container[data-name*="SecretKeyAuth"] {
          border-left: 4px solid #dc3545;
          background: linear-gradient(135deg, #fff8f8 0%, #fff0f0 100%);
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
      customSiteTitle: "Complete Business, Admin & Onramp API Documentation",
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
          // Custom tag ordering: Auth, Admin (with new user management), Business, then others
          const order = [
            'Authentication',
            'Admin Authentication', 
            'Admin User Management', // NEW - prioritized
            'Business Management',
            'Business Token Management',
            'Business Onramp',
            'Token Management',
            'Token Validation',
            'Pricing',
            'Offramp',
            'Liquidity Webhooks'
          ];
          return order.indexOf(a) - order.indexOf(b);
        },
        operationsSorter: 'alpha',
        // Pre-fill authorization examples with generated keys
        preauthorizeApiKey: {
          'X-API-Key': exampleApiKey,
          'X-Secret-Key': exampleSecretKey
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
            
            const secretKeyInput = document.querySelector('input[placeholder="X-Secret-Key"]');
            if (secretKeyInput) {
              secretKeyInput.placeholder = '${exampleSecretKey}';
              secretKeyInput.style.fontSize = '13px';
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
        adminUserManagement: paths.filter(p => p.includes('/admin/users')).length, // NEW
        adminManagement: paths.filter(p => p.includes('/admin') && !p.includes('/admin/auth') && !p.includes('/admin/users')).length,
        business: paths.filter(p => p.includes('/business') && !p.includes('/business-onramp')).length,
        businessOnramp: paths.filter(p => p.includes('/business-onramp')).length,
        pricing: paths.filter(p => p.includes('/onramp-price') || p.includes('/offramp-price')).length,
        offramp: paths.filter(p => p.includes('/offramp')).length,
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
          'Admin User Verification System', // available
          'Admin Dashboard and Management', // available
          'User Account Approval/Rejection', // available
          'API Access Control', // available
          'Verification History Tracking', // available
          'Bulk User Operations', // available
          'Business Management', 
          'Business Onramp API',
          'Token Validation',
          'Pricing Services',
          'Offramp Operations',
          'Liquidity Webhooks',
          'API Key Management'
        ],
        authenticationExamples: {
          apiKey: exampleApiKey,
          secretKey: exampleSecretKey,
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
          }
        },
        swagger: {
          version: '3.0.0',
          title: specs.info.title,
          specGeneration: 'successful'
        }
      });
    });

    // Admin-specific documentation endpoint (ENHANCED)
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
        ],
        integrationGuide: {
          gettingStarted: [
            '1. Create admin account via super admin',
            '2. Login to get admin JWT token',
            '3. Use token for all admin operations',
            '4. Review pending user verifications',
            '5. Approve/reject users as needed',
            '6. Monitor system via analytics endpoints'
          ],
          bestPractices: [
            'Use appropriate admin roles for team members',
            'Regularly review admin activity logs',
            'Enable IP whitelisting for sensitive operations',
            'Use bulk operations for efficiency',
            'Monitor user verification metrics',
            'Set up email notifications for admin actions'
          ]
        }
      });
    });

    // NEW: Admin user management specific documentation
    app.get('/api-docs/admin/users', (req, res) => {
      const adminUserPaths = Object.keys(specs.paths || {}).filter(p => p.includes('/admin/users'));
      
      res.json({
        success: true,
        message: 'Admin User Management API Documentation',
        description: 'Complete system for managing user verification, approval, and API access control',
        totalEndpoints: adminUserPaths.length,
        endpoints: adminUserPaths.map(path => ({
          path,
          methods: Object.keys(specs.paths[path] || {}),
          description: getEndpointDescription(path)
        })),
        workflows: {
          userVerification: {
            description: 'Complete user verification workflow',
            steps: [
              'GET /admin/users/pending-verification - Get users awaiting review',
              'GET /admin/users/{userId} - Review user details',
              'POST /admin/users/{userId}/verify - Approve or reject user',
              'GET /admin/users/{userId}/history - View verification history'
            ]
          },
          userManagement: {
            description: 'Ongoing user account management',
            steps: [
              'GET /admin/users - List and filter all users',
              'PUT /admin/users/{userId}/manage - Update account status',
              'PUT /admin/users/{userId}/api-access - Control API access',
              'POST /admin/users/{userId}/reset-password - Reset user password'
            ]
          },
          bulkOperations: {
            description: 'Efficient bulk user management',
            steps: [
              'GET /admin/users - Identify users for bulk action',
              'POST /admin/users/bulk-actions - Execute bulk operation',
              'GET /admin/users/stats - Monitor bulk operation impact'
            ]
          },
          analytics: {
            description: 'User analytics and insights',
            steps: [
              'GET /admin/users/stats - Get comprehensive statistics',
              'GET /admin/users?verificationStatus=pending - Monitor pending users',
              'GET /admin/users/{userId}/history - Review individual user history'
            ]
          }
        },
        permissionRequirements: {
          user_verification: ['GET pending-verification', 'POST verify', 'GET history'],
          user_management: ['GET users', 'PUT manage', 'PUT api-access', 'POST reset-password'],
          analytics_view: ['GET stats'],
          bulk_operations: ['POST bulk-actions']
        },
        responseExamples: {
          userList: 'Paginated list of users with filtering options',
          userDetails: 'Complete user profile with verification history',
          verificationAction: 'Confirmation of approval/rejection with audit trail',
          bulkOperations: 'Progress report with success/failure breakdown',
          statistics: 'Comprehensive analytics and metrics'
        }
      });
    });

    // NEW: Business API key examples endpoint
    app.get('/api-docs/business/auth-examples', (req, res) => {
      res.json({
        success: true,
        message: 'Business API Authentication Examples',
        description: 'Examples and guidance for using business API keys',
        authenticationTypes: {
          apiKeyOnly: {
            description: 'Used for read-only operations like getting supported tokens and quotes',
            endpoints: [
              'GET /business-onramp/supported-tokens',
              'POST /business-onramp/quote'
            ],
            headers: {
              'X-API-Key': exampleApiKey
            },
            example: `curl -X GET \\
  'https://api.yourdomain.com/api/v1/business-onramp/supported-tokens' \\
  -H 'X-API-Key: ${exampleApiKey}'`
          },
          fullAuthentication: {
            description: 'Used for sensitive operations like creating orders and accessing order data',
            endpoints: [
              'POST /business-onramp/create',
              'GET /business-onramp/orders',
              'GET /business-onramp/orders/{orderId}',
              'GET /business-onramp/stats'
            ],
            headers: {
              'X-API-Key': exampleApiKey,
              'X-Secret-Key': exampleSecretKey
            },
            example: `curl -X POST \\
  'https://api.yourdomain.com/api/v1/business-onramp/create' \\
  -H 'X-API-Key: ${exampleApiKey}' \\
  -H 'X-Secret-Key: ${exampleSecretKey}' \\
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
          },
          secretKey: {
            format: 'sk_{environment}_{64_character_string}',
            examples: {
              live: exampleSecretKey,
              test: '***REMOVED***' + generateExampleKey('', 64)
            },
            description: 'Secret key for sensitive operations - keep this secure and never expose in client-side code'
          }
        },
        security: {
          bestPractices: [
            'Never expose secret keys in client-side code',
            'Use environment variables to store keys',
            'Rotate keys regularly',
            'Use test keys for development and testing',
            'Monitor API key usage for suspicious activity',
            'Implement proper error handling for authentication failures'
          ],
          environments: {
            test: {
              description: 'Use test keys for development and testing',
              baseUrl: 'https://api-test.yourdomain.com',
              keyPrefix: 'pk_test_, ***REMOVED***'
            },
            live: {
              description: 'Use live keys for production',
              baseUrl: 'https://api.yourdomain.com',
              keyPrefix: 'pk_live_, ***REMOVED***'
            }
          }
        }
      });
    });

    console.log(`📚 Swagger docs available at: http://localhost:${process.env.PORT || 5002}/api-docs`);
    console.log(`📄 API JSON available at: http://localhost:${process.env.PORT || 5002}/api-docs.json`);
    console.log(`🔍 Swagger health check: http://localhost:${process.env.PORT || 5002}/api-docs/health`);
    console.log(`👨‍💼 Admin docs: http://localhost:${process.env.PORT || 5002}/api-docs/admin`);
    console.log(`🆕 Admin user management docs: http://localhost:${process.env.PORT || 5002}/api-docs/admin/users`);
    console.log(`🔑 Business auth examples: http://localhost:${process.env.PORT || 5002}/api-docs/business/auth-examples`);
    
  } catch (error) {
    console.error('❌ Error setting up Swagger:', error.message);
    
    // Fallback route if Swagger fails
    app.get('/api-docs', (req, res) => {
      res.status(500).json({
        error: 'Swagger documentation failed to load',
        message: error.message,
        suggestion: 'Check server logs for more details',
        fallback: 'Visit /api/v1 for basic endpoint information',
        availableEndpoints: {
          health: '/api/v1/health',
          auth: '/api/v1/auth/*',
          adminAuth: '/api/v1/admin/auth/*',
          adminUsers: '/api/v1/admin/users/*', // NEW
          business: '/api/v1/business/*',
          businessOnramp: '/api/v1/business-onramp/*',
          pricing: '/api/v1/onramp-price, /api/v1/offramp-price',
          offramp: '/api/v1/offramp/*',
          validation: '/api/v1/validate/*',
          webhooks: '/api/v1/webhooks/*'
        }
      });
    });

    app.get('/api-docs.json', (req, res) => {
      res.status(500).json({
        error: 'API documentation JSON failed to generate',
        message: error.message,
        fallback: specs
      });
    });

    app.get('/api-docs/health', (req, res) => {
      res.status(500).json({
        success: false,
        message: 'Swagger documentation failed to initialize',
        error: error.message
      });
    });

    app.get('/api-docs/admin', (req, res) => {
      res.status(500).json({
        success: false,
        message: 'Admin documentation failed to load',
        error: error.message
      });
    });

    app.get('/api-docs/admin/users', (req, res) => {
      res.status(500).json({
        success: false,
        message: 'Admin user management documentation failed to load',
        error: error.message
      });
    });

    app.get('/api-docs/business/auth-examples', (req, res) => {
      res.status(500).json({
        success: false,
        message: 'Business authentication examples failed to load',
        error: error.message
      });
    });
  }
};

// Helper function to get endpoint descriptions
function getEndpointDescription(path) {
  const descriptions = {
    '/api/v1/admin/users': 'List all users with advanced filtering and pagination',
    '/api/v1/admin/users/{userId}': 'Get detailed user information including verification history',
    '/api/v1/admin/users/pending-verification': 'Get users awaiting admin verification',
    '/api/v1/admin/users/{userId}/verify': 'Approve or reject user verification for API access',
    '/api/v1/admin/users/{userId}/manage': 'Manage user account status and settings',
    '/api/v1/admin/users/{userId}/api-access': 'Toggle user API access permissions',
    '/api/v1/admin/users/{userId}/reset-password': 'Force reset user password (admin only)',
    '/api/v1/admin/users/stats': 'Get comprehensive user statistics for dashboard',
    '/api/v1/admin/users/bulk-actions': 'Perform bulk operations on multiple users',
    '/api/v1/admin/users/{userId}/history': 'Get complete user action history and audit trail'
  };
  
  return descriptions[path] || 'Admin user management endpoint';
}

module.exports = {
  swaggerSetup,
  specs
};