const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

class AuthController {
  // Enhanced signup with admin approval requirement
  async signup(req, res) {
    try {
      const { email, password, fullName, phone, username } = req.body;

      // Validation
      if (!email || !password || !fullName) {
        return res.status(400).json({
          success: false,
          message: 'Email, password, and full name are required'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ 
        $or: [
          { email: email.toLowerCase() },
          ...(username ? [{ username: username.toLowerCase() }] : [])
        ]
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: existingUser.email === email.toLowerCase() 
            ? 'User with this email already exists'
            : 'Username already taken'
        });
      }

      // Parse full name
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      // Create user with pending activation status
      const user = new User({
        email: email.toLowerCase(),
        password, // Will be hashed by pre-save middleware
        username: username?.toLowerCase() || email.split('@')[0],
        firstName,
        lastName,
        phoneNumber: phone,
        // Account starts as pending activation
        isAccountActivated: false,
        accountStatus: 'pending_activation',
        // API access starts as pending approval
        isApiAccessApproved: false,
        apiAccessStatus: 'pending_approval'
      });

      await user.save();

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // Update login tracking
      await user.updateLoginTracking();

      // Prepare response (exclude sensitive fields)
      const userResponse = {
        id: user._id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        phone: user.phoneNumber,
        isVerified: user.isEmailVerified,
        isAccountActivated: user.isAccountActivated,
        accountStatus: user.accountStatus,
        isApiAccessApproved: user.isApiAccessApproved,
        apiAccessStatus: user.apiAccessStatus,
        createdAt: user.createdAt,
        lastLogin: user.lastLoginAt
      };

      res.status(201).json({
        success: true,
        message: 'Account created successfully. Admin activation required before you can create businesses.',
        data: {
          user: userResponse,
          token,
          activationInfo: {
            accountActivated: false,
            apiAccessApproved: false,
            canCreateBusiness: false,
            canAccessApiCredentials: false,
            nextSteps: 'Wait for admin to activate your account. You will be notified via email when approved.'
          },
          activationRequired: true
        }
      });

    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during registration',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Enhanced login with activation status
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Find user
      const user = await User.findOne({ 
        $or: [
          { email: email.toLowerCase() },
          { username: email.toLowerCase() }
        ]
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check password
      const isValidPassword = await user.comparePassword(password);
      
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // Update login tracking
      await user.updateLoginTracking();

      // Prepare response with activation status
      const userResponse = {
        id: user._id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        phone: user.phoneNumber,
        isVerified: user.isEmailVerified,
        isAccountActivated: user.isAccountActivated,
        accountStatus: user.accountStatus,
        isApiAccessApproved: user.isApiAccessApproved,
        apiAccessStatus: user.apiAccessStatus,
        createdAt: user.createdAt,
        lastLogin: user.lastLoginAt
      };

      // Determine what user can do
      const canCreateBusiness = user.canCreateBusiness();
      const canAccessApi = user.canAccessApi();

      let nextSteps = '';
      if (!user.isAccountActivated) {
        nextSteps = 'Wait for admin to activate your account before creating businesses';
      } else if (!user.isApiAccessApproved) {
        nextSteps = 'You can create businesses. Request API access for credentials.';
      } else {
        nextSteps = 'You have full access - create businesses and use API credentials';
      }

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: userResponse,
          token,
          activationInfo: {
            accountActivated: user.isAccountActivated,
            apiAccessApproved: user.isApiAccessApproved,
            canCreateBusiness,
            canAccessApiCredentials: canAccessApi,
            nextSteps
          }
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during login',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get detailed activation status
  async getActivationStatus(req, res) {
    try {
      const userId = req.user.id;
      
      const user = await User.findById(userId).select(
        'email username firstName lastName isAccountActivated accountStatus activatedAt activatedBy ' +
        'isApiAccessApproved apiAccessStatus apiAccessApprovedAt apiAccessApprovedBy apiAccessRequestedAt ' +
        'apiAccessRejectedAt apiAccessRevokedAt createdAt'
      );
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Helper function to get next steps message
      const getNextStepsMessage = (user) => {
        if (!user.isAccountActivated) {
          return 'Wait for admin to activate your account, then you can create businesses';
        } else if (!user.isApiAccessApproved) {
          return 'You can create businesses, but contact support for API access approval to get API credentials';
        } else {
          return 'You have full access - create businesses and access API credentials';
        }
      };

      res.json({
        success: true,
        data: {
          userId: user._id,
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
            apiAccessRequestedAt: user.apiAccessRequestedAt,
            apiAccessRejectedAt: user.apiAccessRejectedAt,
            apiAccessRevokedAt: user.apiAccessRevokedAt,
            message: user.isApiAccessApproved 
              ? 'Your API access is approved - you can access API credentials'
              : 'Your API access is pending admin approval'
          },
          registeredAt: user.createdAt,
          overallStatus: {
            canCreateBusiness: user.canCreateBusiness(),
            canAccessApiCredentials: user.canAccessApi(),
            nextSteps: getNextStepsMessage(user)
          }
        }
      });

    } catch (error) {
      console.error('Get activation status error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking activation status'
      });
    }
  }

  // Request API access from admin
  async requestApiAccess(req, res) {
    try {
      const userId = req.user.id;
      const { reason, businessUseCase } = req.body;

      const user = await User.findById(userId).select(
        'isAccountActivated accountStatus isApiAccessApproved apiAccessStatus email username'
      );
      
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

  // Enhanced profile with activation info
  async getProfile(req, res) {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId).select('-password -resetPasswordToken -emailVerificationToken');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Prepare response with account summary
      const userResponse = {
        id: user._id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phoneNumber,
        dateOfBirth: user.dateOfBirth,
        country: user.country,
        isVerified: user.isEmailVerified,
        isAccountActivated: user.isAccountActivated,
        accountStatus: user.accountStatus,
        isApiAccessApproved: user.isApiAccessApproved,
        apiAccessStatus: user.apiAccessStatus,
        profileCompleteness: user.profileCompleteness,
        preferences: user.preferences,
        createdAt: user.createdAt,
        lastLogin: user.lastLoginAt,
        // Add account summary
        accountSummary: {
          canCreateBusiness: user.canCreateBusiness(),
          canAccessApi: user.canAccessApi(),
          activationStatus: user.accountStatus,
          apiAccessStatus: user.apiAccessStatus
        }
      };

      res.json({
        success: true,
        data: userResponse
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Forgot password (unchanged)
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const user = await User.findOne({ email: email.toLowerCase() });

      // Always return success message for security (don't reveal if email exists)
      const successMessage = 'If an account with that email exists, a password reset link has been sent';

      if (!user) {
        return res.json({
          success: true,
          message: successMessage
        });
      }

      // Generate reset token
      const resetToken = user.generateResetPasswordToken();
      await user.save();

      // TODO: Send reset email
      // await emailService.sendPasswordReset(user.email, resetToken);

      const response = {
        success: true,
        message: successMessage
      };

      // In development, include token for testing
      if (process.env.NODE_ENV === 'development') {
        response.resetToken = resetToken;
        response.devNote = 'Reset token included for development only';
      }

      res.json(response);

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Reset password (unchanged)
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Token and new password are required'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      // Hash the token to compare with stored hash
      const crypto = require('crypto');
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      // Update password and clear reset token
      user.password = newPassword; // Will be hashed by pre-save middleware
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.json({
        success: true,
        message: 'Password reset successfully'
      });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Change password (unchanged)
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long'
        });
      }

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);

      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Update password
      user.password = newPassword; // Will be hashed by pre-save middleware
      await user.save();

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Logout (unchanged)
  async logout(req, res) {
    try {
      // In a stateless JWT system, logout is typically handled client-side
      // by removing the token. However, you might want to implement token blacklisting
      
      // TODO: Add token to blacklist if implementing token blacklisting
      // await TokenBlacklist.create({ token: req.token, expiresAt: req.user.exp });

      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = new AuthController();