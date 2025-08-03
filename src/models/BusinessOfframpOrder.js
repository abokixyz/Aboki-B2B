/**
 * Business Off-ramp Order Model - Complete
 * Represents token-to-fiat conversion orders with wallet generation and bank verification
 */

const mongoose = require('mongoose');

// Off-ramp order statuses
const BUSINESS_OFFRAMP_STATUS = {
  PENDING_DEPOSIT: 'pending_deposit',    // Waiting for customer to send tokens
  DEPOSIT_RECEIVED: 'deposit_received',  // Tokens received, processing swap
  PROCESSING: 'processing',              // Converting tokens and preparing payout
  PENDING_PAYOUT: 'pending_payout',      // Ready to send NGN to bank
  COMPLETED: 'completed',                // Successfully paid out
  FAILED: 'failed',                      // Order failed
  EXPIRED: 'expired',                    // Order expired before completion
  CANCELLED: 'cancelled'                 // Order cancelled
};

const BusinessOfframpOrderSchema = new mongoose.Schema({
  // Order identification
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true
  },
  businessOrderReference: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Customer information
  customerEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true
  },
  
  // Token details
  tokenAmount: {
    type: Number,
    required: true,
    min: 0
  },
  targetToken: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true
  },
  targetNetwork: {
    type: String,
    required: true,
    lowercase: true,
    enum: ['base', 'solana', 'ethereum'],
    index: true
  },
  tokenContractAddress: {
    type: String,
    required: true,
    trim: true
  },
  
  // Pricing and fees
  exchangeRate: {
    type: Number,
    required: true,
    min: 0
  },
  grossNgnAmount: {
    type: Number,
    required: true,
    min: 0
  },
  feePercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0
  },
  feeAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  netNgnAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Bank account details (verified via Lenco)
  recipientAccountNumber: {
    type: String,
    required: true,
    trim: true
  },
  recipientAccountName: {
    type: String,
    required: true,
    trim: true
  },
  recipientBankCode: {
    type: String,
    required: true,
    trim: true
  },
  recipientBankName: {
    type: String,
    required: true,
    trim: true
  },
  accountVerified: {
    type: Boolean,
    default: false
  },
  accountVerificationData: {
    verifiedName: String,
    verifiedBank: {
      code: String,
      name: String
    },
    verifiedAt: Date
  },
  
  // Generated wallet for token deposits
  depositWallet: {
    address: {
      type: String,
      required: true,
      trim: true
    },
    network: {
      type: String,
      required: true,
      lowercase: true
    },
    privateKey: {
      type: String,
      required: true // Encrypted private key
    },
    publicKey: String,
    generatedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    },
    tokensReceived: {
      type: Boolean,
      default: false
    },
    receivedAmount: {
      type: Number,
      default: 0
    },
    receivedAt: Date,
    transactionHash: String
  },
  
  // Order status and tracking
  status: {
    type: String,
    required: true,
    enum: Object.values(BUSINESS_OFFRAMP_STATUS),
    default: BUSINESS_OFFRAMP_STATUS.PENDING_DEPOSIT,
    index: true
  },
  
  // Transaction tracking
  transactionHash: String, // Deposit transaction hash
  swapTransactionHash: String, // Token swap transaction hash
  payoutReference: String, // Bank payout reference
  payoutTransactionId: String, // Payment processor transaction ID
  
  // Webhooks
  webhookUrl: String,
  webhookStatus: {
    attempts: {
      type: Number,
      default: 0
    },
    lastAttemptAt: Date,
    lastDeliveryStatus: {
      type: String,
      enum: ['pending', 'delivered', 'failed'],
      default: 'pending'
    },
    lastDeliveryAt: Date
  },
  
  // Metadata and additional information
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Important timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  depositReceivedAt: Date,
  processingStartedAt: Date,
  completedAt: Date,
  failedAt: Date,
  
  // Failure tracking
  failureReason: String,
  failureDetails: mongoose.Schema.Types.Mixed,
  retryCount: {
    type: Number,
    default: 0
  },
  
  // Additional fields for monitoring
  ipAddress: String,
  userAgent: String,
  deviceFingerprint: String
}, {
  timestamps: true,
  collection: 'business_offramp_orders'
});

// Indexes for performance
BusinessOfframpOrderSchema.index({ businessId: 1, createdAt: -1 });
BusinessOfframpOrderSchema.index({ customerEmail: 1, createdAt: -1 });
BusinessOfframpOrderSchema.index({ status: 1, createdAt: -1 });
BusinessOfframpOrderSchema.index({ targetNetwork: 1, targetToken: 1 });
BusinessOfframpOrderSchema.index({ 'depositWallet.address': 1 });
BusinessOfframpOrderSchema.index({ expiresAt: 1 }); // For cleanup
BusinessOfframpOrderSchema.index({ recipientAccountNumber: 1 });

// Compound indexes
BusinessOfframpOrderSchema.index({ 
  businessId: 1, 
  status: 1, 
  targetNetwork: 1, 
  createdAt: -1 
});

BusinessOfframpOrderSchema.index({ 
  businessId: 1, 
  customerEmail: 1, 
  createdAt: -1 
});

// Virtual fields
BusinessOfframpOrderSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

BusinessOfframpOrderSchema.virtual('timeRemaining').get(function() {
  if (this.isExpired) return 0;
  return Math.max(0, this.expiresAt.getTime() - Date.now());
});

