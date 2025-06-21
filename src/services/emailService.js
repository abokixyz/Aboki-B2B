// src/services/emailService.js - Use the verified custom domain
const mailOptions = {
  from: {
    name: 'Aboki B2B Platform',
    address: 'hello@aboki.xyz' // Now this is verified!
  },
  to: email,
  subject: 'Password Reset Request - Aboki B2B Platform',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
        .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background-color: #f8fafc; }
        .button { 
          display: inline-block; 
          background-color: #2563eb; 
          color: white; 
          padding: 14px 28px; 
          text-decoration: none; 
          border-radius: 6px; 
          margin: 20px 0;
        }
        .footer { padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚀 Aboki B2B Platform</h1>
          <h2>Password Reset Request</h2>
        </div>
        <div class="content">
          <h2>Hello ${userName}!</h2>
          <p>We received a request to reset your password for your Aboki B2B Platform account.</p>
          <p>Click the button below to reset your password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" class="button">Reset Your Password</a>
          </div>
          
          <p style="font-size: 14px; color: #6b7280;">
            Or copy and paste this link: <br>
            <a href="${resetLink}" style="color: #2563eb;">${resetLink}</a>
          </p>
          
          <p style="background-color: #fef3c7; padding: 15px; border-radius: 6px; color: #92400e;">
            ⏰ This link will expire in 1 hour for security.
          </p>
          
          <p style="font-size: 14px; color: #6b7280;">
            If you didn't request this, please ignore this email.
          </p>
        </div>
        <div class="footer">
          <p>© 2025 Aboki B2B Platform</p>
          <p>You can reply to hello@aboki.xyz for support</p>
        </div>
      </div>
    </body>
    </html>
  `
};