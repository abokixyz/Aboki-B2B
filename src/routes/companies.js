// src/routes/companies.js
const express = require('express');
const { Company, User, Transaction, Contract } = require('../models');
const { authenticateJWT, authenticateApiKey, requireRole, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all companies (Admin only with JWT) or (API key with READ permission)
router.get('/', async (req, res) => {
 // Try API key auth first, then JWT
 const authMiddleware = req.headers['x-api-key'] ? 
   [authenticateApiKey, requirePermission('READ')] : 
   [authenticateJWT, requireRole(['ADMIN'])];

 // Apply middleware
 for (const middleware of authMiddleware) {
   await new Promise((resolve, reject) => {
     middleware(req, res, (err) => {
       if (err) reject(err);
       else resolve(true);
     });
   }).catch((error) => {
     return res.status(401).json({
       success: false,
       error: 'Authentication failed'
     });
   });
 }

 try {
   const companies = await Company.aggregate([
     {
       $lookup: {
         from: 'users',
         localField: '_id',
         foreignField: 'companyId',
         as: 'users'
       }
     },
     {
       $lookup: {
         from: 'transactions',
         localField: '_id',
         foreignField: 'companyId',
         as: 'transactions'
       }
     },
     {
       $lookup: {
         from: 'contracts',
         localField: '_id',
         foreignField: 'companyId',
         as: 'contracts'
       }
     },
     {
       $project: {
         id: '$_id',
         name: 1,
         email: 1,
         walletAddress: 1,
         isActive: 1,
         createdAt: 1,
         industry: 1,
         website: 1,
         _count: {
           users: { $size: '$users' },
           transactions: { $size: '$transactions' },
           contracts: { $size: '$contracts' }
         }
       }
     },
     {
       $sort: { createdAt: -1 }
     }
   ]);

   res.json({
     success: true,
     data: { companies },
     total: companies.length
   });

 } catch (error) {
   console.error('Get companies error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to fetch companies'
   });
 }
});

// Get single company
router.get('/:id', authenticateApiKey, requirePermission('READ'), async (req, res) => {
 try {
   const { id } = req.params;

   const company = await Company.findById(id);

   if (!company) {
     return res.status(404).json({
       success: false,
       error: 'Company not found'
     });
   }

   // Get related data
   const [users, transactions, contracts] = await Promise.all([
     User.find({ companyId: id })
       .select('id email firstName lastName role isActive createdAt'),
     Transaction.find({ companyId: id })
       .limit(10)
       .sort({ createdAt: -1 })
       .select('id txHash blockchainType status amount currency createdAt'),
     Contract.find({ companyId: id })
       .select('id name address blockchainType isActive createdAt')
   ]);

   const companyData = {
     ...company.toObject(),
     users,
     transactions,
     contracts
   };

   res.json({
     success: true,
     data: { company: companyData }
   });

 } catch (error) {
   console.error('Get company error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to fetch company'
   });
 }
});

// Create new company (Admin only)
router.post('/', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
 try {
   const {
     name,
     email,
     walletAddress,
     phone,
     address,
     registrationNum,
     taxId,
     website,
     industry
   } = req.body;

   // Validation
   if (!name || !email) {
     return res.status(400).json({
       success: false,
       error: 'Name and email are required'
     });
   }

   // Check if company email already exists
   const existingCompany = await Company.findOne({ email });

   if (existingCompany) {
     return res.status(409).json({
       success: false,
       error: 'Company with this email already exists'
     });
   }

   const company = await Company.create({
     name,
     email,
     walletAddress,
     phone,
     address,
     registrationNum,
     taxId,
     website,
     industry,
     isActive: true
   });

   res.status(201).json({
     success: true,
     message: 'Company created successfully',
     data: { company }
   });

 } catch (error) {
   console.error('Create company error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to create company'
   });
 }
});

