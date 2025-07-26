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

        ## Features
        - **User Authentication**: JWT-based authentication with email verification
        - **Admin System**: User verification, approval/rejection, and API access management
        - **Business Management**: Business registration, token configuration, API key generation
        - **Token Validation**: Multi-chain token validation and metadata retrieval
        - **Pricing Services**: Real-time crypto-to-fiat pricing
        - **Offramp Services**: Crypto-to-fiat withdrawal services
        - **Business Onramp**: Integrated onramp services for businesses
        - **Liquidity Integration**: Settlement and liquidity management

        ## Admin Verification Flow
        1. User registers account (pending verification)
        2. Admin receives notification and reviews user
        3. Admin approves/rejects with reason
        4. User receives notification email
        5. API access enabled for approved users only

        ## Authentication Types
        - **User Auth**: JWT Bearer tokens for user operations
        - **Admin Auth**: JWT Bearer tokens for admin operations
        - **Business Auth**: API Key + Secret for business operations
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
          description: 'Enter JWT token in the format: Bearer <token>. Used for user authentication.'
        },
        adminAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter admin JWT token in the format: Bearer <token>. Used for admin operations.'
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Public API key for business authentication. Format: pk_live_...'
        },
        SecretKeyAuth: {
          type: 'apiKey',
          in: 'header', 
          name: 'X-Secret-Key',
          description: 'Secret key for business authentication. Format: ***REMOVED***...'
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
        name: 'Admin - User Verification',
        description: 'Admin endpoints for managing user verification and API access'
      },
      {
        name: 'Admin - Management',
        description: 'Admin system management endpoints'
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
    './src/routes/admin.js',                   // Admin management routes
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
    admin: paths.filter(p => p.includes('/admin') && !p.includes('/admin/auth')).length,
    business: paths.filter(p => p.includes('/business') && !p.includes('/business-onramp')).length,
    businessOnramp: paths.filter(p => p.includes('/business-onramp')).length,
    pricing: paths.filter(p => p.includes('/onramp-price') || p.includes('/offramp-price')).length,
    offramp: paths.filter(p => p.includes('/offramp')).length,
    validation: paths.filter(p => p.includes('/validate')).length,
    webhooks: paths.filter(p => p.includes('/webhook')).length,
    tokens: paths.filter(p => p.includes('/tokens')).length
  };
  
  console.log('📊 Endpoint breakdown:', groups);
  
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
        /* Admin section styling */
        .swagger-ui .opblock-tag[data-tag*="Admin"] {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .swagger-ui .opblock-tag[data-tag*="Admin"] .opblock-tag-name {
          color: white;
        }
        /* Business section styling */
        .swagger-ui .opblock-tag[data-tag*="Business"] {
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          color: white;
        }
        .swagger-ui .opblock-tag[data-tag*="Business"] .opblock-tag-name {
          color: white;
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
          // Custom tag ordering: Auth, Admin, Business, then others
          const order = [
            'Authentication',
            'Admin Authentication', 
            'Admin - User Verification',
            'Admin - Management',
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
        operationsSorter: 'alpha'
      },
      customJs: [
        // Add custom JavaScript if needed for admin section highlighting
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
        adminManagement: paths.filter(p => p.includes('/admin') && !p.includes('/admin/auth')).length,
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
          'Admin User Verification System', // NEW
          'Admin Dashboard and Management', // NEW
          'User Account Approval/Rejection', // NEW
          'API Access Control', // NEW
          'Verification History Tracking', // NEW
          'Business Management', 
          'Business Onramp API',
          'Token Validation',
          'Pricing Services',
          'Offramp Operations',
          'Liquidity Webhooks',
          'API Key Management'
        ],
        newFeatures: {
          adminSystem: {
            description: 'Complete admin system for user verification',
            endpoints: endpointGroups.adminAuthentication + endpointGroups.adminManagement,
            capabilities: [
              'User verification and approval',
              'API access management',
              'Admin dashboard with statistics',
              'Bulk user operations',
              'Verification history tracking',
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

    // Admin-specific documentation endpoint
    app.get('/api-docs/admin', (req, res) => {
      const adminPaths = Object.keys(specs.paths || {}).filter(p => p.includes('/admin'));
      const adminEndpoints = adminPaths.map(path => ({
        path,
        methods: Object.keys(specs.paths[path] || {})
      }));

      res.json({
        success: true,
        message: 'Admin API documentation',
        totalAdminEndpoints: adminPaths.length,
        endpoints: adminEndpoints,
        adminSystem: {
          authentication: {
            description: 'JWT-based admin authentication',
            roles: ['super_admin', 'admin', 'moderator'],
            tokenExpiry: '8 hours (shorter than user tokens)'
          },
          userVerification: {
            description: 'Admin verification of user accounts',
            flow: [
              '1. User registers (pending status)',
              '2. Admin receives notification',
              '3. Admin reviews and approves/rejects',
              '4. User receives notification',
              '5. API access enabled for approved users'
            ],
            actions: ['approve', 'reject', 'suspend', 'enable_api', 'disable_api']
          },
          permissions: {
            super_admin: 'Full system access including admin management',
            admin: 'User verification, business management, API operations',
            moderator: 'User verification and basic analytics only'
          }
        },
        security: [
          'Account lockout after failed attempts',
          'Admin action audit trails',
          'Role-based permissions',
          'IP address logging'
        ]
      });
    });

    console.log(`📚 Swagger docs available at: http://localhost:${process.env.PORT || 5002}/api-docs`);
    console.log(`📄 API JSON available at: http://localhost:${process.env.PORT || 5002}/api-docs.json`);
    console.log(`🔍 Swagger health check: http://localhost:${process.env.PORT || 5002}/api-docs/health`);
    console.log(`👨‍💼 Admin docs: http://localhost:${process.env.PORT || 5002}/api-docs/admin`);
    
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
          adminAuth: '/api/v1/admin/auth/*', // NEW
          admin: '/api/v1/admin/*', // NEW
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
  }
};

module.exports = {
  swaggerSetup,
  specs
};