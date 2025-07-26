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

  // Enhanced middleware to check both account activation AND admin approval for API access
  static async checkAccountAndApiAccess(req, res, next) {
    try {
      const userId = req.user.id;
      
      // Find user and check activation status
      const user = await User.findById(userId).select('isAccountActivated accountStatus activatedAt activatedBy isApiAccessApproved apiAccessStatus apiAccessApprovedAt apiAccessApprovedBy');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if account is activated
      if (!user.isAccountActivated || user.accountStatus !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Your account is pending admin activation. Please wait for admin approval before you can create or manage businesses.',
          accountStatus: user.accountStatus || 'pending_activation',
          registeredAt: user.createdAt,
          note: 'Contact support if your account has been pending for more than 48 hours'
        });
      }

      // NEW: Check if API access is approved by admin
      if (!user.isApiAccessApproved || user.apiAccessStatus !== 'approved') {
        return res.status(403).json({
          success: false,
          message: 'Your API access is pending admin approval. You can create a business but cannot access API credentials until approved.',
          accountStatus: user.accountStatus,
          apiAccessStatus: user.apiAccessStatus || 'pending_approval',
          activatedAt: user.activatedAt,
          note: 'Contact support if your API access has been pending for more than 72 hours'
        });
      }

      // Add user activation and API access info to request for logging
      req.userActivationInfo = {
        isActivated: user.isAccountActivated,
        status: user.accountStatus,
        activatedAt: user.activatedAt,
        activatedBy: user.activatedBy,
        isApiAccessApproved: user.isApiAccessApproved,
        apiAccessStatus: user.apiAccessStatus,
        apiAccessApprovedAt: user.apiAccessApprovedAt,
        apiAccessApprovedBy: user.apiAccessApprovedBy
      };

      next();
    } catch (error) {
      console.error('Account and API access check error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking account and API access status'
      });
    }
  }

  // Original middleware for basic account activation (for business creation without API access)
  static async checkAccountActivation(req, res, next) {
    try {
      const userId = req.user.id;
      
      // Find user and check activation status
      const user = await User.findById(userId).select('isAccountActivated accountStatus activatedAt activatedBy');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if account is activated
      if (!user.isAccountActivated || user.accountStatus !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Your account is pending admin activation. Please wait for admin approval before you can create or manage businesses.',
          accountStatus: user.accountStatus || 'pending_activation',
          registeredAt: user.createdAt,
          note: 'Contact support if your account has been pending for more than 48 hours'
        });
      }

      // Add user activation info to request for logging
      req.userActivationInfo = {
        isActivated: user.isAccountActivated,
        status: user.accountStatus,
        activatedAt: user.activatedAt,
        activatedBy: user.activatedBy
      };

      next();
    } catch (error) {
      console.error('Account activation check error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking account activation status'
      });
    }
  }

  // Create a new business (with account activation check but API keys only with admin approval)
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

      // Account activation is already checked by middleware
      // Log the activation info for audit
      console.log(`Business creation by activated user: ${userId}`, req.userActivationInfo);

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

      // Check if user has API access approval
      const user = await User.findById(userId).select('isApiAccessApproved apiAccessStatus');
      
      let apiCredentials = null;
      let responseMessage = 'Business created successfully with default supported tokens';
      
      // Only generate API keys if admin has approved API access
      if (user.isApiAccessApproved && user.apiAccessStatus === 'approved') {
        const apiKeys = await BusinessController.generateApiKeys(newBusiness._id, userId);
        apiCredentials = {
          publicKey: apiKeys.publicKey,
          clientKey: apiKeys.clientKey,
          secretKey: apiKeys.secretKey,
          warning: 'Store these credentials securely. The secret key will not be shown again.'
        };
        responseMessage = 'Business created successfully with API credentials and default supported tokens';
      } else {
        responseMessage = 'Business created successfully with default supported tokens. API credentials will be available after admin approval.';
      }

      // Get default token counts
      const defaultTokenCounts = getDefaultTokenCount();

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

      const response = {
        success: true,
        message: responseMessage,
        data: businessResponse
      };

      // Add API credentials only if available
      if (apiCredentials) {
        response.apiCredentials = apiCredentials;
      } else {
        response.apiAccessNote = {
          status: user.apiAccessStatus || 'pending_approval',
          message: 'Your API access is pending admin approval. You will receive API credentials once approved.',
          nextSteps: 'Contact support for API access approval status updates'
        };
      }

      res.status(201).json(response);

    } catch (error) {
      console.error('Create business error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during business creation',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Generate API keys for business - Made static (requires admin approval)
  static async generateApiKeys(businessId, userId) {
    try {
      // Verify user has API access approval
      const user = await User.findById(userId).select('isApiAccessApproved apiAccessStatus');
      
      if (!user.isApiAccessApproved || user.apiAccessStatus !== 'approved') {
        throw new Error('User does not have admin approval for API access');
      }

      // Generate public key (visible identifier)
      const publicKey = `pk_live_${crypto.randomBytes(16).toString('hex')}`;
      
      // Generate client key (for frontend/client-side use)
      const clientKey = `ck_${crypto.randomBytes(12).toString('hex')}`;
      
      // Generate secret key (for server-side use)
      const secretKey = `***REMOVED***${crypto.randomBytes(24).toString('hex')}`;
      
      // Hash the secret key for storage
      const saltRounds = 12;
      const hashedSecretKey = await bcrypt.hash(secretKey, saltRounds);

      // Create API key record with approval tracking
      const apiKeyRecord = new ApiKey({
        businessId,
        userId,
        publicKey,
        clientKey,
        secretKey: hashedSecretKey, // Store hashed version
        permissions: ['read', 'write', 'validate'], // Default permissions
        isActive: true,
        approvedBy: user.apiAccessApprovedBy, // Track who approved API access
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

  // Get business profile (with account activation check)
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

      // Get API key info (without secret) - only if user has API access approval
      const user = await User.findById(userId).select('isApiAccessApproved apiAccessStatus');
      let apiKey = null;
      
      if (user.isApiAccessApproved && user.apiAccessStatus === 'approved') {
        apiKey = await ApiKey.findOne({ businessId: business._id, isActive: true })
          .select('publicKey clientKey permissions isActive createdAt lastUsedAt approvedBy approvedAt');
      }

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
            lastUsedAt: apiKey.lastUsedAt,
            approvedBy: apiKey.approvedBy,
            approvedAt: apiKey.approvedAt
          } : null,
          apiAccessStatus: {
            isApproved: user.isApiAccessApproved || false,
            status: user.apiAccessStatus || 'pending_approval',
            message: user.isApiAccessApproved 
              ? 'API access approved - credentials available'
              : 'API access pending admin approval'
          }
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

  // Update business profile (with account activation check)
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
        status: { $ne: 'deleted' } // Exclude soft-deleted businesses
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

  // Get verification status (with account activation check)
  async getVerificationStatus(req, res) {
    try {
      const userId = req.user.id;

      const business = await Business.findOne({ 
        ownerId: userId,
        status: { $ne: 'deleted' } // Exclude soft-deleted businesses
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

  // Delete business (soft delete) (with account activation check)
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
        status: { $ne: 'deleted' } // Only find active businesses
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

  // Regenerate API keys (requires API access approval)
  async regenerateApiKeys(req, res) {
    try {
      const userId = req.user.id;

      // Check API access approval first
      const user = await User.findById(userId).select('isApiAccessApproved apiAccessStatus');
      
      if (!user.isApiAccessApproved || user.apiAccessStatus !== 'approved') {
        return res.status(403).json({
          success: false,
          message: 'API access not approved by admin. Cannot regenerate API keys.',
          apiAccessStatus: user.apiAccessStatus || 'pending_approval',
          note: 'Contact support for API access approval'
        });
      }

      const business = await Business.findOne({ 
        ownerId: userId,
        status: { $ne: 'deleted' } // Exclude soft-deleted businesses
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
      const newApiKeys = await BusinessController.generateApiKeys(business._id, userId);

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

  // Get API key information (requires API access approval)
  async getApiKeyInfo(req, res) {
    try {
      const userId = req.user.id;

      // Check API access approval first
      const user = await User.findById(userId).select('isApiAccessApproved apiAccessStatus');
      
      if (!user.isApiAccessApproved || user.apiAccessStatus !== 'approved') {
        return res.status(403).json({
          success: false,
          message: 'API access not approved by admin. API key information not available.',
          apiAccessStatus: user.apiAccessStatus || 'pending_approval',
          note: 'Contact support for API access approval'
        });
      }

      const business = await Business.findOne({ 
        ownerId: userId,
        status: { $ne: 'deleted' } // Exclude soft-deleted businesses
      });
      
      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'No active business found'
        });
      }

      const apiKey = await ApiKey.findOne({ businessId: business._id, isActive: true })
        .select('publicKey clientKey permissions isActive createdAt lastUsedAt approvedBy approvedAt');

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
          approvedBy: apiKey.approvedBy,
          approvedAt: apiKey.approvedAt,
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

  // Check account activation and API access status (for users to check their status)
  async checkActivationStatus(req, res) {
    try {
      const userId = req.user.id;
      
      const user = await User.findById(userId).select('isAccountActivated accountStatus activatedAt activatedBy isApiAccessApproved apiAccessStatus apiAccessApprovedAt apiAccessApprovedBy createdAt email username');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          userId,
          email: user.email,
          username: user.username,
          accountActivation: {
            isAccountActivated: user.isAccountActivated || false,
            accountStatus: user.accountStatus || 'pending_activation',
            activatedAt: user.activatedAt,
            activatedBy: user.activatedBy,
            message: user.isAccountActivated 
              ? 'Your account is activated'
              : 'Your account is pending admin activation'
          },
          apiAccess: {
            isApiAccessApproved: user.isApiAccessApproved || false,
            apiAccessStatus: user.apiAccessStatus || 'pending_approval',
            apiAccessApprovedAt: user.apiAccessApprovedAt,
            apiAccessApprovedBy: user.apiAccessApprovedBy,
            message: user.isApiAccessApproved 
              ? 'Your API access is approved - you can access API credentials'
              : 'Your API access is pending admin approval'
          },
          registeredAt: user.createdAt,
          overallStatus: {
            canCreateBusiness: user.isAccountActivated || false,
            canAccessApiCredentials: (user.isAccountActivated && user.isApiAccessApproved) || false,
            nextSteps: this.getNextStepsMessage(user)
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

  // Helper method to generate next steps message
  getNextStepsMessage(user) {
    if (!user.isAccountActivated) {
      return 'Wait for admin to activate your account, then you can create businesses';
    } else if (!user.isApiAccessApproved) {
      return 'You can create businesses, but contact support for API access approval to get API credentials';
    } else {
      return 'You have full access - create businesses and access API credentials';
    }
  }

  // Request API access (for users to request API access from admin)
  async requestApiAccess(req, res) {
    try {
      const userId = req.user.id;
      const { reason, businessUseCase } = req.body;

      const user = await User.findById(userId).select('isAccountActivated accountStatus isApiAccessApproved apiAccessStatus email username');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if account is activated first
      if (!user.isAccountActivated || user.accountStatus !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Your account must be activated before requesting API access'
        });
      }

      // Check if already approved
      if (user.isApiAccessApproved && user.apiAccessStatus === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Your API access is already approved'
        });
      }

      // Check if request is already pending
      if (user.apiAccessStatus === 'pending_approval') {
        return res.status(400).json({
          success: false,
          message: 'Your API access request is already pending admin review'
        });
      }

      // Update user with API access request
      user.apiAccessStatus = 'pending_approval';
      user.apiAccessRequestedAt = new Date();
      user.apiAccessReason = reason?.trim();
      user.businessUseCase = businessUseCase?.trim();
      user.updatedAt = new Date();
      
      await user.save();

      // TODO: Send notification to admin about API access request
      // This could be email, admin dashboard notification, etc.
      
      res.json({
        success: true,
        message: 'API access request submitted successfully',
        data: {
          apiAccessStatus: 'pending_approval',
          requestedAt: user.apiAccessRequestedAt,
          reason: user.apiAccessReason,
          businessUseCase: user.businessUseCase,
          note: 'Admin will review your request. You will be notified of the decision.'
        }
      });

    } catch (error) {
      console.error('Request API access error:', error);
      res.status(500).json({
        success: false,
        message: 'Error submitting API access request'
      });
    }
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

  // ==================== ADMIN METHODS ====================

  // Admin method to approve user account activation
  static async approveUserAccount(req, res) {
    try {
      const { userId } = req.params;
      const adminId = req.admin.id; // Assuming admin authentication middleware

      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.isAccountActivated) {
        return res.status(400).json({
          success: false,
          message: 'User account is already activated'
        });
      }

      // Activate user account
      user.isAccountActivated = true;
      user.accountStatus = 'active';
      user.activatedAt = new Date();
      user.activatedBy = adminId;
      user.updatedAt = new Date();
      
      await user.save();

      res.json({
        success: true,
        message: 'User account activated successfully',
        data: {
          userId: user._id,
          email: user.email,
          username: user.username,
          activatedAt: user.activatedAt,
          activatedBy: adminId
        }
      });

    } catch (error) {
      console.error('Admin approve user account error:', error);
      res.status(500).json({
        success: false,
        message: 'Error activating user account'
      });
    }
  }

  // Admin method to approve API access
  static async approveApiAccess(req, res) {
    try {
      const { userId } = req.params;
      const adminId = req.admin.id; // Assuming admin authentication middleware

      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.isAccountActivated) {
        return res.status(400).json({
          success: false,
          message: 'User account must be activated before approving API access'
        });
      }

      if (user.isApiAccessApproved) {
        return res.status(400).json({
          success: false,
          message: 'User API access is already approved'
        });
      }

      // Approve API access
      user.isApiAccessApproved = true;
      user.apiAccessStatus = 'approved';
      user.apiAccessApprovedAt = new Date();
      user.apiAccessApprovedBy = adminId;
      user.updatedAt = new Date();
      
      await user.save();

      // Check if user has a business and generate API keys if needed
      const business = await Business.findOne({ 
        ownerId: userId, 
        status: { $ne: 'deleted' } 
      });

      let apiKeysGenerated = false;
      let apiCredentials = null;

      if (business) {
        // Check if API keys already exist
        const existingApiKey = await ApiKey.findOne({ 
          businessId: business._id, 
          isActive: true 
        });

        if (!existingApiKey) {
          try {
            const apiKeys = await BusinessController.generateApiKeys(business._id, userId);
            apiKeysGenerated = true;
            apiCredentials = {
              publicKey: apiKeys.publicKey,
              clientKey: apiKeys.clientKey,
              note: 'API credentials generated automatically upon approval'
            };
          } catch (error) {
            console.error('Error auto-generating API keys:', error);
          }
        }
      }

      const response = {
        success: true,
        message: 'User API access approved successfully',
        data: {
          userId: user._id,
          email: user.email,
          username: user.username,
          apiAccessApprovedAt: user.apiAccessApprovedAt,
          apiAccessApprovedBy: adminId,
          hasBusiness: !!business,
          apiKeysGenerated
        }
      };

      if (apiCredentials) {
        response.data.apiCredentials = apiCredentials;
      }

      res.json(response);

    } catch (error) {
      console.error('Admin approve API access error:', error);
      res.status(500).json({
        success: false,
        message: 'Error approving API access'
      });
    }
  }

  // Admin method to reject API access
  static async rejectApiAccess(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = req.admin.id;

      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.isApiAccessApproved) {
        return res.status(400).json({
          success: false,
          message: 'Cannot reject already approved API access'
        });
      }

      // Reject API access
      user.isApiAccessApproved = false;
      user.apiAccessStatus = 'rejected';
      user.apiAccessRejectedAt = new Date();
      user.apiAccessRejectedBy = adminId;
      user.apiAccessRejectionReason = reason?.trim();
      user.updatedAt = new Date();
      
      await user.save();

      res.json({
        success: true,
        message: 'User API access rejected',
        data: {
          userId: user._id,
          email: user.email,
          username: user.username,
          apiAccessStatus: 'rejected',
          rejectedAt: user.apiAccessRejectedAt,
          rejectedBy: adminId,
          reason: user.apiAccessRejectionReason
        }
      });

    } catch (error) {
      console.error('Admin reject API access error:', error);
      res.status(500).json({
        success: false,
        message: 'Error rejecting API access'
      });
    }
  }

  // Admin method to revoke API access
  static async revokeApiAccess(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = req.admin.id;

      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.isApiAccessApproved) {
        return res.status(400).json({
          success: false,
          message: 'User API access is not currently approved'
        });
      }

      // Revoke API access
      user.isApiAccessApproved = false;
      user.apiAccessStatus = 'revoked';
      user.apiAccessRevokedAt = new Date();
      user.apiAccessRevokedBy = adminId;
      user.apiAccessRevocationReason = reason?.trim();
      user.updatedAt = new Date();
      
      await user.save();

      // Deactivate all user's API keys
      const business = await Business.findOne({ 
        ownerId: userId, 
        status: { $ne: 'deleted' } 
      });

      if (business) {
        await ApiKey.updateMany(
          { businessId: business._id, isActive: true },
          { 
            isActive: false, 
            deactivatedAt: new Date(),
            deactivatedBy: adminId,
            deactivationReason: 'API access revoked by admin',
            updatedAt: new Date()
          }
        );
      }

      res.json({
        success: true,
        message: 'User API access revoked and API keys deactivated',
        data: {
          userId: user._id,
          email: user.email,
          username: user.username,
          apiAccessStatus: 'revoked',
          revokedAt: user.apiAccessRevokedAt,
          revokedBy: adminId,
          reason: user.apiAccessRevocationReason,
          apiKeysDeactivated: !!business
        }
      });

    } catch (error) {
      console.error('Admin revoke API access error:', error);
      res.status(500).json({
        success: false,
        message: 'Error revoking API access'
      });
    }
  }

  // Admin method to get pending API access requests
  static async getPendingApiAccessRequests(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      
      const users = await User.find({
        apiAccessStatus: 'pending_approval'
      })
      .select('email username apiAccessRequestedAt apiAccessReason businessUseCase createdAt')
      .sort({ apiAccessRequestedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

      const total = await User.countDocuments({
        apiAccessStatus: 'pending_approval'
      });

      res.json({
        success: true,
        data: {
          requests: users,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalRequests: total,
            hasMore: page * limit < total
          }
        }
      });

    } catch (error) {
      console.error('Get pending API access requests error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching pending API access requests'
      });
    }
  }

  // Admin method to get user details for review
  static async getUserDetailsForReview(req, res) {
    try {
      const { userId } = req.params;
      
      const user = await User.findById(userId)
        .select('-password -resetPasswordToken -emailVerificationToken')
        .populate({
          path: 'businesses',
          match: { status: { $ne: 'deleted' } },
          select: 'businessId businessName businessType industry country status createdAt'
        });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get user's API key info if exists
      const business = await Business.findOne({ 
        ownerId: userId, 
        status: { $ne: 'deleted' } 
      });

      let apiKeyInfo = null;
      if (business) {
        const apiKey = await ApiKey.findOne({ 
          businessId: business._id 
        }).select('isActive createdAt lastUsedAt permissions');
        
        if (apiKey) {
          apiKeyInfo = apiKey;
        }
      }

      res.json({
        success: true,
        data: {
          user,
          business,
          apiKeyInfo,
          reviewSummary: {
            accountStatus: user.accountStatus,
            apiAccessStatus: user.apiAccessStatus,
            hasActiveBusiness: !!business,
            hasApiKeys: !!apiKeyInfo,
            registrationAge: Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24)) + ' days'
          }
        }
      });

    } catch (error) {
      console.error('Get user details for review error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching user details'
      });
    }
  }
}

module.exports = new BusinessController();