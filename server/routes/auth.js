/**
 * Authentication Routes
 * 
 * These routes handle user authentication, registration, and profile management.
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate, registerSchema, loginSchema } = require('../middleware/validation');

/**
 * POST /api/v1/auth/register
 * Register a new user account
 * 
 * Body: { email, password, fullName, dateOfBirth, mobile, pan }
 * Returns: User object and JWT tokens
 */
router.post(
  '/register',
  validate(registerSchema),
  authController.register
);

/**
 * POST /api/v1/auth/login
 * Login with existing credentials
 * 
 * Body: { email, password }
 * Returns: User object and JWT tokens
 */
router.post(
  '/login',
  validate(loginSchema),
  authController.login
);

/**
 * GET /api/v1/auth/profile
 * Get current user's complete profile
 * 
 * Requires: Authentication
 * Returns: Complete user profile with all stored information
 */
router.get(
  '/profile',
  protect,
  authController.getProfile
);

/**
 * PUT /api/v1/auth/profile
 * Update user profile information
 * 
 * Requires: Authentication
 * Body: { personalInfo?, governmentIds?, bankDetails? }
 * Returns: Updated profile completeness percentage
 */
router.put(
  '/profile',
  protect,
  authController.updateProfile
);

/**
 * GET /api/v1/auth/automation-data
 * Get user data needed for automation scripts
 * 
 * Requires: Authentication
 * Returns: All user data including sensitive fields for automation
 */
router.get(
  '/automation-data',
  protect,
  authController.getUserDataForAutomation
);

/**
 * POST /api/v1/auth/logout
 * Logout current user
 * 
 * Requires: Authentication
 * Returns: Success message
 */
router.post(
  '/logout',
  protect,
  authController.logout
);

module.exports = router;
