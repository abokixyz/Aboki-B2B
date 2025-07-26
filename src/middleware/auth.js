const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, ApiKey, Business, Admin } = require('../models'); // Added Admin to imports
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
      isApiAccessApproved: user.isApiAccessApproved || false,
      apiAccessStatus: user.apiAccessStatus || 'pending_approval',
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

// ==================== ADMIN AUTHENTICATION ====================

// Admin JWT Authentication Middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.header('x-auth-token');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    try {
      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || config.jwt.secret);
      
      // Find the admin
      const admin = await Admin.findById(decoded.adminId)
        .select('-password -twoFactorSecret');

      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. Admin not found.',
          code: 'ADMIN_NOT_FOUND'
        });
      }

      // Check if admin is active
      if (!admin.isActive || admin.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin account is not active.',
          code: 'ADMIN_INACTIVE'
        });
      }

      // Check if account is locked
      if (admin.isLocked) {
        return res.status(423).json({
          success: false,
          message: 'Access denied. Admin account is temporarily locked.',
          code: 'ADMIN_LOCKED'
        });
      }

      // Update last active time
      admin.lastActiveAt = new Date();
      await admin.save();

      // Add admin info to request
      req.admin = {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        department: admin.department
      };

      next();
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token.',
        code: 'INVALID_TOKEN'
      });
    }

  } catch (error) {
    console.error('Admin authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication'
    });
  }
};

// Admin permission check middleware
const checkAdminPermission = (requiredPermission) => {
  return (req, res, next) => {
    try {
      const admin = req.admin;

      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. Admin authentication required.',
          code: 'AUTH_REQUIRED'
        });
      }

      // Super admin has all permissions
      if (admin.role === 'super_admin') {
        return next();
      }

      // Check if admin has the required permission
      if (!admin.permissions || !admin.permissions.includes(requiredPermission)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required permission: ${requiredPermission}`,
          code: 'INSUFFICIENT_PERMISSIONS',
          required: requiredPermission,
          current: admin.permissions || []
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during permission check'
      });
    }
  };
};

// Admin role check middleware
const checkAdminRole = (requiredRoles) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return (req, res, next) => {
    try {
      const admin = req.admin;

      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. Admin authentication required.',
          code: 'AUTH_REQUIRED'
        });
      }

      // Check if admin has one of the required roles
      if (!roles.includes(admin.role)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role: ${roles.join(' or ')}`,
          code: 'INSUFFICIENT_ROLE',
          required: roles,
          current: admin.role
        });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during role check'
      });
    }
  };
};

