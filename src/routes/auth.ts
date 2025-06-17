// src/routes/auth.ts
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const router = express.Router();
const prisma = new PrismaClient();

// Generate API Keys
const generateApiKeys = () => {
 const publicKey = `pk_${crypto.randomBytes(16).toString('hex')}`;
 const secretKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
 return { publicKey, secretKey };
};

// Generate JWT Token
const generateToken = (userId: string): string => {
 return jwt.sign(
   { userId }, 
   config.jwt.secret, 
   { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
 );
};

// Signup Route
router.post('/signup', async (req, res) => {
 try {
   const { 
     email, 
     password, 
     firstName, 
     lastName, 
     companyId,  // Optional: link to existing company
     phoneNumber,
     role = 'USER' 
   } = req.body;

   // Validation
   if (!email || !password || !firstName || !lastName) {
     return res.status(400).json({
       success: false,
       error: 'Email, password, firstName, and lastName are required'
     });
   }

   // Email validation
   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
   if (!emailRegex.test(email)) {
     return res.status(400).json({
       success: false,
       error: 'Invalid email format'
     });
   }

   // Password validation
   if (password.length < 8) {
     return res.status(400).json({
       success: false,
       error: 'Password must be at least 8 characters long'
     });
   }

   // Check if user already exists
   const existingUser = await prisma.user.findUnique({
     where: { email }
   });

   if (existingUser) {
     return res.status(409).json({
       success: false,
       error: 'User with this email already exists'
     });
   }

   // Validate company exists if companyId provided
   if (companyId) {
     const company = await prisma.company.findUnique({
       where: { id: companyId }
     });
     
     if (!company) {
       return res.status(400).json({
         success: false,
         error: 'Invalid company ID'
       });
     }
   }

   // Hash password
   const saltRounds = 12;
   const hashedPassword = await bcrypt.hash(password, saltRounds);

   // Generate API keys
   const { publicKey, secretKey } = generateApiKeys();
   const hashedSecretKey = await bcrypt.hash(secretKey, 10);

   // Create user with API keys
   const user = await prisma.user.create({
     data: {
       email,
       password: hashedPassword,
       firstName,
       lastName,
       companyId,
       phoneNumber,
       role,
       isActive: true,
       emailVerified: false,
       apiKeys: {
         create: {
           publicKey,
           secretKey: hashedSecretKey,
           isActive: true,
           name: 'Default API Key',
           permissions: 'READ,WRITE' // Changed to string
         }
       }
     },
     include: {
       apiKeys: {
         select: {
           id: true,
           publicKey: true,
           name: true,
           permissions: true,
           isActive: true,
           createdAt: true
         }
       },
       company: {
         select: {
           id: true,
           name: true,
           email: true
         }
       }
     }
   });

   // Generate JWT token
   const token = generateToken(user.id);

   // Response (never send hashed secret key, only the plain one during signup)
   res.status(201).json({
     success: true,
     message: 'User created successfully',
     data: {
       user: {
         id: user.id,
         email: user.email,
         firstName: user.firstName,
         lastName: user.lastName,
         company: user.company,
         phoneNumber: user.phoneNumber,
         role: user.role,
         isActive: user.isActive,
         emailVerified: user.emailVerified,
         createdAt: user.createdAt
       },
       apiKeys: {
         publicKey,
         secretKey, // Only shown once during signup
         keyId: user.apiKeys[0].id
       },
       token
     },
     warning: 'Store your secret key securely. It will not be shown again.'
   });

 } catch (error) {
   console.error('Signup error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to create user'
   });
 }
});

