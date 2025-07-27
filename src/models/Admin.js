// models/Admin.js
const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
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
    minlength: 8
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'moderator'],
    default: 'moderator',
    required: true,
    index: true
  },
  permissions: [{
    type: String,
    enum: [
      'user_verification',
      'user_management', 
      'business_verification',
      'business_management',
      'api_key_management',
      'system_settings',
      'analytics_view',
      'bulk_operations',
      'admin_management'
    ]
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  lastLogin: {
    type: Date,
    index: true
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpiry: {
    type: Date
  },
  twoFactorSecret: {
    type: String
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  sessionToken: {
    type: String
  },
  ipWhitelist: [{
    type: String
  }]
}, {
  timestamps: true
});

// Indexes
adminSchema.index({ email: 1 });
adminSchema.index({ role: 1 });
adminSchema.index({ isActive: 1 });
adminSchema.index({ createdAt: -1 });

// Virtual for account locked status
adminSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Default permissions by role
adminSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('role')) {
    switch (this.role) {
      case 'super_admin':
        this.permissions = [
          'user_verification',
          'user_management',
          'business_verification', 
          'business_management',
          'api_key_management',
          'system_settings',
          'analytics_view',
          'bulk_operations',
          'admin_management'
        ];
        break;
      case 'admin':
        this.permissions = [
          'user_verification',
          'user_management',
          'business_verification',
          'business_management',
          'api_key_management',
          'analytics_view',
          'bulk_operations'
        ];
        break;
      case 'moderator':
        this.permissions = [
          'user_verification',
          'business_verification',
          'analytics_view'
        ];
        break;
    }
  }
  next();
});

// Instance methods
adminSchema.methods.hasPermission = function(permission) {
  return this.role === 'super_admin' || this.permissions.includes(permission);
};

adminSchema.methods.canManageUser = function(userId) {
  return this.hasPermission('user_management');
};

adminSchema.methods.canVerifyUser = function() {
  return this.hasPermission('user_verification');
};

// Increment login attempts
adminSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: {
        lockUntil: 1
      },
      $set: {
        loginAttempts: 1
      }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      lockUntil: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
    };
  }
  
  return this.updateOne(updates);
};

// Reset login attempts
adminSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      loginAttempts: 1,
      lockUntil: 1
    }
  });
};

// Hide sensitive fields in JSON output
adminSchema.methods.toJSON = function() {
  const admin = this.toObject();
  delete admin.password;
  delete admin.resetPasswordToken;
  delete admin.resetPasswordExpiry;
  delete admin.twoFactorSecret;
  delete admin.sessionToken;
  return admin;
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;