// Admin department check middleware
const checkAdminDepartment = (requiredDepartments) => {
  const departments = Array.isArray(requiredDepartments) ? requiredDepartments : [requiredDepartments];

  return (req, res, next) => {
    try {
      const admin = req.admin;

      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. Admin authentication required.',
          code: 'AUTH_REQUIRED'
        });
      }

      // Super admin can access all departments
      if (admin.role === 'super_admin') {
        return next();
      }

      // Check if admin belongs to one of the required departments
      if (!departments.includes(admin.department)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required department: ${departments.join(' or ')}`,
          code: 'INSUFFICIENT_DEPARTMENT',
          required: departments,
          current: admin.department
        });
      }

      next();
    } catch (error) {
      console.error('Department check error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during department check'
      });
    }
  };
};

// ==================== API KEY AUTHENTICATION ====================

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

    // NEW: Check if user has API access approval
    if (!apiKey.userId.isApiAccessApproved || apiKey.userId.apiAccessStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        error: 'API access not approved by admin. API access denied.',
        apiAccessStatus: apiKey.userId.apiAccessStatus
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

    // Update last used timestamp and usage stats
    apiKey.lastUsedAt = new Date();
    await apiKey.updateUsageStats(true); // Assuming successful access

    req.user = {
      id: apiKey.userId._id,
      email: apiKey.userId.email,
      fullName: apiKey.userId.fullName,
      role: apiKey.userId.role || 'user',
      isAccountActivated: apiKey.userId.isAccountActivated,
      accountStatus: apiKey.userId.accountStatus,
      isApiAccessApproved: apiKey.userId.isApiAccessApproved,
      apiAccessStatus: apiKey.userId.apiAccessStatus
    };

    req.apiKey = {
      id: apiKey._id,
      publicKey: apiKey.publicKey,
      permissions: apiKey.permissions || ['read', 'write'],
      approvedBy: apiKey.approvedBy,
      approvedAt: apiKey.approvedAt
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

// ==================== USER ACCESS CONTROL MIDDLEWARES ====================

// Account activation check middleware (enhanced)
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
        registeredAt: req.user.createdAt,
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

// NEW: API access approval check middleware
const requireApiAccessApproval = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if account is activated first
    if (!req.user.isAccountActivated || req.user.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin activation.',
        accountStatus: req.user.accountStatus || 'pending_activation'
      });
    }

    // Check if API access is approved
    if (!req.user.isApiAccessApproved || req.user.apiAccessStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Your API access is pending admin approval. You can create a business but cannot access API credentials until approved.',
        accountStatus: req.user.accountStatus,
        apiAccessStatus: req.user.apiAccessStatus || 'pending_approval',
        note: 'Contact support if your API access has been pending for more than 72 hours'
      });
    }

    next();
  } catch (error) {
    console.error('API access approval check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error checking API access approval status'
    });
  }
};

// Combined check for both account activation and API access
const requireAccountActivationAndApiAccess = async (req, res, next) => {
  try {
    // First check account activation
    await requireActivatedAccount(req, res, (err) => {
      if (err) return next(err);
      
      // Then check API access approval
      requireApiAccessApproval(req, res, next);
    });
  } catch (error) {
    console.error('Combined access check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error checking access permissions'
    });
  }
};

// ==================== EXISTING MIDDLEWARES ====================

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

// Admin role check middleware (for users, not admin panel)
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

// ==================== UTILITY MIDDLEWARES ====================

// Admin action logging middleware
const logAdminAction = (action, description) => {
  return async (req, res, next) => {
    try {
      const admin = req.admin;
      
      if (admin) {
        // Create audit log entry
        const auditLog = {
          adminId: admin.id,
          adminUsername: admin.username,
          action,
          description,
          method: req.method,
          path: req.path,
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
          timestamp: new Date(),
          requestBody: req.method !== 'GET' ? req.body : undefined
        };

        // Log to console (in production, you might want to use a proper logging service)
        console.log('Admin Action:', JSON.stringify(auditLog, null, 2));

        // You can also save to database if you have an audit log model
        // await AuditLog.create(auditLog);
      }

      next();
    } catch (error) {
      console.error('Admin action logging error:', error);
      // Don't block the request if logging fails
      next();
    }
  };
};

// Admin rate limiting middleware
const adminRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    try {
      const admin = req.admin;
      
      if (!admin) {
        return next();
      }

      const key = `admin_${admin.id}`;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Get or create request history for this admin
      if (!requests.has(key)) {
        requests.set(key, []);
      }

      const adminRequests = requests.get(key);
      
      // Remove old requests outside the window
      const validRequests = adminRequests.filter(timestamp => timestamp > windowStart);
      
      // Check if limit exceeded
      if (validRequests.length >= maxRequests) {
        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded. Too many requests from this admin.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      // Add current request
      validRequests.push(now);
      requests.set(key, validRequests);

      next();
    } catch (error) {
      console.error('Admin rate limiting error:', error);
      next(); // Don't block if rate limiting fails
    }
  };
};

// Export all middleware functions
module.exports = {
  // ==================== USER AUTHENTICATION ====================
  authenticateToken,           // Simple middleware for basic auth routes
  authenticateJWT,            // Advanced middleware for complex features
  authenticateApiKey,         // API key authentication
  
  // ==================== ADMIN AUTHENTICATION ====================
  authenticateAdmin,          // Admin JWT authentication
  checkAdminPermission,       // Admin permission checking
  checkAdminRole,            // Admin role checking
  checkAdminDepartment,      // Admin department checking
  
  // ==================== USER ACCESS CONTROL ====================
  requireActivatedAccount,           // Account activation check
  requireApiAccessApproval,         // NEW: API access approval check
  requireAccountActivationAndApiAccess, // NEW: Combined check
  requireRole,                      // Role-based access
  requireAdmin,                     // Admin access only (for users)
  requirePermission,               // Permission-based access for API keys
  requireBusinessOwnership,        // Business ownership verification
  
  // ==================== SECURITY AND UTILITIES ====================
  trackLoginAttempt,          // Track login attempts for rate limiting
  logAdminAction,            // Admin action logging
  adminRateLimit,           // Admin rate limiting
};

// For backward compatibility, also export the simple one as default
module.exports.default = authenticateToken;