// Login Route
router.post('/login', async (req, res) => {
 try {
   const { email, password } = req.body;

   if (!email || !password) {
     return res.status(400).json({
       success: false,
       error: 'Email and password are required'
     });
   }

   // Find user
   const user = await prisma.user.findUnique({
     where: { email },
     include: {
       apiKeys: {
         where: { isActive: true },
         select: {
           id: true,
           publicKey: true,
           name: true,
           permissions: true,
           isActive: true,
           createdAt: true
         }
       },
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

   if (!user) {
     return res.status(401).json({
       success: false,
       error: 'Invalid credentials'
     });
   }

   // Check if user is active
   if (!user.isActive) {
     return res.status(401).json({
       success: false,
       error: 'Account is deactivated'
     });
   }

   // Verify password
   const isValidPassword = await bcrypt.compare(password, user.password);
   if (!isValidPassword) {
     return res.status(401).json({
       success: false,
       error: 'Invalid credentials'
     });
   }

   // Generate JWT token
   const token = generateToken(user.id);

   // Update last login
   await prisma.user.update({
     where: { id: user.id },
     data: { lastLoginAt: new Date() }
   });

   res.json({
     success: true,
     message: 'Login successful',
     data: {
       user: {
         id: user.id,
         email: user.email,
         firstName: user.firstName,
         lastName: user.lastName,
         company: user.company,
         phoneNumber: user.phoneNumber,
         role: user.role,
         isActive: user.isActive,
         emailVerified: user.emailVerified,
         lastLoginAt: user.lastLoginAt
       },
       apiKeys: user.apiKeys,
       token
     }
   });

 } catch (error) {
   console.error('Login error:', error);
   res.status(500).json({
     success: false,
     error: 'Login failed'
   });
 }
});

// Forgot Password Route
router.post('/forgot-password', async (req, res) => {
 try {
   const { email } = req.body;

   if (!email) {
     return res.status(400).json({
       success: false,
       error: 'Email is required'
     });
   }

   // Check if user exists
   const user = await prisma.user.findUnique({
     where: { email }
   });

   if (!user) {
     // Don't reveal if email exists or not for security
     return res.json({
       success: true,
       message: 'If the email exists, a reset link has been sent'
     });
   }

   // Generate reset token
   const resetToken = crypto.randomBytes(32).toString('hex');
   const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

   // Store reset token (you'll need to add these fields to User model)
   await prisma.user.update({
     where: { id: user.id },
     data: {
       resetToken,
       resetTokenExpiry
     }
   });

   // TODO: Send email with reset link
   // For now, return the token (remove this in production)
   res.json({
     success: true,
     message: 'Password reset link sent to your email',
     resetToken // Remove this in production
   });

 } catch (error) {
   console.error('Forgot password error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to process forgot password request'
   });
 }
});

// Reset Password Route
router.post('/reset-password', async (req, res) => {
 try {
   const { token, newPassword } = req.body;

   if (!token || !newPassword) {
     return res.status(400).json({
       success: false,
       error: 'Token and new password are required'
     });
   }

   // Password validation
   if (newPassword.length < 8) {
     return res.status(400).json({
       success: false,
       error: 'Password must be at least 8 characters long'
     });
   }

   // Find user with valid reset token
   const user = await prisma.user.findFirst({
     where: {
       resetToken: token,
       resetTokenExpiry: {
         gt: new Date()
       }
     }
   });

   if (!user) {
     return res.status(400).json({
       success: false,
       error: 'Invalid or expired reset token'
     });
   }

   // Hash new password
   const hashedPassword = await bcrypt.hash(newPassword, 12);

   // Update password and clear reset token
   await prisma.user.update({
     where: { id: user.id },
     data: {
       password: hashedPassword,
       resetToken: null,
       resetTokenExpiry: null
     }
   });

   res.json({
     success: true,
     message: 'Password reset successfully'
   });

 } catch (error) {
   console.error('Reset password error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to reset password'
   });
 }
});

// Change Password Route (requires authentication)
router.post('/change-password', async (req, res) => {
 try {
   const { currentPassword, newPassword } = req.body;
   const authHeader = req.headers.authorization;
   const token = authHeader && authHeader.split(' ')[1];

   if (!token) {
     return res.status(401).json({
       success: false,
       error: 'Authentication required'
     });
   }

   if (!currentPassword || !newPassword) {
     return res.status(400).json({
       success: false,
       error: 'Current password and new password are required'
     });
   }

   // Password validation
   if (newPassword.length < 8) {
     return res.status(400).json({
       success: false,
       error: 'New password must be at least 8 characters long'
     });
   }

   // Verify JWT token
   const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
   
   // Get user
   const user = await prisma.user.findUnique({
     where: { id: decoded.userId }
   });

   if (!user || !user.isActive) {
     return res.status(401).json({
       success: false,
       error: 'Invalid user'
     });
   }

   // Verify current password
   const isValidPassword = await bcrypt.compare(currentPassword, user.password);
   if (!isValidPassword) {
     return res.status(401).json({
       success: false,
       error: 'Current password is incorrect'
     });
   }

   // Hash new password
   const hashedPassword = await bcrypt.hash(newPassword, 12);

   // Update password
   await prisma.user.update({
     where: { id: user.id },
     data: { password: hashedPassword }
   });

   res.json({
     success: true,
     message: 'Password changed successfully'
   });

 } catch (error) {
   console.error('Change password error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to change password'
   });
 }
});

