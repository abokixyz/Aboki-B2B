const mongoose = require('mongoose');

// User Schema for Authentication
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
  resetPasswordToken: {
    type: String
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

// Index for password reset tokens
userSchema.index({ resetPasswordToken: 1 });
userSchema.index({ resetPasswordExpiry: 1 });

// Business Schema
const businessSchema = new mongoose.Schema({
  businessId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  ownerId: {
    type: String,
    required: true,
    index: true
  },
  businessName: {
    type: String,
    required: true,
    trim: true
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
    ]
  },
  country: {
    type: String,
    required: true
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
  apiKeys: [{
    keyId: String,
    keyName: String,
    permissions: [String],
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastUsed: Date
  }],
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

// Token Selection History Schema (optional - for tracking changes)
const tokenSelectionHistorySchema = new mongoose.Schema({
  businessId: {
    type: String,
    required: true,
    index: true
  },
  network: {
    type: String,
    required: true,
    enum: ['base', 'solana']
  },
  action: {
    type: String,
    required: true,
    enum: ['add', 'remove', 'select', 'clear']
  },
  tokens: [{
    symbol: String,
    name: String,
    contractAddress: String
  }],
  performedBy: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Create models
const User = mongoose.model('User', userSchema);
const Business = mongoose.model('Business', businessSchema);
const TokenSelectionHistory = mongoose.model('TokenSelectionHistory', tokenSelectionHistorySchema);

module.exports = {
  User,
  Business,
  TokenSelectionHistory
};