// src/models/UserTransaction.js
const mongoose = require('mongoose');

const userTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null
  },
  type: {
    type: String,
    required: true
  },
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    default: null
  },
  currency: {
    type: String,
    default: 'USD'
  },
  status: {
    type: String,
    default: 'PENDING'
  },
  blockchainTxId: {
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

module.exports = mongoose.model('UserTransaction', userTransactionSchema);