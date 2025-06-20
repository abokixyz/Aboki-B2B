// src/routes/transactions.js
const express = require('express');
const { Transaction, Company } = require('../models');
const { authenticateApiKey, authenticateJWT, requirePermission, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all transactions (with filtering and pagination)
router.get('/', authenticateApiKey, requirePermission('READ'), async (req, res) => {
 try {
   const { 
     page = 1, 
     limit = 20, 
     status, 
     blockchainType, 
     companyId,
     startDate,
     endDate 
   } = req.query;

   const skip = (Number(page) - 1) * Number(limit);

   // Build where clause
   const where = {};
   if (status) where.status = status;
   if (blockchainType) where.blockchainType = blockchainType;
   if (companyId) where.companyId = companyId;
   
   // Date filtering
   if (startDate || endDate) {
     where.createdAt = {};
     if (startDate) where.createdAt.$gte = new Date(startDate);
     if (endDate) where.createdAt.$lte = new Date(endDate);
   }

   const [transactions, total] = await Promise.all([
     Transaction.find(where)
       .skip(skip)
       .limit(Number(limit))
       .sort({ createdAt: -1 })
       .populate('companyId', 'id name email'),
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
   console.error('Get transactions error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to fetch transactions'
   });
 }
});

// Get single transaction
router.get('/:id', authenticateApiKey, requirePermission('READ'), async (req, res) => {
 try {
   const { id } = req.params;

   const transaction = await Transaction.findById(id)
     .populate('companyId', 'id name email walletAddress');

   if (!transaction) {
     return res.status(404).json({
       success: false,
       error: 'Transaction not found'
     });
   }

   res.json({
     success: true,
     data: { transaction }
   });

 } catch (error) {
   console.error('Get transaction error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to fetch transaction'
   });
 }
});

// Create new transaction
router.post('/', authenticateApiKey, requirePermission('WRITE'), async (req, res) => {
 try {
   const {
     companyId,
     blockchainType,
     contractAddress,
     functionName,
     parameters,
     amount,
     currency = 'USD',
     type = 'CONTRACT'
   } = req.body;

   // Validation
   if (!companyId || !blockchainType || !contractAddress || !functionName || !parameters) {
     return res.status(400).json({
       success: false,
       error: 'companyId, blockchainType, contractAddress, functionName, and parameters are required'
     });
   }

   // Verify company exists
   const company = await Company.findById(companyId);

   if (!company) {
     return res.status(404).json({
       success: false,
       error: 'Company not found'
     });
   }

   if (!company.isActive) {
     return res.status(400).json({
       success: false,
       error: 'Company is not active'
     });
   }

   const transaction = await Transaction.create({
     companyId,
     blockchainType,
     contractAddress,
     functionName,
     parameters,
     amount: amount ? parseFloat(amount) : null,
     currency,
     type,
     status: 'PENDING'
   });

   // Populate company data
   await transaction.populate('companyId', 'id name email');

   res.status(201).json({
     success: true,
     message: 'Transaction created successfully',
     data: { transaction }
   });

 } catch (error) {
   console.error('Create transaction error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to create transaction'
   });
 }
});

// Update transaction status (usually called by blockchain webhook)
router.patch('/:id/status', authenticateApiKey, requirePermission('WRITE'), async (req, res) => {
 try {
   const { id } = req.params;
   const { 
     status, 
     txHash, 
     gasUsed, 
     gasPrice, 
     errorMessage 
   } = req.body;

   if (!status) {
     return res.status(400).json({
       success: false,
       error: 'Status is required'
     });
   }

   // Validate status
   const validStatuses = ['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED'];
   if (!validStatuses.includes(status)) {
     return res.status(400).json({
       success: false,
       error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
     });
   }

   const updateData = { status };
   
   if (txHash) updateData.txHash = txHash;
   if (gasUsed) updateData.gasUsed = gasUsed.toString();
   if (gasPrice) updateData.gasPrice = gasPrice.toString();
   if (errorMessage) updateData.errorMessage = errorMessage;
   
   // Set completion timestamp for final states
   if (['CONFIRMED', 'FAILED', 'CANCELLED'].includes(status)) {
     updateData.completedAt = new Date();
   }

   const transaction = await Transaction.findByIdAndUpdate(
     id,
     updateData,
     { new: true }
   ).populate('companyId', 'id name email');

   if (!transaction) {
     return res.status(404).json({
       success: false,
       error: 'Transaction not found'
     });
   }

   res.json({
     success: true,
     message: 'Transaction status updated successfully',
     data: { transaction }
   });

 } catch (error) {
   console.error('Update transaction status error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to update transaction status'
   });
 }
});