// Get User Transaction History
router.get('/transaction-history', async (req, res) => {
 try {
   const authHeader = req.headers.authorization;
   const token = authHeader && authHeader.split(' ')[1];

   if (!token) {
     return res.status(401).json({
       success: false,
       error: 'Authentication required'
     });
   }

   // Verify JWT token
   const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
   
   // Get query parameters for filtering and pagination
   const { 
     page = 1, 
     limit = 20, 
     status, 
     type,
     startDate,
     endDate,
     sortBy = 'createdAt',
     sortOrder = 'desc'
   } = req.query;

   const skip = (Number(page) - 1) * Number(limit);

   // Build where clause
   const where: any = { userId: decoded.userId };
   if (status) where.status = status;
   if (type) where.type = type;
   
   // Date filtering
   if (startDate || endDate) {
     where.createdAt = {};
     if (startDate) where.createdAt.gte = new Date(startDate as string);
     if (endDate) where.createdAt.lte = new Date(endDate as string);
   }

   // Get transactions and total count
   const [transactions, total] = await Promise.all([
     prisma.userTransaction.findMany({
       where,
       skip,
       take: Number(limit),
       orderBy: { [sortBy as string]: sortOrder },
       select: {
         id: true,
         type: true,
         amount: true,
         currency: true,
         status: true,
         blockchainTxId: true,
         metadata: true,
         createdAt: true,
         updatedAt: true
       }
     }),
     prisma.userTransaction.count({ where })
   ]);

   // Get transaction statistics
   const stats = await prisma.userTransaction.groupBy({
     by: ['status'],
     where: { userId: decoded.userId },
     _count: { status: true },
     _sum: { amount: true }
   });

   // Calculate summary statistics
   const summary = {
     totalTransactions: total,
     totalAmount: transactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0),
     byStatus: stats.reduce((acc, stat) => {
       acc[stat.status] = {
         count: stat._count.status,
         totalAmount: Number(stat._sum.amount) || 0
       };
       return acc;
     }, {} as any)
   };

   res.json({
     success: true,
     data: {
       transactions,
       summary,
       pagination: {
         page: Number(page),
         limit: Number(limit),
         total,
         pages: Math.ceil(total / Number(limit)),
         hasNext: skip + Number(limit) < total,
         hasPrev: Number(page) > 1
       }
     }
   });

 } catch (error) {
   console.error('Transaction history error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to fetch transaction history'
   });
 }
});

// Get Single Transaction Details
router.get('/transaction/:id', async (req, res) => {
 try {
   const authHeader = req.headers.authorization;
   const token = authHeader && authHeader.split(' ')[1];

   if (!token) {
     return res.status(401).json({
       success: false,
       error: 'Authentication required'
     });
   }

   // Verify JWT token
   const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
   const { id } = req.params;

   const transaction = await prisma.userTransaction.findFirst({
     where: {
       id,
       userId: decoded.userId // Ensure user can only access their own transactions
     },
     include: {
       user: {
         select: {
           id: true,
           email: true,
           firstName: true,
           lastName: true
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

// Generate New API Key
router.post('/generate-api-key', async (req, res) => {
 try {
   // This route would need authentication middleware
   const { userId, name = 'New API Key', permissions = 'READ' } = req.body;

   const { publicKey, secretKey } = generateApiKeys();
   const hashedSecretKey = await bcrypt.hash(secretKey, 10);

   const apiKey = await prisma.apiKey.create({
     data: {
       userId,
       publicKey,
       secretKey: hashedSecretKey,
       name,
       permissions,
       isActive: true
     },
     select: {
       id: true,
       publicKey: true,
       name: true,
       permissions: true,
       isActive: true,
       createdAt: true
     }
   });

   res.status(201).json({
     success: true,
     message: 'API key generated successfully',
     data: {
       apiKey,
       secretKey // Only shown once
     },
     warning: 'Store your secret key securely. It will not be shown again.'
   });

 } catch (error) {
   console.error('API key generation error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to generate API key'
   });
 }
});

// Get User's API Keys
router.get('/api-keys/:userId', async (req, res) => {
 try {
   const { userId } = req.params;

   const apiKeys = await prisma.apiKey.findMany({
     where: { 
       userId,
       isActive: true 
     },
     select: {
       id: true,
       publicKey: true,
       name: true,
       permissions: true,
       isActive: true,
       createdAt: true,
       lastUsedAt: true
     },
     orderBy: { createdAt: 'desc' }
   });

   res.json({
     success: true,
     data: { apiKeys }
   });

 } catch (error) {
   console.error('Get API keys error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to fetch API keys'
   });
 }
});

// Revoke API Key
router.delete('/api-keys/:keyId', async (req, res) => {
 try {
   const { keyId } = req.params;

   await prisma.apiKey.update({
     where: { id: keyId },
     data: { 
       isActive: false,
       revokedAt: new Date()
     }
   });

   res.json({
     success: true,
     message: 'API key revoked successfully'
   });

 } catch (error) {
   console.error('Revoke API key error:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to revoke API key'
   });
 }
});

export default router;