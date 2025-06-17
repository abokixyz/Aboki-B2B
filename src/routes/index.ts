// src/routes/index.ts
import express from 'express';
import authRoutes from './auth';
import companyRoutes from './companies';
import transactionRoutes from './transactions';
import healthRoutes from './health';

const router = express.Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/companies', companyRoutes);
router.use('/transactions', transactionRoutes);
router.use('/health', healthRoutes);

// API info route
router.get('/', (req, res) => {
 res.json({
   success: true,
   message: 'Blockchain B2B Platform API v1',
   version: '1.0.0',
   endpoints: {
     auth: {
       signup: 'POST /api/v1/auth/signup',
       login: 'POST /api/v1/auth/login',
       generateApiKey: 'POST /api/v1/auth/generate-api-key',
       getApiKeys: 'GET /api/v1/auth/api-keys/:userId',
       revokeApiKey: 'DELETE /api/v1/auth/api-keys/:keyId'
     },
     companies: {
       list: 'GET /api/v1/companies',
       get: 'GET /api/v1/companies/:id',
       create: 'POST /api/v1/companies',
       update: 'PUT /api/v1/companies/:id',
       transactions: 'GET /api/v1/companies/:id/transactions',
       contracts: 'GET /api/v1/companies/:id/contracts',
       activate: 'PATCH /api/v1/companies/:id/activate',
       deactivate: 'PATCH /api/v1/companies/:id/deactivate'
     },
     transactions: {
       list: 'GET /api/v1/transactions',
       get: 'GET /api/v1/transactions/:id',
       create: 'POST /api/v1/transactions',
       updateStatus: 'PATCH /api/v1/transactions/:id/status',
       cancel: 'PATCH /api/v1/transactions/:id/cancel',
       retry: 'POST /api/v1/transactions/:id/retry',
       stats: 'GET /api/v1/transactions/stats/overview'
     },
     health: 'GET /api/v1/health'
   },
   authentication: {
     jwt: 'Use Bearer token in Authorization header',
     apiKey: 'Use X-API-Key and X-API-Secret headers'
   },
   timestamp: new Date().toISOString()
 });
});

export default router;