// Get transaction statistics
router.get('/stats/overview', authenticateApiKey, requirePermission('READ'), async (req, res) => {
 try {
   const { companyId, blockchainType, days = 30 } = req.query;

   const startDate = new Date();
   startDate.setDate(startDate.getDate() - Number(days));

   const where = {
     createdAt: { $gte: startDate }
   };
   
   if (companyId) where.companyId = companyId;
   if (blockchainType) where.blockchainType = blockchainType;

   const [
     totalTransactions,
     pendingTransactions,
     confirmedTransactions,
     failedTransactions,
     totalVolumeResult
   ] = await Promise.all([
     Transaction.countDocuments(where),
     Transaction.countDocuments({ ...where, status: 'PENDING' }),
     Transaction.countDocuments({ ...where, status: 'CONFIRMED' }),
     Transaction.countDocuments({ ...where, status: 'FAILED' }),
     Transaction.aggregate([
       { $match: { ...where, amount: { $ne: null } } },
       { $group: { _id: null, totalAmount: { $sum: { $toDouble: '$amount' } } } }
     ])
   ]);

   // Get daily transaction counts for the chart
   const dailyStats = await Transaction.aggregate([
     { $match: where },
     {
       $group: {
         _id: {
           $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
         },
         count: { $sum: 1 },
         volume: {
           $sum: {
             $cond: [
               { $ne: ['$amount', null] },
               { $toDouble: '$amount' },
               0
             ]
           }
         }
       }
     },
     { $sort: { _id: -1 } },
     { $limit: 30 },
     {
       $project: {
         date: '$_id',
         count: 1,
         volume: 1,
         _id: 0
       }
     }
   ]);

   const totalVolume = totalVolumeResult.length > 0 ? totalVolumeResult[0].totalAmount : 0;

   res.json({
     success: true,
     data: {
       overview: {
         total: totalTransactions,
         pending: pendingTransactions,
         confirmed: confirmedTransactions,
         failed: failedTransactions,
         successRate: totalTransactions > 0 ? (confirmedTransactions / totalTransactions * 100).toFixed(2) : 0,
         totalVolume: totalVolume || 0
       },
       dailyStats,
       period: `Last ${days} days`
     }
   });

 } catch (error) {
   console.error('Get transaction stats error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to fetch transaction statistics'
   });
 }
});

// Cancel pending transaction
router.patch('/:id/cancel', authenticateApiKey, requirePermission('WRITE'), async (req, res) => {
 try {
   const { id } = req.params;
   const { reason } = req.body;

   const transaction = await Transaction.findById(id);

   if (!transaction) {
     return res.status(404).json({
       success: false,
       error: 'Transaction not found'
     });
   }

   if (transaction.status !== 'PENDING') {
     return res.status(400).json({
       success: false,
       error: 'Only pending transactions can be cancelled'
     });
   }

   const updatedTransaction = await Transaction.findByIdAndUpdate(
     id,
     {
       status: 'CANCELLED',
       errorMessage: reason || 'Cancelled by user',
       completedAt: new Date()
     },
     { new: true }
   );

   res.json({
     success: true,
     message: 'Transaction cancelled successfully',
     data: { transaction: updatedTransaction }
   });

 } catch (error) {
   console.error('Cancel transaction error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to cancel transaction'
   });
 }
});

// Retry failed transaction
router.post('/:id/retry', authenticateApiKey, requirePermission('WRITE'), async (req, res) => {
 try {
   const { id } = req.params;

   const originalTransaction = await Transaction.findById(id);

   if (!originalTransaction) {
     return res.status(404).json({
       success: false,
       error: 'Transaction not found'
     });
   }

   if (originalTransaction.status !== 'FAILED') {
     return res.status(400).json({
       success: false,
       error: 'Only failed transactions can be retried'
     });
   }

   // Create new transaction with same parameters
   const newTransaction = await Transaction.create({
     companyId: originalTransaction.companyId,
     blockchainType: originalTransaction.blockchainType,
     contractAddress: originalTransaction.contractAddress,
     functionName: originalTransaction.functionName,
     parameters: originalTransaction.parameters,
     amount: originalTransaction.amount,
     currency: originalTransaction.currency,
     type: originalTransaction.type,
     status: 'PENDING',
     metadata: {
       ...originalTransaction.metadata,
       retryOf: originalTransaction._id
     }
   });

   // Populate company data
   await newTransaction.populate('companyId', 'id name email');

   res.status(201).json({
     success: true,
     message: 'Transaction retry created successfully',
     data: { transaction: newTransaction }
   });

 } catch (error) {
   console.error('Retry transaction error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to retry transaction'
   });
 }
});

module.exports = router;