const express = require('express');
const router = express.Router();

// Import models
const { User, Business } = require('../models');

// Middleware to verify JWT token (you can import this from a separate file)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  const jwt = require('jsonwebtoken');
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};

// POST /business/create - Create a new business
router.post('/create', authenticateToken, async (req, res) => {
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
      createdAt: newBusiness.createdAt
    };

    res.status(201).json({
      success: true,
      message: 'Business created successfully',
      data: businessResponse
    });

  } catch (error) {
    console.error('Create business error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during business creation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /business/profile - Get business profile
router.get('/profile', authenticateToken, async (req, res) => {
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

    res.json({
      success: true,
      data: business
    });

  } catch (error) {
    console.error('Get business profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /business/update - Update business profile
router.put('/update', authenticateToken, async (req, res) => {
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
});

// GET /business/verification-status - Get verification status
router.get('/verification-status', authenticateToken, async (req, res) => {
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
});

// DELETE /business/delete - Delete business (soft delete)
router.delete('/delete', authenticateToken, async (req, res) => {
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

    // Soft delete - update status instead of actually deleting
    business.status = 'deleted';
    business.deletedAt = new Date();
    business.updatedAt = new Date();
    await business.save();

    res.json({
      success: true,
      message: 'Business deleted successfully'
    });

  } catch (error) {
    console.error('Delete business error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during business deletion',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;