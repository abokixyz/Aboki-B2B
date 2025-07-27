const mongoose = require('mongoose');

// User Schema for Authentication with Admin Verification Support
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  
  // ADMIN VERIFICATION FIELDS (NEW)
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending',
    index: true
  },
  accountStatus: {
    type: String,
    enum: ['active', 'suspended', 'deactivated'],
    default: 'active',
    index: true
  },
  isApiEnabled: {
    type: Boolean,
    default: false,
    index: true
  },
  verificationHistory: [{
    action: {
      type: String,
      enum: ['verification_approved', 'verification_rejected', 'account_suspended', 'account_activated', 'api_enabled', 'api_disabled']
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    details: {
      type: mongoose.Schema.Types.Mixed
    }
  }],
  verifiedAt: {
    type: Date
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  rejectionReason: {
    type: String
  },
  
  // Email verification fields
  emailVerificationToken: {
    type: String,
    index: true
  },
  emailVerificationExpiry: {
    type: Date
  },
  
  // Password reset fields
  resetPasswordToken: {
    type: String,
    index: true
  },
  resetPasswordExpiry: {
    type: Date
  },
  
  lastLogin: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to update updatedAt
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// INDEXES FOR PERFORMANCE
// Existing indexes
userSchema.index({ resetPasswordToken: 1 });
userSchema.index({ resetPasswordExpiry: 1 });

// New indexes for email verification
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ emailVerificationExpiry: 1 });

// New indexes for admin verification
userSchema.index({ verificationStatus: 1, isVerified: 1 });
userSchema.index({ accountStatus: 1 });
userSchema.index({ isApiEnabled: 1 });
userSchema.index({ verifiedAt: 1 });

// Compound indexes for better performance
userSchema.index({ emailVerificationToken: 1, emailVerificationExpiry: 1 });
userSchema.index({ resetPasswordToken: 1, resetPasswordExpiry: 1 });
userSchema.index({ verificationStatus: 1, accountStatus: 1, isApiEnabled: 1 });

// INSTANCE METHODS

// Check if user can create businesses
userSchema.methods.canCreateBusiness = function() {
  return this.isVerified && 
         this.verificationStatus === 'approved' && 
         this.isApiEnabled && 
         (this.accountStatus || 'active') === 'active';
};

// Get user verification summary
userSchema.methods.getVerificationSummary = function() {
  return {
    emailVerified: this.isVerified || false,
    adminApproved: this.verificationStatus === 'approved',
    apiEnabled: this.isApiEnabled || false,
    accountActive: (this.accountStatus || 'active') === 'active',
    canCreateBusiness: this.canCreateBusiness()
  };
};

// Add verification history entry
userSchema.methods.addVerificationHistory = function(action, performedBy, details = {}) {
  if (!this.verificationHistory) {
    this.verificationHistory = [];
  }
  
  this.verificationHistory.push({
    action,
    performedBy,
    performedAt: new Date(),
    details
  });
};

// STATIC METHODS

// Find users pending verification
userSchema.statics.findPendingVerification = function() {
  return this.find({
    $or: [
      { verificationStatus: 'pending' },
      { verificationStatus: { $exists: false } }
    ],
    isVerified: true // Only email-verified users
  });
};

// Clean up expired tokens periodically
userSchema.statics.cleanupExpiredTokens = async function() {
  const now = new Date();
  
  await this.updateMany(
    {
      $or: [
        { emailVerificationExpiry: { $lt: now } },
        { resetPasswordExpiry: { $lt: now } }
      ]
    },
    {
      $unset: {
        emailVerificationToken: "",
        emailVerificationExpiry: "",
        resetPasswordToken: "",
        resetPasswordExpiry: ""
      }
    }
  );
};

// Migration helper - ensure all users have required fields
userSchema.statics.migrateVerificationFields = async function() {
  const results = {};
  
  // Add verificationStatus to users who don't have it
  results.verificationStatus = await this.updateMany(
    { verificationStatus: { $exists: false } },
    { 
      $set: { 
        verificationStatus: 'pending',
        updatedAt: new Date()
      } 
    }
  );
  
  // Add accountStatus to users who don't have it
  results.accountStatus = await this.updateMany(
    { accountStatus: { $exists: false } },
    { 
      $set: { 
        accountStatus: 'active',
        updatedAt: new Date()
      } 
    }
  );
  
  // Add isApiEnabled to users who don't have it
  results.isApiEnabled = await this.updateMany(
    { isApiEnabled: { $exists: false } },
    { 
      $set: { 
        isApiEnabled: false,
        updatedAt: new Date()
      } 
    }
  );
  
  // Add verificationHistory to users who don't have it
  results.verificationHistory = await this.updateMany(
    { verificationHistory: { $exists: false } },
    { 
      $set: { 
        verificationHistory: [],
        updatedAt: new Date()
      } 
    }
  );
  
  return results;
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpiry;
  delete user.emailVerificationToken;
  delete user.emailVerificationExpiry;
  return user;
};

// Create safe user object for public APIs
userSchema.methods.toSafeObject = function() {
  return {
    id: this._id,
    email: this.email,
    fullName: this.fullName,
    phone: this.phone,
    isVerified: this.isVerified,
    verificationStatus: this.verificationStatus,
    accountStatus: this.accountStatus,
    isApiEnabled: this.isApiEnabled,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin
  };
};

// VIRTUAL FIELDS

// Virtual for user's full verification status
userSchema.virtual('fullVerificationStatus').get(function() {
  return {
    email: this.isVerified ? 'verified' : 'pending',
    admin: this.verificationStatus || 'pending',
    api: this.isApiEnabled ? 'enabled' : 'disabled',
    account: this.accountStatus || 'active',
    overall: this.canCreateBusiness() ? 'complete' : 'incomplete'
  };
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);