/**
 * User Model - CORRECTED VERSION
 * FIXES: 
 * - Fixed address schema nesting
 * - Proper schema structure
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false
  },
  
  personalInfo: {
    fullName: {
      type: String,
      required: [true, 'Please provide your full name'],
      trim: true
    },
    dateOfBirth: {
      type: Date
    },
    mobile: {
      type: String,
      match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit mobile number']
    },
    address: {  // ← FIX: Proper nesting
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: {
        type: String,
        match: [/^[0-9]{6}$/, 'Please provide a valid 6-digit pincode']
      }
    }
  },
  
  governmentIds: {
    pan: {
      type: String,
      uppercase: true,
      match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please provide a valid PAN']
    },
    aadhaar: {
      type: String,
      match: [/^[0-9]{12}$/, 'Please provide a valid 12-digit Aadhaar']
    },
    uan: {
      type: String,
      match: [/^[0-9]{12}$/, 'Please provide a valid 12-digit UAN']
    }
  },
  
  bankDetails: [{
    bankName: {
      type: String,
      required: true
    },
    accountNumber: {
      type: String,
      required: true
    },
    ifscCode: {
      type: String,
      required: true,
      uppercase: true,
      match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Please provide a valid IFSC code']
    },
    accountType: {
      type: String,
      enum: ['savings', 'current'],
      default: 'savings'
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  
  profileCompleteness: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  tasksCompleted: {
    type: Number,
    default: 0
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  }
}, {
  timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Calculate profile completeness before saving
UserSchema.pre('save', function(next) {
  let completeness = 0;
  
  // Basic info (30%)
  if (this.email) completeness += 10;
  if (this.personalInfo?.fullName) completeness += 10;
  if (this.personalInfo?.mobile) completeness += 10;
  
  // Government IDs (40%)
  if (this.governmentIds?.pan) completeness += 10;
  if (this.governmentIds?.aadhaar) completeness += 15;
  if (this.governmentIds?.uan) completeness += 15;
  
  // Additional info (30%)
  if (this.personalInfo?.dateOfBirth) completeness += 10;
  if (this.personalInfo?.address?.line1) completeness += 10;
  if (this.bankDetails && this.bankDetails.length > 0) completeness += 10;
  
  this.profileCompleteness = completeness;
  next();
});

// Generate JWT token
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { id: this._id, email: this.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Generate refresh token
UserSchema.methods.getRefreshToken = function() {
  return jwt.sign(
    { id: this._id },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// Match password
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Static method to find by credentials
UserSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ email: email.toLowerCase() }).select('+password');
  
  if (!user) {
    throw new Error('Invalid login credentials');
  }
  
  const isPasswordMatch = await user.matchPassword(password);
  
  if (!isPasswordMatch) {
    throw new Error('Invalid login credentials');
  }
  
  return user;
};

// Get primary bank account
UserSchema.methods.getPrimaryBankAccount = function() {
  if (!this.bankDetails || this.bankDetails.length === 0) {
    return null;
  }
  
  return this.bankDetails.find(account => account.isPrimary) || this.bankDetails[0];
};

module.exports = mongoose.model('User', UserSchema);

