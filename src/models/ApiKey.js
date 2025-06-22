const mongoose = require('mongoose');

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
    required: true
  },
  permissions: {
    type: [String],
    default: ['read', 'write', 'validate'],
    enum: ['read', 'write', 'validate', 'admin']
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUsedAt: {
    type: Date,
    default: null
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
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

// Indexes for better performance
apiKeySchema.index({ businessId: 1, isActive: 1 });
apiKeySchema.index({ publicKey: 1, isActive: 1 });
apiKeySchema.index({ userId: 1, isActive: 1 });
apiKeySchema.index({ businessId: 1, userId: 1 });

// Virtual for masking secret key in responses
apiKeySchema.virtual('maskedSecretKey').get(function() {
  return this.secretKey ? this.secretKey.substring(0, 8) + '...' : null;
});

// Ensure virtual fields are serialized
apiKeySchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.secretKey; // Never include secret key in JSON responses
    return ret;
  }
});

// Instance method to check if key is valid
apiKeySchema.methods.isValid = function() {
  return this.isActive && this.publicKey && this.clientKey && this.secretKey;
};

// Instance method to update last used timestamp
apiKeySchema.methods.updateLastUsed = function() {
  this.lastUsedAt = new Date();
  return this.save();
};

// Static method to find active keys for a business
apiKeySchema.statics.findActiveByBusiness = function(businessId) {
  return this.find({ businessId, isActive: true });
};

// Static method to find by public key
apiKeySchema.statics.findByPublicKey = function(publicKey) {
  return this.findOne({ publicKey, isActive: true });
};

// Static method to deactivate all keys for a business
apiKeySchema.statics.deactivateByBusiness = function(businessId) {
  return this.updateMany(
    { businessId },
    { isActive: false, updatedAt: new Date() }
  );
};

// Pre-save middleware to update updatedAt
apiKeySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ApiKey', apiKeySchema);