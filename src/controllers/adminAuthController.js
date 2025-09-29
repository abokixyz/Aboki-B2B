// controllers/adminAuthController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Admin } = require('../models');
const emailService = require('../services/EmailService'); // Adjust path as needed

class AdminAuthController {
  // Admin login
  async login(req, res) {
    try {
      const { email, password, twoFactorCode } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Find admin
      const admin = await Admin.findOne({ email: email.toLowerCase() });
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check if account is locked
      if (admin.isLocked) {
        return res.status(423).json({
          success: false,
          message: 'Account is temporarily locked due to too many failed login attempts',
          lockUntil: admin.lockUntil
        });
      }

      // Check if account is active
      if (!admin.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Admin account is deactivated. Contact super admin.'
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (!isPasswordValid) {
        // Increment login attempts
        await admin.incLoginAttempts();
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check 2FA if enabled
      if (admin.twoFactorEnabled) {
        if (!twoFactorCode) {
          return res.status(400).json({
            success: false,
            message: 'Two-factor authentication code is required',
            requiresTwoFactor: true
          });
        }

        // Verify 2FA code (implement your 2FA logic here)
        const isValidTwoFactor = await this.verifyTwoFactorCode(admin, twoFactorCode);
        if (!isValidTwoFactor) {
          await admin.incLoginAttempts();
          return res.status(401).json({
            success: false,
            message: 'Invalid two-factor authentication code'
          });
        }
      }

      // Reset login attempts on successful login
      if (admin.loginAttempts > 0) {
        await admin.resetLoginAttempts();
      }

      // Generate JWT token with shorter expiry for admin
      const token = jwt.sign(
        {
          id: admin._id,
          email: admin.email,
          fullName: admin.fullName,
          role: admin.role
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.ADMIN_JWT_EXPIRE || '8h' } // Shorter expiry for admin tokens
      );

      // Update last login and session token
      admin.lastLogin = new Date();
      admin.sessionToken = token;
      await admin.save();

      // Log admin login
      console.log(`👨‍💼 Admin login: ${admin.email} (${admin.role}) at ${new Date().toISOString()}`);

      // Remove sensitive data from response
      const adminResponse = {
        id: admin._id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions,
        isActive: admin.isActive,
        lastLogin: admin.lastLogin,
        createdAt: admin.createdAt,
        twoFactorEnabled: admin.twoFactorEnabled
      };

      res.json({
        success: true,
        message: 'Admin login successful',
        data: {
          admin: adminResponse,
          token,
          permissions: admin.permissions,
          expiresIn: process.env.ADMIN_JWT_EXPIRE || '8h'
        }
      });

    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during admin login',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Admin forgot password
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      // Validation
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Find admin
      const admin = await Admin.findOne({ 
        email: email.toLowerCase(),
        isActive: true 
      });

      // Always return success message to prevent email enumeration
      const successMessage = 'If an admin account exists with that email, a password reset link has been sent';

      if (!admin) {
        // Log attempt for security monitoring
        console.log(`🔐 Password reset attempted for non-existent admin: ${email}`);
        
        return res.json({
          success: true,
          message: successMessage
        });
      }

      // Check for recent reset requests (rate limiting)
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      if (admin.resetPasswordExpiry && admin.resetPasswordExpiry > fifteenMinutesAgo) {
        const retryAfter = Math.ceil((admin.resetPasswordExpiry - Date.now()) / 1000);
        return res.status(429).json({
          success: false,
          message: 'A password reset email was recently sent. Please wait before requesting another.',
          retryAfter
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      // Set token expiry (10 minutes for security)
      const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000);

      // Save reset token to admin
      admin.resetPasswordToken = hashedToken;
      admin.resetPasswordExpiry = tokenExpiry;
      await admin.save();

      // Send reset email
      try {
        await this.sendPasswordResetEmail(admin.fullName, admin.email, resetToken);
        
        // Log reset request
        console.log(`🔐 Admin password reset requested: ${admin.email} at ${new Date().toISOString()}`);
        
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        // Clear reset token if email fails
        admin.resetPasswordToken = undefined;
        admin.resetPasswordExpiry = undefined;
        await admin.save();
        
        return res.status(500).json({
          success: false,
          message: 'Failed to send password reset email. Please try again later.'
        });
      }

      res.json({
        success: true,
        message: successMessage
      });

    } catch (error) {
      console.error('Admin forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during password reset request',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Admin reset password
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      // Validation
      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Reset token and new password are required'
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long'
        });
      }

      // Password strength validation
      const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
      if (!passwordStrengthRegex.test(newPassword)) {
        return res.status(400).json({
          success: false,
          message: 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
        });
      }

      // Hash the token to find admin
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      // Find admin with valid reset token
      const admin = await Admin.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpiry: { $gt: Date.now() },
        isActive: true
      });

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      // Hash new password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update admin password and clear reset token
      admin.password = hashedPassword;
      admin.resetPasswordToken = undefined;
      admin.resetPasswordExpiry = undefined;
      admin.sessionToken = undefined; // Clear any existing sessions
      admin.loginAttempts = 0; // Reset login attempts
      admin.lockUntil = undefined; // Clear any account locks
      admin.updatedAt = new Date();
      
      await admin.save();

      // Send confirmation email
      try {
        await this.sendPasswordResetConfirmation(admin.fullName, admin.email);
      } catch (emailError) {
        console.error('Failed to send password reset confirmation email:', emailError);
        // Don't fail the reset if confirmation email fails
      }

      // Log password reset
      console.log(`🔐 Admin password reset completed: ${admin.email} at ${new Date().toISOString()}`);

      res.json({
        success: true,
        message: 'Password reset successfully. You can now login with your new password.'
      });

    } catch (error) {
      console.error('Admin reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during password reset',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get admin profile
  async getProfile(req, res) {
    try {
      const adminId = req.admin.id;

      const admin = await Admin.findById(adminId).select('-password -resetPasswordToken -resetPasswordExpiry -twoFactorSecret -sessionToken');
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }

      res.json({
        success: true,
        data: admin
      });

    } catch (error) {
      console.error('Get admin profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Change admin password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const adminId = req.admin.id;

      // Validation
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 8 characters long'
        });
      }

      if (currentPassword === newPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password must be different from current password'
        });
      }

