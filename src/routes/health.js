// src/routes/health.js
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

// Basic health check
router.get('/', async (req, res) => {
 try {
   // Test database connection
   await mongoose.connection.db.admin().ping();
   
   res.json({
     success: true,
     status: 'healthy',
     timestamp: new Date().toISOString(),
     uptime: process.uptime(),
     environment: process.env.NODE_ENV || 'development',
     version: '1.0.0'
   });
 } catch (error) {
   res.status(503).json({
     success: false,
     status: 'unhealthy',
     error: 'Database connection failed',
     timestamp: new Date().toISOString()
   });
 }
});

// Detailed health check
router.get('/detailed', async (req, res) => {
 try {
   const dbStart = Date.now();
   await mongoose.connection.db.admin().ping();
   const dbTime = Date.now() - dbStart;

   res.json({
     success: true,
     status: 'healthy',
     timestamp: new Date().toISOString(),
     uptime: process.uptime(),
     environment: process.env.NODE_ENV || 'development',
     version: '1.0.0',
     checks: {
       database: {
         status: 'healthy',
         responseTime: `${dbTime}ms`,
         readyState: mongoose.connection.readyState
       },
       memory: {
         used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
         total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
         unit: 'MB'
       }
     }
   });
 } catch (error) {
   res.status(503).json({
     success: false,
     status: 'unhealthy',
     error: 'Health check failed',
     timestamp: new Date().toISOString()
   });
 }
});

module.exports = router;