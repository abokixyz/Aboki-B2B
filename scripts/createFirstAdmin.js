// scripts/createFirstAdmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Simple Admin model for the script (if you don't have the full model yet)
const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'moderator'],
    default: 'moderator',
    required: true
  },
  permissions: [{
    type: String,
    enum: [
      'user_verification',
      'user_management', 
      'business_verification',
      'business_management',
      'api_key_management',
      'system_settings',
      'analytics_view',
      'bulk_operations',
      'admin_management'
    ]
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  sessionToken: {
    type: String
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Default permissions by role
adminSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('role')) {
    switch (this.role) {
      case 'super_admin':
        this.permissions = [
          'user_verification',
          'user_management',
          'business_verification', 
          'business_management',
          'api_key_management',
          'system_settings',
          'analytics_view',
          'bulk_operations',
          'admin_management'
        ];
        break;
      case 'admin':
        this.permissions = [
          'user_verification',
          'user_management',
          'business_verification',
          'business_management',
          'api_key_management',
          'analytics_view',
          'bulk_operations'
        ];
        break;
      case 'moderator':
        this.permissions = [
          'user_verification',
          'business_verification',
          'analytics_view'
        ];
        break;
    }
  }
  next();
});

// Instance methods for login attempts
adminSchema.methods.incLoginAttempts = function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      lockUntil: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
    };
  }
  
  return this.updateOne(updates);
};

adminSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      loginAttempts: 1,
      lockUntil: 1
    }
  });
};

adminSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

const Admin = mongoose.model('Admin', adminSchema);

async function createFirstAdmin() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || process.env.DATABASE_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Check if any super admin already exists
    const existingSuperAdmin = await Admin.findOne({ role: 'super_admin' });
    if (existingSuperAdmin) {
      console.log('⚠️  Super admin already exists:');
      console.log('   Email:', existingSuperAdmin.email);
      console.log('   Name:', existingSuperAdmin.fullName);
      console.log('   Created:', existingSuperAdmin.createdAt);
      console.log('   Active:', existingSuperAdmin.isActive);
      
      const answer = await askQuestion('Do you want to create another super admin? (y/N): ');
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('👋 Exiting...');
        process.exit(0);
      }
    }

    console.log('\n🛠️  Creating first super admin...\n');

    // Get admin details
    const email = await askQuestion('Enter admin email: ');
    const fullName = await askQuestion('Enter admin full name: ');
    const password = await askQuestion('Enter admin password (min 8 chars): ', true);

    // Validation
    if (!email || !fullName || !password) {
      console.error('❌ All fields are required');
      process.exit(1);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('❌ Invalid email format');
      process.exit(1);
    }

    if (password.length < 8) {
      console.error('❌ Password must be at least 8 characters long');
      process.exit(1);
    }

    // Check if admin with this email already exists
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      console.error('❌ Admin with this email already exists');
      process.exit(1);
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create admin
    console.log('👨‍💼 Creating super admin...');
    const adminData = {
      email: email.toLowerCase(),
      password: hashedPassword,
      fullName,
      role: 'super_admin',
      isActive: true
    };

    const newAdmin = new Admin(adminData);
    await newAdmin.save();

    console.log('\n✅ Super Admin created successfully!');
    console.log('📧 Email:', newAdmin.email);
    console.log('👤 Name:', newAdmin.fullName);
    console.log('🛡️  Role:', newAdmin.role);
    console.log('🔑 Permissions:', newAdmin.permissions.length, 'permissions');
    console.log('📅 Created:', newAdmin.createdAt);
    console.log('🆔 ID:', newAdmin._id);

    console.log('\n🎉 Setup complete! You can now:');
    console.log('1. Login to admin panel with these credentials');
    console.log('2. Create additional admin accounts through the admin interface');
    console.log('3. Start managing user verifications');
    
    console.log('\n📝 Next steps:');
    console.log('• Test admin login: POST /api/v1/admin/auth/login');
    console.log('• View pending users: GET /api/v1/admin/users/pending-verification');
    console.log('• Create more admins: POST /api/v1/admin/auth/create-admin');

  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    
    if (error.code === 11000) {
      console.error('💡 Hint: An admin with this email already exists');
    }
    
    process.exit(1);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
    process.exit(0);
  }
}

// Helper function to get user input
function askQuestion(question, hidden = false) {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    if (hidden) {
      // Hide password input
      const stdin = process.openStdin();
      process.stdout.write(question);
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');
      
      let password = '';
      stdin.on('data', function(char) {
        char = char + '';
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004':
            stdin.setRawMode(false);
            stdin.pause();
            process.stdout.write('\n');
            rl.close();
            resolve(password);
            break;
          case '\u0003':
            process.exit(1);
            break;
          case '\u007f': // backspace
            if (password.length > 0) {
              password = password.slice(0, -1);
              process.stdout.write('\b \b');
            }
            break;
          default:
            password += char;
            process.stdout.write('*');
            break;
        }
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

// Handle script interruption
process.on('SIGINT', async () => {
  console.log('\n\n👋 Script interrupted');
  await mongoose.connection.close();
  process.exit(0);
});

// Run the script
if (require.main === module) {
  createFirstAdmin();
}

module.exports = { createFirstAdmin, Admin };