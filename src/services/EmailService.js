const nodemailer = require('nodemailer');

class GmailEmailService {
  constructor() {
    // Check if email is enabled
    this.emailEnabled = process.env.EMAIL_ENABLED !== 'false';
    
    console.log('📧 Gmail Email Service Debug:');
    console.log('- Email enabled:', this.emailEnabled);
    console.log('- GMAIL_USER exists:', process.env.GMAIL_USER ? 'YES' : 'NO');
    console.log('- GMAIL_APP_PASSWORD exists:', process.env.GMAIL_APP_PASSWORD ? 'YES' : 'NO');
    console.log('- GMAIL_FROM_NAME:', process.env.GMAIL_FROM_NAME || 'ABOKI');

    if (!this.emailEnabled) {
      console.log('📧 Email service disabled for development');
      return;
    }

    // Initialize Gmail transporter
    this.transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER, // Your Gmail address
        pass: process.env.GMAIL_APP_PASSWORD // Your Gmail app password
      }
    });
    
    // Default sender configuration
    this.defaultSender = {
      name: process.env.GMAIL_FROM_NAME || "ABOKI",
      email: process.env.GMAIL_USER || "your-email@gmail.com"
    };
    
    console.log('✅ Gmail Email Service initialized');
  }

  async testConnection() {
    if (!this.emailEnabled) {
      console.log('📧 Email service disabled - connection test skipped');
      return true;
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.log('⚠️  Gmail credentials not configured');
      return false;
    }

    try {
      console.log('🔍 Testing Gmail connection...');
      
      // Verify SMTP connection
      await this.transporter.verify();
      console.log('✅ Gmail connection test successful');
      return true;
    } catch (error) {
      console.error('❌ Gmail connection test failed:', error.message);
      return false;
    }
  }

  async sendEmail(options) {
    if (!this.emailEnabled) {
      console.log('📧 Email disabled - would have sent:', {
        to: options.to,
        subject: options.subject
      });
      return { success: true, messageId: 'disabled' };
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.log('⚠️  Gmail credentials not configured - skipping email');
      return { success: true, messageId: 'no-credentials' };
    }

    try {
      console.log(`📤 Sending email via Gmail to: ${options.to}`);
      
      const mailOptions = {
        from: `"${this.defaultSender.name}" <${this.defaultSender.email}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        // Optional: Add reply-to if different from sender
        replyTo: process.env.REPLY_TO_EMAIL || this.defaultSender.email
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent successfully to ${options.to}:`, result.messageId);
      
      return { 
        success: true, 
        messageId: result.messageId
      };
    } catch (error) {
      console.error('❌ Gmail email sending failed:', error.message);
      
      // Don't throw error - just log it so auth flow continues
      console.log('⚠️  Authentication will continue without email');
      
      return { 
        success: false, 
        error: error.message
      };
    }
  }

  async sendWelcomeEmail(name, email, verificationToken) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    
    const html = `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Welcome to ABOKI! 🚀</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333;">Hello ${name}!</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            We're thrilled to have you join the ABOKI family! You've just taken the first step 
            towards smarter financial management.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Verify Email Address
            </a>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
              <strong>📋 Important:</strong> After email verification, your account will be reviewed by our admin team for API access. This usually takes 1-2 business days.
            </p>
          </div>
          
          <div style="background: #e3f2fd; border: 1px solid #bbdefb; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="color: #1565c0; margin: 0; font-size: 14px;">
              <strong>⏰ Note:</strong> This verification link will expire in 24 hours.
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.5;">
            If the button doesn't work, copy and paste this URL into your browser:<br>
            <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">${verificationUrl}</a>
          </p>
          
          <p style="color: #666;">
            Welcome to the ABOKI family!<br>
            <strong>The ABOKI Team</strong>
          </p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: email,
      name: name,
      subject: 'Welcome to ABOKI - Verify Your Email 🚀',
      html
    });
  }

  async sendPasswordResetEmail(name, email, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;
    
    const html = `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="background: #FF6B6B; padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Password Reset Request 🔑</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333;">Hello ${name}!</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            We received a request to reset your ABOKI account password. If you made this request, 
            click the button below to reset your password.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: #FF6B6B; color: white; padding: 15px 30px; text-decoration: none; 
                      border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">
              Reset My Password
            </a>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
              <strong>⚠️ Security Notice:</strong> This link will expire in 10 minutes for your security. 
              If you didn't request this password reset, please ignore this email.
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.5;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${resetUrl}" style="color: #FF6B6B; word-break: break-all;">${resetUrl}</a>
          </p>
          
          <p style="color: #666;">
            Best regards,<br>
            <strong>The ABOKI Security Team</strong>
          </p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: email,
      name: name,
      subject: 'Reset Your ABOKI Password 🔑',
      html
    });
  }

  async sendPasswordResetConfirmation(name, email) {
    const html = `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="background: #4CAF50; padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Password Reset Successful! ✅</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333;">Hello ${name}!</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            Your ABOKI account password has been successfully reset. You can now log in 
            with your new password.
          </p>
          
          <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="color: #155724; margin: 0; font-size: 14px;">
              <strong>🔒 Security Tip:</strong> For your account security, make sure to use a strong, unique password 
              and don't share it with anyone.
            </p>
          </div>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.FRONTEND_URL}/login" 
               style="background: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; 
                      border-radius: 5px; font-weight: bold; display: inline-block;">
              Login to Your Account
            </a>
          </div>
          
          <p style="color: #666;">
            Welcome back to ABOKI!<br>
            <strong>The ABOKI Team</strong>
          </p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: email,
      name: name,
      subject: 'Password Reset Successful - ABOKI ✅',
      html
    });
  }

  // ============= ADMIN NOTIFICATION EMAILS =============

  // Send account approval email
  async sendAccountApprovalEmail(fullName, email, apiEnabled = true) {
    const html = `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">🎉 Account Approved!</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">Welcome to ABOKI, ${fullName}!</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: #10B981; color: white; padding: 10px 20px; border-radius: 25px; display: inline-block; margin-bottom: 20px;">
            ✅ Verification Complete
          </div>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Great news! Your ABOKI account has been reviewed and approved by our admin team.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981;">
            <h3 style="color: #111827; margin-top: 0;">What's Next?</h3>
            <ul style="color: #374151; line-height: 1.6;">
              <li><strong>Account Access:</strong> Your account is now fully activated</li>
              ${apiEnabled ? '<li><strong>API Access:</strong> You can now create businesses and generate API keys</li>' : '<li><strong>API Access:</strong> Currently disabled - contact support to enable</li>'}
              <li><strong>Full Features:</strong> Access to all ABOKI platform features</li>
            </ul>
          </div>
          
          ${apiEnabled ? `
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <h3 style="color: #111827; margin-top: 0;">🚀 Getting Started with API</h3>
              <p style="color: #374151; margin-bottom: 10px;">You can now:</p>
              <ol style="color: #374151; line-height: 1.6;">
                <li>Create your business profile</li>
                <li>Generate API credentials</li>
                <li>Configure supported tokens</li>
                <li>Start accepting payments</li>
              </ol>
            </div>
          ` : ''}
          
          <p style="color: #374151; line-height: 1.6;">
            If you have any questions or need assistance getting started, our support team is here to help.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || '#'}/dashboard" 
               style="background: #10B981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
              Access Your Dashboard
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6B7280; font-size: 14px;">
          <p>Thank you for choosing ABOKI!</p>
          <p>Questions? Contact us at <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@aboki.xyz'}" style="color: #10B981;">${process.env.SUPPORT_EMAIL || 'support@aboki.xyz'}</a></p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: email,
      name: fullName,
      subject: '🎉 Your ABOKI Account Has Been Approved!',
      html
    });
  }

  // Send account rejection email
  async sendAccountRejectionEmail(fullName, email, reason) {
    const html = `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">Account Review Update</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">Hi ${fullName},</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: #f56565; color: white; padding: 10px 20px; border-radius: 25px; display: inline-block; margin-bottom: 20px;">
            ⚠️ Review Required
          </div>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Thank you for your interest in ABOKI. After reviewing your account, we need additional information before we can approve your access.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f56565;">
            <h3 style="color: #111827; margin-top: 0;">Review Details:</h3>
            <p style="color: #374151;"><strong>Reason:</strong> ${reason}</p>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="color: #111827; margin-top: 0;">Next Steps:</h3>
            <ul style="color: #374151; line-height: 1.6;">
              <li>Review the reason provided above</li>
              <li>Address any issues mentioned</li>
              <li>Contact our support team for clarification if needed</li>
              <li>Resubmit your application when ready</li>
            </ul>
          </div>
          
          <p style="color: #374151; line-height: 1.6;">
            We're here to help you through this process. Please don't hesitate to reach out if you have any questions.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@aboki.xyz'}" 
               style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
              Contact Support
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6B7280; font-size: 14px;">
          <p>Thank you for your understanding.</p>
          <p>Support Team: <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@aboki.xyz'}" style="color: #667eea;">${process.env.SUPPORT_EMAIL || 'support@aboki.xyz'}</a></p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: email,
      name: fullName,
      subject: 'ABOKI Account Review Update',
      html
    });
  }

  // Send API access change notification
  async sendApiAccessChangeEmail(fullName, email, enabled, reason) {
    const statusColor = enabled ? '#10B981' : '#f59e0b';
    const statusText = enabled ? 'Enabled' : 'Disabled';
    const statusIcon = enabled ? '🚀' : '⚠️';
    
    const html = `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, ${statusColor} 0%, ${enabled ? '#059669' : '#d97706'} 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">${statusIcon} API Access ${statusText}</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">Hi ${fullName},</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: ${statusColor}; color: white; padding: 10px 20px; border-radius: 25px; display: inline-block; margin-bottom: 20px;">
            ${enabled ? '✅ Enabled' : '⚠️ Disabled'}
          </div>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Your ABOKI API access has been ${enabled ? 'enabled' : 'disabled'} by our admin team.
          </p>
          
          ${reason ? `
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor};">
              <h3 style="color: #111827; margin-top: 0;">Details:</h3>
              <p style="color: #374151;">${reason}</p>
            </div>
          ` : ''}
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor};">
            <h3 style="color: #111827; margin-top: 0;">${enabled ? 'What You Can Do Now:' : 'Impact:'}</h3>
            ${enabled ? `
              <ul style="color: #374151; line-height: 1.6;">
                <li>Create and manage business profiles</li>
                <li>Generate API credentials</li>
                <li>Configure payment tokens</li>
                <li>Process transactions</li>
              </ul>
            ` : `
              <ul style="color: #374151; line-height: 1.6;">
                <li>API functionality is temporarily unavailable</li>
                <li>Existing API keys will not work</li>
                <li>Business operations are suspended</li>
                <li>Contact support for assistance</li>
              </ul>
            `}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            ${enabled ? 
              `<a href="${process.env.FRONTEND_URL || '#'}/dashboard" style="background: ${statusColor}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Access Dashboard</a>` :
              `<a href="mailto:${process.env.SUPPORT_EMAIL || 'support@aboki.xyz'}" style="background: ${statusColor}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Contact Support</a>`
            }
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6B7280; font-size: 14px;">
          <p>If you have any questions, contact us at <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@aboki.xyz'}" style="color: ${statusColor};">${process.env.SUPPORT_EMAIL || 'support@aboki.xyz'}</a></p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: email,
      name: fullName,
      subject: `ABOKI API Access ${statusText}`,
      html
    });
  }

  // Send admin notification for new user registration
  async sendNewUserNotificationToAdmin(adminEmail, userData) {
    const html = `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">🆕 New User Registration</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">A new user has registered and requires verification</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="color: #111827; margin-top: 0;">User Details:</h3>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
              <p style="margin: 5px 0; color: #374151;"><strong>Name:</strong> ${userData.fullName}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Email:</strong> ${userData.email}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Phone:</strong> ${userData.phone || 'Not provided'}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Registration Date:</strong> ${new Date(userData.createdAt).toLocaleString()}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Email Verified:</strong> ${userData.isVerified ? 'Yes' : 'No'}</p>
            </div>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="color: #111827; margin-top: 0;">Action Required:</h3>
            <p style="color: #374151;">Please review this user's registration and verify their account for API access.</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.ADMIN_PANEL_URL || process.env.FRONTEND_URL || '#'}/admin/users/pending" 
               style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
              Review in Admin Panel
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6B7280; font-size: 14px;">
          <p>This is an automated notification from ABOKI Admin System</p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: adminEmail,
      name: 'Admin',
      subject: '🆕 New User Registration - Review Required',
      html
    });
  }
}

module.exports = new GmailEmailService();