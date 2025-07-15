const mongoose = require('mongoose');

// Business Onramp Order Status Constants
const BUSINESS_ORDER_STATUS = {
  INITIATED: 'initiated',       // Order created, payment link generated
  PENDING: 'pending',          // Payment received, waiting for settlement
  PROCESSING: 'processing',    // Settlement in progress on liquidity server
  COMPLETED: 'completed',      // Tokens sent to customer
  FAILED: 'failed',           // Order failed at any stage
  CANCELLED: 'cancelled',     // Order cancelled by business or customer
  EXPIRED: 'expired'          // Order expired without payment
};

// Business Onramp Order Schema
const businessOnrampOrderSchema = new mongoose.Schema({
  // Order Identification
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
  
  // Customer Information
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
  customerWallet: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  // Order Details
  amount: {
    type: Number,
    required: true,
    min: 1000, // Minimum ₦1,000
    max: 10000000 // Maximum ₦10,000,000
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
    trim: true,
    index: true
  },
  tokenContractAddress: {
    type: String,
    required: true,
    trim: true
  },
  
  // Pricing Information
  exchangeRate: {
    type: Number,
    required: true
  },
  estimatedTokenAmount: {
    type: Number,
    required: true
  },
  actualTokenAmount: {
    type: Number,
    default: null
  },
  
  // Fee Information
  feePercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  feeAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  netAmount: {
    type: Number,
    required: true
  },
  
  // Status and Tracking
  status: {
    type: String,
    enum: Object.values(BUSINESS_ORDER_STATUS),
    default: BUSINESS_ORDER_STATUS.INITIATED,
    index: true
  },
  
  // Payment Information
  paymentReference: {
    type: String,
    index: true
  },
  monnifyTransactionReference: {
    type: String,
    index: true
  },
  paidAmount: {
    type: Number,
    default: null
  },
  paymentCompletedAt: {
    type: Date,
    default: null
  },
  
  // Settlement Information
  transactionHash: {
    type: String,
    index: true
  },
  liquidityServerOrderId: {
    type: String,
    index: true
  },
  settlementInitiatedAt: {
    type: Date,
    default: null
  },
  settlementCompletedAt: {
    type: Date,
    default: null
  },
  
  // URLs and Webhooks (Optional)
  redirectUrl: {
    type: String,
    trim: true
  },
  webhookUrl: {
    type: String,
    trim: true
  },
  webhookAttempts: {
    type: Number,
    default: 0
  },
  lastWebhookAttempt: {
    type: Date,
    default: null
  },
  webhookDelivered: {
    type: Boolean,
    default: false
  },
  
  // Additional Data
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Error Handling
  errorMessage: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  
  // Timestamps
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
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
businessOnrampOrderSchema.index({ businessId: 1, status: 1 });
businessOnrampOrderSchema.index({ businessId: 1, createdAt: -1 });
businessOnrampOrderSchema.index({ businessId: 1, targetToken: 1 });
businessOnrampOrderSchema.index({ businessId: 1, targetNetwork: 1 });
businessOnrampOrderSchema.index({ customerEmail: 1, createdAt: -1 });
businessOnrampOrderSchema.index({ status: 1, createdAt: -1 });
businessOnrampOrderSchema.index({ expiresAt: 1, status: 1 });
businessOnrampOrderSchema.index({ targetToken: 1, targetNetwork: 1 });

// Virtual for formatted amount
businessOnrampOrderSchema.virtual('formattedAmount').get(function() {
  return `₦${this.amount.toLocaleString()}`;
});

businessOnrampOrderSchema.virtual('formattedTokenAmount').get(function() {
  return `${this.estimatedTokenAmount} ${this.targetToken}`;
});

businessOnrampOrderSchema.virtual('formattedFeeAmount').get(function() {
  return `₦${this.feeAmount.toLocaleString()}`;
});

businessOnrampOrderSchema.virtual('formattedNetAmount').get(function() {
  return `₦${this.netAmount.toLocaleString()}`;
});

// Instance methods
businessOnrampOrderSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt && this.status === BUSINESS_ORDER_STATUS.INITIATED;
};

businessOnrampOrderSchema.methods.canBeCancelled = function() {
  return [BUSINESS_ORDER_STATUS.INITIATED, BUSINESS_ORDER_STATUS.PENDING].includes(this.status);
};

businessOnrampOrderSchema.methods.isPaymentCompleted = function() {
  return [
    BUSINESS_ORDER_STATUS.PENDING, 
    BUSINESS_ORDER_STATUS.PROCESSING, 
    BUSINESS_ORDER_STATUS.COMPLETED
  ].includes(this.status);
};

businessOnrampOrderSchema.methods.markAsPaid = function(paidAmount, paymentRef) {
  this.status = BUSINESS_ORDER_STATUS.PENDING;
  this.paidAmount = paidAmount;
  this.monnifyTransactionReference = paymentRef;
  this.paymentCompletedAt = new Date();
  this.updatedAt = new Date();
};

businessOnrampOrderSchema.methods.markAsProcessing = function(liquidityOrderId) {
  this.status = BUSINESS_ORDER_STATUS.PROCESSING;
  this.liquidityServerOrderId = liquidityOrderId;
  this.settlementInitiatedAt = new Date();
  this.updatedAt = new Date();
};

businessOnrampOrderSchema.methods.markAsCompleted = function(transactionHash, actualTokenAmount) {
  this.status = BUSINESS_ORDER_STATUS.COMPLETED;
  this.transactionHash = transactionHash;
  this.actualTokenAmount = actualTokenAmount || this.estimatedTokenAmount;
  this.settlementCompletedAt = new Date();
  this.completedAt = new Date();
  this.updatedAt = new Date();
};

businessOnrampOrderSchema.methods.markAsFailed = function(errorMessage) {
  this.status = BUSINESS_ORDER_STATUS.FAILED;
  this.errorMessage = errorMessage;
  this.updatedAt = new Date();
};

businessOnrampOrderSchema.methods.markAsExpired = function() {
  this.status = BUSINESS_ORDER_STATUS.EXPIRED;
  this.updatedAt = new Date();
};

businessOnrampOrderSchema.methods.markAsCancelled = function(reason) {
  this.status = BUSINESS_ORDER_STATUS.CANCELLED;
  this.notes = reason || 'Order cancelled';
  this.updatedAt = new Date();
};

businessOnrampOrderSchema.methods.updateWebhookAttempt = function() {
  this.webhookAttempts += 1;
  this.lastWebhookAttempt = new Date();
  this.updatedAt = new Date();
};

businessOnrampOrderSchema.methods.markWebhookDelivered = function() {
  this.webhookDelivered = true;
  this.updatedAt = new Date();
};

// Static methods
businessOnrampOrderSchema.statics.findByBusinessId = function(businessId, options = {}) {
  const query = { businessId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.targetToken) {
    query.targetToken = options.targetToken.toUpperCase();
  }
  
  if (options.targetNetwork) {
    query.targetNetwork = options.targetNetwork.toLowerCase();
  }
  
  if (options.customerEmail) {
    query.customerEmail = { $regex: options.customerEmail, $options: 'i' };
  }
  
  if (options.startDate || options.endDate) {
    query.createdAt = {};
    if (options.startDate) {
      query.createdAt.$gte = new Date(options.startDate);
    }
    if (options.endDate) {
      query.createdAt.$lte = new Date(options.endDate);
    }
  }
  
  const sortBy = options.sortBy || 'createdAt';
  const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
  const sortObj = {};
  sortObj[sortBy] = sortOrder;
  
  return this.find(query)
    .sort(sortObj)
    .limit(options.limit || 20)
    .skip((options.page - 1) * (options.limit || 20) || 0);
};

businessOnrampOrderSchema.statics.getBusinessStats = function(businessId, timeframe = '30d') {
  const startDate = new Date();
  const days = timeframe === '7d' ? 7 : timeframe === '90d' ? 90 : timeframe === '1y' ? 365 : 30;
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        businessId: new mongoose.Types.ObjectId(businessId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalTokenAmount: { $sum: '$estimatedTokenAmount' },
        totalFees: { $sum: '$feeAmount' }
      }
    }
  ]);
};

businessOnrampOrderSchema.statics.findExpiredOrders = function() {
  return this.find({
    status: BUSINESS_ORDER_STATUS.INITIATED,
    expiresAt: { $lt: new Date() }
  });
};

businessOnrampOrderSchema.statics.findPendingWebhooks = function() {
  return this.find({
    webhookUrl: { $ne: null, $ne: '' },
    webhookDelivered: false,
    webhookAttempts: { $lt: 5 }, // Max 5 attempts
    status: { $in: [BUSINESS_ORDER_STATUS.COMPLETED, BUSINESS_ORDER_STATUS.FAILED] }
  });
};

// Pre-save middleware
businessOnrampOrderSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Post-save middleware for logging
businessOnrampOrderSchema.post('save', function(doc) {
  console.log(`[BUSINESS_ONRAMP_ORDER] Order ${doc.orderId} status: ${doc.status}`);
});

const BusinessOnrampOrder = mongoose.model('BusinessOnrampOrder', businessOnrampOrderSchema);

module.exports = {
  BusinessOnrampOrder,
  BUSINESS_ORDER_STATUS
};