// src/routes/companies.ts
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateJWT, authenticateApiKey, requireRole, requirePermission } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

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
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        walletAddress: true,
        isActive: true,
        createdAt: true,
        industry: true,
        website: true,
        _count: {
          select: {
            users: true,
            transactions: true,
            contracts: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

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

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            createdAt: true
          }
        },
        transactions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            txHash: true,
            blockchainType: true,
            status: true,
            amount: true,
            currency: true,
            createdAt: true
          }
        },
        contracts: {
          select: {
            id: true,
            name: true,
            address: true,
            blockchainType: true,
            isActive: true,
            createdAt: true
          }
        }
      }
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    res.json({
      success: true,
      data: { company }
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
    const existingCompany = await prisma.company.findUnique({
      where: { email }
    });

    if (existingCompany) {
      return res.status(409).json({
        success: false,
        error: 'Company with this email already exists'
      });
    }

    const company = await prisma.company.create({
      data: {
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
      }
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
    const existingCompany = await prisma.company.findUnique({
      where: { id }
    });

    if (!existingCompany) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    // Check if email is being changed and if it conflicts
    if (email && email !== existingCompany.email) {
      const emailConflict = await prisma.company.findUnique({
        where: { email }
      });

      if (emailConflict) {
        return res.status(409).json({
          success: false,
          error: 'Company with this email already exists'
        });
      }
    }

    const updatedCompany = await prisma.company.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(walletAddress !== undefined && { walletAddress }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(registrationNum !== undefined && { registrationNum }),
        ...(taxId !== undefined && { taxId }),
        ...(website !== undefined && { website }),
        ...(industry !== undefined && { industry })
      }
    });

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
    const where: any = { companyId: id };
    if (status) where.status = status;
    if (blockchainType) where.blockchainType = blockchainType;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          txHash: true,
          blockchainType: true,
          contractAddress: true,
          functionName: true,
          status: true,
          amount: true,
          currency: true,
          gasUsed: true,
          gasPrice: true,
          createdAt: true,
          completedAt: true
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

    const where: any = { companyId: id };
    if (blockchainType) where.blockchainType = blockchainType;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const contracts = await prisma.contract.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        address: true,
        blockchainType: true,
        description: true,
        isActive: true,
        createdAt: true
      }
    });

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

    const company = await prisma.company.update({
      where: { id },
      data: { isActive: false }
    });

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

    const company = await prisma.company.update({
      where: { id },
      data: { isActive: true }
    });

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

export default router;