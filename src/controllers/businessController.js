// controllers/businessController.js - UPDATED WITH STRICTER ADMIN APPROVAL CHECK

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { User, Business, ApiKey } = require('../models');
const { DEFAULT_TOKENS, getDefaultTokensForNetwork, isDefaultToken, getDefaultTokenCount } = require('../config/defaultTokens');

class BusinessController {
  // Helper method to initialize default tokens for a business
  static initializeDefaultTokens(business) {
    // Initialize supportedTokens and feeConfiguration
    business.supportedTokens = {
      base: [],
      solana: [],
      ethereum: []
    };
    business.feeConfiguration = {
      base: [],
      solana: [],
      ethereum: []
    };

    // Add default tokens for each network
    Object.keys(DEFAULT_TOKENS).forEach(network => {
      DEFAULT_TOKENS[network].forEach(tokenTemplate => {
        // Add to supported tokens
        const token = {
          ...tokenTemplate,
          addedAt: new Date(),
          metadata: {}
        };
        business.supportedTokens[network].push(token);

        // Add default fee configuration (0% fee)
        business.feeConfiguration[network].push({
          contractAddress: tokenTemplate.contractAddress,
          symbol: tokenTemplate.symbol,
          feePercentage: 0, // Default fee is 0%
          isActive: true,
          isDefault: true,
          updatedAt: new Date()
        });
      });
    });

    business.supportedTokensUpdatedAt = new Date();
  }

