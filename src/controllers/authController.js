const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const EmailService = require('../services/EmailService'); // Import the email service

class AuthController {
  // User registration with admin verification
  async signup(req, res) {
    try {
      const { email, password, fullName, phone } = req.body;

      // Validation
      if (!email || !password || !fullName) {
        return res.status(400).json({
          success: false,
          message: 'Email, password, and full name are required'
        });
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Password validation
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Hash password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationTokenExpiry = new Date(Date.now() + 24 * 3600000); // 24 hours

      // Create user with admin verification fields
      const newUser = new User({
        email: email.toLowerCase(),
        password: hashedPassword,
        fullName,
        phone,
        isVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: verificationTokenExpiry,
        
        // Admin verification fields
        verificationStatus: 'pending',
        isApiEnabled: false,
        accountStatus: 'active',
        
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await newUser.save();

      // Send welcome email with verification
      try {
        await EmailService.sendWelcomeEmail(fullName, email.toLowerCase(), verificationToken);
        console.log(`✅ Welcome email sent to ${email}`);
      } catch (emailError) {
        console.error('❌ Failed to send welcome email:', emailError);
        // Don't fail registration if email fails
      }

      // Send notification to admin about new user registration
      try {
        const adminEmail = process.env.ADMIN_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL;
        if (adminEmail) {
          await EmailService.sendNewUserNotificationToAdmin(adminEmail, {
            fullName: newUser.fullName,
            email: newUser.email,
            phone: newUser.phone,
            createdAt: newUser.createdAt,
            isVerified: newUser.isVerified
          });
          console.log(`✅ Admin notification sent for new user: ${email}`);
        }
      } catch (emailError) {
        console.error('❌ Failed to send admin notification email:', emailError);
        // Don't fail registration if admin notification fails
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: newUser._id, 
          email: newUser.email,
          fullName: newUser.fullName
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      // Remove password from response
      const userResponse = {
        id: newUser._id,
        email: newUser.email,
        fullName: newUser.fullName,
        phone: newUser.phone,
        isVerified: newUser.isVerified,
        verificationStatus: newUser.verificationStatus,
        isApiEnabled: newUser.isApiEnabled,
        createdAt: newUser.createdAt
      };

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email to verify your account. Admin verification is required for API access.',
        data: {
          user: userResponse,
          token
        },
        notice: {
          emailVerification: 'Please verify your email address',
          adminVerification: 'Your account requires admin verification for API access',
          expectedWaitTime: '1-2 business days'
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

  // User login with verification status
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
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check account status
      if (user.accountStatus === 'suspended') {
        return res.status(403).json({
          success: false,
          message: 'Your account has been suspended. Please contact support.',
          suspensionReason: user.suspensionReason,
          contactSupport: process.env.SUPPORT_EMAIL || 'support@company.com'
        });
      }

      if (user.accountStatus === 'deactivated') {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated. Please contact support.',
          contactSupport: process.env.SUPPORT_EMAIL || 'support@company.com'
        });
      }

      // Update last login
      await User.updateOne(
        { _id: user._id },
        { 
          lastLogin: new Date(),
          updatedAt: new Date() 
        }
      );

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user._id, 
          email: user.email,
          fullName: user.fullName
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      // Remove password from response
      const userResponse = {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        isVerified: user.isVerified,
        verificationStatus: user.verificationStatus || 'pending',
        isApiEnabled: user.isApiEnabled || false,
        accountStatus: user.accountStatus || 'active',
        lastLogin: new Date(),
        createdAt: user.createdAt
      };

      // Prepare verification status information
      const verificationInfo = this.getVerificationInfo(user);

      const response = {
        success: true,
        message: 'Login successful',
        data: {
          user: userResponse,
          token
        }
      };

      // Add verification info if user needs attention
      if (verificationInfo.requiresAttention) {
        response.verification = verificationInfo;
      }

      res.json(response);

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during login',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Request password reset
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      // Validation
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      // Find user
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        // Return success even if user doesn't exist (security best practice)
        return res.json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent'
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 600000); // 10 minutes from now (security improvement)

      // Save reset token to user
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpiry = resetTokenExpiry;
      user.updatedAt = new Date();
      await user.save();

      // Send password reset email
      try {
        await EmailService.sendPasswordResetEmail(user.fullName, user.email, resetToken);
        console.log(`✅ Password reset email sent to ${user.email}`);
      } catch (emailError) {
        console.error('❌ Failed to send password reset email:', emailError);
        // Still return success for security reasons
      }

      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent',
        // Include token in development mode only
        ...(process.env.NODE_ENV === 'development' && { resetToken })
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during password reset request',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Reset password with token
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      // Validation
      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Reset token and new password are required'
        });
      }

      // Password validation
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      // Find user with valid reset token
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpiry: { $gt: new Date() }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      // Hash new password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update user password and clear reset token
      user.password = hashedPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpiry = undefined;
      user.updatedAt = new Date();
      await user.save();

      // Send password reset confirmation email
      try {
        await EmailService.sendPasswordResetConfirmation(user.fullName, user.email);
        console.log(`✅ Password reset confirmation email sent to ${user.email}`);
      } catch (emailError) {
        console.error('❌ Failed to send password reset confirmation email:', emailError);
        // Don't fail the password reset if email fails
      }

      res.json({
        success: true,
        message: 'Password reset successfully'
      });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during password reset',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Change password for authenticated user
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Validation
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }

