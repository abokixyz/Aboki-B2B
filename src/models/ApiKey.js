const mongoose = require('mongoose');

// Enhanced API Key Schema with admin approval tracking
const apiKeySchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // API Key identifiers
  publicKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  clientKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  secretKey: {
    type: String,
    required: true // This will be hashed
  },
  
  // Key configuration
  permissions: [{
    type: String,
    enum: ['read', 'write', 'validate', 'admin'],
    default: ['read', 'write', 'validate']
  }],
  
  // Status and activation
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // NEW: Admin approval tracking
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true // API keys can only be created with admin approval
  },
  approvedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // Rate limiting configuration
  rateLimit: {
    requestsPerMinute: {
      type: Number,
      default: 100
    },
    requestsPerHour: {
      type: Number,
      default: 1000
    },
    requestsPerDay: {
      type: Number,
      default: 10000
    }
  },
  
  // Usage tracking
  usageStats: {
    totalRequests: {
      type: Number,
      default: 0
    },
    successfulRequests: {
      type: Number,
      default: 0
    },
    failedRequests: {
      type: Number,
      default: 0
    },
    lastRequestAt: Date,
    averageResponseTime: {
      type: Number,
      default: 0
    }
  },
  
  // Security and monitoring
  lastUsedAt: Date,
  lastUsedIp: String,
  lastUsedUserAgent: String,
  
  // IP whitelist (optional)
  ipWhitelist: [{
    type: String,
    trim: true
  }],
  
  // Environment
  environment: {
    type: String,
    enum: ['development', 'staging', 'production'],
    default: 'production',
    index: true
  },
  
  // Expiration (optional)
  expiresAt: Date,
  
  // Deactivation tracking
  deactivatedAt: Date,
  deactivatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  deactivationReason: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Key metadata
  description: {
    type: String,
    trim: true,
    maxlength: 200
  },
  keyName: {
    type: String,
    trim: true,
    maxlength: 100,
    default: 'Default API Key'
  },
  
  // Webhook endpoints (optional)
  webhookUrls: {
    success: {
      type: String,
      trim: true
    },
    failure: {
      type: String,
      trim: true
    },
    notification: {
      type: String,
      trim: true
    }
  },
  
  // Scope restrictions
  allowedNetworks: [{
    type: String,
    enum: ['ethereum', 'base', 'solana'],
    default: ['ethereum', 'base', 'solana']
  }],
  
  allowedOperations: [{
    type: String,
    enum: ['payment_creation', 'payment_validation', 'token_management', 'webhook_management'],
    default: ['payment_creation', 'payment_validation']
  }],
  
  // Compliance and audit
  complianceLevel: {
    type: String,
    enum: ['basic', 'enhanced', 'enterprise'],
    default: 'basic'
  },
  
  // Key rotation history
  rotationHistory: [{
    previousPublicKey: String,
    rotatedAt: Date,
    rotatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    reason: String
  }],
  
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

// Compound indexes for efficient querying
apiKeySchema.index({ businessId: 1, isActive: 1 });
apiKeySchema.index({ userId: 1, isActive: 1 });
apiKeySchema.index({ publicKey: 1, isActive: 1 });
apiKeySchema.index({ environment: 1, isActive: 1 });
apiKeySchema.index({ approvedBy: 1, approvedAt: -1 });
apiKeySchema.index({ lastUsedAt: -1 });
apiKeySchema.index({ expiresAt: 1 }, { sparse: true });

// Pre-save middleware
apiKeySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual to check if key is expired
apiKeySchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

// Virtual to get key status
apiKeySchema.virtual('keyStatus').get(function() {
  if (!this.isActive) return 'inactive';
  if (this.isExpired) return 'expired';
  return 'active';
});

// Virtual to get usage summary
apiKeySchema.virtual('usageSummary').get(function() {
  const total = this.usageStats.totalRequests || 0;
  const successful = this.usageStats.successfulRequests || 0;
  const failed = this.usageStats.failedRequests || 0;
  
  return {
    totalRequests: total,
    successfulRequests: successful,
    failedRequests: failed,
    successRate: total > 0 ? ((successful / total) * 100).toFixed(2) : 0,
    failureRate: total > 0 ? ((failed / total) * 100).toFixed(2) : 0,
    lastUsed: this.lastUsedAt,
    averageResponseTime: this.usageStats.averageResponseTime || 0
  };
});

// Virtual to get security info
apiKeySchema.virtual('securityInfo').get(function() {
  return {
    hasIpWhitelist: this.ipWhitelist && this.ipWhitelist.length > 0,
    lastUsedIp: this.lastUsedIp,
    lastUsedUserAgent: this.lastUsedUserAgent,
    environment: this.environment,
    permissions: this.permissions,
    allowedNetworks: this.allowedNetworks,
    allowedOperations: this.allowedOperations
  };
});

// Ensure virtual fields are serialized
apiKeySchema.set('toJSON', { virtuals: true });
apiKeySchema.set('toObject', { virtuals: true });

// Instance method to check if key can be used
apiKeySchema.methods.canBeUsed = function() {
  return this.isActive && !this.isExpired;
};

// Instance method to check permission
apiKeySchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission);
};

