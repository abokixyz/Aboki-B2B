const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, ApiKey, Business } = require('../models'); // Updated to use Business instead of Company
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET || config.jwt.secret);
    
    // Get user data with business information
    const user = await User.findById(decoded.userId || decoded.id)
      .select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid user'
      });
    }

    // Check if user account is locked
    if (user.isAccountLocked && user.isAccountLocked()) {
      return res.status(423).json({
        success: false,
        error: 'Account is temporarily locked due to too many failed login attempts',
        lockUntil: user.lockUntil
      });
    }

    // Get user's business if exists
    const business = await Business.findOne({ 
      ownerId: user._id, 
      status: { $ne: 'deleted' } 
    }).select('businessId businessName status');

    req.user = {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role || 'user',
      isAdmin: user.isAdmin || false,
      isAccountActivated: user.isAccountActivated || false,
      accountStatus: user.accountStatus || 'pending_activation',
      businessId: business ? business._id : undefined
    };

    if (business) {
      req.business = {
        id: business._id,
        businessId: business.businessId,
        name: business.businessName,
        status: business.status
      };
    }

    next();
  } catch (error) {
    console.error('JWT Authentication error:', error);
    return res.status(403).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

// API Key Authentication Middleware (for business API keys)
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

    // Find the API key
    const apiKey = await ApiKey.findOne({ publicKey })
      .populate('userId', '-password')
      .populate('businessId');

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    if (!apiKey.isActive) {
      return res.status(401).json({
        success: false,
        error: 'API key is inactive'
      });
    }

    // Verify secret key
    const isValidSecret = await bcrypt.compare(secretKey, apiKey.secretKey);
    if (!isValidSecret) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API secret'
      });
    }

    // Check if user account is activated
    if (!apiKey.userId.isAccountActivated || apiKey.userId.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'User account is not activated. API access denied.',
        accountStatus: apiKey.userId.accountStatus
      });
    }

    // Check if user account is locked
    if (apiKey.userId.isAccountLocked && apiKey.userId.isAccountLocked()) {
      return res.status(423).json({
        success: false,
        error: 'User account is temporarily locked',
        lockUntil: apiKey.userId.lockUntil
      });
    }

    // Update last used timestamp
    apiKey.lastUsedAt = new Date();
    await apiKey.save();

    req.user = {
      id: apiKey.userId._id,
      email: apiKey.userId.email,
      fullName: apiKey.userId.fullName,
      role: apiKey.userId.role || 'user',
      isAccountActivated: apiKey.userId.isAccountActivated,
      accountStatus: apiKey.userId.accountStatus
    };

    req.apiKey = {
      id: apiKey._id,
      publicKey: apiKey.publicKey,
      permissions: apiKey.permissions || ['read', 'write']
    };

    if (apiKey.businessId) {
      req.business = {
        id: apiKey.businessId._id,
        businessId: apiKey.businessId.businessId,
        name: apiKey.businessId.businessName,
        status: apiKey.businessId.status
      };
    }

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

// Account activation check middleware
const requireActivatedAccount = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if account is activated
    if (!req.user.isAccountActivated || req.user.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin activation. Please wait for admin approval before you can access this feature.',
        accountStatus: req.user.accountStatus || 'pending_activation',
        note: 'Contact support if your account has been pending for more than 48 hours'
      });
    }

    next();
  } catch (error) {
    console.error('Account activation check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error checking account activation status'
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

    // Convert single role to array
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}`
      });
    }

    next();
  };
};

// Admin role check middleware
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (!req.user.isAdmin && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin privileges required'
    });
  }

  // Check if admin account is activated
  if (!req.user.isAccountActivated || req.user.accountStatus !== 'active') {
    return res.status(403).json({
      success: false,
      error: 'Admin account is not activated'
    });
  }

  next();
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

    const userPermissions = req.apiKey.permissions || [];
    if (!userPermissions.includes(permission) && !userPermissions.includes('admin')) {
      return res.status(403).json({
        success: false,
        error: `Insufficient permissions. Required: ${permission}`
      });
    }

    next();
  };
};

// Business ownership check middleware
const requireBusinessOwnership = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const businessId = req.params.businessId || req.business?.id;
    
    if (!businessId) {
      return res.status(400).json({
        success: false,
        error: 'Business ID required'
      });
    }

    const business = await Business.findById(businessId);
    
    if (!business || business.status === 'deleted') {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }

    // Check if user owns the business or is admin
    if (business.ownerId.toString() !== req.user.id.toString() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You do not own this business.'
      });
    }

    req.targetBusiness = business;
    next();
  } catch (error) {
    console.error('Business ownership check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error verifying business ownership'
    });
  }
};

// Rate limiting middleware for login attempts
const trackLoginAttempt = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return next();
    }

    const user = await User.findOne({ email });
    
    if (user && user.isAccountLocked()) {
      return res.status(423).json({
        success: false,
        error: 'Account is temporarily locked due to too many failed login attempts',
        lockUntil: user.lockUntil,
        message: 'Please try again later or contact support'
      });
    }

    req.targetUser = user;
    next();
  } catch (error) {
    console.error('Login attempt tracking error:', error);
    next();
  }
};

// Export all middleware functions
module.exports = {
  // Basic authentication
  authenticateToken,      // Simple middleware for basic auth routes
  authenticateJWT,        // Advanced middleware for complex features
  authenticateApiKey,     // API key authentication
  
  // Authorization and access control
  requireRole,            // Role-based access
  requireAdmin,           // Admin access only
  requirePermission,      // Permission-based access for API keys
  requireActivatedAccount, // Account activation check
  requireBusinessOwnership, // Business ownership verification
  
  // Security and rate limiting
  trackLoginAttempt,      // Track login attempts for rate limiting
};

// For backward compatibility, also export the simple one as default
module.exports.default = authenticateToken;