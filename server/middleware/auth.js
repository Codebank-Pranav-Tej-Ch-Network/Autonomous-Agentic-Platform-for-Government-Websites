/**
 * Authentication Middleware
 * 
 * This middleware protects routes that require authentication.
 * It verifies JWT tokens and attaches user information to the request object.
 * 
 * HOW IT WORKS:
 * 1. Client sends request with "Authorization: Bearer TOKEN" header
 * 2. Middleware extracts the token
 * 3. Verifies the token is valid and not expired
 * 4. Looks up the user in the database
 * 5. Attaches user to req.user so route handlers can use it
 * 6. If anything fails, sends 401 Unauthorized
 * 
 * This is a common pattern in REST APIs called "bearer token authentication"
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');
const { AppError } = require('./errorHandler');

/**
 * Protect middleware - requires valid JWT token
 * 
 * Usage in routes:
 * router.get('/protected', protect, (req, res) => {
 *   // req.user is now available here
 * });
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Check if authorization header exists and starts with 'Bearer'
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      // Extract token from header
      // Header format: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      // We split by space and take the second part (the actual token)
      token = req.headers.authorization.split(' ')[1];
    }

    // If no token found, deny access
    if (!token) {
      return next(new AppError('Not authorized to access this route', 401));
    }

    try {
      // Verify token with the secret key
      // If token is invalid or expired, this will throw an error
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Token contains user ID - fetch the full user from database
      // We use .select('-password') to exclude the password field
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return next(new AppError('User no longer exists', 401));
      }

      // Check if user account is active
      if (!req.user.isActive) {
        return next(new AppError('User account is deactivated', 401));
      }

      // All checks passed - continue to the route handler
      next();

    } catch (error) {
      // JWT verification failed
      logger.warn('JWT verification failed:', {
        error: error.message,
        token: token.substring(0, 20) + '...' // Log partial token for debugging
      });

      if (error.name === 'TokenExpiredError') {
        return next(new AppError('Token expired, please login again', 401));
      }

      return next(new AppError('Invalid token', 401));
    }

  } catch (error) {
    next(error);
  }
};

/**
 * Authorize middleware - checks if user has required role
 * 
 * Usage:
 * router.delete('/admin/users/:id', protect, authorize('admin'), (req, res) => {
 *   // Only admins can reach here
 * });
 * 
 * This creates a closure that captures the allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // req.user was set by the protect middleware
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    // Check if user's role is in the allowed roles
    if (!roles.includes(req.user.role)) {
      logger.warn('Authorization failed:', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles
      });

      return next(
        new AppError(
          `User role '${req.user.role}' is not authorized to access this route`,
          403
        )
      );
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token
 * Useful for endpoints that work differently for logged-in vs anonymous users
 * 
 * For example, a public task list might show more details if user is logged in
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');
      } catch (error) {
        // Token invalid, but that's okay for optional auth
        logger.debug('Optional auth: Invalid token, continuing without user');
      }
    }

    // Continue regardless of whether user was found
    next();

  } catch (error) {
    next(error);
  }
};

module.exports = { protect, authorize, optionalAuth };