// Instance method to check network access
apiKeySchema.methods.canAccessNetwork = function(network) {
  return this.allowedNetworks.includes(network.toLowerCase());
};

// Instance method to check operation access
apiKeySchema.methods.canPerformOperation = function(operation) {
  return this.allowedOperations.includes(operation);
};

// Instance method to validate IP access
apiKeySchema.methods.isIpAllowed = function(ip) {
  if (!this.ipWhitelist || this.ipWhitelist.length === 0) {
    return true; // No IP restriction
  }
  return this.ipWhitelist.includes(ip);
};

// Instance method to update usage stats
apiKeySchema.methods.updateUsageStats = function(isSuccessful = true, responseTime = 0) {
  this.usageStats.totalRequests += 1;
  
  if (isSuccessful) {
    this.usageStats.successfulRequests += 1;
  } else {
    this.usageStats.failedRequests += 1;
  }
  
  this.usageStats.lastRequestAt = new Date();
  this.lastUsedAt = new Date();
  
  // Update average response time
  if (responseTime > 0) {
    const currentAvg = this.usageStats.averageResponseTime || 0;
    const totalRequests = this.usageStats.totalRequests;
    this.usageStats.averageResponseTime = 
      ((currentAvg * (totalRequests - 1)) + responseTime) / totalRequests;
  }
  
  return this.save();
};

// Instance method to rotate key (creates history record)
apiKeySchema.methods.addRotationHistory = function(previousPublicKey, rotatedBy, reason) {
  this.rotationHistory.push({
    previousPublicKey,
    rotatedAt: new Date(),
    rotatedBy,
    reason: reason || 'Key rotation'
  });
  
  return this.save();
};

// Instance method to deactivate key
apiKeySchema.methods.deactivate = function(deactivatedBy, reason) {
  this.isActive = false;
  this.deactivatedAt = new Date();
  this.deactivatedBy = deactivatedBy;
  this.deactivationReason = reason;
  
  return this.save();
};

// Static method to find active keys for business
apiKeySchema.statics.findActiveKeysForBusiness = function(businessId) {
  return this.find({ 
    businessId, 
    isActive: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

// Static method to find keys by user
apiKeySchema.statics.findKeysByUser = function(userId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

// Static method to find keys approved by admin
apiKeySchema.statics.findKeysApprovedBy = function(adminId) {
  return this.find({ approvedBy: adminId }).sort({ approvedAt: -1 });
};

// Static method to find expired keys
apiKeySchema.statics.findExpiredKeys = function() {
  return this.find({
    expiresAt: { $lt: new Date() },
    isActive: true
  });
};

// Static method to get usage statistics
apiKeySchema.statics.getUsageStatistics = async function(timeRange = '30d') {
  const startDate = new Date();
  
  switch (timeRange) {
    case '24h':
      startDate.setHours(startDate.getHours() - 24);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
    default:
      startDate.setDate(startDate.getDate() - 30);
      break;
  }
  
  const stats = await this.aggregate([
    {
      $match: {
        'usageStats.lastRequestAt': { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalKeys: { $sum: 1 },
        activeKeys: { 
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } 
        },
        totalRequests: { 
          $sum: '$usageStats.totalRequests' 
        },
        successfulRequests: { 
          $sum: '$usageStats.successfulRequests' 
        },
        failedRequests: { 
          $sum: '$usageStats.failedRequests' 
        },
        averageResponseTime: { 
          $avg: '$usageStats.averageResponseTime' 
        }
      }
    }
  ]);
  
  const result = stats[0] || {
    totalKeys: 0,
    activeKeys: 0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0
  };
  
  result.successRate = result.totalRequests > 0 
    ? ((result.successfulRequests / result.totalRequests) * 100).toFixed(2)
    : 0;
    
  return result;
};

// Static method to cleanup inactive keys
apiKeySchema.statics.cleanupInactiveKeys = async function(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await this.deleteMany({
    isActive: false,
    deactivatedAt: { $lt: cutoffDate }
  });
  
  console.log(`✅ Cleaned up ${result.deletedCount} inactive API keys older than ${daysOld} days`);
  return result.deletedCount;
};

// Static method to find keys needing rotation
apiKeySchema.statics.findKeysNeedingRotation = function(maxAge = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAge);
  
  return this.find({
    isActive: true,
    createdAt: { $lt: cutoffDate },
    // No recent rotation
    $or: [
      { 'rotationHistory.0': { $exists: false } },
      { 'rotationHistory.0.rotatedAt': { $lt: cutoffDate } }
    ]
  });
};

// Static method to get admin approval statistics
apiKeySchema.statics.getApprovalStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$approvedBy',
        count: { $sum: 1 },
        latestApproval: { $max: '$approvedAt' }
      }
    },
    {
      $lookup: {
        from: 'admins',
        localField: '_id',
        foreignField: '_id',
        as: 'admin'
      }
    },
    {
      $project: {
        adminId: '$_id',
        adminName: { $arrayElemAt: ['$admin.name', 0] },
        keysApproved: '$count',
        latestApproval: '$latestApproval'
      }
    },
    {
      $sort: { keysApproved: -1 }
    }
  ]);
  
  return stats;
};

module.exports = mongoose.model('ApiKey', apiKeySchema);