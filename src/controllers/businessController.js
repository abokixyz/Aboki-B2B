const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { User, Business, ApiKey } = require('../models');

class BusinessController {
  // Create a new business
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
        'Other'
      ];

      if (!allowedIndustries.includes(industry)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid industry. Allowed industries: ' + allowedIndustries.join(', ')
        });
      }

      // Check if user already has a business
      const existingBusiness = await Business.findOne({ ownerId: userId });
      if (existingBusiness) {
        return res.status(409).json({
          success: false,
          message: 'User already has a business. Only one business per user is allowed.'
        });
      }

      // Validate business name uniqueness
      const existingBusinessName = await Business.findOne({ 
        businessName: { $regex: new RegExp(`^${businessName}$`, 'i') }
      });
      if (existingBusinessName) {
        return res.status(409).json({
          success: false,
          message: 'Business name already exists. Please choose a different name.'
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
        supportedTokens: {
          base: [],
          solana: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await newBusiness.save();

      // Generate API keys for the business - Fixed method call
      const apiKeys = await BusinessController.generateApiKeys(newBusiness._id, userId);

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
        createdAt: newBusiness.createdAt,
        apiCredentials: {
          publicKey: apiKeys.publicKey,
          clientKey: apiKeys.clientKey,
          secretKeyPreview: apiKeys.secretKey.substring(0, 8) + '...',
          note: 'Store the secret key securely. This is the only time it will be shown in full.'
        }
      };

      res.status(201).json({
        success: true,
        message: 'Business created successfully with API credentials',
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
      const secretKey = `***REMOVED***${crypto.randomBytes(24).toString('hex')}`;
      
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

  // Get business profile
  async getBusinessProfile(req, res) {
    try {
      const userId = req.user.id;

      const business = await Business.findOne({ ownerId: userId })
        .select('-registrationNumber -taxId -verificationDocuments');

      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'Business not found. Please create a business first.'
        });
      }

      // Get API key info (without secret)
      const apiKey = await ApiKey.findOne({ businessId: business._id, isActive: true })
        .select('publicKey clientKey permissions isActive createdAt lastUsedAt');

      res.json({
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
      });

    } catch (error) {
      console.error('Get business profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Update business profile
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

      const business = await Business.findOne({ ownerId: userId });
      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'Business not found'
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

  // Get verification status
  async getVerificationStatus(req, res) {
    try {
      const userId = req.user.id;

      const business = await Business.findOne({ ownerId: userId })
        .select('businessId businessName status verificationDocuments createdAt');

      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'Business not found'
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

  // Delete business (soft delete)
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

      const business = await Business.findOne({ ownerId: userId });
      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'Business not found'
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
        message: 'Business and associated API keys deleted successfully'
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

  // Regenerate API keys
  async regenerateApiKeys(req, res) {
    try {
      const userId = req.user.id;

      const business = await Business.findOne({ ownerId: userId });
      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'Business not found'
        });
      }

      // Deactivate old API keys
      await ApiKey.updateMany(
        { businessId: business._id },
        { isActive: false, updatedAt: new Date() }
      );

      // Generate new API keys - Fixed method call
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

  // Get API key information
  async getApiKeyInfo(req, res) {
    try {
      const userId = req.user.id;

      const business = await Business.findOne({ ownerId: userId });
      if (!business) {
        return res.status(404).json({
          success: false,
          message: 'Business not found'
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
}

module.exports = new BusinessController();