// Update company
router.put('/:id', authenticateApiKey, requirePermission('WRITE'), async (req, res) => {
 try {
   const { id } = req.params;
   const {
     name,
     email,
     walletAddress,
     phone,
     address,
     registrationNum,
     taxId,
     website,
     industry
   } = req.body;

   // Check if company exists
   const existingCompany = await Company.findById(id);

   if (!existingCompany) {
     return res.status(404).json({
       success: false,
       error: 'Company not found'
     });
   }

   // Check if email is being changed and if it conflicts
   if (email && email !== existingCompany.email) {
     const emailConflict = await Company.findOne({ email });

     if (emailConflict) {
       return res.status(409).json({
         success: false,
         error: 'Company with this email already exists'
       });
     }
   }

   // Build update object
   const updateData = {};
   if (name) updateData.name = name;
   if (email) updateData.email = email;
   if (walletAddress !== undefined) updateData.walletAddress = walletAddress;
   if (phone !== undefined) updateData.phone = phone;
   if (address !== undefined) updateData.address = address;
   if (registrationNum !== undefined) updateData.registrationNum = registrationNum;
   if (taxId !== undefined) updateData.taxId = taxId;
   if (website !== undefined) updateData.website = website;
   if (industry !== undefined) updateData.industry = industry;

   const updatedCompany = await Company.findByIdAndUpdate(
     id,
     updateData,
     { new: true }
   );

   res.json({
     success: true,
     message: 'Company updated successfully',
     data: { company: updatedCompany }
   });

 } catch (error) {
   console.error('Update company error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to update company'
   });
 }
});

// Get company transactions
router.get('/:id/transactions', authenticateApiKey, requirePermission('READ'), async (req, res) => {
 try {
   const { id } = req.params;
   const { page = 1, limit = 20, status, blockchainType } = req.query;

   const skip = (Number(page) - 1) * Number(limit);

   // Build where clause
   const where = { companyId: id };
   if (status) where.status = status;
   if (blockchainType) where.blockchainType = blockchainType;

   const [transactions, total] = await Promise.all([
     Transaction.find(where)
       .skip(skip)
       .limit(Number(limit))
       .sort({ createdAt: -1 })
       .select('id txHash blockchainType contractAddress functionName status amount currency gasUsed gasPrice createdAt completedAt'),
     Transaction.countDocuments(where)
   ]);

   res.json({
     success: true,
     data: { 
       transactions,
       pagination: {
         page: Number(page),
         limit: Number(limit),
         total,
         pages: Math.ceil(total / Number(limit))
       }
     }
   });

 } catch (error) {
   console.error('Get company transactions error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to fetch company transactions'
   });
 }
});

// Get company contracts
router.get('/:id/contracts', authenticateApiKey, requirePermission('READ'), async (req, res) => {
 try {
   const { id } = req.params;
   const { blockchainType, isActive } = req.query;

   const where = { companyId: id };
   if (blockchainType) where.blockchainType = blockchainType;
   if (isActive !== undefined) where.isActive = isActive === 'true';

   const contracts = await Contract.find(where)
     .sort({ createdAt: -1 })
     .select('id name address blockchainType description isActive createdAt');

   res.json({
     success: true,
     data: { contracts }
   });

 } catch (error) {
   console.error('Get company contracts error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to fetch company contracts'
   });
 }
});

// Deactivate company (Admin only)
router.patch('/:id/deactivate', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
 try {
   const { id } = req.params;

   const company = await Company.findByIdAndUpdate(
     id,
     { isActive: false },
     { new: true }
   );

   if (!company) {
     return res.status(404).json({
       success: false,
       error: 'Company not found'
     });
   }

   res.json({
     success: true,
     message: 'Company deactivated successfully',
     data: { company }
   });

 } catch (error) {
   console.error('Deactivate company error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to deactivate company'
   });
 }
});

// Activate company (Admin only)
router.patch('/:id/activate', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
 try {
   const { id } = req.params;

   const company = await Company.findByIdAndUpdate(
     id,
     { isActive: true },
     { new: true }
   );

   if (!company) {
     return res.status(404).json({
       success: false,
       error: 'Company not found'
     });
   }

   res.json({
     success: true,
     message: 'Company activated successfully',
     data: { company }
   });

 } catch (error) {
   console.error('Activate company error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to activate company'
   });
 }
});

module.exports = router;