
/**
 * Auth Controller - FINAL SIMPLE VERSION
 * 
 * Matches the simplified User model
 * No encryption complexity
 */

const User = require('../models/User');
const logger = require('../utils/logger');

exports.register = async (req, res, next) => {
  try {
    const { email, password, fullName, dateOfBirth, mobile, pan } = req.body;

    logger.info('Registration attempt', { email });

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    const existingPAN = await User.findOne({ 'governmentIds.pan': pan.toUpperCase() });
    if (existingPAN) {
      return res.status(400).json({
        success: false,
        message: 'This PAN is already registered with another account'
      });
    }

    const user = await User.create({
      email,
      password,
      personalInfo: {
        fullName,
        dateOfBirth: new Date(dateOfBirth),
        mobile
      },
      governmentIds: {
        pan: pan.toUpperCase()
      }
    });

    logger.info('User registered successfully', {
      userId: user._id,
      email: user.email
    });

    const accessToken = user.getSignedJwtToken();
    const refreshToken = user.getRefreshToken();

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.personalInfo.fullName,
          pan: user.governmentIds.pan,
          profileCompleteness: user.profileCompleteness
        },
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    logger.error('Registration error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages
      });
    }
    
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    logger.info('Login attempt', { email });

    const user = await User.findByCredentials(email, password);

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    const accessToken = user.getSignedJwtToken();
    const refreshToken = user.getRefreshToken();

    logger.info('User logged in successfully', {
      userId: user._id,
      email: user.email
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.personalInfo?.fullName,
          pan: user.governmentIds?.pan,
          profileCompleteness: user.profileCompleteness
        },
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    
    if (error.message === 'Invalid login credentials') {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    next(error);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          personalInfo: user.personalInfo,
          governmentIds: {
            pan: user.governmentIds?.pan,
            aadhaar: user.governmentIds?.aadhaar, // Plain string
            uan: user.governmentIds?.uan,         // Plain string
            hasAadhaar: !!user.governmentIds?.aadhaar,
            hasUAN: !!user.governmentIds?.uan
          },
          bankDetails: user.bankDetails,
          profileCompleteness: user.profileCompleteness,
          tasksCompleted: user.tasksCompleted,
          createdAt: user.createdAt
        }
      }
    });

  } catch (error) {
    logger.error('Get profile error:', error);
    next(error);
  }
};

/**
 * SIMPLIFIED: Direct field updates
 */
