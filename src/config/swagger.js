const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Complete Authentication, Business Management & Onramp API',
      version: '1.0.0',
      description: 'A comprehensive API for user authentication, business management, API key generation, token validation, pricing services, offramp operations, business onramp integration, and admin user management with JWT tokens and secure credential management',
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
          description: 'Enter JWT token in the format: Bearer <token>'
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Public API key for business authentication'
        },
        SecretKeyAuth: {
          type: 'apiKey',
          in: 'header', 
          name: 'X-Secret-Key',
          description: 'Secret key for business authentication'
        }
      }
    }
  },
  apis: [
    './src/routes/auth.js',                    // Authentication routes
    './src/routes/business.js',                // Business management routes  
    './src/routes/businessOnrampRoutes.js',    // Business onramp API routes
    './src/routes/liquidityWebhookRoutes.js',  // Liquidity webhook routes
    './src/routes/pricing.js',                 // Pricing routes
    './src/routes/tokenValidation.js',         // Token validation routes
    './src/routes/tokens.js',                  // Token management routes
    './src/routes/admin.js',                   // *** ADD THIS LINE - Admin routes ***
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
  
  // Log the endpoint groups found (UPDATED to include admin)
  const paths = Object.keys(specs.paths || {});
  const groups = {
    auth: paths.filter(p => p.includes('/auth')).length,
    business: paths.filter(p => p.includes('/business')).length,
    businessOnramp: paths.filter(p => p.includes('/business-onramp')).length,
    pricing: paths.filter(p => p.includes('/onramp-price') || p.includes('/offramp-price')).length,
    offramp: paths.filter(p => p.includes('/offramp')).length,
    validation: paths.filter(p => p.includes('/validate')).length,
    webhooks: paths.filter(p => p.includes('/webhook')).length,
    tokens: paths.filter(p => p.includes('/tokens')).length,
    admin: paths.filter(p => p.includes('/admin')).length  // *** ADD THIS LINE ***
  };
  
  console.log('📊 Endpoint breakdown:', groups);
  
  // Check specifically for admin routes
  if (groups.admin > 0) {
    console.log('👑 Admin routes detected:', groups.admin, 'endpoints');
    const adminPaths = paths.filter(p => p.includes('/admin'));
    adminPaths.forEach(path => console.log(`   - ${path}`));
  } else {
    console.log('⚠️  No admin routes found - check if admin.js file exists and has @swagger comments');
  }
  
} catch (error) {
  console.error('❌ Error generating Swagger specs:', error.message);
  console.error('Stack trace:', error.stack);
  
  // Create a minimal fallback spec
  specs = {
    openapi: '3.0.0',
    info: {
      title: 'Complete Authentication, Business Management & Onramp API',
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
        /* Admin section styling */
        .swagger-ui .opblock-tag-section.is-open .opblock-tag:contains("Admin") {
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
      `,
      customSiteTitle: "Complete Business & Onramp API Documentation",
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
        tagsSorter: 'alpha',
        operationsSorter: 'alpha'
      },
      customJs: [
        // Add custom JavaScript if needed
      ]
    }));

    // API JSON endpoint
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(specs);
    });

    // Health check for swagger (UPDATED to include admin info)
    app.get('/api-docs/health', (req, res) => {
      const paths = Object.keys(specs.paths || {});
      const endpointGroups = {
        authentication: paths.filter(p => p.includes('/auth')).length,
        business: paths.filter(p => p.includes('/business')).length,
        businessOnramp: paths.filter(p => p.includes('/business-onramp')).length,
        pricing: paths.filter(p => p.includes('/onramp-price') || p.includes('/offramp-price')).length,
        offramp: paths.filter(p => p.includes('/offramp')).length,
        validation: paths.filter(p => p.includes('/validate')).length,
        webhooks: paths.filter(p => p.includes('/webhook')).length,
        tokens: paths.filter(p => p.includes('/tokens')).length,
        admin: paths.filter(p => p.includes('/admin')).length  // *** ADD THIS LINE ***
      };
      
      res.json({
        success: true,
        message: 'Swagger documentation is healthy',
        totalEndpoints: paths.length,
        endpointGroups,
        features: [
          'User Authentication',
          'Business Management', 
          'Business Onramp API',
          'Token Validation',
          'Pricing Services',
          'Offramp Operations',
          'Liquidity Webhooks',
          'API Key Management',
          'Admin User Management'  // *** ADD THIS LINE ***
        ],
        swagger: {
          version: '3.0.0',
          title: specs.info.title,
          specGeneration: 'successful'
        },
        adminEndpoints: paths.filter(p => p.includes('/admin'))  // *** ADD THIS LINE ***
      });
    });

    console.log(`📚 Swagger docs available at: http://localhost:${process.env.PORT || 5002}/api-docs`);
    console.log(`📄 API JSON available at: http://localhost:${process.env.PORT || 5002}/api-docs.json`);
    console.log(`🔍 Swagger health check: http://localhost:${process.env.PORT || 5002}/api-docs/health`);
    
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
          business: '/api/v1/business/*',
          businessOnramp: '/api/v1/business-onramp/*',
          pricing: '/api/v1/onramp-price, /api/v1/offramp-price',
          offramp: '/api/v1/offramp/*',
          validation: '/api/v1/validate/*',
          webhooks: '/api/v1/webhooks/*',
          admin: '/api/v1/admin/*'  // *** ADD THIS LINE ***
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
  }
};

module.exports = {
  swaggerSetup,
  specs
};