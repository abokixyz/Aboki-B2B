// middleware/adminAuth.js
const jwt = require('jsonwebtoken');
const { Admin } = require('../models');

// Authenticate admin token
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find admin and check if account is active
    const admin = await Admin.findById(decoded.id).select('-password -resetPasswordToken -resetPasswordExpiry -twoFactorSecret');
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token - admin not found'
      });
    }

    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Admin account is deactivated'
      });
    }

    // Check if admin account is locked
    if (admin.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Admin account is temporarily locked',
        lockUntil: admin.lockUntil
      });
    }

    // Optional: Check if session token matches (for additional security)
    if (admin.sessionToken && admin.sessionToken !== token) {
      return res.status(401).json({
        success: false,
        message: 'Token has been invalidated. Please login again.'
      });
    }

    // Add admin info to request
    req.admin = {
      id: admin._id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
      permissions: admin.permissions
    };

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }

    console.error('Admin auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication'
    });
  }
};

// Require specific role(s)
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Super admin has access to everything
    if (req.admin.role === 'super_admin') {
      return next();
    }

    // Check if admin role is in allowed roles
    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
        currentRole: req.admin.role
      });
    }

    next();
  };
};

// Require specific permission(s)
const requirePermission = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Super admin has all permissions
    if (req.admin.role === 'super_admin') {
      return next();
    }

    // Check if admin has any of the required permissions
    const hasPermission = requiredPermissions.some(permission => 
      req.admin.permissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${requiredPermissions.join(' or ')}`,
        currentPermissions: req.admin.permissions
      });
    }

    next();
  };
};

// Check if admin can perform action on specific resource
const canManageResource = (resourceType, options = {}) => {
  return async (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Super admin can manage everything
    if (req.admin.role === 'super_admin') {
      return next();
    }

    try {
      let hasAccess = false;

      switch (resourceType) {
        case 'user':
          // Check user management permissions
          hasAccess = req.admin.permissions.includes('user_management') || 
                     req.admin.permissions.includes('user_verification');
          
          // If checking verification specifically
          if (options.action === 'verify') {
            hasAccess = req.admin.permissions.includes('user_verification');
          }
          break;

        case 'business':
          // Check business management permissions
          hasAccess = req.admin.permissions.includes('business_management') || 
                     req.admin.permissions.includes('business_verification');
          
          // If checking verification specifically
          if (options.action === 'verify') {
            hasAccess = req.admin.permissions.includes('business_verification');
          }
          break;

        case 'admin':
          // Only super admins can manage other admins
          hasAccess = req.admin.role === 'super_admin';
          break;

        case 'system':
          // System settings require specific permission
          hasAccess = req.admin.permissions.includes('system_settings');
          break;

        case 'analytics':
          // Analytics viewing permission
          hasAccess = req.admin.permissions.includes('analytics_view');
          break;

        case 'bulk_operations':
          // Bulk operations permission
          hasAccess = req.admin.permissions.includes('bulk_operations');
          break;

        default:
          hasAccess = false;
      }

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Insufficient permissions to manage ${resourceType}`,
          requiredPermissions: getRequiredPermissions(resourceType, options.action),
          currentPermissions: req.admin.permissions
        });
      }

      next();

    } catch (error) {
      console.error('Resource access check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during access check'
      });
    }
  };
};

// Helper function to get required permissions for resource actions
const getRequiredPermissions = (resourceType, action) => {
  const permissionMap = {
    user: {
      default: ['user_management', 'user_verification'],
      verify: ['user_verification'],
      manage: ['user_management']
    },
    business: {
      default: ['business_management', 'business_verification'],
      verify: ['business_verification'],
      manage: ['business_management']
    },
    admin: {
      default: ['super_admin_role']
    },
    system: {
      default: ['system_settings']
    },
    analytics: {
      default: ['analytics_view']
    },
    bulk_operations: {
      default: ['bulk_operations']
    }
  };

  const resource = permissionMap[resourceType];
  if (!resource) return [];

  return resource[action] || resource.default || [];
};

