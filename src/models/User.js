const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Enhanced User Schema with API access control
const userSchema = new mongoose.Schema({
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
    minlength: 6
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  dateOfBirth: Date,
  country: {
    type: String,
    trim: true
  },
  
  // EXISTING: Account activation fields
  isAccountActivated: {
    type: Boolean,
    default: false,
    index: true
  },
  accountStatus: {
    type: String,
    enum: ['pending_activation', 'active', 'suspended', 'banned'],
    default: 'pending_activation',
    index: true
  },
  activatedAt: Date,
  activatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },

  // NEW: API Access Control Fields
  isApiAccessApproved: {
    type: Boolean,
    default: false,
    index: true
  },
  apiAccessStatus: {
    type: String,
    enum: ['pending_approval', 'approved', 'rejected', 'revoked'],
    default: 'pending_approval',
    index: true
  },
  apiAccessRequestedAt: Date,
  apiAccessApprovedAt: Date,
  apiAccessApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  apiAccessRejectedAt: Date,
  apiAccessRejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  apiAccessRejectionReason: {
    type: String,
    trim: true,
    maxlength: 500
  },
  apiAccessRevokedAt: Date,
  apiAccessRevokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  apiAccessRevocationReason: {
    type: String,
    trim: true,
    maxlength: 500
  },
  apiAccessReason: {
    type: String,
    trim: true,
    maxlength: 500
  },
  businessUseCase: {
    type: String,
    trim: true,
    maxlength: 1000
  },

  // Email verification
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  
  // Password reset
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  
  // Login tracking
  lastLoginAt: Date,
  loginCount: {
    type: Number,
    default: 0
  },
  
  // Profile completion
  profileCompleteness: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // User preferences
  preferences: {
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      marketing: {
        type: Boolean,
        default: false
      },
      security: {
        type: Boolean,
        default: true
      }
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'es', 'fr', 'de', 'pt', 'it']
    }
  },

  // Security fields
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: String,
  
  // Compliance and KYC
  kycStatus: {
    type: String,
    enum: ['not_started', 'pending', 'approved', 'rejected'],
    default: 'not_started'
  },
  kycSubmittedAt: Date,
  kycApprovedAt: Date,
  
  // Terms and privacy acceptance
  termsAcceptedAt: Date,
  privacyPolicyAcceptedAt: Date,
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  deletedAt: Date
});

// Indexes for efficient querying
userSchema.index({ email: 1, isEmailVerified: 1 });
userSchema.index({ username: 1 });
userSchema.index({ isAccountActivated: 1, accountStatus: 1 });
userSchema.index({ isApiAccessApproved: 1, apiAccessStatus: 1 }); // NEW
userSchema.index({ apiAccessRequestedAt: -1 }); // NEW
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLoginAt: -1 });

// Pre-save middleware
userSchema.pre('save', async function(next) {
  // Update the updatedAt field
  this.updatedAt = new Date();
  
  // Hash password if it's modified
  if (this.isModified('password')) {
    try {
      const saltRounds = 12;
      this.password = await bcrypt.hash(this.password, saltRounds);
    } catch (error) {
      return next(error);
    }
  }
  
  // Calculate profile completeness
  this.profileCompleteness = this.calculateProfileCompleteness();
  
  next();
});

// Virtual to get full name
userSchema.virtual('fullName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.lastName || this.username;
});

// Virtual to get user's businesses
userSchema.virtual('businesses', {
  ref: 'Business',
  localField: '_id',
  foreignField: 'ownerId'
});

// NEW: Virtual to get API access summary
userSchema.virtual('apiAccessSummary').get(function() {
  return {
    isApproved: this.isApiAccessApproved,
    status: this.apiAccessStatus,
    requestedAt: this.apiAccessRequestedAt,
    approvedAt: this.apiAccessApprovedAt,
    rejectedAt: this.apiAccessRejectedAt,
    revokedAt: this.apiAccessRevokedAt,
    canAccessApi: this.isAccountActivated && this.isApiAccessApproved && this.apiAccessStatus === 'approved'
  };
});

