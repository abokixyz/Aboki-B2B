const { User, Business } = require('../models');
const EmailService = require('../services/EmailService');

class AdminController {
  // Get users pending verification
  async getPendingUsers(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        sortBy = 'createdAt', 
        sortOrder = 'desc',
        search 
      } = req.query;

      const skip = (page - 1) * limit;
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Build search query
      let searchQuery = {
        verificationStatus: { $in: ['pending', undefined, null] },
        isApiEnabled: { $ne: true }
      };

      if (search) {
        searchQuery.$or = [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      // Get pending users with business info
      const users = await User.aggregate([
        { $match: searchQuery },
        {
          $lookup: {
            from: 'businesses',
            localField: '_id',
            foreignField: 'ownerId',
            as: 'business'
          }
        },
        {
          $addFields: {
            business: { $arrayElemAt: ['$business', 0] }
          }
        },
        { $sort: sortOptions },
        { $skip: skip },
        { $limit: parseInt(limit) },
        {
          $project: {
            password: 0,
            resetPasswordToken: 0,
            resetPasswordExpiry: 0,
            emailVerificationToken: 0
          }
        }
      ]);

      // Get total count for pagination
      const totalUsers = await User.countDocuments(searchQuery);
      const totalPages = Math.ceil(totalUsers / limit);

      // Get summary statistics
      const [totalPending, totalApproved, totalRejected, totalWithBusiness] = await Promise.all([
        User.countDocuments({ verificationStatus: { $in: ['pending', undefined, null] } }),
        User.countDocuments({ verificationStatus: 'approved' }),
        User.countDocuments({ verificationStatus: 'rejected' }),
        User.countDocuments({ 
          _id: { $in: await Business.distinct('ownerId') }
        })
      ]);

      res.json({
        success: true,
        data: {
          users: users.map(user => ({
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            phone: user.phone,
            isVerified: user.isVerified,
            isApiEnabled: user.isApiEnabled || false,
            verificationStatus: user.verificationStatus || 'pending',
            verifiedBy: user.verifiedBy,
            verifiedAt: user.verifiedAt,
            rejectionReason: user.rejectionReason,
            business: user.business ? {
              businessId: user.business.businessId,
              businessName: user.business.businessName,
              status: user.business.status,
              industry: user.business.industry,
              country: user.business.country
            } : null,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin
          })),
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalUsers,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            limit: parseInt(limit)
          },
          summary: {
            totalPending,
            totalApproved,
            totalRejected,
            totalWithBusiness
          }
        }
      });

    } catch (error) {
      console.error('Get pending users error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Verify user (approve or reject)
  async verifyUser(req, res) {
    try {
      const { userId } = req.params;
      const { action, reason, notes, enableApiAccess = true } = req.body;
      const adminId = req.admin.id;
      const adminName = req.admin.fullName;

      // Validation
      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Action must be either "approve" or "reject"'
        });
      }

      if (action === 'reject' && !reason) {
        return res.status(400).json({
          success: false,
          message: 'Reason is required for rejection'
        });
      }

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update user verification status
      const updateData = {
        verificationStatus: action === 'approve' ? 'approved' : 'rejected',
        verifiedBy: adminId,
        verifiedAt: new Date(),
        updatedAt: new Date()
      };

      if (action === 'approve') {
        updateData.isApiEnabled = enableApiAccess;
        updateData.isVerified = true;
      } else {
        updateData.rejectionReason = reason;
        updateData.isApiEnabled = false;
      }

      if (notes) {
        updateData.adminNotes = notes;
      }

      // Add to verification history
      const verificationRecord = {
        action: action === 'approve' ? 'approved' : 'rejected',
        adminId,
        adminName,
        timestamp: new Date(),
        reason: reason || (action === 'approve' ? 'Approved for API access' : undefined),
        notes
      };

      updateData.$push = {
        verificationHistory: verificationRecord
      };

      await User.findByIdAndUpdate(userId, updateData);

      // Send notification email
      let notificationSent = false;
      try {
        if (action === 'approve') {
          await EmailService.sendAccountApprovalEmail(user.fullName, user.email, enableApiAccess);
        } else {
          await EmailService.sendAccountRejectionEmail(user.fullName, user.email, reason);
        }
        notificationSent = true;
        console.log(`✅ ${action === 'approve' ? 'Approval' : 'Rejection'} email sent to ${user.email}`);
      } catch (emailError) {
        console.error('❌ Failed to send notification email:', emailError);
      }

      // Get updated user data
      const updatedUser = await User.findById(userId)
        .select('-password -resetPasswordToken -resetPasswordExpiry -emailVerificationToken')
        .lean();

      res.json({
        success: true,
        message: `User ${action === 'approve' ? 'approved for API access' : 'rejected'} successfully`,
        data: {
          user: {
            id: updatedUser._id,
            email: updatedUser.email,
            fullName: updatedUser.fullName,
            phone: updatedUser.phone,
            isVerified: updatedUser.isVerified,
            isApiEnabled: updatedUser.isApiEnabled || false,
            verificationStatus: updatedUser.verificationStatus,
            verifiedBy: updatedUser.verifiedBy,
            verifiedAt: updatedUser.verifiedAt,
            rejectionReason: updatedUser.rejectionReason,
            createdAt: updatedUser.createdAt,
            lastLogin: updatedUser.lastLogin
          },
          notificationSent,
          verificationHistory: verificationRecord
        }
      });

    } catch (error) {
      console.error('Verify user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Toggle API access for verified user
  async toggleApiAccess(req, res) {
    try {
      const { userId } = req.params;
      const { enableAccess, reason } = req.body;
      const adminId = req.admin.id;
      const adminName = req.admin.fullName;

      if (typeof enableAccess !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'enableAccess must be a boolean value'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Only allow API access changes for approved users
      if (user.verificationStatus !== 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Can only modify API access for approved users'
        });
      }

      // Update API access
      const verificationRecord = {
        action: enableAccess ? 'enabled_api' : 'disabled_api',
        adminId,
        adminName,
        timestamp: new Date(),
        reason: reason || `API access ${enableAccess ? 'enabled' : 'disabled'} by admin`
      };

      await User.findByIdAndUpdate(userId, {
        isApiEnabled: enableAccess,
        updatedAt: new Date(),
        $push: {
          verificationHistory: verificationRecord
        }
      });

      // Send notification email
      let notificationSent = false;
      try {
        await EmailService.sendApiAccessChangeEmail(
          user.fullName, 
          user.email, 
          enableAccess, 
          reason
        );
        notificationSent = true;
      } catch (emailError) {
        console.error('❌ Failed to send API access notification:', emailError);
      }

      res.json({
        success: true,
        message: `API access ${enableAccess ? 'enabled' : 'disabled'} successfully`,
        data: {
          userId,
          isApiEnabled: enableAccess,
          reason,
          notificationSent,
          updatedAt: new Date()
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

  // Get verified users
  async getVerifiedUsers(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        status, 
        apiAccess,
        search 
      } = req.query;

      const skip = (page - 1) * limit;

      // Build query
      let query = {
        verificationStatus: { $exists: true, $ne: 'pending' }
      };

      if (status) {
        query.verificationStatus = status;
      }

      if (typeof apiAccess === 'string') {
        query.isApiEnabled = apiAccess === 'true';
      }

      if (search) {
        query.$or = [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      // Get users with business info
      const users = await User.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'businesses',
            localField: '_id',
            foreignField: 'ownerId',
            as: 'business'
          }
        },
        {
          $addFields: {
            business: { $arrayElemAt: ['$business', 0] }
          }
        },
        { $sort: { verifiedAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },
        {
          $project: {
            password: 0,
            resetPasswordToken: 0,
            resetPasswordExpiry: 0,
            emailVerificationToken: 0
          }
        }
      ]);

      const totalUsers = await User.countDocuments(query);
      const totalPages = Math.ceil(totalUsers / limit);

      res.json({
        success: true,
        data: {
          users: users.map(user => ({
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            phone: user.phone,
            isVerified: user.isVerified,
            isApiEnabled: user.isApiEnabled || false,
            verificationStatus: user.verificationStatus,
            verifiedBy: user.verifiedBy,
            verifiedAt: user.verifiedAt,
            rejectionReason: user.rejectionReason,
            business: user.business ? {
              businessId: user.business.businessId,
              businessName: user.business.businessName,
              status: user.business.status,
              industry: user.business.industry,
              country: user.business.country
            } : null,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin
          })),
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalUsers,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            limit: parseInt(limit)
          },
          filters: {
            appliedFilters: { status, apiAccess, search },
            totalMatching: totalUsers
          }
        }
      });

    } catch (error) {
      console.error('Get verified users error:', error);
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

      // Get user with business info
      const userAggregate = await User.aggregate([
        { $match: { _id: require('mongoose').Types.ObjectId(userId) } },
        {
          $lookup: {
            from: 'businesses',
            localField: '_id',
            foreignField: 'ownerId',
            as: 'business'
          }
        },
        {
          $addFields: {
            business: { $arrayElemAt: ['$business', 0] }
          }
        },
        {
          $project: {
            password: 0,
            resetPasswordToken: 0,
            resetPasswordExpiry: 0,
            emailVerificationToken: 0
          }
        }
      ]);

      if (!userAggregate || userAggregate.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = userAggregate[0];

      // Get API usage statistics (you'd implement this based on your API logging)
      const apiUsage = {
        totalRequests: 0, // Implement based on your API logging system
        lastApiCall: null,
        isActive: user.isApiEnabled || false
      };

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            phone: user.phone,
            isVerified: user.isVerified,
            isApiEnabled: user.isApiEnabled || false,
            verificationStatus: user.verificationStatus || 'pending',
            verifiedBy: user.verifiedBy,
            verifiedAt: user.verifiedAt,
            rejectionReason: user.rejectionReason,
            adminNotes: user.adminNotes,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin
          },
          business: user.business || null,
          verificationHistory: user.verificationHistory || [],
          apiUsage
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

  // Get dashboard statistics
  async getDashboardStats(req, res) {
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get user statistics
      const [
        totalUsers,
        pendingUsers,
        approvedUsers,
        rejectedUsers,
        usersWithApiAccess,
        newUsersThisWeek
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ verificationStatus: { $in: ['pending', undefined, null] } }),
        User.countDocuments({ verificationStatus: 'approved' }),
        User.countDocuments({ verificationStatus: 'rejected' }),
        User.countDocuments({ isApiEnabled: true }),
        User.countDocuments({ createdAt: { $gte: weekAgo } })
      ]);

      // Get business statistics
      const [
        totalBusinesses,
        verifiedBusinesses,
        pendingBusinesses,
        activeBusinesses
      ] = await Promise.all([
        Business.countDocuments(),
        Business.countDocuments({ status: 'verified' }),
        Business.countDocuments({ status: 'pending_verification' }),
        Business.countDocuments({ status: { $nin: ['deleted', 'suspended'] } })
      ]);

      // Get recent pending users
      const recentPendingUsers = await User.find({
        verificationStatus: { $in: ['pending', undefined, null] }
      })
      .select('fullName email createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

      // Get recent verifications
      const recentVerifications = await User.find({
        verificationStatus: { $in: ['approved', 'rejected'] },
        verifiedAt: { $exists: true }
      })
      .select('fullName email verificationStatus verifiedAt')
      .sort({ verifiedAt: -1 })
      .limit(5)
      .lean();

      res.json({
        success: true,
        data: {
          users: {
            total: totalUsers,
            pending: pendingUsers,
            approved: approvedUsers,
            rejected: rejectedUsers,
            withApiAccess: usersWithApiAccess,
            newThisWeek: newUsersThisWeek
          },
          businesses: {
            total: totalBusinesses,
            verified: verifiedBusinesses,
            pending: pendingBusinesses,
            active: activeBusinesses
          },
          apiUsage: {
            totalRequests: 0, // Implement based on your API logging
            requestsToday: 0,  // Implement based on your API logging
            activeApiKeys: usersWithApiAccess
          },
          recent: {
            pendingUsers: recentPendingUsers.map(user => ({
              id: user._id,
              fullName: user.fullName,
              email: user.email,
              createdAt: user.createdAt
            })),
            recentVerifications: recentVerifications.map(user => ({
              id: user._id,
              fullName: user.fullName,
              email: user.email,
              status: user.verificationStatus,
              verifiedAt: user.verifiedAt
            }))
          }
        }
      });

    } catch (error) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Bulk verify users
  async bulkVerifyUsers(req, res) {
    try {
      const { userIds, action, reason, enableApiAccess = true } = req.body;
      const adminId = req.admin.id;
      const adminName = req.admin.fullName;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'userIds must be a non-empty array'
        });
      }

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Action must be either "approve" or "reject"'
        });
      }

      const results = [];
      let successful = 0;
      let failed = 0;

      for (const userId of userIds) {
        try {
          const user = await User.findById(userId);
          if (!user) {
            results.push({
              userId,
              status: 'failed',
              error: 'User not found'
            });
            failed++;
            continue;
          }

          // Update user
          const updateData = {
            verificationStatus: action === 'approve' ? 'approved' : 'rejected',
            verifiedBy: adminId,
            verifiedAt: new Date(),
            updatedAt: new Date()
          };

          if (action === 'approve') {
            updateData.isApiEnabled = enableApiAccess;
            updateData.isVerified = true;
          } else {
            updateData.rejectionReason = reason;
            updateData.isApiEnabled = false;
          }

          const verificationRecord = {
            action: action === 'approve' ? 'approved' : 'rejected',
            adminId,
            adminName,
            timestamp: new Date(),
            reason: reason || (action === 'approve' ? 'Bulk approval' : 'Bulk rejection'),
            notes: 'Bulk operation'
          };

          updateData.$push = {
            verificationHistory: verificationRecord
          };

          await User.findByIdAndUpdate(userId, updateData);

          // Send email notification
          try {
            if (action === 'approve') {
              await EmailService.sendAccountApprovalEmail(user.fullName, user.email, enableApiAccess);
            } else {
              await EmailService.sendAccountRejectionEmail(user.fullName, user.email, reason);
            }
          } catch (emailError) {
            console.error(`Failed to send email to ${user.email}:`, emailError);
          }

          results.push({
            userId,
            status: 'success',
            action
          });
          successful++;

        } catch (error) {
          results.push({
            userId,
            status: 'failed',
            error: error.message
          });
          failed++;
        }
      }

      res.json({
        success: true,
        message: `Bulk verification completed: ${successful} successful, ${failed} failed`,
        data: {
          processed: userIds.length,
          successful,
          failed,
          results
        }
      });

    } catch (error) {
      console.error('Bulk verify users error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get verification history
  async getVerificationHistory(req, res) {
    try {
      const { 
        page = 1, 
        limit = 50, 
        adminId, 
        action, 
        dateFrom, 
        dateTo 
      } = req.query;

      const skip = (page - 1) * limit;

      // Build aggregation pipeline
      const pipeline = [
        { $unwind: '$verificationHistory' },
        {
          $project: {
            _id: '$verificationHistory._id',
            userId: '$_id',
            userEmail: '$email',
            userFullName: '$fullName',
            action: '$verificationHistory.action',
            adminId: '$verificationHistory.adminId',
            adminName: '$verificationHistory.adminName',
            timestamp: '$verificationHistory.timestamp',
            reason: '$verificationHistory.reason',
            notes: '$verificationHistory.notes'
          }
        }
      ];

      // Add filters
      const matchStage = {};
      if (adminId) matchStage['adminId'] = adminId;
      if (action) matchStage['action'] = action;
      if (dateFrom || dateTo) {
        matchStage['timestamp'] = {};
        if (dateFrom) matchStage['timestamp'].$gte = new Date(dateFrom);
        if (dateTo) matchStage['timestamp'].$lte = new Date(dateTo);
      }

      if (Object.keys(matchStage).length > 0) {
        pipeline.push({ $match: matchStage });
      }

      pipeline.push(
        { $sort: { timestamp: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) }
      );

      const history = await User.aggregate(pipeline);

      // Get total count
      const countPipeline = [
        { $unwind: '$verificationHistory' },
        {
          $project: {
            action: '$verificationHistory.action',
            adminId: '$verificationHistory.adminId',
            timestamp: '$verificationHistory.timestamp'
          }
        }
      ];

      if (Object.keys(matchStage).length > 0) {
        countPipeline.push({ $match: matchStage });
      }

      countPipeline.push({ $count: 'total' });

      const countResult = await User.aggregate(countPipeline);
      const totalRecords = countResult[0]?.total || 0;
      const totalPages = Math.ceil(totalRecords / limit);

      res.json({
        success: true,
        data: {
          history,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalRecords,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            limit: parseInt(limit)
          },
          filters: {
            adminId,
            action,
            dateFrom,
            dateTo
          }
        }
      });

    } catch (error) {
      console.error('Get verification history error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = new AdminController();