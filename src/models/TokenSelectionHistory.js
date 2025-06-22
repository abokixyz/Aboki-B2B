const mongoose = require('mongoose');

// Token Selection History Schema (for tracking changes)
const tokenSelectionHistorySchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true
  },
  network: {
    type: String,
    required: true,
    enum: ['base', 'solana', 'ethereum'],
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: ['add', 'remove', 'select', 'clear', 'update'],
    index: true
  },
  tokens: [{
    symbol: String,
    name: String,
    contractAddress: String,
    decimals: Number,
    type: String,
    logoUrl: String
  }],
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    source: String // 'api', 'dashboard', 'mobile'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound indexes for efficient querying
tokenSelectionHistorySchema.index({ businessId: 1, timestamp: -1 });
tokenSelectionHistorySchema.index({ businessId: 1, network: 1, timestamp: -1 });
tokenSelectionHistorySchema.index({ performedBy: 1, timestamp: -1 });

// Static method to get recent history for a business
tokenSelectionHistorySchema.statics.getRecentHistory = function(businessId, limit = 50) {
  return this.find({ businessId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('performedBy', 'fullName email');
};

// Static method to get history by network
tokenSelectionHistorySchema.statics.getNetworkHistory = function(businessId, network, limit = 50) {
  return this.find({ businessId, network })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('performedBy', 'fullName email');
};

// Static method to log token action
tokenSelectionHistorySchema.statics.logAction = function(data) {
  const {
    businessId,
    network,
    action,
    tokens,
    performedBy,
    metadata = {}
  } = data;

  const historyEntry = new this({
    businessId,
    network,
    action,
    tokens,
    performedBy,
    metadata,
    timestamp: new Date()
  });

  return historyEntry.save();
};

// Static method to clean old history (keep only last 1000 entries per business)
tokenSelectionHistorySchema.statics.cleanupOldHistory = async function() {
  const businesses = await this.distinct('businessId');
  
  for (const businessId of businesses) {
    const entries = await this.find({ businessId })
      .sort({ timestamp: -1 })
      .skip(1000)
      .select('_id');
    
    if (entries.length > 0) {
      const idsToDelete = entries.map(entry => entry._id);
      await this.deleteMany({ _id: { $in: idsToDelete } });
    }
  }
};

module.exports = mongoose.model('TokenSelectionHistory', tokenSelectionHistorySchema);