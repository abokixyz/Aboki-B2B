// src/models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  txHash: {
    type: String,
    unique: true,
    sparse: true
  },
  blockchainType: {
    type: String,
    required: true
  },
  contractAddress: {
    type: String,
    required: true
  },
  functionName: {
    type: String,
    required: true
  },
  parameters: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED'],
    default: 'PENDING'
  },
  gasUsed: {
    type: String,
    default: null
  },
  gasPrice: {
    type: String,
    default: null
  },
  errorMessage: {
    type: String,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    default: null
  },
  currency: {
    type: String,
    default: 'USD'
  },
  type: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);