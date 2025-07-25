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

  // Middleware to check if user account is activated
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

  // Create a new business (with account activation check)
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

      // Generate API keys for the business
      const apiKeys = await BusinessController.generateApiKeys(newBusiness._id, userId);

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

  // Generate API keys for business - Made static
  static async generateApiKeys(businessId, userId) {
    try {
      // Generate public key (visible identifier)
      const publicKey = `pk_live_${crypto.randomBytes(16).toString('hex')}`;
      
      // Generate client key (for frontend/client-side use)
      const clientKey = `ck_${crypto.randomBytes(12).toString('hex')}`;
      
      // Generate secret key (for server-side use)
      const secretKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
      
      // Hash the secret key for storage
      const saltRounds = 12;
      const hashedSecretKey = await bcrypt.hash(secretKey, saltRounds);

      // Create API key record
      const apiKeyRecord = new ApiKey({
        businessId,
        userId,
        publicKey,
        clientKey,
        secretKey: hashedSecretKey, // Store hashed version
        permissions: ['read', 'write', 'validate'], // Default permissions
        isActive: true,
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

  // Regenerate API keys (with account activation check)
  async regenerateApiKeys(req, res) {
    try {
      const userId = req.user.id;

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

  // Get API key information (with account activation check)
  async getApiKeyInfo(req, res) {
    try {
      const userId = req.user.id;

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

  // Check account activation status (for users to check their status)
  async checkActivationStatus(req, res) {
    try {
      const userId = req.user.id;
      
      const user = await User.findById(userId).select('isAccountActivated accountStatus activatedAt activatedBy createdAt email username');
      
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
          isAccountActivated: user.isAccountActivated || false,
          accountStatus: user.accountStatus || 'pending_activation',
          registeredAt: user.createdAt,
          activatedAt: user.activatedAt,
          activatedBy: user.activatedBy,
          message: user.isAccountActivated 
            ? 'Your account is activated and you can create businesses'
            : 'Your account is pending admin activation. Please wait for approval.',
          nextSteps: user.isAccountActivated 
            ? 'You can now create and manage your business'
            : 'Contact support if your account has been pending for more than 48 hours'
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