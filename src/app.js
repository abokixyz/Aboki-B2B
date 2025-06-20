// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/database');
const config = require('./config');
const routes = require('./routes');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet());
app.use(cors({
 origin: process.env.CORS_ORIGIN || '*',
 credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check route (important for Render)
app.get('/health', (req, res) => {
 res.status(200).json({ 
   status: 'OK', 
   timestamp: new Date().toISOString(),
   environment: process.env.NODE_ENV || 'development'
 });
});

// Basic route
app.get('/', (req, res) => {
 res.json({
   message: 'Blockchain B2B Platform API',
   status: 'running',
   timestamp: new Date().toISOString(),
   version: '1.0.0',
   environment: process.env.NODE_ENV || 'development'
 });
});

// API routes
app.use('/api/v1', routes);

// Error handling middleware
app.use((err, req, res, next) => {
 console.error('Unhandled error:', err);
 res.status(500).json({
   success: false,
   error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
 });
});

// 404 handler
app.use('*', (req, res) => {
 res.status(404).json({
   success: false,
   error: 'Route not found'
 });
});

const PORT = process.env.PORT || config.port || 3000;

app.listen(PORT, '0.0.0.0', () => {
 console.log(`🚀 Server running on port ${PORT}`);
 console.log(`🔗 Environment: ${process.env.NODE_ENV || 'development'}`);
 
 if (process.env.NODE_ENV !== 'production') {
   console.log(`🔗 Visit: http://localhost:${PORT}`);
   console.log(`📊 Health: http://localhost:${PORT}/api/v1/health`);
   console.log(`🏢 Companies: http://localhost:${PORT}/api/v1/companies`);
 }
});

module.exports = app;