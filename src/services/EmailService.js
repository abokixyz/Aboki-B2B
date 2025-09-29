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

    // Initialize Gmail transporter - FIXED: Changed from createTransporter to createTransport
    this.transporter = nodemailer.createTransport({
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

  // ============= USER EMAIL TEMPLATES =============

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

  // ============= ADMIN EMAIL TEMPLATES =============

  async sendAdminPasswordResetEmail(name, email, resetToken) {
    const resetUrl = `${process.env.ADMIN_PANEL_URL || process.env.FRONTEND_URL}/admin/auth/reset-password?token=${resetToken}`;
    
    const html = `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">🔐 Admin Password Reset</h1>
          <p style="color: #fecaca; margin: 10px 0 0 0; font-size: 16px;">Security Alert - Admin Access</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: #dc2626; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin-bottom: 20px; font-size: 14px;">
            🛡️ Admin Security
          </div>
          
          <h2 style="color: #111827; margin-top: 0;">Hello ${name},</h2>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            A password reset has been requested for your admin account. If you made this request, 
            click the button below to reset your password.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <h3 style="color: #111827; margin-top: 0;">🚨 Security Notice</h3>
            <ul style="color: #374151; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li>This link expires in <strong>10 minutes</strong> for security</li>
              <li>Only use this link if you requested the reset</li>
              <li>If you didn't request this, contact the security team immediately</li>
              <li>Your admin sessions will be invalidated after reset</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: #dc2626; color: white; padding: 15px 30px; text-decoration: none; 
                      border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;
                      box-shadow: 0 4px 6px rgba(220, 38, 38, 0.2);">
              Reset Admin Password
            </a>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #92400e; margin: 0; font-size: 14px;">
              <strong>⚠️ Admin Account:</strong> ${email}<br>
              <strong>🕐 Request Time:</strong> ${new Date().toLocaleString()}<br>
              <strong>⏰ Expires:</strong> 10 minutes from request time
            </p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-top: 25px;">
            If the button doesn't work, copy and paste this secure link:<br>
            <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 12px; word-break: break-all; display: block; margin-top: 8px;">${resetUrl}</code>
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6B7280; font-size: 14px; padding: 20px; background: #f8fafc; border-radius: 8px;">
          <p style="margin: 0;"><strong>ABOKI Admin Security Team</strong></p>
          <p style="margin: 5px 0 0 0;">If you have security concerns: <a href="mailto:${process.env.SECURITY_EMAIL || 'security@aboki.xyz'}" style="color: #dc2626;">${process.env.SECURITY_EMAIL || 'security@aboki.xyz'}</a></p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: email,
      name: name,
      subject: '🔐 ABOKI Admin Password Reset - Security Alert',
      html
    });
  }

  async sendAdminPasswordResetConfirmation(name, email) {
    const html = `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">✅ Admin Password Reset Complete</h1>
          <p style="color: #a7f3d0; margin: 10px 0 0 0; font-size: 16px;">Security Update Successful</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: #059669; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin-bottom: 20px; font-size: 14px;">
            🛡️ Security Confirmed
          </div>
          
          <h2 style="color: #111827; margin-top: 0;">Hello ${name},</h2>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Your admin password has been successfully reset and updated. Your account security has been refreshed.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
            <h3 style="color: #111827; margin-top: 0;">🔒 Security Update Summary</h3>
            <ul style="color: #374151; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li>Admin password successfully changed</li>
              <li>All previous sessions have been invalidated</li>
              <li>You'll need to login again with your new password</li>
              <li>Account security has been refreshed</li>
            </ul>
          </div>
          
          <div style="background: #d1fae5; border: 1px solid #6ee7b7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #065f46; margin: 0; font-size: 14px;">
              <strong>🔐 Security Best Practices:</strong><br>
              • Use a unique password for your admin account<br>
              • Enable two-factor authentication if available<br>
              • Don't share your admin credentials<br>
              • Logout when finished with admin tasks
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.ADMIN_PANEL_URL || process.env.FRONTEND_URL}/admin/login" 
               style="background: #059669; color: white; padding: 15px 30px; text-decoration: none; 
                      border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;
                      box-shadow: 0 4px 6px rgba(5, 150, 105, 0.2);">
              Access Admin Panel
            </a>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #92400e; margin: 0; font-size: 14px;">
              <strong>📋 Account Details:</strong><br>
              <strong>👤 Admin:</strong> ${email}<br>
              <strong>🕐 Reset Time:</strong> ${new Date().toLocaleString()}<br>
              <strong>🔄 Status:</strong> Password updated successfully
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6B7280; font-size: 14px; padding: 20px; background: #f8fafc; border-radius: 8px;">
          <p style="margin: 0;"><strong>ABOKI Admin Security Team</strong></p>
          <p style="margin: 5px 0 0 0;">Security questions? Contact: <a href="mailto:${process.env.SECURITY_EMAIL || 'security@aboki.xyz'}" style="color: #059669;">${process.env.SECURITY_EMAIL || 'security@aboki.xyz'}</a></p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: email,
      name: name,
      subject: '✅ ABOKI Admin Password Reset Complete',
      html
    });
  }

  // ============= USER NOTIFICATION EMAILS =============

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
            Your ABOKI API access has been ${enabled ? 'enabled' : 'disabled'} by our admin team</p>
          
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

  // ============= ADMIN NOTIFICATION EMAILS =============

  async sendNewUserNotificationToAdmin(adminEmail, userData) {
    const html = `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">New User Registration</h1>
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
      subject: 'New User Registration - Review Required',
      html
    });
  }

  // ============= BUSINESS NOTIFICATION EMAILS =============

  async sendBusinessCreationNotification(userData, businessData) {
    const html = `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">Business Profile Created</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Your business has been successfully registered</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: #667eea; color: white; padding: 10px 20px; border-radius: 25px; display: inline-block; margin-bottom: 20px;">
            Business Active
          </div>
          
          <h2 style="color: #111827; margin-top: 0;">Hello ${userData.fullName},</h2>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Your business profile has been successfully created and is now active on the ABOKI platform.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="color: #111827; margin-top: 0;">Business Details:</h3>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
              <p style="margin: 5px 0; color: #374151;"><strong>Business Name:</strong> ${businessData.businessName}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Business ID:</strong> ${businessData.businessId}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Type:</strong> ${businessData.businessType}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Status:</strong> Active</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Created:</strong> ${new Date().toLocaleString()}</p>
            </div>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981;">
            <h3 style="color: #111827; margin-top: 0;">Next Steps:</h3>
            <ul style="color: #374151; line-height: 1.6;">
              <li>Generate your API credentials</li>
              <li>Configure supported payment tokens</li>
              <li>Set up webhook endpoints</li>
              <li>Begin testing transactions</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || '#'}/dashboard/business/${businessData.businessId}" 
               style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
              Manage Business
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6B7280; font-size: 14px;">
          <p>Need help? Contact us at <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@aboki.xyz'}" style="color: #667eea;">${process.env.SUPPORT_EMAIL || 'support@aboki.xyz'}</a></p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: userData.email,
      name: userData.fullName,
      subject: 'Your ABOKI Business Profile is Ready!',
      html
    });
  }

  async sendApiKeyGeneratedNotification(userData, businessData, keyData) {
    const html = `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">API Key Generated</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Your API credentials are ready</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: #059669; color: white; padding: 10px 20px; border-radius: 25px; display: inline-block; margin-bottom: 20px;">
            Credentials Active
          </div>
          
          <h2 style="color: #111827; margin-top: 0;">Hello ${userData.fullName},</h2>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            New API credentials have been generated for your business: <strong>${businessData.businessName}</strong>
          </p>
          
          <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #92400e; margin-top: 0;">Security Notice</h3>
            <p style="color: #92400e; margin: 0; font-size: 14px;">
              For security reasons, API secrets are only shown once during generation. 
              Make sure you've securely stored your credentials before leaving the dashboard.
            </p>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
            <h3 style="color: #111827; margin-top: 0;">API Key Details:</h3>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
              <p style="margin: 5px 0; color: #374151;"><strong>Key Name:</strong> ${keyData.keyName}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Environment:</strong> ${keyData.environment}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Created:</strong> ${new Date().toLocaleString()}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Status:</strong> Active</p>
            </div>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <h3 style="color: #111827; margin-top: 0;">Documentation</h3>
            <p style="color: #374151;">Get started with our API documentation and integration guides:</p>
            <ul style="color: #374151; line-height: 1.6;">
              <li>API Reference and endpoints</li>
              <li>Authentication examples</li>
              <li>Webhook setup guide</li>
              <li>SDKs and libraries</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || '#'}/dashboard/business/${businessData.businessId}/api" 
               style="background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px; margin-right: 10px;">
              View API Keys
            </a>
            <a href="${process.env.FRONTEND_URL || '#'}/docs/api" 
               style="background: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
              API Documentation
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6B7280; font-size: 14px;">
          <p>Questions about integration? <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@aboki.xyz'}" style="color: #059669;">${process.env.SUPPORT_EMAIL || 'support@aboki.xyz'}</a></p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: userData.email,
      name: userData.fullName,
      subject: 'ABOKI API Key Generated Successfully',
      html
    });
  }

  // ============= TRANSACTION NOTIFICATION EMAILS =============

  async sendTransactionNotification(userData, transactionData) {
    const statusColor = transactionData.status === 'completed' ? '#10B981' : 
                       transactionData.status === 'failed' ? '#ef4444' : '#f59e0b';
    const statusIcon = transactionData.status === 'completed' ? 'Success' : 
                      transactionData.status === 'failed' ? 'Failed' : 'Pending';

    const html = `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, ${statusColor} 0%, ${statusColor}dd 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">${statusIcon} Transaction ${transactionData.status.charAt(0).toUpperCase() + transactionData.status.slice(1)}</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Transaction Update for ${userData.fullName}</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: ${statusColor}; color: white; padding: 10px 20px; border-radius: 25px; display: inline-block; margin-bottom: 20px;">
            ${transactionData.status.toUpperCase()}
          </div>
          
          <h2 style="color: #111827; margin-top: 0;">Transaction Details</h2>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor};">
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
              <p style="margin: 5px 0; color: #374151;"><strong>Transaction ID:</strong> ${transactionData.transactionId}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Amount:</strong> ${transactionData.amount} ${transactionData.currency}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Token:</strong> ${transactionData.token}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Status:</strong> ${transactionData.status}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Timestamp:</strong> ${new Date(transactionData.timestamp).toLocaleString()}</p>
              ${transactionData.description ? `<p style="margin: 5px 0; color: #374151;"><strong>Description:</strong> ${transactionData.description}</p>` : ''}
            </div>
          </div>
          
          ${transactionData.status === 'failed' && transactionData.errorMessage ? `
            <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #dc2626; margin-top: 0;">Error Details:</h3>
              <p style="color: #dc2626; margin: 0;">${transactionData.errorMessage}</p>
            </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || '#'}/dashboard/transactions/${transactionData.transactionId}" 
               style="background: ${statusColor}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
              View Transaction
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6B7280; font-size: 14px;">
          <p>This is an automated notification from ABOKI</p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: userData.email,
      name: userData.fullName,
      subject: `${statusIcon} ABOKI Transaction ${transactionData.status.charAt(0).toUpperCase() + transactionData.status.slice(1)} - ${transactionData.transactionId}`,
      html
    });
  }
}

module.exports = new GmailEmailService();