
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
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    console.log('═══════════════════════════════════════');
    console.log('🔍 PROFILE UPDATE DEBUG START');
    console.log('═══════════════════════════════════════');
    console.log('User ID:', userId);
    console.log('Raw request body:', JSON.stringify(updates, null, 2));

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

    // Process each update
    for (const [key, value] of Object.entries(updates)) {
      console.log(`\n🔄 Processing: ${key} = ${value}`);

      if (key === 'governmentIds.aadhaar') {
        if (!user.governmentIds) user.governmentIds = {};
        user.governmentIds.aadhaar = value;
        console.log('✅ Set Aadhaar:', value);
      } 
      else if (key === 'governmentIds.uan') {
        if (!user.governmentIds) user.governmentIds = {};
        user.governmentIds.uan = value;
        console.log('✅ Set UAN:', value);
      }
      else if (key.startsWith('personalInfo.')) {
        const parts = key.split('.');
        if (parts.length === 2) {
          const field = parts[1];
          if (!user.personalInfo) user.personalInfo = {};
          user.personalInfo[field] = value;
          console.log(`✅ Set personalInfo.${field}`);
        } else if (parts.length === 3) {
          const subfield = parts[2];
          if (!user.personalInfo) user.personalInfo = {};
          if (!user.personalInfo.address) user.personalInfo.address = {};
          user.personalInfo.address[subfield] = value;
          console.log(`✅ Set address.${subfield}`);
        }
      }
      else if (key === 'bankDetails') {
        user.bankDetails = value;
        console.log('✅ Set bankDetails');
      }
    }

    user.markModified('governmentIds');
    user.markModified('personalInfo');

    console.log('\n💾 Saving...');
    await user.save();

    // Verify
    const verifyUser = await User.findById(userId);
    console.log('\n✅ AFTER save:');
    console.log('  - Aadhaar:', verifyUser.governmentIds?.aadhaar);
    console.log('  - UAN:', verifyUser.governmentIds?.uan);
    console.log('  - Profile %:', verifyUser.profileCompleteness);
    console.log('═══════════════════════════════════════\n');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        profileCompleteness: verifyUser.profileCompleteness,
        updatedFields: {
          hasAadhaar: !!verifyUser.governmentIds?.aadhaar,
          aadhaarValue: verifyUser.governmentIds?.aadhaar,
          hasUAN: !!verifyUser.governmentIds?.uan,
          uanValue: verifyUser.governmentIds?.uan
        }
      }
    });

  } catch (error) {
    console.error('❌ ERROR:', error);
    logger.error('Update profile error:', error);
    
    res.status(500).json({
      success: false,
      message: error.message
    });
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
