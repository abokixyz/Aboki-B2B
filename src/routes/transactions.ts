// src/routes/transactions.ts
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateApiKey, authenticateJWT, requirePermission, requireRole } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

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
    const where: any = {};
    if (status) where.status = status;
    if (blockchainType) where.blockchainType = blockchainType;
    if (companyId) where.companyId = companyId;
    
    // Date filtering
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }),
      prisma.transaction.count({ where })
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

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            email: true,
            walletAddress: true
          }
        }
      }
    });

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
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

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

    const transaction = await prisma.transaction.create({
      data: {
        companyId,
        blockchainType,
        contractAddress,
        functionName,
        parameters,
        amount: amount ? parseFloat(amount) : null,
        currency,
        type,
        status: 'PENDING'
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

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

    const updateData: any = { status };
    
    if (txHash) updateData.txHash = txHash;
    if (gasUsed) updateData.gasUsed = gasUsed.toString();
    if (gasPrice) updateData.gasPrice = gasPrice.toString();
    if (errorMessage) updateData.errorMessage = errorMessage;
    
    // Set completion timestamp for final states
    if (['CONFIRMED', 'FAILED', 'CANCELLED'].includes(status)) {
      updateData.completedAt = new Date();
    }

    const transaction = await prisma.transaction.update({
      where: { id },
      data: updateData,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

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

    const where: any = {
      createdAt: { gte: startDate }
    };
    
    if (companyId) where.companyId = companyId;
    if (blockchainType) where.blockchainType = blockchainType;

    const [
      totalTransactions,
      pendingTransactions,
      confirmedTransactions,
      failedTransactions,
      totalVolume
    ] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.count({ where: { ...where, status: 'PENDING' } }),
      prisma.transaction.count({ where: { ...where, status: 'CONFIRMED' } }),
      prisma.transaction.count({ where: { ...where, status: 'FAILED' } }),
      prisma.transaction.aggregate({
        where: { ...where, amount: { not: null } },
        _sum: { amount: true }
      })
    ]);

    // Get daily transaction counts for the chart
    const dailyStats = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        SUM(CASE WHEN amount IS NOT NULL THEN amount ELSE 0 END) as volume
      FROM transactions 
      WHERE created_at >= ${startDate}
      ${companyId ? `AND company_id = ${companyId}` : ''}
      ${blockchainType ? `AND blockchain_type = ${blockchainType}` : ''}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `;

    res.json({
      success: true,
      data: {
        overview: {
          total: totalTransactions,
          pending: pendingTransactions,
          confirmed: confirmedTransactions,
          failed: failedTransactions,
          successRate: totalTransactions > 0 ? (confirmedTransactions / totalTransactions * 100).toFixed(2) : 0,
          totalVolume: totalVolume._sum.amount || 0
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

    const transaction = await prisma.transaction.findUnique({
      where: { id }
    });

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

    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        errorMessage: reason || 'Cancelled by user',
        completedAt: new Date()
      }
    });

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

    const originalTransaction = await prisma.transaction.findUnique({
      where: { id }
    });

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
    const newTransaction = await prisma.transaction.create({
      data: {
        companyId: originalTransaction.companyId,
        blockchainType: originalTransaction.blockchainType,
        contractAddress: originalTransaction.contractAddress,
        functionName: originalTransaction.functionName,
        parameters: originalTransaction.parameters as any,
        amount: originalTransaction.amount,
        currency: originalTransaction.currency,
        type: originalTransaction.type,
        status: 'PENDING',
        metadata: {
          ...originalTransaction.metadata as any,
          retryOf: originalTransaction.id
        }
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

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

export default router;