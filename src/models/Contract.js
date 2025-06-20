// src/models/Contract.js
const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  abi: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  blockchainType: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

contractSchema.index({ companyId: 1, address: 1 }, { unique: true });

module.exports = mongoose.model('Contract', contractSchema);