// IP whitelist middleware (optional - for additional security)
const checkIpWhitelist = async (req, res, next) => {
  try {
    if (!req.admin) {
      return next(); // Skip if admin not authenticated yet
    }

    const admin = await Admin.findById(req.admin.id).select('ipWhitelist');
    
    // If no IP whitelist is set, allow access
    if (!admin || !admin.ipWhitelist || admin.ipWhitelist.length === 0) {
      return next();
    }

    // Get client IP
    const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    // Check if client IP is in whitelist
    const isWhitelisted = admin.ipWhitelist.some(whitelistedIp => {
      // Simple IP matching - you might want to implement CIDR matching
      return clientIp === whitelistedIp || clientIp.includes(whitelistedIp);
    });

    if (!isWhitelisted) {
      console.log(`🚫 IP access denied for admin ${admin.email} from ${clientIp}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied from this IP address',
        clientIp: process.env.NODE_ENV === 'development' ? clientIp : undefined
      });
    }

    next();

  } catch (error) {
    console.error('IP whitelist check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during IP check'
    });
  }
};

// Rate limiting middleware for admin actions
const adminRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100, // per window
    message = 'Too many requests from this admin'
  } = options;

  // Simple in-memory rate limiting (use Redis in production)
  const requestCounts = new Map();

  return (req, res, next) => {
    if (!req.admin) {
      return next();
    }

    const key = `${req.admin.id}:${req.route?.path || req.path}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    for (const [countKey, requests] of requestCounts.entries()) {
      requestCounts.set(countKey, requests.filter(time => time > windowStart));
      if (requestCounts.get(countKey).length === 0) {
        requestCounts.delete(countKey);
      }
    }

    // Get current requests for this admin/endpoint
    const currentRequests = requestCounts.get(key) || [];
    
    if (currentRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Add current request
    currentRequests.push(now);
    requestCounts.set(key, currentRequests);

    next();
  };
};

// Audit logging middleware
const auditLog = (action) => {
  return (req, res, next) => {
    // Store original res.json to capture response
    const originalJson = res.json;
    
    res.json = function(data) {
      // Log the admin action
      const logData = {
        adminId: req.admin?.id,
        adminEmail: req.admin?.email,
        action,
        method: req.method,
        path: req.path,
        params: req.params,
        body: req.method !== 'GET' ? req.body : undefined,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date(),
        success: data?.success !== false,
        statusCode: res.statusCode
      };

      // Log to console (implement proper logging service in production)
      console.log('📋 Admin Action:', JSON.stringify(logData, null, 2));

      // TODO: Store in audit log database/service
      // await AuditLog.create(logData);

      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
};

// Combined middleware for common admin route protection
const adminAuth = {
  // Basic authentication
  authenticate: authenticateAdmin,
  
  // Role-based access
  requireRole,
  requirePermission,
  canManageResource,
  
  // Security enhancements
  checkIpWhitelist,
  rateLimit: adminRateLimit,
  auditLog,
  
  // Common combinations
  userManagement: [
    authenticateAdmin,
    requirePermission(['user_management']),
    auditLog('user_management')
  ],
  
  userVerification: [
    authenticateAdmin,
    requirePermission(['user_verification']),
    auditLog('user_verification')
  ],
  
  businessManagement: [
    authenticateAdmin,
    requirePermission(['business_management']),
    auditLog('business_management')
  ],
  
  businessVerification: [
    authenticateAdmin,
    requirePermission(['business_verification']),
    auditLog('business_verification')
  ],
  
  systemAdmin: [
    authenticateAdmin,
    requireRole(['super_admin']),
    auditLog('system_admin')
  ],
  
  analytics: [
    authenticateAdmin,
    requirePermission(['analytics_view']),
    auditLog('analytics_view')
  ],
  
  bulkOperations: [
    authenticateAdmin,
    requirePermission(['bulk_operations']),
    adminRateLimit({ maxRequests: 10, windowMs: 60 * 1000 }), // Stricter rate limit
    auditLog('bulk_operations')
  ]
};

module.exports = {
  authenticateAdmin,
  requireRole,
  requirePermission,
  canManageResource,
  checkIpWhitelist,
  adminRateLimit,
  auditLog,
  adminAuth
};