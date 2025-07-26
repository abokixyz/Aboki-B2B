const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Admin Schema for managing user approvals and system administration
const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  
  // Admin profile
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  
  // Admin role and permissions
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'moderator', 'support'],
    default: 'admin',
    index: true
  },
  
  permissions: [{
    type: String,
    enum: [
      'user_management',
      'business_management', 
      'api_key_management',
      'system_settings',
      'audit_logs',
      'financial_management',
      'support_tickets',
      'content_moderation'
    ]
  }],
  
  // Admin status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
    index: true
  },
  
  // Department and team
  department: {
    type: String,
    enum: ['operations', 'compliance', 'support', 'security', 'finance'],
    required: true
  },
  
  // Contact information
  phoneNumber: String,
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  
  // Security settings
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: String,
  lastPasswordChange: {
    type: Date,
    default: Date.now
  },
  
  // Activity tracking
  lastLoginAt: Date,
  lastActiveAt: Date,
  loginCount: {
    type: Number,
    default: 0
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockedUntil: Date,
  
  // Admin statistics
  stats: {
    usersApproved: {
      type: Number,
      default: 0
    },
    apiAccessApprovals: {
      type: Number,
      default: 0
    },
    businessesReviewed: {
      type: Number,
      default: 0
    },
    ticketsResolved: {
      type: Number,
      default: 0
    }
  },
  
  // Approval history tracking
  approvalHistory: [{
    action: {
      type: String,
      enum: ['user_activation', 'api_access_approval', 'api_access_rejection', 'api_access_revocation', 'business_verification', 'account_suspension']
    },
    targetId: mongoose.Schema.Types.ObjectId,
    targetType: {
      type: String,
      enum: ['User', 'Business', 'ApiKey']
    },
    reason: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Work schedule and availability
  workSchedule: {
    timezone: {
      type: String,
      default: 'UTC'
    },
    workingHours: {
      start: {
        type: String,
        default: '09:00'
      },
      end: {
        type: String,
        default: '17:00'
      }
    },
    workingDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    }]
  },
  
  // Admin notes and comments
  notes: {
    type: String,
    maxlength: 1000
  },
  
  // Created and managed by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient querying
adminSchema.index({ email: 1 });
adminSchema.index({ role: 1, isActive: 1 });
adminSchema.index({ department: 1, status: 1 });
adminSchema.index({ lastActiveAt: -1 });
adminSchema.index({ 'stats.usersApproved': -1 });

// Pre-save middleware
adminSchema.pre('save', async function(next) {
  this.updatedAt = new Date();
  
  // Hash password if modified
  if (this.isModified('password')) {
    try {
      const saltRounds = 12;
      this.password = await bcrypt.hash(this.password, saltRounds);
      this.lastPasswordChange = new Date();
    } catch (error) {
      return next(error);
    }
  }
  
  next();
});

// Virtual to get full name
adminSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual to check if account is locked
adminSchema.virtual('isLocked').get(function() {
  return this.lockedUntil && this.lockedUntil > Date.now();
});

// Virtual to get admin summary
adminSchema.virtual('adminSummary').get(function() {
  return {
    name: this.fullName,
    role: this.role,
    department: this.department,
    isActive: this.isActive && this.status === 'active' && !this.isLocked,
    totalApprovals: this.stats.usersApproved + this.stats.apiAccessApprovals,
    lastActive: this.lastActiveAt
  };
});

// Ensure virtual fields are serialized
adminSchema.set('toJSON', { virtuals: true });
adminSchema.set('toObject', { virtuals: true });

// Instance method to compare password
adminSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Instance method to check permission
adminSchema.methods.hasPermission = function(permission) {
  if (this.role === 'super_admin') return true;
  return this.permissions.includes(permission);
};

// Instance method to check if can approve users
adminSchema.methods.canApproveUsers = function() {
  return this.hasPermission('user_management') && this.isActive && this.status === 'active';
};

// Instance method to check if can manage API access
adminSchema.methods.canManageApiAccess = function() {
  return this.hasPermission('api_key_management') && this.isActive && this.status === 'active';
};

// Instance method to update activity
adminSchema.methods.updateActivity = function() {
  this.lastActiveAt = new Date();
  return this.save();
};

// Instance method to update login tracking
adminSchema.methods.updateLoginTracking = function(isSuccessful = true) {
  if (isSuccessful) {
    this.lastLoginAt = new Date();
    this.lastActiveAt = new Date();
    this.loginCount += 1;
    this.failedLoginAttempts = 0;
  } else {
    this.failedLoginAttempts += 1;
    
    // Lock account after 5 failed attempts
    if (this.failedLoginAttempts >= 5) {
      this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }
  }
  
  return this.save();
};

// Instance method to record approval action
adminSchema.methods.recordApproval = function(action, targetId, targetType, reason = '') {
  this.approvalHistory.push({
    action,
    targetId,
    targetType,
    reason,
    timestamp: new Date()
  });
  
  // Update stats
  switch (action) {
    case 'user_activation':
      this.stats.usersApproved += 1;
      break;
    case 'api_access_approval':
    case 'api_access_rejection':
    case 'api_access_revocation':
      this.stats.apiAccessApprovals += 1;
      break;
    case 'business_verification':
      this.stats.businessesReviewed += 1;
      break;
  }
  
  return this.save();
};

// Instance method to unlock account
adminSchema.methods.unlock = function() {
  this.failedLoginAttempts = 0;
  this.lockedUntil = undefined;
  return this.save();
};

// Static method to find admins by role
adminSchema.statics.findByRole = function(role) {
  return this.find({ role, isActive: true, status: 'active' });
};

// Static method to find admins by department
adminSchema.statics.findByDepartment = function(department) {
  return this.find({ department, isActive: true, status: 'active' });
};

// Static method to find admins with permission
adminSchema.statics.findWithPermission = function(permission) {
  return this.find({
    $or: [
      { role: 'super_admin' },
      { permissions: permission }
    ],
    isActive: true,
    status: 'active'
  });
};

// Static method to get admin statistics
adminSchema.statics.getAdminStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalAdmins: { $sum: 1 },
        activeAdmins: {
          $sum: { $cond: [{ $and: [{ $eq: ['$isActive', true] }, { $eq: ['$status', 'active'] }] }, 1, 0] }
        },
        totalUserApprovals: { $sum: '$stats.usersApproved' },
        totalApiApprovals: { $sum: '$stats.apiAccessApprovals' },
        totalBusinessReviews: { $sum: '$stats.businessesReviewed' }
      }
    }
  ]);
  
  const roleStats = await this.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const departmentStats = await this.aggregate([
    {
      $group: {
        _id: '$department',
        count: { $sum: 1 }
      }
    }
  ]);
  
  return {
    overview: stats[0] || {
      totalAdmins: 0,
      activeAdmins: 0,
      totalUserApprovals: 0,
      totalApiApprovals: 0,
      totalBusinessReviews: 0
    },
    byRole: roleStats,
    byDepartment: departmentStats
  };
};

// Static method to find top performing admins
adminSchema.statics.findTopPerformers = function(limit = 10) {
  return this.find({ isActive: true, status: 'active' })
    .sort({
      'stats.usersApproved': -1,
      'stats.apiAccessApprovals': -1,
      'stats.businessesReviewed': -1
    })
    .limit(limit)
    .select('firstName lastName role department stats lastActiveAt');
};

// Static method to find inactive admins
adminSchema.statics.findInactiveAdmins = function(daysInactive = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive);
  
  return this.find({
    isActive: true,
    status: 'active',
    $or: [
      { lastActiveAt: { $lt: cutoffDate } },
      { lastActiveAt: { $exists: false } }
    ]
  });
};

module.exports = mongoose.model('Admin', adminSchema);