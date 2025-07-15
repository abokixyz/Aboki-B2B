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
      'Fintech',
      'Cryptocurrency',
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
  
  // ENHANCED: Updated supportedTokens with default tokens support
  supportedTokens: {
    base: [{
      symbol: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
      },
      name: {
        type: String,
        required: true,
        trim: true
      },
      contractAddress: {
        type: String,
        required: true,
        trim: true,
        alias: 'address'
      },
      decimals: {
        type: Number,
        required: true,
        min: 0,
        max: 18
      },
      network: {
        type: String,
        default: 'base'
      },
      type: {
        type: String,
        default: 'ERC-20'
      },
      logoUrl: String,
      isActive: {
        type: Boolean,
        default: true
      },
      isTradingEnabled: {
        type: Boolean,
        default: true
      },
      isDefault: {
        type: Boolean,
        default: false
      },
      addedAt: {
        type: Date,
        default: Date.now
      },
      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      }
    }],
    solana: [{
      symbol: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
      },
      name: {
        type: String,
        required: true,
        trim: true
      },
      contractAddress: {
        type: String,
        required: true,
        trim: true,
        alias: 'address'
      },
      decimals: {
        type: Number,
        required: true,
        min: 0,
        max: 18
      },
      network: {
        type: String,
        default: 'solana'
      },
      type: {
        type: String,
        default: 'SPL'
      },
      logoUrl: String,
      isActive: {
        type: Boolean,
        default: true
      },
      isTradingEnabled: {
        type: Boolean,
        default: true
      },
      isDefault: {
        type: Boolean,
        default: false
      },
      addedAt: {
        type: Date,
        default: Date.now
      },
      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      }
    }],
    ethereum: [{
      symbol: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
      },
      name: {
        type: String,
        required: true,
        trim: true
      },
      contractAddress: {
        type: String,
        required: true,
        trim: true,
        alias: 'address'
      },
      decimals: {
        type: Number,
        required: true,
        min: 0,
        max: 18
      },
      network: {
        type: String,
        default: 'ethereum'
      },
      type: {
        type: String,
        default: 'ERC-20'
      },
      logoUrl: String,
      isActive: {
        type: Boolean,
        default: true
      },
      isTradingEnabled: {
        type: Boolean,
        default: true
      },
      isDefault: {
        type: Boolean,
        default: false
      },
      addedAt: {
        type: Date,
        default: Date.now
      },
      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      }
    }]
  },

  // NEW: Fee configuration for each supported token with default support
  feeConfiguration: {
    base: [{
      contractAddress: {
        type: String,
        required: true,
        trim: true
      },
      symbol: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
      },
      feePercentage: {
        type: Number,
        required: true,
        min: 0,
        max: 10,
        default: 0
      },
      isActive: {
        type: Boolean,
        default: true
      },
      isDefault: {
        type: Boolean,
        default: false
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    }],
    solana: [{
      contractAddress: {
        type: String,
        required: true,
        trim: true
      },
      symbol: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
      },
      feePercentage: {
        type: Number,
        required: true,
        min: 0,
        max: 10,
        default: 0
      },
      isActive: {
        type: Boolean,
        default: true
      },
      isDefault: {
        type: Boolean,
        default: false
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    }],
    ethereum: [{
      contractAddress: {
        type: String,
        required: true,
        trim: true
      },
      symbol: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
      },
      feePercentage: {
        type: Number,
        required: true,
        min: 0,
        max: 10,
        default: 0
      },
      isActive: {
        type: Boolean,
        default: true
      },
      isDefault: {
        type: Boolean,
        default: false
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },

  // NEW: Payment wallets for receiving fees (updated with ethereum)
  paymentWallets: {
    solana: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
        },
        message: 'Invalid Solana wallet address format'
      }
    },
    base: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^0x[a-fA-F0-9]{40}$/.test(v);
        },
        message: 'Invalid Base wallet address format'
      }
    },
    ethereum: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^0x[a-fA-F0-9]{40}$/.test(v);
        },
        message: 'Invalid Ethereum wallet address format'
      }
    }
  },

  // NEW: Bank account for fiat payments
  bankAccount: {
    accountName: {
      type: String,
      trim: true,
      maxlength: 100
    },
    accountNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^\d{10}$/.test(v);
        },
        message: 'Account number must be 10 digits'
      }
    },
    bankName: {
      type: String,
      trim: true,
      maxlength: 100
    },
    bankCode: {
      type: String,
      trim: true,
      maxlength: 10
    },
    currency: {
      type: String,
      default: 'NGN',
      uppercase: true,
      maxlength: 3
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  },

  // NEW: Timestamps for token configuration
  supportedTokensUpdatedAt: {
    type: Date
  },

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