// Virtual to get account status summary
userSchema.virtual('accountSummary').get(function() {
  return {
    isActivated: this.isAccountActivated,
    status: this.accountStatus,
    activatedAt: this.activatedAt,
    canCreateBusiness: this.isAccountActivated && this.accountStatus === 'active',
    canAccessApi: this.isAccountActivated && this.isApiAccessApproved && this.apiAccessStatus === 'approved'
  };
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Instance method to calculate profile completeness
userSchema.methods.calculateProfileCompleteness = function() {
  let completeness = 0;
  const fields = [
    'username', 'email', 'firstName', 'lastName', 
    'phoneNumber', 'dateOfBirth', 'country'
  ];
  
  fields.forEach(field => {
    if (this[field]) completeness += 100 / fields.length;
  });
  
  // Email verification bonus
  if (this.isEmailVerified) completeness += 10;
  
  // Cap at 100%
  return Math.min(Math.round(completeness), 100);
};

// Instance method to check if user can create business
userSchema.methods.canCreateBusiness = function() {
  return this.isAccountActivated && this.accountStatus === 'active';
};

// NEW: Instance method to check if user can access API
userSchema.methods.canAccessApi = function() {
  return this.isAccountActivated && 
         this.accountStatus === 'active' &&
         this.isApiAccessApproved && 
         this.apiAccessStatus === 'approved';
};

// NEW: Instance method to check if user can request API access
userSchema.methods.canRequestApiAccess = function() {
  return this.isAccountActivated && 
         this.accountStatus === 'active' &&
         (!this.apiAccessStatus || this.apiAccessStatus === 'rejected');
};

// Instance method to generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return token;
};

// Instance method to generate password reset token
userSchema.methods.generateResetPasswordToken = function() {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

// Instance method to update login tracking
userSchema.methods.updateLoginTracking = function() {
  this.lastLoginAt = new Date();
  this.loginCount += 1;
  return this.save();
};

// Static method to find users by account status
userSchema.statics.findByAccountStatus = function(status) {
  return this.find({ accountStatus: status });
};

// NEW: Static method to find users by API access status
userSchema.statics.findByApiAccessStatus = function(status) {
  return this.find({ apiAccessStatus: status });
};

// NEW: Static method to find pending API access requests
userSchema.statics.findPendingApiAccessRequests = function() {
  return this.find({ 
    apiAccessStatus: 'pending_approval',
    isAccountActivated: true,
    accountStatus: 'active'
  }).sort({ apiAccessRequestedAt: -1 });
};

// Static method to find users requiring activation
userSchema.statics.findPendingActivation = function() {
  return this.find({ 
    isAccountActivated: false,
    accountStatus: 'pending_activation'
  }).sort({ createdAt: -1 });
};

// Static method to cleanup expired tokens
userSchema.statics.cleanupExpiredTokens = async function() {
  const now = new Date();
  
  // Clear expired email verification tokens
  await this.updateMany(
    { emailVerificationExpires: { $lt: now } },
    { 
      $unset: { 
        emailVerificationToken: 1, 
        emailVerificationExpires: 1 
      } 
    }
  );
  
  // Clear expired password reset tokens
  await this.updateMany(
    { resetPasswordExpires: { $lt: now } },
    { 
      $unset: { 
        resetPasswordToken: 1, 
        resetPasswordExpires: 1 
      } 
    }
  );
  
  console.log('✅ Expired tokens cleaned up');
};

// NEW: Static method to get API access statistics
userSchema.statics.getApiAccessStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$apiAccessStatus',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    pending_approval: 0,
    approved: 0,
    rejected: 0,
    revoked: 0
  };
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
  });
  
  return result;
};

// Static method to get user statistics
userSchema.statics.getUserStats = async function() {
  const totalUsers = await this.countDocuments();
  const activeUsers = await this.countDocuments({ accountStatus: 'active' });
  const pendingActivation = await this.countDocuments({ accountStatus: 'pending_activation' });
  const verifiedEmails = await this.countDocuments({ isEmailVerified: true });
  
  return {
    total: totalUsers,
    active: activeUsers,
    pendingActivation,
    verifiedEmails,
    activationRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0,
    verificationRate: totalUsers > 0 ? ((verifiedEmails / totalUsers) * 100).toFixed(2) : 0
  };
};

module.exports = mongoose.model('User', userSchema);