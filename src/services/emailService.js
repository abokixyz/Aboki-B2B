// src/services/emailService.js - Using direct HTTP API calls
const https = require('https');

class EmailService {
  constructor() {
    this.apiKey = process.env.BREVO_API_KEY;
    this.apiUrl = 'https://api.brevo.com/v3/smtp/email';
  }

  async sendPasswordResetEmail(email, resetToken, userName) {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const emailData = {
      sender: {
        name: "Aboki B2B Platform",
        email: "hello@aboki.xyz"
      },
      to: [
        {
          email: email,
          name: userName
        }
      ],
      subject: "Password Reset Request - Aboki B2B Platform",
      htmlContent: `
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

    return this.sendEmail(emailData);
  }

  async sendPasswordChangeConfirmation(email, userName) {
    const emailData = {
      sender: {
        name: "Aboki B2B Platform",
        email: "hello@aboki.xyz"
      },
      to: [
        {
          email: email,
          name: userName
        }
      ],
      subject: "Password Changed Successfully - Aboki B2B Platform",
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
            .header { background-color: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 30px; background-color: #f8fafc; }
            .footer { padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 Aboki B2B Platform</h1>
              <h2>Password Updated Successfully</h2>
            </div>
            <div class="content">
              <h2>Hello ${userName}!</h2>
              <p>Your password has been successfully changed for your Aboki B2B Platform account.</p>
              <p>If you didn't make this change, please contact our support team immediately.</p>
            </div>
            <div class="footer">
              <p>© 2025 Aboki B2B Platform</p>
              <p>Sent from hello@aboki.xyz</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    return this.sendEmail(emailData);
  }

  async sendEmail(emailData) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(emailData);
      
      const options = {
        hostname: 'api.brevo.com',
        port: 443,
        path: '/v3/smtp/email',
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('Email sent successfully to:', emailData.to[0].email);
            resolve({ success: true });
          } else {
            console.error('Email sending failed:', res.statusCode, data);
            resolve({ success: false, error: `HTTP ${res.statusCode}: ${data}` });
          }
        });
      });

      req.on('error', (error) => {
        console.error('Email request error:', error);
        reject({ success: false, error: error.message });
      });

      req.write(postData);
      req.end();
    });
  }
}

module.exports = new EmailService();