// Enhanced compound indexes for efficient querying
businessSchema.index({ ownerId: 1, status: 1 });
businessSchema.index({ businessName: 1 });
businessSchema.index({ industry: 1, country: 1 });
businessSchema.index({ 'supportedTokens.base.contractAddress': 1 });
businessSchema.index({ 'supportedTokens.solana.contractAddress': 1 });
businessSchema.index({ 'supportedTokens.ethereum.contractAddress': 1 });
businessSchema.index({ 'supportedTokens.base.symbol': 1 });
businessSchema.index({ 'supportedTokens.solana.symbol': 1 });
businessSchema.index({ 'supportedTokens.ethereum.symbol': 1 });

// Virtual to get associated API keys
businessSchema.virtual('apiKeys', {
  ref: 'ApiKey',
  localField: '_id',
  foreignField: 'businessId'
});

// NEW: Virtual for getting active supported tokens count (including ethereum)
businessSchema.virtual('activeTokensCount').get(function() {
  const baseActive = this.supportedTokens?.base?.filter(t => t.isActive && t.isTradingEnabled)?.length || 0;
  const solanaActive = this.supportedTokens?.solana?.filter(t => t.isActive && t.isTradingEnabled)?.length || 0;
  const ethereumActive = this.supportedTokens?.ethereum?.filter(t => t.isActive && t.isTradingEnabled)?.length || 0;
  return {
    base: baseActive,
    solana: solanaActive,
    ethereum: ethereumActive,
    total: baseActive + solanaActive + ethereumActive
  };
});

// NEW: Virtual for default vs custom tokens count
businessSchema.virtual('tokenBreakdown').get(function() {
  const getTokenStats = (tokens) => ({
    total: tokens?.length || 0,
    default: tokens?.filter(t => t.isDefault)?.length || 0,
    custom: tokens?.filter(t => !t.isDefault)?.length || 0,
    active: tokens?.filter(t => t.isActive && t.isTradingEnabled)?.length || 0
  });

  return {
    base: getTokenStats(this.supportedTokens?.base),
    solana: getTokenStats(this.supportedTokens?.solana),
    ethereum: getTokenStats(this.supportedTokens?.ethereum)
  };
});

// NEW: Virtual for payment configuration status (updated with ethereum)
businessSchema.virtual('paymentConfigurationStatus').get(function() {
  const hasWallets = !!(this.paymentWallets?.solana || this.paymentWallets?.base || this.paymentWallets?.ethereum);
  const hasBankAccount = !!(this.bankAccount?.accountNumber);
  const hasActiveTokens = this.activeTokensCount.total > 0;
  
  return {
    canReceiveCrypto: hasWallets && hasActiveTokens,
    canReceiveFiat: hasBankAccount,
    hasActiveTokens,
    hasWallets,
    hasBankAccount,
    isFullyConfigured: hasWallets && hasBankAccount && hasActiveTokens
  };
});

// Ensure virtual fields are serialized
businessSchema.set('toJSON', { virtuals: true });
businessSchema.set('toObject', { virtuals: true });

// EXISTING: Instance method to check if business is active
businessSchema.methods.isActive = function() {
  return this.status === 'verified' || this.status === 'pending_verification';
};

// NEW: Method to get token by address and network (updated with ethereum)
businessSchema.methods.getTokenByAddress = function(address, network) {
  const networkKey = network.toLowerCase();
  if (!this.supportedTokens || !this.supportedTokens[networkKey]) {
    return null;
  }
  
  return this.supportedTokens[networkKey].find(
    token => token.contractAddress.toLowerCase() === address.toLowerCase()
  );
};

