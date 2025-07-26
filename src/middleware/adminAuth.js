const jwt = require('jsonwebtoken');
const { Admin } = require('../models'); // You'll need to create an Admin model

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required. Please provide a valid admin token.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Admin token is required'
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired admin token'
      });
    }

    // Check if it's an admin token (should have admin role)
    if (!decoded.role || !['super_admin', 'admin', 'moderator'].includes(decoded.role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      });
    }

    // Get admin from database
    const admin = await Admin.findById(decoded.id).select('-password');
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not found'
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Admin account is deactivated'
      });
    }

    // Add admin info to request
    req.admin = {
      id: admin._id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
      permissions: admin.permissions || []
    };

    // Update last login
    await Admin.updateOne(
      { _id: admin._id },
      { lastLogin: new Date() }
    );

    next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during admin authentication'
    });
  }
};

// Check specific admin permissions
const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }

    // Super admin has all permissions
    if (req.admin.role === 'super_admin') {
      return next();
    }

    // Check if admin has required permission
    if (!req.admin.permissions.includes(requiredPermission)) {
      return res.status(403).json({
        success: false,
        message: `Permission required: ${requiredPermission}`
      });
    }

    next();
  };
};

// Check admin role
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }

    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        message: `Insufficient role. Required: ${allowedRoles.join(' or ')}`
      });
    }

    next();
  };
};

module.exports = {
  authenticateAdmin,
  requirePermission,
  requireRole
};