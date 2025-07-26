// controllers/adminController.js - Simple version to get started
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Import models with error handling
let User, Admin, ApiKey;
try {
  const models = require('../models');
  User = models.User;
  Admin = models.Admin;
  ApiKey = models.ApiKey;
  console.log('✅ Admin controller: Models imported successfully');
} catch (error) {
  console.error('❌ Admin controller: Error importing models:', error.message);
}

class AdminController {
  // Simple admin login
  async login(req, res) {
    try {
      console.log('🔐 Admin login attempt');
      
      const { email, password } = req.body;

      // Basic validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Check if Admin model is available
      if (!Admin) {
        console.error('❌ Admin model not available');
        return res.status(500).json({
          success: false,
          message: 'Admin model not available. Check database connection.',
          debug: 'Admin model is undefined'
        });
      }

      console.log('🔍 Looking for admin with email:', email.toLowerCase());

      // Find admin
      const admin = await Admin.findOne({ 
        email: email.toLowerCase(),
        isActive: true 
      });

      console.log('🔍 Admin found:', !!admin);

      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check password
      console.log('🔑 Verifying password...');
      const isValidPassword = await admin.comparePassword(password);
      console.log('🔑 Password valid:', isValidPassword);
      
      if (!isValidPassword) {
        // Update failed login attempts if the method exists
        if (typeof admin.updateLoginTracking === 'function') {
          await admin.updateLoginTracking(false);
        }
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Update login tracking if the method exists
      if (typeof admin.updateLoginTracking === 'function') {
        await admin.updateLoginTracking(true);
      }

      // Generate JWT token
      console.log('🎫 Generating JWT token...');
      const token = jwt.sign(
        { 
          adminId: admin._id,
          role: admin.role,
          permissions: admin.permissions 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
      );

      console.log('✅ Admin login successful');

      res.json({
        success: true,
        message: 'Admin login successful',
        data: {
          admin: {
            id: admin._id,
            username: admin.username,
            email: admin.email,
            fullName: admin.fullName || `${admin.firstName} ${admin.lastName}`,
            role: admin.role,
            permissions: admin.permissions,
            department: admin.department
          },
          token
        }
      });

    } catch (error) {
      console.error('🔥 Admin login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during admin login',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Simple dashboard overview
  async getDashboardOverview(req, res) {
    try {
      console.log('📊 Getting dashboard overview...');

      if (!User) {
        return res.status(500).json({
          success: false,
          message: 'User model not available'
        });
      }

      // Get basic user counts
      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ 
        isAccountActivated: true, 
        accountStatus: 'active' 
      });
      const pendingActivations = await User.countDocuments({ 
        accountStatus: 'pending_activation' 
      });
      const pendingApiRequests = await User.countDocuments({ 
        apiAccessStatus: 'pending_approval',
        isAccountActivated: true 
      });

      res.json({
        success: true,
        data: {
          overview: {
            totalUsers,
            activeUsers,
            pendingActivations,
            pendingApiRequests,
            activationRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0
          }
        }
      });

    } catch (error) {
      console.error('🔥 Dashboard overview error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching dashboard overview',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get pending activations
  async getPendingActivations(req, res) {
    try {
      console.log('📋 Getting pending activations...');

      if (!User) {
        return res.status(500).json({
          success: false,
          message: 'User model not available'
        });
      }

      const pendingUsers = await User.find({ 
        isAccountActivated: false,
        accountStatus: 'pending_activation'
      })
      .select('username email firstName lastName createdAt phoneNumber country')
      .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: {
          users: pendingUsers,
          count: pendingUsers.length
        }
      });

    } catch (error) {
      console.error('🔥 Get pending activations error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching pending activations',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Activate user
  async activateUser(req, res) {
    try {
      const { userId } = req.params;
      const adminId = req.admin.id;

      console.log('🟢 Activating user:', userId, 'by admin:', adminId);

      if (!User || !Admin) {
        return res.status(500).json({
          success: false,
          message: 'Required models not available'
        });
      }

      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.isAccountActivated) {
        return res.status(400).json({
          success: false,
          message: 'User account is already activated'
        });
      }

      // Activate user
      user.isAccountActivated = true;
      user.accountStatus = 'active';
      user.activatedAt = new Date();
      user.activatedBy = adminId;
      await user.save();

      console.log('✅ User activated successfully:', userId);

      res.json({
        success: true,
        message: 'User account activated successfully',
        data: {
          userId: user._id,
          email: user.email,
          username: user.username,
          activatedAt: user.activatedAt
        }
      });

    } catch (error) {
      console.error('🔥 Activate user error:', error);
      res.status(500).json({
        success: false,
        message: 'Error activating user account',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get pending API requests
  async getPendingApiRequests(req, res) {
    try {
      console.log('📋 Getting pending API requests...');

      if (!User) {
        return res.status(500).json({
          success: false,
          message: 'User model not available'
        });
      }

      const pendingRequests = await User.find({
        isAccountActivated: true,
        accountStatus: 'active',
        apiAccessStatus: 'pending_approval'
      })
      .select('username email firstName lastName apiAccessRequestedAt apiAccessReason businessUseCase')
      .sort({ apiAccessRequestedAt: -1 });

      res.json({
        success: true,
        data: {
          requests: pendingRequests,
          count: pendingRequests.length
        }
      });

    } catch (error) {
      console.error('🔥 Get pending API requests error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching pending API requests',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Approve API access
  async approveApiAccess(req, res) {
    try {
      const { userId } = req.params;
      const adminId = req.admin.id;

      console.log('🟢 Approving API access for user:', userId);

      if (!User) {
        return res.status(500).json({
          success: false,
          message: 'User model not available'
        });
      }

      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.isAccountActivated) {
        return res.status(400).json({
          success: false,
          message: 'User account must be activated first'
        });
      }

      if (user.isApiAccessApproved) {
        return res.status(400).json({
          success: false,
          message: 'API access is already approved for this user'
        });
      }

      // Approve API access
      user.isApiAccessApproved = true;
      user.apiAccessStatus = 'approved';
      user.apiAccessApprovedAt = new Date();
      user.apiAccessApprovedBy = adminId;
      await user.save();

      console.log('✅ API access approved for user:', userId);

      res.json({
        success: true,
        message: 'API access approved successfully',
        data: {
          userId: user._id,
          email: user.email,
          username: user.username,
          approvedAt: user.apiAccessApprovedAt
        }
      });

    } catch (error) {
      console.error('🔥 Approve API access error:', error);
      res.status(500).json({
        success: false,
        message: 'Error approving API access',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Reject API access
  async rejectApiAccess(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = req.admin.id;

      console.log('🔴 Rejecting API access for user:', userId);

      if (!User) {
        return res.status(500).json({
          success: false,
          message: 'User model not available'
        });
      }

      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.apiAccessStatus !== 'pending_approval') {
        return res.status(400).json({
          success: false,
          message: 'No pending API access request for this user'
        });
      }

      // Reject API access
      user.apiAccessStatus = 'rejected';
      user.apiAccessRejectedAt = new Date();
      user.apiAccessRejectedBy = adminId;
      user.apiAccessRejectionReason = reason || 'Not specified';
      await user.save();

      console.log('✅ API access rejected for user:', userId);

      res.json({
        success: true,
        message: 'API access rejected',
        data: {
          userId: user._id,
          email: user.email,
          username: user.username,
          rejectedAt: user.apiAccessRejectedAt,
          reason: user.apiAccessRejectionReason
        }
      });

    } catch (error) {
      console.error('🔥 Reject API access error:', error);
      res.status(500).json({
        success: false,
        message: 'Error rejecting API access',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get all users (simplified)
  async getAllUsers(req, res) {
    try {
      const { page = 1, limit = 20, search, accountStatus, apiAccessStatus } = req.query;

      if (!User) {
        return res.status(500).json({
          success: false,
          message: 'User model not available'
        });
      }

      const query = {};
      
      if (accountStatus) query.accountStatus = accountStatus;
      if (apiAccessStatus) query.apiAccessStatus = apiAccessStatus;
      if (search) {
        query.$or = [
          { email: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (page - 1) * limit;
      const users = await User.find(query)
        .select('-password -resetPasswordToken -emailVerificationToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await User.countDocuments(query);

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      console.error('🔥 Get all users error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching users',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get user stats (simplified)
  async getUserStats(req, res) {
    try {
      if (!User) {
        return res.status(500).json({
          success: false,
          message: 'User model not available'
        });
      }

      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ accountStatus: 'active' });
      const pendingActivation = await User.countDocuments({ accountStatus: 'pending_activation' });
      const verifiedEmails = await User.countDocuments({ isEmailVerified: true });

      // API access stats
      const apiStats = {
        pending_approval: await User.countDocuments({ apiAccessStatus: 'pending_approval' }),
        approved: await User.countDocuments({ apiAccessStatus: 'approved' }),
        rejected: await User.countDocuments({ apiAccessStatus: 'rejected' }),
        revoked: await User.countDocuments({ apiAccessStatus: 'revoked' })
      };

      res.json({
        success: true,
        data: {
          userStats: {
            total: totalUsers,
            active: activeUsers,
            pendingActivation,
            verifiedEmails,
            activationRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0,
            verificationRate: totalUsers > 0 ? ((verifiedEmails / totalUsers) * 100).toFixed(2) : 0
          },
          apiAccessStats: apiStats
        }
      });

    } catch (error) {
      console.error('🔥 Get user stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching user statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = new AdminController();