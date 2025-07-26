const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Middleware to authenticate admin users
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
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

// Middleware to check if admin has specific permission
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

// Middleware to check if admin has specific role
const checkAdminRole = (requiredRoles) => {
  // Ensure requiredRoles is an array
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

// Middleware to check if admin belongs to specific department
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

// Middleware to log admin actions for audit trail
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

// Middleware to validate admin session and refresh token if needed
const validateAdminSession = async (req, res, next) => {
  try {
    const admin = req.admin;

    if (!admin) {
      return next();
    }

    // Check if admin needs to change password (if it's been too long)
    const adminRecord = await Admin.findById(admin.id);
    
    if (adminRecord) {
      const passwordAge = Date.now() - adminRecord.lastPasswordChange.getTime();
      const maxPasswordAge = 90 * 24 * 60 * 60 * 1000; // 90 days

      if (passwordAge > maxPasswordAge) {
        return res.status(403).json({
          success: false,
          message: 'Password change required. Your password is over 90 days old.',
          code: 'PASSWORD_CHANGE_REQUIRED',
          lastPasswordChange: adminRecord.lastPasswordChange
        });
      }

      // Check if 2FA is required for this admin role
      if ((admin.role === 'super_admin' || admin.role === 'admin') && !adminRecord.twoFactorEnabled) {
        return res.status(403).json({
          success: false,
          message: 'Two-factor authentication is required for your admin role.',
          code: 'TWO_FACTOR_REQUIRED'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Admin session validation error:', error);
    next(); // Don't block if validation fails
  }
};

// Rate limiting middleware for admin actions
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

module.exports = {
  authenticateAdmin,
  checkAdminPermission,
  checkAdminRole,
  checkAdminDepartment,
  logAdminAction,
  validateAdminSession,
  adminRateLimit
};