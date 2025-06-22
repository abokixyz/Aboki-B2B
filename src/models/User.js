const mongoose = require('mongoose');

// User Schema for Authentication
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  // Email verification fields
  emailVerificationToken: {
    type: String,
    index: true
  },
  emailVerificationExpiry: {
    type: Date
  },
  // Password reset fields
  resetPasswordToken: {
    type: String,
    index: true
  },
  resetPasswordExpiry: {
    type: Date
  },
  lastLogin: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to update updatedAt
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Existing indexes
userSchema.index({ resetPasswordToken: 1 });
userSchema.index({ resetPasswordExpiry: 1 });

// New indexes for email verification
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ emailVerificationExpiry: 1 });

// Compound indexes for better performance
userSchema.index({ emailVerificationToken: 1, emailVerificationExpiry: 1 });
userSchema.index({ resetPasswordToken: 1, resetPasswordExpiry: 1 });

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpiry;
  delete user.emailVerificationToken;
  delete user.emailVerificationExpiry;
  return user;
};

// Clean up expired tokens periodically
userSchema.statics.cleanupExpiredTokens = async function() {
  const now = new Date();
  
  await this.updateMany(
    {
      $or: [
        { emailVerificationExpiry: { $lt: now } },
        { resetPasswordExpiry: { $lt: now } }
      ]
    },
    {
      $unset: {
        emailVerificationToken: "",
        emailVerificationExpiry: "",
        resetPasswordToken: "",
        resetPasswordExpiry: ""
      }
    }
  );
};

module.exports = mongoose.model('User', userSchema);