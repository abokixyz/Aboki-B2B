// src/config/index.ts
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Interface defining the structure of the application's configuration.
 * This helps with type safety and provides clear expectations for config values.
 */
interface AppConfig {
  port: number;
  nodeEnv: string;

  database: {
    url: string;
  };

  redis: {
    url: string;
  };

  blockchain: {
    ethereum?: {
      rpc?: string;
    };
    polygon?: {
      rpc?: string;
    };
    contractAddress?: string;
  };

  jwt: {
    secret: string;
    expiresIn: string;
  };

  apiKeys: {
    length: number;
  };

  email: {
    service?: string;
    user?: string;
    password?: string;
  };

  cors: {
    origin: string | string[];
  };

  rateLimiting: {
    windowMs: number;
    max: number;
  };
}

/**
 * Environment Variable Validation
 * This crucial section ensures that critical environment variables are present 
 * before your application starts.
 */
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}. Please ensure it's set in your .env file or deployment configuration.`);
  }
}

// Additional validation for PORT
const port = parseInt(process.env.PORT || '3000', 10);
if (isNaN(port)) {
  throw new Error('PORT environment variable must be a valid number.');
}

/**
 * The main configuration object for the application.
 * Values are loaded from environment variables, with sensible defaults where appropriate.
 */
export const config: AppConfig = {
  // Application Basics
  port, // Use the validated port
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL as string, // We've already validated this exists
  },

  // Redis Configuration (for caching, sessions, etc.)
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Blockchain Configuration (e.g., for Web3 interactions)
  blockchain: {
    ethereum: {
      rpc: process.env.ETHEREUM_RPC_URL,
    },
    polygon: {
      rpc: process.env.POLYGON_RPC_URL,
    },
    contractAddress: process.env.CONTRACT_ADDRESS,
  },

  // JWT (JSON Web Token) Configuration for authentication
  jwt: {
    secret: process.env.JWT_SECRET as string, // We've already validated this exists
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // API Key Generation Settings
  apiKeys: {
    length: 32,
  },

  // Email Service Configuration (for future features like verification)
  email: {
    service: process.env.EMAIL_SERVICE,
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
  },

  // CORS (Cross-Origin Resource Sharing) Configuration
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : '*',
  },

  // Rate Limiting Configuration to protect against abuse
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: 100, // Max 100 requests per IP per window
  },
};

// Optional warnings for blockchain configuration
if (!config.blockchain.ethereum?.rpc && !config.blockchain.polygon?.rpc) {
  console.warn('Warning: No blockchain RPC URL configured. Blockchain-related features might not work.');
}

// Log configuration status (useful for debugging)
if (config.nodeEnv === 'development') {
  console.log('🔧 Configuration loaded successfully');
  console.log(`📊 Environment: ${config.nodeEnv}`);
  console.log(`🚀 Port: ${config.port}`);
  console.log(`🔗 Database: ${config.database.url ? 'Connected' : 'Not configured'}`);
  console.log(`🔑 JWT: ${config.jwt.secret ? 'Configured' : 'Missing'}`);
}