      // Password strength validation
      const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
      if (!passwordStrengthRegex.test(newPassword)) {
        return res.status(400).json({
          success: false,
          message: 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
        });
      }

      // Find admin
      const admin = await Admin.findById(adminId);
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Hash new password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      admin.password = hashedNewPassword;
      admin.updatedAt = new Date();
      await admin.save();

      // Log password change
      console.log(`🔐 Admin password changed: ${admin.email} at ${new Date().toISOString()}`);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Change admin password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during password change',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Create new admin (super admin only)
  async createAdmin(req, res) {
    try {
      // Check if current admin is super admin (middleware should handle this, but double-check)
      if (req.admin.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only super admins can create new admin accounts'
        });
      }

      const { email, password, fullName, role, permissions } = req.body;

      // Validation
      if (!email || !password || !fullName || !role) {
        return res.status(400).json({
          success: false,
          message: 'Email, password, full name, and role are required'
        });
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long'
        });
      }

      // Password strength validation
      const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
      if (!passwordStrengthRegex.test(password)) {
        return res.status(400).json({
          success: false,
          message: 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
        });
      }

      if (!['super_admin', 'admin', 'moderator'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role specified. Must be: super_admin, admin, or moderator'
        });
      }

      // Check if admin already exists
      const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
      if (existingAdmin) {
        return res.status(409).json({
          success: false,
          message: 'Admin with this email already exists'
        });
      }

      // Hash password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create admin
      const newAdmin = new Admin({
        email: email.toLowerCase(),
        password: hashedPassword,
        fullName,
        role,
        permissions: permissions || undefined, // Will use default permissions based on role
        createdBy: req.admin.id,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await newAdmin.save();

      // Log admin creation
      console.log(`👨‍💼 New admin created: ${newAdmin.email} (${newAdmin.role}) by ${req.admin.email}`);

      // Remove password from response
      const adminResponse = {
        id: newAdmin._id,
        email: newAdmin.email,
        fullName: newAdmin.fullName,
        role: newAdmin.role,
        permissions: newAdmin.permissions,
        isActive: newAdmin.isActive,
        createdBy: newAdmin.createdBy,
        createdAt: newAdmin.createdAt
      };

      res.status(201).json({
        success: true,
        message: 'Admin account created successfully',
        data: adminResponse
      });

    } catch (error) {
      console.error('Create admin error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during admin creation',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get all admins (super admin only)
  async getAdmins(req, res) {
    try {
      // Check if current admin is super admin
      if (req.admin.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only super admins can view admin accounts'
        });
      }

      const { page = 1, limit = 20, role, isActive } = req.query;
      const skip = (page - 1) * limit;

      // Build query
      let query = {};
      if (role) query.role = role;
      if (typeof isActive === 'string') query.isActive = isActive === 'true';

      // Get admins with creator info
      const admins = await Admin.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'admins',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'creator'
          }
        },
        {
          $addFields: {
            createdByName: { $arrayElemAt: ['$creator.fullName', 0] }
          }
        },
        {
          $project: {
            password: 0,
            resetPasswordToken: 0,
            resetPasswordExpiry: 0,
            twoFactorSecret: 0,
            sessionToken: 0,
            creator: 0
          }
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) }
      ]);

      const totalAdmins = await Admin.countDocuments(query);
      const totalPages = Math.ceil(totalAdmins / limit);

      // Get role distribution
      const roleStats = await Admin.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]);

      res.json({
        success: true,
        data: {
          admins,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalAdmins,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            limit: parseInt(limit)
          },
          statistics: {
            totalAdmins,
            roleDistribution: roleStats.reduce((acc, stat) => {
              acc[stat._id] = stat.count;
              return acc;
            }, {}),
            activeAdmins: await Admin.countDocuments({ isActive: true }),
            inactiveAdmins: await Admin.countDocuments({ isActive: false })
          }
        }
      });

    } catch (error) {
      console.error('Get admins error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Toggle admin status (super admin only)
  async toggleAdminStatus(req, res) {
    try {
      // Check if current admin is super admin
      if (req.admin.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only super admins can modify admin accounts'
        });
      }

      const { adminId } = req.params;
      const { isActive, reason } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'isActive must be a boolean value'
        });
      }

      // Prevent self-deactivation
      if (adminId === req.admin.id) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate your own account'
        });
      }

      const admin = await Admin.findById(adminId);
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }

      // Prevent deactivating the last super admin
      if (!isActive && admin.role === 'super_admin') {
        const activeSuperAdmins = await Admin.countDocuments({ 
          role: 'super_admin', 
          isActive: true,
          _id: { $ne: adminId }
        });
        
        if (activeSuperAdmins === 0) {
          return res.status(400).json({
            success: false,
            message: 'Cannot deactivate the last super admin account'
          });
        }
      }

      // Update admin status
      admin.isActive = isActive;
      admin.updatedAt = new Date();
      
      // Clear session token if deactivating
      if (!isActive) {
        admin.sessionToken = undefined;
      }
      
      await admin.save();

      // Log status change
      console.log(`👨‍💼 Admin status changed: ${admin.email} ${isActive ? 'activated' : 'deactivated'} by ${req.admin.email}. Reason: ${reason || 'No reason provided'}`);

      res.json({
        success: true,
        message: `Admin account ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: {
          adminId,
          email: admin.email,
          fullName: admin.fullName,
          isActive,
          reason,
          updatedAt: admin.updatedAt,
          updatedBy: req.admin.email
        }
      });

    } catch (error) {
      console.error('Toggle admin status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Admin logout
  async logout(req, res) {
    try {
      const adminId = req.admin.id;

      // Clear session token
      await Admin.updateOne(
        { _id: adminId },
        { $unset: { sessionToken: 1 } }
      );

      // Log logout
      console.log(`👨‍💼 Admin logout: ${req.admin.email} at ${new Date().toISOString()}`);

      res.json({
        success: true,
        message: 'Admin logged out successfully'
      });

    } catch (error) {
      console.error('Admin logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during logout',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Helper method to verify 2FA code (implement based on your 2FA library)
  async verifyTwoFactorCode(admin, code) {
    try {
      // Implement your 2FA verification logic here
      // Example with speakeasy library:
      // const speakeasy = require('speakeasy');
      // return speakeasy.totp.verify({
      //   secret: admin.twoFactorSecret,
      //   encoding: 'base32',
      //   token: code,
      //   window: 2
      // });
      
      // For now, return true (implement proper 2FA verification)
      return true;
    } catch (error) {
      console.error('2FA verification error:', error);
      return false;
    }
  }

  // Helper method to send password reset email
  async sendPasswordResetEmail(fullName, email, resetToken) {
    try {
      // Use your email service - adjust based on your implementation
      await emailService.sendAdminPasswordResetEmail(fullName, email, resetToken);
    } catch (error) {
      console.error('Send password reset email error:', error);
      throw error;
    }
  }

  // Helper method to send password reset confirmation email
  async sendPasswordResetConfirmation(fullName, email) {
    try {
      // Use your email service - adjust based on your implementation
      await emailService.sendAdminPasswordResetConfirmation(fullName, email);
    } catch (error) {
      console.error('Send password reset confirmation email error:', error);
      throw error;
    }
  }

  // Get admin activity logs (super admin only)
  async getAdminActivity(req, res) {
    try {
      if (req.admin.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only super admins can view admin activity'
        });
      }

      const { page = 1, limit = 50, adminId, action, dateFrom, dateTo } = req.query;
      const skip = (page - 1) * limit;

      // Build query for activity logs (you'll need to implement activity logging)
      let query = {};
      if (adminId) query.adminId = adminId;
      if (action) query.action = action;
      if (dateFrom || dateTo) {
        query.timestamp = {};
        if (dateFrom) query.timestamp.$gte = new Date(dateFrom);
        if (dateTo) query.timestamp.$lte = new Date(dateTo);
      }

      // For now, return recent admin logins as activity
      const recentActivity = await Admin.find({})
        .select('email fullName role lastLogin')
        .sort({ lastLogin: -1 })
        .limit(parseInt(limit));

      res.json({
        success: true,
        data: {
          activity: recentActivity.map(admin => ({
            adminId: admin._id,
            email: admin.email,
            fullName: admin.fullName,
            role: admin.role,
            action: 'login',
            timestamp: admin.lastLogin,
            details: 'Admin login'
          })),
          pagination: {
            currentPage: parseInt(page),
            totalPages: 1,
            totalRecords: recentActivity.length,
            hasNext: false,
            hasPrev: false,
            limit: parseInt(limit)
          },
          note: 'Implement comprehensive activity logging for full audit trail'
        }
      });

    } catch (error) {
      console.error('Get admin activity error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Reset admin password (super admin only)
  async resetAdminPassword(req, res) {
    try {
      if (req.admin.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only super admins can reset admin passwords'
        });
      }

      const { adminId } = req.params;
      const { newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password is required'
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long'
        });
      }

      // Password strength validation
      const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
      if (!passwordStrengthRegex.test(newPassword)) {
        return res.status(400).json({
          success: false,
          message: 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
        });
      }

      const admin = await Admin.findById(adminId);
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }

      // Hash new password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password and clear session
      admin.password = hashedPassword;
      admin.sessionToken = undefined;
      admin.updatedAt = new Date();
      await admin.save();

      // Log password reset
      console.log(`🔐 Admin password reset: ${admin.email} by ${req.admin.email} at ${new Date().toISOString()}`);

      res.json({
        success: true,
        message: 'Admin password reset successfully',
        data: {
          adminId,
          email: admin.email,
          message: 'Password has been reset. Admin will need to login with new password.'
        }
      });

    } catch (error) {
      console.error('Reset admin password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get admin statistics (super admin only)
  async getAdminStats(req, res) {
    try {
      if (req.admin.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only super admins can view admin statistics'
        });
      }

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const stats = await Promise.all([
        // Total admins by role
        Admin.aggregate([
          { $group: { _id: '$role', count: { $sum: 1 } } }
        ]),
        
        // Active vs inactive
        Admin.countDocuments({ isActive: true }),
        Admin.countDocuments({ isActive: false }),
        
        // Recent logins (last 30 days)
        Admin.countDocuments({ 
          lastLogin: { $gte: thirtyDaysAgo },
          isActive: true 
        }),
        
        // New admins (last 30 days)
        Admin.countDocuments({ 
          createdAt: { $gte: thirtyDaysAgo } 
        })
      ]);

      const [roleDistribution, activeCount, inactiveCount, recentLogins, newAdmins] = stats;

      res.json({
        success: true,
        data: {
          totalAdmins: activeCount + inactiveCount,
          activeAdmins: activeCount,
          inactiveAdmins: inactiveCount,
          roleDistribution: roleDistribution.reduce((acc, role) => {
            acc[role._id] = role.count;
            return acc;
          }, {}),
          recentActivity: {
            loginsLast30Days: recentLogins,
            newAdminsLast30Days: newAdmins
          },
          systemHealth: {
            activeSuperAdmins: await Admin.countDocuments({ 
              role: 'super_admin', 
              isActive: true 
            }),
            twoFactorEnabled: await Admin.countDocuments({ 
              twoFactorEnabled: true 
            })
          }
        }
      });

    } catch (error) {
      console.error('Get admin stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = new AdminAuthController();