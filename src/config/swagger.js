const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Authentication & Business Management API',
      version: '1.0.0',
      description: 'A comprehensive API for user authentication, business management, and API key generation with JWT tokens and secure credential management',
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
        }
      }
    }
  },
  apis: [
    './src/routes/auth.js',        // Authentication routes
    './src/routes/business.js',    // Business management routes
    './src/controllers/*.js',      // Include controllers if they have swagger docs
    // './src/routes/tokens.js',       // Comment out if file doesn't exist
    './src/routes/tokenValidation.js' // Comment out if file doesn't exist
  ]
};

// Create specs with error handling
let specs;
try {
  specs = swaggerJsdoc(options);
  console.log('✅ Swagger specs generated successfully');
  console.log(`📄 Found ${Object.keys(specs.paths || {}).length} API endpoints`);
} catch (error) {
  console.error('❌ Error generating Swagger specs:', error.message);
  // Create a minimal fallback spec
  specs = {
    openapi: '3.0.0',
    info: {
      title: 'Authentication & Business Management API',
      version: '1.0.0',
      description: 'API documentation generation failed. Check server logs for details.'
    },
    paths: {},
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
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
      `,
      customSiteTitle: "Authentication & Business API Documentation",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'none',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
        validatorUrl: null
      }
    }));

    // API JSON endpoint
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(specs);
    });

    // Health check for swagger
    app.get('/api-docs/health', (req, res) => {
      res.json({
        success: true,
        message: 'Swagger documentation is healthy',
        endpoints: Object.keys(specs.paths || {}),
        totalEndpoints: Object.keys(specs.paths || {}).length
      });
    });

    console.log(`📚 Swagger docs available at: http://localhost:${process.env.PORT || 5002}/api-docs`);
    console.log(`📄 API JSON available at: http://localhost:${process.env.PORT || 5002}/api-docs.json`);
    
  } catch (error) {
    console.error('❌ Error setting up Swagger:', error.message);
    
    // Fallback route if Swagger fails
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
        message: error.message
      });
    });
  }
};

module.exports = {
  swaggerSetup,
  specs
};