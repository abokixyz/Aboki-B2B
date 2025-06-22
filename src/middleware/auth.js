const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, ApiKey, Company } = require('../models');
const config = require('../config');

// Simple JWT Authentication Middleware (for basic auth routes)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || config.jwt.secret, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};

// Advanced JWT Authentication Middleware (for complex features)
const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Get user data
    const user = await User.findById(decoded.userId || decoded.id)
      .populate('companyId', 'id name email')
      .select('-password');

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or inactive user'
      });
    }

    req.user = {
      id: user._id,
      email: user.email,
      role: user.role,
      companyId: user.companyId ? user.companyId._id : undefined
    };

    if (user.companyId) {
      req.company = {
        id: user.companyId._id,
        name: user.companyId.name,
        email: user.companyId.email
      };
    }

    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

// API Key Authentication Middleware (for both user and company API keys)
const authenticateApiKey = async (req, res, next) => {
  try {
    const publicKey = req.headers['x-api-key'];
    const secretKey = req.headers['x-api-secret'];

    if (!publicKey || !secretKey) {
      return res.status(401).json({
        success: false,
        error: 'API key and secret are required. Use X-API-Key and X-API-Secret headers.'
      });
    }

    // Check if it's a user API key
    const userApiKey = await ApiKey.findOne({ publicKey })
      .populate({
        path: 'userId',
        populate: {
          path: 'companyId',
          select: 'id name email'
        }
      });

    if (userApiKey) {
      // Verify user API key
      if (!userApiKey.isActive) {
        return res.status(401).json({
          success: false,
          error: 'API key is inactive'
        });
      }

      const isValidSecret = await bcrypt.compare(secretKey, userApiKey.secretKey);
      if (!isValidSecret) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API secret'
        });
      }

      // Update last used timestamp
      userApiKey.lastUsedAt = new Date();
      await userApiKey.save();

      req.user = {
        id: userApiKey.userId._id,
        email: userApiKey.userId.email,
        role: userApiKey.userId.role,
        companyId: userApiKey.userId.companyId ? userApiKey.userId.companyId._id : undefined
      };

      req.apiKey = {
        id: userApiKey._id,
        publicKey: userApiKey.publicKey,
        permissions: userApiKey.permissions.split(',')
      };

      if (userApiKey.userId.companyId) {
        req.company = {
          id: userApiKey.userId.companyId._id,
          name: userApiKey.userId.companyId.name,
          email: userApiKey.userId.companyId.email
        };
      }

      return next();
    }

    // Check if it's a company API key (your existing system)
    const company = await Company.findOne({ apiKey: publicKey });

    if (company) {
      // For company API keys, you might want to implement your own validation logic
      // For now, we'll assume the secretKey should match some company secret
      // You can modify this based on your existing company API key system
      
      if (!company.isActive) {
        return res.status(401).json({
          success: false,
          error: 'Company is inactive'
        });
      }

      req.company = {
        id: company._id,
        name: company.name,
        email: company.email
      };

      return next();
    }

    // No valid API key found
    return res.status(401).json({
      success: false,
      error: 'Invalid API key'
    });

  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

// Role-based authorization middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Permission-based authorization for API keys
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key authentication required'
      });
    }

    const userPermissions = req.apiKey.permissions;
    if (!userPermissions.includes(permission) && !userPermissions.includes('ADMIN')) {
      return res.status(403).json({
        success: false,
        error: `Insufficient permissions. Required: ${permission}`
      });
    }

    next();
  };
};

// Export both the simple and complex middleware
module.exports = {
  authenticateToken,      // Simple middleware for basic auth routes
  authenticateJWT,        // Advanced middleware for complex features
  authenticateApiKey,
  requireRole,
  requirePermission
};

// For backward compatibility, also export the simple one as default
module.exports.default = authenticateToken;