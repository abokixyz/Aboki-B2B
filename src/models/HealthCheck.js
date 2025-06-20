// src/models/HealthCheck.js
const mongoose = require('mongoose');

const healthCheckSchema = new mongoose.Schema({
  status: {
    type: String,
    default: 'healthy'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('HealthCheck', healthCheckSchema);