      // Password validation
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long'
        });
      }

      // Check if new password is same as current
      if (currentPassword === newPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password must be different from current password'
        });
      }

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Hash new password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      user.password = hashedNewPassword;
      user.updatedAt = new Date();
      await user.save();

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during password change',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get user profile with verification info
  async getProfile(req, res) {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId).select('-password -resetPasswordToken -resetPasswordExpiry -emailVerificationToken');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Add verification info to response
      const userWithVerification = {
        ...user.toObject(),
        verification: {
          emailVerified: user.isVerified,
          adminVerificationStatus: user.verificationStatus || 'pending',
          apiAccessEnabled: user.isApiEnabled || false,
          canCreateBusiness: user.isApiEnabled && user.verificationStatus === 'approved',
          canAccessApi: user.isApiEnabled && user.verificationStatus === 'approved' && user.accountStatus === 'active',
          verifiedAt: user.verifiedAt,
          rejectionReason: user.rejectionReason,
          accountStatus: user.accountStatus || 'active'
        }
      };

      res.json({
        success: true,
        data: userWithVerification
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

  // Get detailed verification status
  async getVerificationStatus(req, res) {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId).select('verificationStatus isApiEnabled verifiedAt rejectionReason verificationHistory accountStatus suspensionReason');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const status = {
        verificationStatus: user.verificationStatus || 'pending',
        isApiEnabled: user.isApiEnabled || false,
        canAccessApi: user.isApiEnabled && user.verificationStatus === 'approved' && user.accountStatus === 'active',
        accountStatus: user.accountStatus || 'active',
        verifiedAt: user.verifiedAt,
        rejectionReason: user.rejectionReason,
        suspensionReason: user.suspensionReason,
        history: user.verificationHistory || []
      };

      // Add status messages and next steps
      const statusInfo = this.getDetailedVerificationInfo(user);
      Object.assign(status, statusInfo);

      res.json({
        success: true,
        data: status
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

  // Verify email
  async verifyEmail(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Verification token is required'
        });
      }

      // Find user with valid verification token
      const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpiry: { $gt: new Date() }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification token'
        });
      }

      // Update user verification status
      user.isVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpiry = undefined;
      user.updatedAt = new Date();
      await user.save();

      // Get current verification info
      const verificationInfo = this.getDetailedVerificationInfo(user);

      res.json({
        success: true,
        message: 'Email verified successfully',
        data: {
          isVerified: true,
          nextSteps: verificationInfo.nextSteps,
          verificationStatus: user.verificationStatus || 'pending'
        }
      });

    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during email verification',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Logout user
  async logout(req, res) {
    try {
      // In a stateless JWT system, logout is handled client-side
      // You could maintain a blacklist of tokens in Redis for enhanced security
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during logout',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Helper method to get verification info for login
  getVerificationInfo(user) {
    const info = {
      requiresAttention: false,
      message: null,
      status: user.verificationStatus || 'pending',
      apiEnabled: user.isApiEnabled || false,
      nextSteps: null
    };

    if (!user.isVerified) {
      info.requiresAttention = true;
      info.message = 'Please verify your email address';
      info.nextSteps = 'Check your email and click the verification link';
    } else if (user.verificationStatus === 'pending') {
      info.requiresAttention = true;
      info.message = 'Your account is pending admin verification for API access';
      info.nextSteps = 'Please wait for admin review (1-2 business days)';
    } else if (user.verificationStatus === 'rejected') {
      info.requiresAttention = true;
      info.message = 'Your account verification was rejected';
      info.nextSteps = 'Contact support for more information';
      info.rejectionReason = user.rejectionReason;
    } else if (user.verificationStatus === 'approved' && !user.isApiEnabled) {
      info.requiresAttention = true;
      info.message = 'Your account is approved but API access is disabled';
      info.nextSteps = 'Contact support to enable API access';
    }

    return info;
  }

  // Helper method to get detailed verification info
  getDetailedVerificationInfo(user) {
    const info = {};

    switch (user.verificationStatus) {
      case 'pending':
        info.message = 'Your account is pending admin verification';
        info.nextSteps = 'Please wait for admin review (1-2 business days)';
        info.estimatedTime = '1-2 business days';
        break;
      case 'approved':
        if (user.isApiEnabled) {
          info.message = 'Your account is verified and API access is enabled';
          info.nextSteps = 'You can now create businesses and use API features';
        } else {
          info.message = 'Your account is verified but API access is disabled';
          info.nextSteps = 'Contact support to enable API access';
        }
        break;
      case 'rejected':
        info.message = 'Your account verification was rejected';
        info.nextSteps = 'Please contact support for more information';
        break;
      case 'suspended':
        info.message = 'Your account has been suspended';
        info.nextSteps = 'Contact support immediately';
        break;
      default:
        info.message = 'Unknown verification status';
        info.nextSteps = 'Contact support for assistance';
    }

    // Add account status info
    if (user.accountStatus === 'suspended') {
      info.message = 'Your account has been suspended';
      info.nextSteps = 'Contact support immediately';
      info.urgency = 'high';
    } else if (user.accountStatus === 'deactivated') {
      info.message = 'Your account has been deactivated';
      info.nextSteps = 'Contact support to reactivate your account';
      info.urgency = 'high';
    }

    info.supportEmail = process.env.SUPPORT_EMAIL || 'support@company.com';
    
    return info;
  }
}

module.exports = new AuthController();