/**
 * Authentication Controller
 * 
 * Handles user registration, login, profile management, and token refresh.
 * This controller manages the user's identity and session within the system.
 */

const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Register New User
 * 
 * Creates a new user account with basic information. The user will need to
 * complete their profile later with government IDs and other details before
 * they can perform automation tasks.
 */
exports.register = async (req, res, next) => {
  try {
    const { email, password, fullName, dateOfBirth, mobile, pan } = req.body;

    logger.info('Registration attempt', { email });

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    // Check if PAN is already registered
    const existingPAN = await User.findOne({ 'governmentIds.pan': pan.toUpperCase() });
    if (existingPAN) {
      return res.status(400).json({
        success: false,
        message: 'This PAN is already registered with another account'
      });
    }

    // Create user with basic information
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

    // Generate tokens
    const accessToken = user.getSignedJwtToken();
    const refreshToken = user.getRefreshToken();

    // Return user data and tokens
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
    
    // Handle validation errors
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

/**
 * Login User
 * 
 * Authenticates a user with email and password, returns JWT tokens for
 * subsequent authenticated requests.
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    logger.info('Login attempt', { email });

    // Find user and validate credentials
    const user = await User.findByCredentials(email, password);

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Generate tokens
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

/**
 * Get Current User Profile
 * 
 * Returns the complete profile of the authenticated user, including all
 * stored information and profile completeness status.
 */
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get decrypted Aadhaar if stored
    let aadhaar = null;
    if (user.governmentIds?.aadhaar?.isStored) {
      aadhaar = user.getAadhaar();
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
            hasAadhaar: user.governmentIds?.aadhaar?.isStored,
            aadhaar: aadhaar ? aadhaar.replace(/\d(?=\d{4})/g, "X") : null, // Masked display
            uan: user.governmentIds?.uan
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
 * Update User Profile
 * 
 * Allows users to update their profile information, add government IDs,
 * bank details, etc. This is essential for completing their profile to
 * enable task automation.
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    logger.info('Profile update attempt', { userId, updates: Object.keys(updates) });

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update personal information if provided
    if (updates.personalInfo) {
      user.personalInfo = { ...user.personalInfo, ...updates.personalInfo };
    }

    // Update government IDs if provided
    if (updates.governmentIds) {
      // Handle Aadhaar specially (needs encryption)
      if (updates.governmentIds.aadhaar) {
        user.setAadhaar(updates.governmentIds.aadhaar);
        delete updates.governmentIds.aadhaar; // Remove from direct updates
      }
      
      // Update other government IDs
      user.governmentIds = { ...user.governmentIds, ...updates.governmentIds };
    }

    // Handle bank details (can add or update)
    if (updates.bankDetails) {
      if (Array.isArray(updates.bankDetails)) {
        user.bankDetails = updates.bankDetails;
      } else {
        // Adding a single bank account
        user.bankDetails.push(updates.bankDetails);
      }
    }

    await user.save();

    logger.info('Profile updated successfully', {
      userId: user._id,
      profileCompleteness: user.profileCompleteness
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        profileCompleteness: user.profileCompleteness
      }
    });

  } catch (error) {
    logger.error('Update profile error:', error);
    
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

/**
 * Logout (Token Invalidation)
 * 
 * In a JWT system, logout is typically handled on the client side by
 * removing the token. This endpoint exists for consistency and can be
 * extended to implement token blacklisting if needed.
 */
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
