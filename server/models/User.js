/**
 * Enhanced User Model with Complete Profile Information
 * 
 * This model stores user profile data that is relatively stable and reused
 * across multiple automation tasks. Sensitive data like Aadhaar is encrypted.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  // Authentication fields
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
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  
  // Personal Information - Used across all services
  personalInfo: {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required']
    },
    
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit mobile number']
    },
    
    address: {
      line1: { type: String },
      line2: String,
      city: { type: String },
      state: { type: String },
      pincode: {
        type: String,
        match: [/^[0-9]{6}$/, 'Please provide a valid 6-digit pincode']
      }
    }
  },
  
  // Government IDs - Different services need different IDs
  governmentIds: {
    // PAN - Required for Income Tax
    pan: {
      type: String,
      required: [true, 'PAN is required'],
      unique: true,
      uppercase: true,
      match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please provide a valid PAN format']
    },
    
    // Aadhaar - Required for DigiLocker and ITR e-verification
    // Stored encrypted for security
    aadhaar: {
      encrypted: String,
      iv: String,  // Initialization vector for decryption
      isStored: {
        type: Boolean,
        default: false
      }
    },
    
    // UAN - Required for EPFO services
    uan: {
      type: String,
      match: [/^[0-9]{12}$/, 'UAN must be 12 digits'],
      sparse: true  // Allows null values while maintaining uniqueness for non-null values
    }
  },
  
  // Bank Details - Used for refunds and transfers
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
  
  // Activity tracking
  tasksCompleted: {
    type: Number,
    default: 0
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  lastLoginAt: Date,
  
  // Profile completion percentage (calculated field)
  profileCompleteness: {
    type: Number,
    default: 0
  }
  
}, {
  timestamps: true
});

/**
 * Middleware: Hash password before saving
 */
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/**
 * Middleware: Calculate profile completeness before saving
 */
userSchema.pre('save', function(next) {
  let completedFields = 0;
  const totalFields = 10;
  
  if (this.personalInfo?.fullName) completedFields++;
  if (this.personalInfo?.dateOfBirth) completedFields++;
  if (this.personalInfo?.mobile) completedFields++;
  if (this.personalInfo?.address?.line1) completedFields++;
  if (this.personalInfo?.address?.city) completedFields++;
  if (this.governmentIds?.pan) completedFields++;
  if (this.governmentIds?.aadhaar?.isStored) completedFields++;
  if (this.governmentIds?.uan) completedFields++;
  if (this.bankDetails?.length > 0) completedFields++;
  if (this.email) completedFields++;
  
  this.profileCompleteness = Math.round((completedFields / totalFields) * 100);
  next();
});

/**
 * Instance Method: Encrypt and store Aadhaar number
 */
userSchema.methods.setAadhaar = function(aadhaarNumber) {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('Encryption key not configured');
  }
  
  // Create cipher
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  // Encrypt
  let encrypted = cipher.update(aadhaarNumber, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Store encrypted data and IV
  this.governmentIds.aadhaar = {
    encrypted: encrypted,
    iv: iv.toString('hex'),
    isStored: true
  };
};

/**
 * Instance Method: Decrypt and retrieve Aadhaar number
 */
userSchema.methods.getAadhaar = function() {
  if (!this.governmentIds?.aadhaar?.isStored) {
    return null;
  }
  
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('Encryption key not configured');
  }
  
  try {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(this.governmentIds.aadhaar.iv, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    
    let decrypted = decipher.update(this.governmentIds.aadhaar.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Error decrypting Aadhaar:', error);
    return null;
  }
};

/**
 * Instance Method: Get primary bank account
 */
userSchema.methods.getPrimaryBankAccount = function() {
  if (!this.bankDetails || this.bankDetails.length === 0) {
    return null;
  }
  
  // Find primary account
  const primaryAccount = this.bankDetails.find(account => account.isPrimary);
  
  // If no primary set, return first account
  return primaryAccount || this.bankDetails[0];
};

/**
 * Instance Method: Check if profile is sufficiently complete for a task type
 */
userSchema.methods.canPerformTask = function(taskType) {
  const requirements = {
    itr_filing: ['personalInfo.fullName', 'governmentIds.pan', 'bankDetails'],
    digilocker_download: ['personalInfo.fullName', 'governmentIds.aadhaar'],
    epfo_balance: ['personalInfo.fullName', 'governmentIds.uan']
  };
  
  const requiredFields = requirements[taskType] || [];
  
  for (const field of requiredFields) {
    const value = field.split('.').reduce((obj, key) => obj?.[key], this);
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return false;
    }
  }
  
  return true;
};

/**
 * Instance Method: Get missing fields for a task type
 */
userSchema.methods.getMissingFields = function(taskType) {
  const requirements = {
    itr_filing: [
      { field: 'personalInfo.fullName', label: 'Full Name' },
      { field: 'governmentIds.pan', label: 'PAN Number' },
      { field: 'bankDetails', label: 'Bank Account Details' }
    ],
    digilocker_download: [
      { field: 'personalInfo.fullName', label: 'Full Name' },
      { field: 'governmentIds.aadhaar', label: 'Aadhaar Number' }
    ],
    epfo_balance: [
      { field: 'personalInfo.fullName', label: 'Full Name' },
      { field: 'governmentIds.uan', label: 'UAN' }
    ]
  };
  
  const requiredFields = requirements[taskType] || [];
  const missing = [];
  
  for (const {field, label} of requiredFields) {
    const value = field.split('.').reduce((obj, key) => obj?.[key], this);
    if (!value || (Array.isArray(value) && value.length === 0)) {
      missing.push({ field, label });
    }
  }
  
  return missing;
};

// Password comparison method
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// JWT token generation
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { id: this._id, email: this.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '15m' }
  );
};

userSchema.methods.getRefreshToken = function() {
  return jwt.sign(
    { id: this._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

// Static method for login
userSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ email }).select('+password');
  
  if (!user) {
    throw new Error('Invalid login credentials');
  }
  
  const isPasswordMatch = await user.matchPassword(password);
  
  if (!isPasswordMatch) {
    throw new Error('Invalid login credentials');
  }
  
  user.lastLoginAt = new Date();
  await user.save();
  
  return user;
};

module.exports = mongoose.model('User', userSchema);
