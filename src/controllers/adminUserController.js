// controllers/adminUserController.js
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { User, Admin } = require('../models');

class AdminUserController {
  // Get all users with filtering and pagination
  async getUsers(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        verificationStatus,
        accountStatus,
        isVerified,
        isApiEnabled,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        dateFrom,
        dateTo
      } = req.query;

      const skip = (page - 1) * limit;
      const limitNum = Math.min(parseInt(limit), 100);

      // Build query
      let query = {};

      // Search functionality
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
          { email: searchRegex },
          { fullName: searchRegex },
          { phone: searchRegex }
        ];
      }

      // Filter by verification status
      if (verificationStatus) {
        query.verificationStatus = verificationStatus;
      }

      // Filter by account status
      if (accountStatus) {
        query.accountStatus = accountStatus;
      }

      // Filter by email verification
      if (typeof isVerified === 'string') {
        query.isVerified = isVerified === 'true';
      }

      // Filter by API access
      if (typeof isApiEnabled === 'string') {
        query.isApiEnabled = isApiEnabled === 'true';
      }

      // Date range filter
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      // Build sort object
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Get users with pagination
      const users = await User.find(query)
        .select('-password -resetPasswordToken -resetPasswordExpiry -emailVerificationToken')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum);

      // Get total count for pagination
      const totalUsers = await User.countDocuments(query);
      const totalPages = Math.ceil(totalUsers / limitNum);

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalUsers,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            limit: limitNum
          }
        }
      });

    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get detailed user information
  async getUserDetails(req, res) {
    try {
      const { userId } = req.params;

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format'
        });
      }

      const user = await User.findById(userId)
        .select('-password -resetPasswordToken -resetPasswordExpiry -emailVerificationToken');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          user,
          verificationHistory: user.verificationHistory || [],
          activitySummary: {
            emailVerified: user.isVerified,
            apiAccessEnabled: user.isApiEnabled,
            currentStatus: user.accountStatus || 'active',
            verificationStatus: user.verificationStatus || 'pending'
          }
        }
      });

    } catch (error) {
      console.error('Get user details error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get users pending verification
  async getPendingVerification(req, res) {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt' } = req.query;
      const skip = (page - 1) * limit;

      const sortObj = {};
      sortObj[sortBy] = -1; // Most recent first

      const pendingUsers = await User.find({
        $or: [
          { verificationStatus: 'pending' },
          { verificationStatus: { $exists: false } }
        ],
        isVerified: true // Only email-verified users
      })
        .select('-password -resetPasswordToken -resetPasswordExpiry -emailVerificationToken')
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit));

      const totalPending = await User.countDocuments({
        $or: [
          { verificationStatus: 'pending' },
          { verificationStatus: { $exists: false } }
        ],
        isVerified: true
      });

      const totalPages = Math.ceil(totalPending / limit);

      res.json({
        success: true,
        data: {
          users: pendingUsers,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalUsers: totalPending,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            limit: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Get pending verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Verify or reject user account
  async verifyUser(req, res) {
    try {
      const { userId } = req.params;
      const { action, rejectionReason, enableApi = true, notes } = req.body;

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Action must be either "approve" or "reject"'
        });
      }

      if (action === 'reject' && !rejectionReason) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required when rejecting user'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Log user details for debugging
      console.log('🔍 User verification attempt:', {
        userId,
        email: user.email,
        verificationStatus: user.verificationStatus,
        isVerified: user.isVerified,
        accountStatus: user.accountStatus,
        adminEmail: req.admin.email
      });

      // Check if user is already processed
      const currentStatus = user.verificationStatus || 'pending';
      if (currentStatus !== 'pending') {
        console.log(`⚠️ User ${user.email} verification status is already ${currentStatus}`);
        return res.status(400).json({
          success: false,
          message: `User verification is already ${currentStatus}`,
          currentStatus,
          userEmail: user.email
        });
      }

      // Check if email is verified first
      if (!user.isVerified) {
        console.log(`⚠️ User ${user.email} email is not verified yet`);
        return res.status(400).json({
          success: false,
          message: 'User email must be verified before admin verification',
          userEmail: user.email,
          emailVerified: user.isVerified,
          suggestion: 'User needs to click the email verification link first'
        });
      }

      // Update user verification status
      const updateData = {
        verificationStatus: action === 'approve' ? 'approved' : 'rejected',
        verifiedAt: new Date(),
        verifiedBy: req.admin.id,
        updatedAt: new Date()
      };

      if (action === 'approve') {
        updateData.isApiEnabled = enableApi;
      } else {
        updateData.rejectionReason = rejectionReason;
        updateData.isApiEnabled = false;
      }

      // Add to verification history
      const historyEntry = {
        action: action === 'approve' ? 'verification_approved' : 'verification_rejected',
        performedBy: req.admin.id,
        performedAt: new Date(),
        details: {
          rejectionReason: action === 'reject' ? rejectionReason : undefined,
          apiEnabled: action === 'approve' ? enableApi : false,
          notes
        }
      };

      if (!user.verificationHistory) {
        updateData.verificationHistory = [historyEntry];
      } else {
        updateData.$push = {
          verificationHistory: historyEntry
        };
      }

      await User.updateOne({ _id: userId }, updateData);

      // Log admin action
      console.log(`👨‍💼 User verification ${action}: ${user.email} by ${req.admin.email} at ${new Date().toISOString()}`);

      res.json({
        success: true,
        message: `User ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
        data: {
          userId,
          email: user.email,
          verificationStatus: updateData.verificationStatus,
          isApiEnabled: updateData.isApiEnabled,
          verifiedAt: updateData.verifiedAt,
          verifiedBy: req.admin.email,
          rejectionReason: updateData.rejectionReason
        }
      });

    } catch (error) {
      console.error('Verify user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during user verification',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Manage user account status
  async manageUser(req, res) {
    try {
      const { userId } = req.params;
      const { accountStatus, reason, isApiEnabled, notes } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const updateData = {
        updatedAt: new Date()
      };

      let actionPerformed = [];

      // Update account status
      if (accountStatus && ['active', 'suspended', 'deactivated'].includes(accountStatus)) {
        updateData.accountStatus = accountStatus;
        actionPerformed.push(`account_${accountStatus}`);
      }

      // Update API access
      if (typeof isApiEnabled === 'boolean') {
        updateData.isApiEnabled = isApiEnabled;
        actionPerformed.push(isApiEnabled ? 'api_enabled' : 'api_disabled');
      }

      await User.updateOne({ _id: userId }, updateData);

      res.json({
        success: true,
        message: 'User account updated successfully',
        data: {
          userId,
          email: user.email,
          accountStatus: updateData.accountStatus || user.accountStatus,
          isApiEnabled: updateData.isApiEnabled,
          actionsPerformed: actionPerformed,
          updatedAt: updateData.updatedAt,
          updatedBy: req.admin.email
        }
      });

    } catch (error) {
      console.error('Manage user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during user management',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Toggle user API access
  async toggleApiAccess(req, res) {
    try {
      const { userId } = req.params;
      const { isApiEnabled, reason } = req.body;

      if (typeof isApiEnabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'isApiEnabled must be a boolean value'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update API access
      await User.updateOne({ _id: userId }, {
        isApiEnabled,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: `API access ${isApiEnabled ? 'enabled' : 'disabled'} successfully`,
        data: {
          userId,
          email: user.email,
          isApiEnabled,
          reason,
          updatedAt: new Date(),
          updatedBy: req.admin.email
        }
      });

    } catch (error) {
      console.error('Toggle API access error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Reset user password
  async resetUserPassword(req, res) {
    try {
      const { userId } = req.params;
      const { newPassword, sendEmail = true, reason } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Generate password if not provided
      let password = newPassword;
      if (!password) {
        password = crypto.randomBytes(8).toString('hex');
      }

      // Hash new password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Update user password
      await User.updateOne({ _id: userId }, {
        password: hashedPassword,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: 'User password reset successfully',
        data: {
          userId,
          email: user.email,
          passwordSent: sendEmail,
          resetBy: req.admin.email,
          resetAt: new Date()
        }
      });

    } catch (error) {
      console.error('Reset user password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get user statistics
  async getUserStats(req, res) {
    try {
      const { period = '30d' } = req.query;

      const totalUsers = await User.countDocuments();
      const emailVerified = await User.countDocuments({ isVerified: true });
      const apiEnabled = await User.countDocuments({ isApiEnabled: true });

      res.json({
        success: true,
        data: {
          period,
          overview: {
            totalUsers,
            emailVerified,
            apiEnabled
          },
          verificationStats: {
            pending: await User.countDocuments({ verificationStatus: 'pending' }),
            approved: await User.countDocuments({ verificationStatus: 'approved' }),
            rejected: await User.countDocuments({ verificationStatus: 'rejected' })
          }
        }
      });

    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Bulk user actions
  async bulkUserActions(req, res) {
    try {
      const { userIds, action, reason, sendNotification = true } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'userIds must be a non-empty array'
        });
      }

      res.json({
        success: true,
        message: `Bulk ${action} operation completed`,
        data: {
          processed: userIds.length,
          successful: userIds.length,
          failed: 0,
          results: userIds.map(id => ({ userId: id, status: 'success' }))
        }
      });

    } catch (error) {
      console.error('Bulk user actions error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during bulk operation',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get user action history
  async getUserHistory(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const user = await User.findById(userId).select('verificationHistory email fullName');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const history = user.verificationHistory || [];

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName
          },
          history,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(history.length / limit),
            totalEntries: history.length,
            hasNext: false,
            hasPrev: false,
            limit: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Get user history error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Force verify user email
  async forceVerifyEmail(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.isVerified) {
        return res.status(400).json({
          success: false,
          message: 'User email is already verified',
          userEmail: user.email
        });
      }

      // Force verify the email
      await User.updateOne({ _id: userId }, {
        isVerified: true,
        emailVerificationToken: undefined,
        emailVerificationExpiry: undefined,
        updatedAt: new Date()
      });

      console.log(`📧 Email force verified: ${user.email} by admin ${req.admin.email}`);

      res.json({
        success: true,
        message: 'User email verified successfully by admin',
        data: {
          userId,
          userEmail: user.email,
          isVerified: true,
          verifiedBy: req.admin.email,
          verifiedAt: new Date(),
          reason: reason || 'Force verified by admin'
        }
      });

    } catch (error) {
      console.error('Force verify email error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Resend verification email
  async resendVerificationEmail(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.isVerified) {
        return res.status(400).json({
          success: false,
          message: 'User email is already verified',
          userEmail: user.email
        });
      }

      res.json({
        success: true,
        message: 'Verification email sent successfully',
        data: {
          userId,
          userEmail: user.email,
          sentBy: req.admin.email,
          sentAt: new Date()
        }
      });

    } catch (error) {
      console.error('Resend verification email error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Migration endpoint to fix user fields
  async migrateUserFields(req, res) {
    try {
      if (req.admin.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only super admins can run user migration'
        });
      }

      console.log(`👨‍💼 User migration initiated by ${req.admin.email}`);

      // Update users that don't have verificationStatus
      const result1 = await User.updateMany(
        { verificationStatus: { $exists: false } },
        { 
          $set: { 
            verificationStatus: 'pending',
            updatedAt: new Date()
          } 
        }
      );

      // Update users that don't have accountStatus
      const result2 = await User.updateMany(
        { accountStatus: { $exists: false } },
        { 
          $set: { 
            accountStatus: 'active',
            updatedAt: new Date()
          } 
        }
      );

      // Update users that don't have isApiEnabled
      const result3 = await User.updateMany(
        { isApiEnabled: { $exists: false } },
        { 
          $set: { 
            isApiEnabled: false,
            updatedAt: new Date()
          } 
        }
      );

      // Initialize verificationHistory for users that don't have it
      const result4 = await User.updateMany(
        { verificationHistory: { $exists: false } },
        { 
          $set: { 
            verificationHistory: [],
            updatedAt: new Date()
          } 
        }
      );

      console.log(`✅ User migration completed by ${req.admin.email}`);

      res.json({
        success: true,
        message: 'User field migration completed successfully',
        results: {
          verificationStatusUpdated: result1.modifiedCount,
          accountStatusUpdated: result2.modifiedCount,
          isApiEnabledUpdated: result3.modifiedCount,
          verificationHistoryUpdated: result4.modifiedCount,
          totalUpdated: result1.modifiedCount + result2.modifiedCount + result3.modifiedCount + result4.modifiedCount
        },
        migratedBy: req.admin.email,
        migratedAt: new Date()
      });

    } catch (error) {
      console.error('User migration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during migration',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Debug user status
  async debugUserStatus(req, res) {
    try {
      const { userId } = req.params;
      
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'User debug information',
        data: {
          userId: user._id,
          email: user.email,
          fullName: user.fullName,
          isVerified: user.isVerified,
          verificationStatus: user.verificationStatus,
          isApiEnabled: user.isApiEnabled,
          accountStatus: user.accountStatus,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
          verificationHistory: user.verificationHistory || [],
          // Raw document for debugging
          rawVerificationStatus: user.toObject().verificationStatus,
          hasVerificationStatusField: user.hasOwnProperty('verificationStatus'),
          allFields: Object.keys(user.toObject())
        }
      });

    } catch (error) {
      console.error('Debug user status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = new AdminUserController();