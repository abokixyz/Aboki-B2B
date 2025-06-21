// src/services/emailService.js - Fix the method name
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Fix: createTransport (not createTransporter)
    this.transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  async sendPasswordResetEmail(email, resetToken, userName) {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: {
        name: 'Aboki B2B Platform',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: 'Password Reset Request - Aboki B2B Platform',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 30px; background-color: #f8fafc; }
            .button { 
              display: inline-block; 
              background-color: #2563eb; 
              color: white; 
              padding: 14px 28px; 
              text-decoration: none; 
              border-radius: 6px; 
              margin: 20px 0;
              font-weight: bold;
            }
            .footer { padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
            .logo { font-size: 24px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🚀 Aboki B2B</div>
              <h1 style="margin: 10px 0 0 0;">Password Reset Request</h1>
            </div>
            <div class="content">
              <h2 style="color: #1f2937;">Hello ${userName}!</h2>
              <p style="font-size: 16px; line-height: 1.6;">
                We received a request to reset your password for your Aboki B2B Platform account.
              </p>
              <p style="font-size: 16px; line-height: 1.6;">
                Click the button below to reset your password:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" class="button">Reset Your Password</a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280;">
                Or copy and paste this link into your browser:<br>
                <a href="${resetLink}" style="color: #2563eb; word-break: break-all;">${resetLink}</a>
              </p>
              
              <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; color: #92400e; font-weight: bold;">
                  ⏰ This link will expire in 1 hour for security reasons.
                </p>
              </div>
              
              <p style="font-size: 14px; color: #6b7280;">
                If you didn't request this password reset, please ignore this email. 
                Your password will remain unchanged.
              </p>
            </div>
            <div class="footer">
              <p>© 2025 Aboki B2B Platform. All rights reserved.</p>
              <p>Sent from hello@aboki.xyz</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Password reset email sent successfully to:', email);
      return { success: true };
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordChangeConfirmation(email, userName) {
    const mailOptions = {
      from: {
        name: 'Aboki B2B Platform',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: 'Password Changed Successfully - Aboki B2B Platform',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
            .header { background-color: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 30px; background-color: #f8fafc; }
            .footer { padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
            .logo { font-size: 24px; font-weight: bold; }
            .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🚀 Aboki B2B</div>
              <h1 style="margin: 10px 0 0 0;">Password Updated Successfully</h1>
            </div>
            <div class="content">
              <div class="success-icon">✅</div>
              <h2 style="color: #1f2937; text-align: center;">Hello ${userName}!</h2>
              <p style="font-size: 16px; line-height: 1.6; text-align: center;">
                Your password has been successfully changed for your Aboki B2B Platform account.
              </p>
              
              <div style="background-color: #fef2f2; border: 1px solid #ef4444; border-radius: 6px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; color: #dc2626; font-weight: bold;">
                  🚨 If you didn't make this change, please contact our support team immediately.
                </p>
              </div>
            </div>
            <div class="footer">
              <p>© 2025 Aboki B2B Platform. All rights reserved.</p>
              <p>Sent from hello@aboki.xyz</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error('Failed to send password change confirmation:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();