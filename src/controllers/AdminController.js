const { User, Business } = require('../models');

class AdminController {
  // Middleware to check if user is admin
  static async checkAdminRole(req, res, next) {
    try {
      const userId = req.user.id;
      
      const user = await User.findById(userId).select('role isAdmin');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if user has admin privileges
      if (!user.isAdmin && user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      req.adminInfo = {
        adminId: userId,
        role: user.role,
        isAdmin: user.isAdmin
      };

      next();
    } catch (error) {
      console.error('Admin role check error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking admin privileges'
      });
    }
  }

  // Get all pending user activations
  async getPendingActivations(req, res) {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
      
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

      // Find users pending activation
      const pendingUsers = await User.find({
        $or: [
          { isAccountActivated: { $ne: true } },
          { accountStatus: { $nin: ['active', 'suspended', 'banned'] } },
          { accountStatus: { $exists: false } }
        ]
      })
      .select('_id email username fullName createdAt accountStatus isAccountActivated registrationIP lastLoginAt')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

      // Get total count for pagination
      const totalCount = await User.countDocuments({
        $or: [
          { isAccountActivated: { $ne: true } },
          { accountStatus: { $nin: ['active', 'suspended', 'banned'] } },
          { accountStatus: { $exists: false } }
        ]
      });

      const totalPages = Math.ceil(totalCount / parseInt(limit));

      res.json({
        success: true,
        data: {
          users: pendingUsers,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount,
            hasNext: parseInt(page) < totalPages,
            hasPrev: parseInt(page) > 1
          }
        },
        message: `Found ${pendingUsers.length} users pending activation`
      });

    } catch (error) {
      console.error('Get pending activations error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving pending activations'
      });
    }
  }

  // Get all users with their activation status
  async getAllUsers(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        sortBy = 'createdAt', 
        sortOrder = 'desc',
        status = 'all',
        search = ''
      } = req.query;
      
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

      // Build query
      let query = {};
      
      // Filter by activation status
      if (status === 'pending') {
        query = {
          $or: [
            { isAccountActivated: { $ne: true } },
            { accountStatus: { $nin: ['active', 'suspended', 'banned'] } },
            { accountStatus: { $exists: false } }
          ]
        };
      } else if (status === 'active') {
        query = {
          isAccountActivated: true,
          accountStatus: 'active'
        };
      } else if (status === 'suspended') {
        query = { accountStatus: 'suspended' };
      } else if (status === 'banned') {
        query = { accountStatus: 'banned' };
      }

      // Add search functionality
      if (search.trim()) {
        const searchRegex = new RegExp(search.trim(), 'i');
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { email: searchRegex },
            { username: searchRegex },
            { fullName: searchRegex }
          ]
        });
      }

      const users = await User.find(query)
        .select('_id email username fullName createdAt accountStatus isAccountActivated activatedAt activatedBy registrationIP lastLoginAt role')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit));

      // Get total count for pagination
      const totalCount = await User.countDocuments(query);
      const totalPages = Math.ceil(totalCount / parseInt(limit));

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount,
            hasNext: parseInt(page) < totalPages,
            hasPrev: parseInt(page) > 1
          },
          filters: {
            status,
            search
          }
        }
      });

    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving users'
      });
    }
  }

  // Activate a user account
  async activateUser(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = req.adminInfo.adminId;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if user is already activated
      if (user.isAccountActivated && user.accountStatus === 'active') {
        return res.status(400).json({
          success: false,
          message: 'User account is already activated'
        });
      }

      // Activate the user
      user.isAccountActivated = true;
      user.accountStatus = 'active';
      user.activatedAt = new Date();
      user.activatedBy = adminId;
      user.activationReason = reason || 'Account approved by admin';
      user.updatedAt = new Date();

      await user.save();

      // Log admin action
      console.log(`Admin ${adminId} activated user ${userId} - ${user.email}`);

      res.json({
        success: true,
        message: 'User account activated successfully',
        data: {
          userId: user._id,
          email: user.email,
          username: user.username,
          activatedAt: user.activatedAt,
          activatedBy: adminId,
          accountStatus: user.accountStatus,
          reason: user.activationReason
        }
      });

    } catch (error) {
      console.error('Activate user error:', error);
      res.status(500).json({
        success: false,
        message: 'Error activating user account'
      });
    }
  }

  // Suspend a user account
  async suspendUser(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = req.adminInfo.adminId;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Suspension reason is required'
        });
      }

      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if user is already suspended
      if (user.accountStatus === 'suspended') {
        return res.status(400).json({
          success: false,
          message: 'User account is already suspended'
        });
      }

      // Suspend the user
      user.accountStatus = 'suspended';
      user.suspendedAt = new Date();
      user.suspendedBy = adminId;
      user.suspensionReason = reason.trim();
      user.updatedAt = new Date();

      await user.save();

      // Log admin action
      console.log(`Admin ${adminId} suspended user ${userId} - ${user.email} - Reason: ${reason}`);

      res.json({
        success: true,
        message: 'User account suspended successfully',
        data: {
          userId: user._id,
          email: user.email,
          username: user.username,
          suspendedAt: user.suspendedAt,
          suspendedBy: adminId,
          accountStatus: user.accountStatus,
          reason: user.suspensionReason
        }
      });

    } catch (error) {
      console.error('Suspend user error:', error);
      res.status(500).json({
        success: false,
        message: 'Error suspending user account'
      });
    }
  }

  // Reactivate a suspended user account
  async reactivateUser(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = req.adminInfo.adminId;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if user is suspended
      if (user.accountStatus !== 'suspended') {
        return res.status(400).json({
          success: false,
          message: 'User account is not suspended'
        });
      }

      // Reactivate the user
      user.accountStatus = 'active';
      user.isAccountActivated = true;
      user.reactivatedAt = new Date();
      user.reactivatedBy = adminId;
      user.reactivationReason = reason || 'Account reactivated by admin';
      user.updatedAt = new Date();

      await user.save();

      // Log admin action
      console.log(`Admin ${adminId} reactivated user ${userId} - ${user.email}`);

      res.json({
        success: true,
        message: 'User account reactivated successfully',
        data: {
          userId: user._id,
          email: user.email,
          username: user.username,
          reactivatedAt: user.reactivatedAt,
          reactivatedBy: adminId,
          accountStatus: user.accountStatus,
          reason: user.reactivationReason
        }
      });

    } catch (error) {
      console.error('Reactivate user error:', error);
      res.status(500).json({
        success: false,
        message: 'Error reactivating user account'
      });
    }
  }

  // Bulk activate multiple users
  async bulkActivateUsers(req, res) {
    try {
      const { userIds, reason } = req.body;
      const adminId = req.adminInfo.adminId;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User IDs array is required'
        });
      }

      if (userIds.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Cannot activate more than 50 users at once'
        });
      }

      const users = await User.find({
        _id: { $in: userIds },
        $or: [
          { isAccountActivated: { $ne: true } },
          { accountStatus: { $nin: ['active', 'suspended', 'banned'] } }
        ]
      });

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No eligible users found for activation'
        });
      }

      // Update all users
      const bulkOps = users.map(user => ({
        updateOne: {
          filter: { _id: user._id },
          update: {
            $set: {
              isAccountActivated: true,
              accountStatus: 'active',
              activatedAt: new Date(),
              activatedBy: adminId,
              activationReason: reason || 'Bulk activation by admin',
              updatedAt: new Date()
            }
          }
        }
      }));

      const result = await User.bulkWrite(bulkOps);

      // Log admin action
      console.log(`Admin ${adminId} bulk activated ${result.modifiedCount} users`);

      res.json({
        success: true,
        message: `Successfully activated ${result.modifiedCount} user accounts`,
        data: {
          activatedCount: result.modifiedCount,
          requestedCount: userIds.length,
          activatedBy: adminId,
          reason: reason || 'Bulk activation by admin'
        }
      });

    } catch (error) {
      console.error('Bulk activate users error:', error);
      res.status(500).json({
        success: false,
        message: 'Error during bulk user activation'
      });
    }
  }

  // Get user details with businesses
  async getUserDetails(req, res) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const user = await User.findById(userId)
        .select('-password -__v')
        .lean();
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get user's businesses
      const businesses = await Business.find({ ownerId: userId })
        .select('businessId businessName businessType industry status createdAt')
        .lean();

      res.json({
        success: true,
        data: {
          user,
          businesses,
          businessCount: businesses.length
        }
      });

    } catch (error) {
      console.error('Get user details error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving user details'
      });
    }
  }

  // Get activation statistics
  async getActivationStats(req, res) {
    try {
      const stats = await User.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            activeUsers: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$isAccountActivated', true] }, { $eq: ['$accountStatus', 'active'] }] },
                  1,
                  0
                ]
              }
            },
            pendingUsers: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $ne: ['$isAccountActivated', true] },
                      { $not: { $in: ['$accountStatus', ['active', 'suspended', 'banned']] } }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            suspendedUsers: {
              $sum: {
                $cond: [{ $eq: ['$accountStatus', 'suspended'] }, 1, 0]
              }
            },
            bannedUsers: {
              $sum: {
                $cond: [{ $eq: ['$accountStatus', 'banned'] }, 1, 0]
              }
            }
          }
        }
      ]);

      // Get recent activations (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentActivations = await User.countDocuments({
        activatedAt: { $gte: sevenDaysAgo }
      });

      // Get pending users count by registration date
      const pendingByDate = await User.aggregate([
        {
          $match: {
            $or: [
              { isAccountActivated: { $ne: true } },
              { accountStatus: { $not: { $in: ['active', 'suspended', 'banned'] } } }
            ]
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: -1 } },
        { $limit: 7 }
      ]);

      const result = stats[0] || {
        totalUsers: 0,
        activeUsers: 0,
        pendingUsers: 0,
        suspendedUsers: 0,
        bannedUsers: 0
      };

      res.json({
        success: true,
        data: {
          overview: result,
          recentActivations,
          pendingByDate: pendingByDate.reverse()
        }
      });

    } catch (error) {
      console.error('Get activation stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving activation statistics'
      });
    }
  }
}

module.exports = new AdminController();