BusinessOfframpOrderSchema.virtual('timeRemainingFormatted').get(function() {
  const remaining = this.timeRemaining;
  if (remaining === 0) return 'Expired';
  
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  return `${minutes}m remaining`;
});

BusinessOfframpOrderSchema.virtual('depositWalletStatus').get(function() {
  if (!this.depositWallet) return 'not_generated';
  if (this.depositWallet.tokensReceived) return 'received';
  if (this.isExpired) return 'expired';
  return 'waiting';
});

// Instance methods
BusinessOfframpOrderSchema.methods.updateStatus = function(newStatus, details = {}) {
  this.status = newStatus;
  this.updatedAt = new Date();
  
  // Set specific timestamps based on status
  switch (newStatus) {
    case BUSINESS_OFFRAMP_STATUS.DEPOSIT_RECEIVED:
      this.depositReceivedAt = new Date();
      if (this.depositWallet) {
        this.depositWallet.tokensReceived = true;
        this.depositWallet.receivedAt = new Date();
        if (details.transactionHash) {
          this.transactionHash = details.transactionHash;
        }
        if (details.receivedAmount) {
          this.depositWallet.receivedAmount = details.receivedAmount;
        }
      }
      break;
      
    case BUSINESS_OFFRAMP_STATUS.PROCESSING:
      this.processingStartedAt = new Date();
      if (details.swapTransactionHash) {
        this.swapTransactionHash = details.swapTransactionHash;
      }
      break;
      
    case BUSINESS_OFFRAMP_STATUS.COMPLETED:
      this.completedAt = new Date();
      if (details.payoutReference) {
        this.payoutReference = details.payoutReference;
      }
      if (details.payoutTransactionId) {
        this.payoutTransactionId = details.payoutTransactionId;
      }
      break;
      
    case BUSINESS_OFFRAMP_STATUS.FAILED:
      this.failedAt = new Date();
      if (details.failureReason) {
        this.failureReason = details.failureReason;
      }
      if (details.failureDetails) {
        this.failureDetails = details.failureDetails;
      }
      break;
      
    case BUSINESS_OFFRAMP_STATUS.EXPIRED:
      if (!this.failedAt) {
        this.failedAt = new Date();
        this.failureReason = 'Order expired before completion';
      }
      break;
  }
  
  return this.save();
};

BusinessOfframpOrderSchema.methods.canRetry = function() {
  return this.status === BUSINESS_OFFRAMP_STATUS.FAILED && 
         this.retryCount < 3 && 
         !this.isExpired;
};

BusinessOfframpOrderSchema.methods.incrementRetry = function() {
  this.retryCount += 1;
  this.updatedAt = new Date();
  return this.save();
};

BusinessOfframpOrderSchema.methods.toSafeJSON = function() {
  const obj = this.toJSON();
  
  // Remove sensitive information
  if (obj.depositWallet && obj.depositWallet.privateKey) {
    delete obj.depositWallet.privateKey;
  }
  
  return obj;
};

// Static methods
BusinessOfframpOrderSchema.statics.findExpiredOrders = function() {
  return this.find({
    status: { 
      $in: [
        BUSINESS_OFFRAMP_STATUS.PENDING_DEPOSIT,
        BUSINESS_OFFRAMP_STATUS.DEPOSIT_RECEIVED,
        BUSINESS_OFFRAMP_STATUS.PROCESSING
      ]
    },
    expiresAt: { $lt: new Date() }
  });
};

BusinessOfframpOrderSchema.statics.findByDepositWallet = function(walletAddress) {
  return this.findOne({
    'depositWallet.address': walletAddress
  });
};

BusinessOfframpOrderSchema.statics.getBusinessSummary = function(businessId, timeframe = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeframe);
  
  return this.aggregate([
    {
      $match: {
        businessId: businessId,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalNetAmount: { $sum: '$netNgnAmount' },
        totalFees: { $sum: '$feeAmount' },
        completedOrders: {
          $sum: { $cond: [{ $eq: ['$status', BUSINESS_OFFRAMP_STATUS.COMPLETED] }, 1, 0] }
        },
        pendingOrders: {
          $sum: { 
            $cond: [
              { 
                $in: [
                  '$status', 
                  [
                    BUSINESS_OFFRAMP_STATUS.PENDING_DEPOSIT,
                    BUSINESS_OFFRAMP_STATUS.DEPOSIT_RECEIVED,
                    BUSINESS_OFFRAMP_STATUS.PROCESSING,
                    BUSINESS_OFFRAMP_STATUS.PENDING_PAYOUT
                  ]
                ] 
              }, 
              1, 
              0
            ] 
          }
        },
        failedOrders: {
          $sum: { $cond: [{ $eq: ['$status', BUSINESS_OFFRAMP_STATUS.FAILED] }, 1, 0] }
        }
      }
    }
  ]);
};

// Pre-save middleware
BusinessOfframpOrderSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Pre-remove middleware to clean up associated data
BusinessOfframpOrderSchema.pre('remove', function(next) {
  // Additional cleanup logic can be added here
  next();
});

// Create the model
const BusinessOfframpOrder = mongoose.model('BusinessOfframpOrder', BusinessOfframpOrderSchema);

module.exports = {
  BusinessOfframpOrder,
  BUSINESS_OFFRAMP_STATUS
};