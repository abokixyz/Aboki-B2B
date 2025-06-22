const mongoose = require('mongoose');

// Business Schema
const businessSchema = new mongoose.Schema({
  businessId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  businessName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  businessType: {
    type: String,
    required: true,
    enum: ['LLC', 'Corporation', 'Partnership', 'Sole Proprietorship', 'Non-Profit', 'Other']
  },
  description: {
    type: String,
    trim: true
  },
  industry: {
    type: String,
    required: true,
    enum: [
      'Technology',
      'Finance',
      'Healthcare',
      'Education',
      'E-commerce',
      'Manufacturing',
      'Real Estate',
      'Consulting',
      'Marketing',
      'Food & Beverage',
      'Entertainment',
      'Transportation',
      'Energy',
      'Agriculture',
      'Other'
    ],
    index: true
  },
  country: {
    type: String,
    required: true,
    index: true
  },
  registrationNumber: {
    type: String,
    trim: true
  },
  taxId: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  logo: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending_verification', 'verified', 'rejected', 'suspended', 'deleted'],
    default: 'pending_verification',
    index: true
  },
  verificationDocuments: [{
    type: {
      type: String,
      enum: ['business_license', 'tax_certificate', 'registration_certificate', 'identity_document', 'other']
    },
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    }
  }],
  supportedTokens: {
    base: [{
      symbol: String,
      name: String,
      contractAddress: String,
      decimals: Number,
      network: String,
      type: String,
      logoUrl: String,
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    solana: [{
      symbol: String,
      name: String,
      contractAddress: String,
      decimals: Number,
      network: String,
      type: String,
      logoUrl: String,
      addedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  // Remove this field as we now have a separate ApiKey model
  // apiKeys: [{
  //   keyId: String,
  //   keyName: String,
  //   permissions: [String],
  //   isActive: {
  //     type: Boolean,
  //     default: true
  //   },
  //   createdAt: {
  //     type: Date,
  //     default: Date.now
  //   },
  //   lastUsed: Date
  // }],
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

// Pre-save middleware to update updatedAt
businessSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Compound indexes for efficient querying
businessSchema.index({ ownerId: 1, status: 1 });
businessSchema.index({ businessName: 1 });
businessSchema.index({ industry: 1, country: 1 });

// Virtual to get associated API keys
businessSchema.virtual('apiKeys', {
  ref: 'ApiKey',
  localField: '_id',
  foreignField: 'businessId'
});

// Ensure virtual fields are serialized
businessSchema.set('toJSON', { virtuals: true });
businessSchema.set('toObject', { virtuals: true });

// Instance method to check if business is active
businessSchema.methods.isActive = function() {
  return this.status === 'verified' || this.status === 'pending_verification';
};

// Static method to find businesses by industry
businessSchema.statics.findByIndustry = function(industry) {
  return this.find({ industry, status: { $ne: 'deleted' } });
};

// Static method to find verified businesses
businessSchema.statics.findVerified = function() {
  return this.find({ status: 'verified' });
};

module.exports = mongoose.model('Business', businessSchema);