/**
 * COMPLETELY REWRITTEN: Proper nested object updates
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    console.log('═══════════════════════════════════════');
    console.log('🔍 PROFILE UPDATE DEBUG');
    console.log('User ID:', userId);
    console.log('Updates received:', JSON.stringify(updates, null, 2));

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('📝 BEFORE update:');
    console.log('  - Aadhaar:', user.governmentIds?.aadhaar);
    console.log('  - UAN:', user.governmentIds?.uan);
    console.log('  - Profile %:', user.profileCompleteness);

    // ✅ FIX: Handle personalInfo updates carefully
    if (updates.personalInfo) {
      // Initialize personalInfo if it doesn't exist
      if (!user.personalInfo) {
        user.personalInfo = {};
      }

      // Update top-level personalInfo fields
      if (updates.personalInfo.fullName !== undefined) {
        user.personalInfo.fullName = updates.personalInfo.fullName;
      }
      if (updates.personalInfo.dateOfBirth !== undefined) {
        user.personalInfo.dateOfBirth = updates.personalInfo.dateOfBirth;
      }
      if (updates.personalInfo.mobile !== undefined) {
        user.personalInfo.mobile = updates.personalInfo.mobile;
      }

      // ✅ CRITICAL FIX: Only update address if it's provided AND not undefined
      if (updates.personalInfo.address && typeof updates.personalInfo.address === 'object') {
        // Initialize address if it doesn't exist
        if (!user.personalInfo.address) {
          user.personalInfo.address = {};
        }
        
        // Merge address fields
        if (updates.personalInfo.address.line1 !== undefined) {
          user.personalInfo.address.line1 = updates.personalInfo.address.line1;
        }
        if (updates.personalInfo.address.line2 !== undefined) {
          user.personalInfo.address.line2 = updates.personalInfo.address.line2;
        }
        if (updates.personalInfo.address.city !== undefined) {
          user.personalInfo.address.city = updates.personalInfo.address.city;
        }
        if (updates.personalInfo.address.state !== undefined) {
          user.personalInfo.address.state = updates.personalInfo.address.state;
        }
        if (updates.personalInfo.address.pincode !== undefined) {
          user.personalInfo.address.pincode = updates.personalInfo.address.pincode;
        }
      }
      
      console.log('✅ Updated personalInfo');
    }

    // ✅ Handle governmentIds updates
    if (updates.governmentIds) {
      // Initialize governmentIds if it doesn't exist
      if (!user.governmentIds) {
        user.governmentIds = {};
      }

      // Preserve PAN (it never changes after registration)
      // Only update Aadhaar and UAN if provided
      if (updates.governmentIds.aadhaar !== undefined && updates.governmentIds.aadhaar !== '') {
        user.governmentIds.aadhaar = updates.governmentIds.aadhaar;
        console.log('✅ Updated Aadhaar:', updates.governmentIds.aadhaar);
      }
      
      if (updates.governmentIds.uan !== undefined && updates.governmentIds.uan !== '') {
        user.governmentIds.uan = updates.governmentIds.uan;
        console.log('✅ Updated UAN:', updates.governmentIds.uan);
      }
    }

    // ✅ Handle bankDetails updates
    if (updates.bankDetails) {
      user.bankDetails = updates.bankDetails;
      console.log('✅ Updated bankDetails');
    }

    // Mark modified for Mongoose
    user.markModified('personalInfo');
    user.markModified('governmentIds');
    
    console.log('💾 Saving user...');
    await user.save();

    // Verify save
    const updated = await User.findById(userId);
    console.log('✅ Saved successfully!');
    console.log('📊 AFTER save:');
    console.log('  - Aadhaar:', updated.governmentIds?.aadhaar);
    console.log('  - UAN:', updated.governmentIds?.uan);
    console.log('  - Profile completeness:', updated.profileCompleteness + '%');
    console.log('═══════════════════════════════════════\n');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        profileCompleteness: updated.profileCompleteness,
        user: {
          id: updated._id,
          email: updated.email,
          personalInfo: updated.personalInfo,
          governmentIds: {
            pan: updated.governmentIds?.pan,
            aadhaar: updated.governmentIds?.aadhaar,
            uan: updated.governmentIds?.uan,
            hasAadhaar: !!updated.governmentIds?.aadhaar,
            hasUAN: !!updated.governmentIds?.uan
          },
          bankDetails: updated.bankDetails,
          profileCompleteness: updated.profileCompleteness
        }
      }
    });

  } catch (error) {
    console.error('❌ ERROR:', error);
    logger.error('Update profile error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get user data for automation scripts
 * Returns sensitive data needed for government portal automation
 */
exports.getUserDataForAutomation = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Return all data needed for automation
    res.json({
      success: true,
      data: {
        personalInfo: {
          fullName: user.personalInfo?.fullName,
          dateOfBirth: user.personalInfo?.dateOfBirth,
          mobile: user.personalInfo?.mobile,
          address: user.personalInfo?.address
        },
        governmentIds: {
          pan: user.governmentIds?.pan,
          aadhaar: user.governmentIds?.aadhaar,  // ← Available for scripts
          uan: user.governmentIds?.uan
        },
        bankDetails: user.bankDetails
      }
    });

  } catch (error) {
    logger.error('Get automation data error:', error);
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    logger.info('User logged out', { userId: req.user.id });
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    next(error);
  }
};

module.exports = exports;