  // UPDATED: Stricter middleware to check if user account is activated
  static async checkAccountActivation(req, res, next) {
    try {
      const userId = req.user.id;
      
      // Find user and check activation status
      const user = await User.findById(userId).select('verificationStatus isApiEnabled accountStatus isVerified email fullName');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      console.log(`🔍 Account activation check for user: ${user.email}`, {
        isVerified: user.isVerified,
        verificationStatus: user.verificationStatus,
        isApiEnabled: user.isApiEnabled,
        accountStatus: user.accountStatus
      });

      // Check if user email is verified FIRST
      if (!user.isVerified) {
        console.log(`❌ Email not verified: ${user.email}`);
        return res.status(403).json({
          success: false,
          message: 'Please verify your email address first before creating a business.',
          emailVerified: false,
          verificationStatus: user.verificationStatus || 'pending',
          isApiEnabled: false,
          step: 1,
          nextStep: 'Check your email and click the verification link',
          requiresAdminApproval: true
        });
      }

      // STRICT CHECK: Verify admin approval status
      const verificationStatus = user.verificationStatus || 'pending';
      const isApiEnabled = user.isApiEnabled || false;

      if (verificationStatus !== 'approved') {
        console.log(`❌ Admin approval pending: ${user.email} - status: ${verificationStatus}`);
        return res.status(403).json({
          success: false,
          message: 'Your account is pending admin approval. Please wait for admin verification before creating a business.',
          verificationStatus,
          isApiEnabled: false,
          emailVerified: user.isVerified,
          step: 2,
          currentStatus: verificationStatus,
          nextStep: 'Wait for admin verification (1-2 business days)',
          note: 'Admin verification is required for business creation and API access',
          contactSupport: 'If this is taking longer than expected, please contact support'
        });
      }

      if (!isApiEnabled) {
        console.log(`❌ API access not enabled: ${user.email}`);
        return res.status(403).json({
          success: false,
          message: 'Your API access is not enabled. Please contact admin for API access.',
          verificationStatus: 'approved',
          isApiEnabled: false,
          emailVerified: user.isVerified,
          step: 3,
          nextStep: 'Contact admin to enable API access',
          note: 'API access must be enabled by admin for business operations'
        });
      }

      // Check account status
      const accountStatus = user.accountStatus || 'active';
      if (accountStatus !== 'active') {
        console.log(`❌ Account not active: ${user.email} - status: ${accountStatus}`);
        return res.status(403).json({
          success: false,
          message: `Your account status is ${accountStatus}. Contact support for assistance.`,
          accountStatus,
          verificationStatus,
          isApiEnabled,
          emailVerified: user.isVerified
        });
      }

      console.log(`✅ Account activation check passed: ${user.email}`);

      // Add user verification info to request for logging
      req.userVerificationInfo = {
        isEmailVerified: user.isVerified,
        verificationStatus: user.verificationStatus,
        isApiEnabled: user.isApiEnabled,
        accountStatus,
        userId: user._id,
        email: user.email
      };

      next();
    } catch (error) {
      console.error('Account activation check error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking account verification status',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Generate API keys for business
  static async generateApiKeys(businessId, userId, approvedBy = null) {
    try {
      // Generate public key (visible identifier)
      const publicKey = `pk_live_${crypto.randomBytes(16).toString('hex')}`;
      
      // Generate client key (for frontend/client-side use)
      const clientKey = `ck_${crypto.randomBytes(12).toString('hex')}`;
      
      // Generate secret key (for server-side use)
      const secretKey = `***REMOVED***${crypto.randomBytes(24).toString('hex')}`;
      
      // Hash the secret key for storage
      const saltRounds = 12;
      const hashedSecretKey = await bcrypt.hash(secretKey, saltRounds);

      // Create API key record with all required fields
      const apiKeyRecord = new ApiKey({
        businessId,
        userId,
        publicKey,
        clientKey,
        secretKey: hashedSecretKey, // Store hashed version
        permissions: ['read', 'write', 'validate'], // Default permissions
        isActive: true,
        isApproved: true, // Auto-approve for business creation
        approvedBy: approvedBy || userId,
        approvedAt: new Date(),
        createdAt: new Date(),
        lastUsedAt: null
      });

      await apiKeyRecord.save();

      return {
        publicKey,
        clientKey,
        secretKey // Return plain text version (only time it's available)
      };

    } catch (error) {
      console.error('Error generating API keys:', error);
      throw error;
    }
  }

  // Helper method to add default tokens to existing businesses
  static async addDefaultTokensToExistingBusiness(business) {
    try {
      // Initialize if not exists
      if (!business.supportedTokens) {
        business.supportedTokens = { base: [], solana: [], ethereum: [] };
      }
      if (!business.feeConfiguration) {
        business.feeConfiguration = { base: [], solana: [], ethereum: [] };
      }

      let tokensAdded = 0;

      // Add missing default tokens for each network
      Object.keys(DEFAULT_TOKENS).forEach(network => {
        if (!business.supportedTokens[network]) {
          business.supportedTokens[network] = [];
        }
        if (!business.feeConfiguration[network]) {
          business.feeConfiguration[network] = [];
        }

        DEFAULT_TOKENS[network].forEach(tokenTemplate => {
          // Check if token already exists
          const existingToken = business.supportedTokens[network].find(
            t => t.contractAddress.toLowerCase() === tokenTemplate.contractAddress.toLowerCase()
          );

          if (!existingToken) {
            // Add to supported tokens
            const token = {
              ...tokenTemplate,
              addedAt: new Date(),
              metadata: {}
            };
            business.supportedTokens[network].push(token);

            // Add default fee configuration (0% fee)
            business.feeConfiguration[network].push({
              contractAddress: tokenTemplate.contractAddress,
              symbol: tokenTemplate.symbol,
              feePercentage: 0, // Default fee is 0%
              isActive: true,
              isDefault: true,
              updatedAt: new Date()
            });

            tokensAdded++;
          }
        });
      });

      if (tokensAdded > 0) {
        business.supportedTokensUpdatedAt = new Date();
        business.updatedAt = new Date();
        await business.save();
      }

      return tokensAdded;
    } catch (error) {
      console.error('Error adding default tokens to existing business:', error);
      throw error;
    }
  }

  // Create a new business (with STRICT account activation check)
  async createBusiness(req, res) {
    try {
      const userId = req.user.id;
      const {
        businessName,
        businessType,
        description,
        industry,
        country,
        registrationNumber,
        taxId,
        website,
        phoneNumber,
        address,
        logo
      } = req.body;

      // Account verification is already checked by middleware
      // Log the verification info for audit trail
      console.log(`🏢 Business creation attempt by verified user:`, {
        userId,
        email: req.userVerificationInfo.email,
        verificationStatus: req.userVerificationInfo.verificationStatus,
        isApiEnabled: req.userVerificationInfo.isApiEnabled,
        businessName
      });

      // Validation
      if (!businessName || !businessType || !industry || !country) {
        return res.status(400).json({
          success: false,
          message: 'Business name, type, industry, and country are required'
        });
      }

      // Validate business type
      const allowedBusinessTypes = [
        'LLC',
        'Corporation',
        'Partnership',
        'Sole Proprietorship',
        'Non-Profit',
        'Other'
      ];

      if (!allowedBusinessTypes.includes(businessType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid business type. Allowed types: ' + allowedBusinessTypes.join(', ')
        });
      }

      // Validate industry
      const allowedIndustries = [
        'Technology',
        'Finance',
        'Healthcare',
        'Education',
        'E-commerce',
        'Manufacturing',
        'Real Estate',
        'Consulting',
        'Marketing',
        'Food & Beverage',
        'Entertainment',
        'Transportation',
        'Energy',
        'Agriculture',
        'Fintech',
        'Cryptocurrency',
        'Other'
      ];

      if (!allowedIndustries.includes(industry)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid industry. Allowed industries: ' + allowedIndustries.join(', ')
        });
      }

      // Check if user already has an ACTIVE business (exclude deleted ones)
      const existingBusiness = await Business.findOne({ 
        ownerId: userId,
        status: { $ne: 'deleted' } // Exclude soft-deleted businesses
      });
      
      if (existingBusiness) {
        return res.status(409).json({
          success: false,
          message: 'User already has an active business. Only one active business per user is allowed.',
          currentBusiness: {
            businessId: existingBusiness.businessId,
            businessName: existingBusiness.businessName,
            status: existingBusiness.status
          }
        });
      }

      // Validate business name uniqueness (excluding deleted businesses)
      const existingBusinessName = await Business.findOne({ 
        businessName: { $regex: new RegExp(`^${businessName}$`, 'i') },
        status: { $ne: 'deleted' } // Exclude soft-deleted businesses
      });
      
      if (existingBusinessName) {
        return res.status(409).json({
          success: false,
          message: 'Business name already exists among active businesses. Please choose a different name.'
        });
      }

      // Generate business ID
      const businessId = `BIZ_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Create business
      const newBusiness = new Business({
        businessId,
        ownerId: userId,
        businessName: businessName.trim(),
        businessType,
        description: description?.trim(),
        industry,
        country,
        registrationNumber: registrationNumber?.trim(),
        taxId: taxId?.trim(),
        website: website?.trim(),
        phoneNumber: phoneNumber?.trim(),
        address: address ? {
          street: address.street?.trim(),
          city: address.city?.trim(),
          state: address.state?.trim(),
          zipCode: address.zipCode?.trim(),
          country: address.country?.trim() || country
        } : undefined,
        logo: logo?.trim(),
        status: 'pending_verification',
        verificationDocuments: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Initialize default tokens and fees
      BusinessController.initializeDefaultTokens(newBusiness);

      await newBusiness.save();

      // Generate API keys for the business
      const apiKeys = await BusinessController.generateApiKeys(newBusiness._id, userId, userId);

      // Get default token counts
      const defaultTokenCounts = getDefaultTokenCount();

      console.log(`✅ Business created successfully:`, {
        businessId: newBusiness.businessId,
        businessName: newBusiness.businessName,
        ownerId: userId,
        ownerEmail: req.userVerificationInfo.email,
        defaultTokensAdded: defaultTokenCounts.total
      });

      // Remove sensitive fields from response
      const businessResponse = {
        businessId: newBusiness.businessId,
        businessName: newBusiness.businessName,
        businessType: newBusiness.businessType,
        description: newBusiness.description,
        industry: newBusiness.industry,
        country: newBusiness.country,
        website: newBusiness.website,
        phoneNumber: newBusiness.phoneNumber,
        address: newBusiness.address,
        logo: newBusiness.logo,
        status: newBusiness.status,
        supportedTokens: newBusiness.supportedTokens,
        defaultTokensInfo: {
          message: 'Your business has been initialized with default supported tokens',
          defaultTokensCount: defaultTokenCounts,
          defaultFeePercentage: '0% (You can customize these fees)'
        },
        createdAt: newBusiness.createdAt
      };

      res.status(201).json({
        success: true,
        message: 'Business created successfully with API credentials and default supported tokens',
        data: businessResponse,
        apiCredentials: {
          publicKey: apiKeys.publicKey,
          clientKey: apiKeys.clientKey,
          secretKey: apiKeys.secretKey, // Show full secret key only once
          warning: 'Store these credentials securely. The secret key will not be shown again.'
        }
      });

    } catch (error) {
      console.error('Create business error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during business creation',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Rest of the methods remain the same...
  async getBusinessProfile(req, res) {
    try {
      const userId = req.user.id;

      const business = await Business.findOne({ 
        ownerId: userId,
        status: { $ne: 'deleted' } // Exclude soft-deleted businesses
      }).select('-registrationNumber -taxId -verificationDocuments');

      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'No active business found. Please create a business first.'
        });
      }

      // Add default tokens to existing businesses that don't have them
      const tokensAdded = await BusinessController.addDefaultTokensToExistingBusiness(business);

      // Get API key info (without secret)
      const apiKey = await ApiKey.findOne({ businessId: business._id, isActive: true })
        .select('publicKey clientKey permissions isActive createdAt lastUsedAt');

      const response = {
        success: true,
        data: {
          ...business.toObject(),
          apiCredentials: apiKey ? {
            publicKey: apiKey.publicKey,
            clientKey: apiKey.clientKey,
            permissions: apiKey.permissions,
            isActive: apiKey.isActive,
            createdAt: apiKey.createdAt,
            lastUsedAt: apiKey.lastUsedAt
          } : null
        }
      };

      // Add info if default tokens were just added
      if (tokensAdded > 0) {
        response.message = `Profile retrieved. ${tokensAdded} default tokens were added to your business.`;
      }

      res.json(response);

    } catch (error) {
      console.error('Get business profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // All other methods remain unchanged - just using the same verification flow...
  async updateBusiness(req, res) {
    try {
      const userId = req.user.id;
      const {
        description,
        website,
        phoneNumber,
        address,
        logo
      } = req.body;

      const business = await Business.findOne({ 
        ownerId: userId,
        status: { $ne: 'deleted' }
      });
      
      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'No active business found'
        });
      }

      // Update allowed fields
      if (description !== undefined) business.description = description.trim();
      if (website !== undefined) business.website = website.trim();
      if (phoneNumber !== undefined) business.phoneNumber = phoneNumber.trim();
      if (logo !== undefined) business.logo = logo.trim();
      
      if (address !== undefined) {
        business.address = {
          street: address.street?.trim(),
          city: address.city?.trim(),
          state: address.state?.trim(),
          zipCode: address.zipCode?.trim(),
          country: address.country?.trim() || business.country
        };
      }

      business.updatedAt = new Date();
      await business.save();

      res.json({
        success: true,
        message: 'Business updated successfully',
        data: business
      });

    } catch (error) {
      console.error('Update business error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during business update',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async getVerificationStatus(req, res) {
    try {
      const userId = req.user.id;

      const business = await Business.findOne({ 
        ownerId: userId,
        status: { $ne: 'deleted' }
      }).select('businessId businessName status verificationDocuments createdAt');

      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'No active business found'
        });
      }

      res.json({
        success: true,
        data: {
          businessId: business.businessId,
          businessName: business.businessName,
          status: business.status,
          documentsSubmitted: business.verificationDocuments.length,
          createdAt: business.createdAt
        }
      });

    } catch (error) {
      console.error('Get verification status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async getApiKeyInfo(req, res) {
    try {
      const userId = req.user.id;

      const business = await Business.findOne({ 
        ownerId: userId,
        status: { $ne: 'deleted' }
      });
      
      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'No active business found'
        });
      }

      const apiKey = await ApiKey.findOne({ businessId: business._id, isActive: true })
        .select('publicKey clientKey permissions isActive createdAt lastUsedAt');

      if (!apiKey) {
        return res.status(404).json({
          success: false,
          message: 'No active API keys found'
        });
      }

      res.json({
        success: true,
        data: {
          publicKey: apiKey.publicKey,
          clientKey: apiKey.clientKey,
          permissions: apiKey.permissions,
          isActive: apiKey.isActive,
          createdAt: apiKey.createdAt,
          lastUsedAt: apiKey.lastUsedAt,
          note: 'Secret key is never displayed for security reasons'
        }
      });

    } catch (error) {
      console.error('Get API key info error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async regenerateApiKeys(req, res) {
    try {
      const userId = req.user.id;

      const business = await Business.findOne({ 
        ownerId: userId,
        status: { $ne: 'deleted' }
      });
      
      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'No active business found'
        });
      }

      // Deactivate old API keys
      await ApiKey.updateMany(
        { businessId: business._id },
        { isActive: false, updatedAt: new Date() }
      );

      // Generate new API keys
      const newApiKeys = await BusinessController.generateApiKeys(business._id, userId, userId);

      console.log(`🔑 API keys regenerated for business ${business.businessId} by user ${userId}`);

      res.json({
        success: true,
        message: 'API keys regenerated successfully',
        data: {
          publicKey: newApiKeys.publicKey,
          clientKey: newApiKeys.clientKey,
          secretKey: newApiKeys.secretKey,
          warning: 'Store these credentials securely. The secret key will not be shown again.'
        }
      });

    } catch (error) {
      console.error('Regenerate API keys error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during API key regeneration',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async deleteBusiness(req, res) {
    try {
      const userId = req.user.id;
      const { confirmDelete } = req.body;

      if (!confirmDelete) {
        return res.status(400).json({
          success: false,
          message: 'Please confirm deletion by setting confirmDelete to true'
        });
      }

      const business = await Business.findOne({ 
        ownerId: userId,
        status: { $ne: 'deleted' }
      });
      
      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'No active business found to delete'
        });
      }

      // Deactivate API keys
      await ApiKey.updateMany(
        { businessId: business._id },
        { isActive: false, updatedAt: new Date() }
      );

      // Soft delete - update status instead of actually deleting
      business.status = 'deleted';
      business.deletedAt = new Date();
      business.updatedAt = new Date();
      await business.save();

      res.json({
        success: true,
        message: 'Business and associated API keys deleted successfully. You can now create a new business.',
        data: {
          deletedBusinessId: business.businessId,
          deletedBusinessName: business.businessName,
          deletedAt: business.deletedAt,
          note: 'You can create a new business anytime now'
        }
      });

    } catch (error) {
      console.error('Delete business error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during business deletion',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Check account activation status (for users to check their status)
  async checkActivationStatus(req, res) {
    try {
      const userId = req.user.id;
      
      const user = await User.findById(userId).select('verificationStatus isApiEnabled accountStatus isVerified createdAt email fullName');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const canCreateBusiness = user.isVerified && 
                               user.verificationStatus === 'approved' && 
                               user.isApiEnabled && 
                               (user.accountStatus || 'active') === 'active';

      res.json({
        success: true,
        data: {
          userId,
          email: user.email,
          fullName: user.fullName,
          isEmailVerified: user.isVerified || false,
          verificationStatus: user.verificationStatus || 'pending',
          isApiEnabled: user.isApiEnabled || false,
          accountStatus: user.accountStatus || 'active',
          registeredAt: user.createdAt,
          canCreateBusiness,
          message: canCreateBusiness
            ? 'Your account is fully verified and you can create businesses'
            : 'Your account requires additional verification steps',
          nextSteps: this.getNextSteps(user),
          requirements: {
            emailVerified: user.isVerified || false,
            adminApproved: user.verificationStatus === 'approved',
            apiEnabled: user.isApiEnabled || false,
            accountActive: (user.accountStatus || 'active') === 'active'
          }
        }
      });

    } catch (error) {
      console.error('Check activation status error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking activation status'
      });
    }
  }

  // Helper method to get next steps for user
  getNextSteps(user) {
    if (!user.isVerified) {
      return 'Please verify your email address by clicking the link sent to your email';
    }
    
    if (user.verificationStatus !== 'approved') {
      return 'Your account is pending admin approval. Please wait for verification (1-2 business days)';
    }

    if (!user.isApiEnabled) {
      return 'Your API access needs to be enabled by admin. Contact support if this is taking too long.';
    }
    
    if ((user.accountStatus || 'active') !== 'active') {
      return 'Your account status is not active. Please contact support for assistance';
    }
    
    return 'You can now create and manage your business';
  }

  // Get default tokens configuration (static method for reference)
  static getDefaultTokensConfig() {
    return {
      tokens: DEFAULT_TOKENS,
      info: {
        description: 'These are the default tokens automatically added to every new business',
        defaultFeePercentage: 0,
        customizable: 'Businesses can customize fees and add more tokens',
        protection: 'Default tokens cannot be deleted, only disabled'
      }
    };
  }
}

module.exports = new BusinessController();