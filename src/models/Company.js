// src/models/Company.js
const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  walletAddress: {
    type: String,
    default: null
  },
  apiKey: {
    type: String,
    required: true,
    unique: true,
    default: () => require('crypto').randomUUID()
  },
  isActive: {
    type: Boolean,
    default: true
  },
  phone: {
    type: String,
    default: null
  },
  address: {
    type: String,
    default: null
  },
  registrationNum: {
    type: String,
    default: null
  },
  taxId: {
    type: String,
    default: null
  },
  website: {
    type: String,
    default: null
  },
  industry: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Company', companySchema);