// NEW: Method to get fee configuration for a token (updated with ethereum)
businessSchema.methods.getFeeForToken = function(address, network) {
  const networkKey = network.toLowerCase();
  if (!this.feeConfiguration || !this.feeConfiguration[networkKey]) {
    return 0;
  }
  
  const feeConfig = this.feeConfiguration[networkKey].find(
    config => config.contractAddress.toLowerCase() === address.toLowerCase() && config.isActive
  );
  
  return feeConfig ? feeConfig.feePercentage : 0;
};

// NEW: Method to check if business can receive payments
businessSchema.methods.canReceivePayments = function() {
  return this.paymentConfigurationStatus;
};

// NEW: Method to get trading-enabled tokens for a network (updated with ethereum)
businessSchema.methods.getTradingTokens = function(network) {
  const networkKey = network.toLowerCase();
  if (!this.supportedTokens || !this.supportedTokens[networkKey]) {
    return [];
  }
  
  return this.supportedTokens[networkKey].filter(
    token => token.isActive && token.isTradingEnabled
  );
};

// NEW: Method to get default tokens for a network
businessSchema.methods.getDefaultTokens = function(network) {
  const networkKey = network.toLowerCase();
  if (!this.supportedTokens || !this.supportedTokens[networkKey]) {
    return [];
  }
  
  return this.supportedTokens[networkKey].filter(token => token.isDefault);
};

// NEW: Method to get custom tokens for a network
businessSchema.methods.getCustomTokens = function(network) {
  const networkKey = network.toLowerCase();
  if (!this.supportedTokens || !this.supportedTokens[networkKey]) {
    return [];
  }
  
  return this.supportedTokens[networkKey].filter(token => !token.isDefault);
};

// NEW: Method to check if a token is supported for trading (updated with ethereum)
businessSchema.methods.isTokenSupportedForTrading = function(address, network) {
  const token = this.getTokenByAddress(address, network);
  return token && token.isActive && token.isTradingEnabled;
};

// NEW: Method to check if can modify default tokens (prevent deletion of defaults)
businessSchema.methods.canModifyToken = function(address, network, action) {
  const token = this.getTokenByAddress(address, network);
  if (!token) return false;
  
  // Default tokens can only be disabled, not deleted
  if (token.isDefault && action === 'delete') {
    return false;
  }
  
  return true;
};

// EXISTING: Static method to find businesses by industry
businessSchema.statics.findByIndustry = function(industry) {
  return this.find({ industry, status: { $ne: 'deleted' } });
};

// EXISTING: Static method to find verified businesses
businessSchema.statics.findVerified = function() {
  return this.find({ status: 'verified' });
};

// NEW: Static method to find businesses with active trading tokens (updated with ethereum)
businessSchema.statics.findWithTradingTokens = function(network) {
  const query = {
    status: { $in: ['verified', 'pending_verification'] },
    [`supportedTokens.${network.toLowerCase()}.isActive`]: true,
    [`supportedTokens.${network.toLowerCase()}.isTradingEnabled`]: true
  };
  return this.find(query);
};

// NEW: Static method to find businesses by supported token (updated with ethereum)
businessSchema.statics.findByToken = function(address, network) {
  const networkKey = network.toLowerCase();
  return this.find({
    [`supportedTokens.${networkKey}.contractAddress`]: { $regex: new RegExp(`^${address}$`, 'i') },
    [`supportedTokens.${networkKey}.isActive`]: true,
    status: { $ne: 'deleted' }
  });
};

// NEW: Static method to get businesses with default tokens only
businessSchema.statics.findWithDefaultTokensOnly = function() {
  return this.find({
    $and: [
      { 'supportedTokens.base': { $not: { $elemMatch: { isDefault: false } } } },
      { 'supportedTokens.solana': { $not: { $elemMatch: { isDefault: false } } } },
      { 'supportedTokens.ethereum': { $not: { $elemMatch: { isDefault: false } } } }
    ]
  });
};

module.exports = mongoose.model('Business', businessSchema);