/**
 * Error Handler Middleware
 * 
 * This is Express middleware that catches all errors in your application.
 * Instead of letting errors crash the server or send ugly stack traces to users,
 * this formats them nicely and sends appropriate HTTP responses.
 * 
 * In Express, error-handling middleware always has four parameters (err, req, res, next)
 * even if you don't use all of them. This is how Express knows it's an error handler.
 */

const logger = require('../utils/logger');

// Custom error class for operational errors (expected errors we handle)
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Flag to distinguish from programming errors
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Main error handler function
const errorHandler = (err, req, res, next) => {
  // Default to 500 Internal Server Error if no status code provided
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  
  // Log the error with full details
  logger.error(`Error: ${message}`, {
    statusCode,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  // Different error handling based on environment
  if (process.env.NODE_ENV === 'production') {
    // In production, don't leak error details to clients
    // Only send operational errors; hide programming errors
    if (!err.isOperational) {
      statusCode = 500;
      message = 'Something went wrong';
    }
  }
  
  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      // Only include stack trace in development
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

// Handle 404 errors (route not found)
const notFound = (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

module.exports = { errorHandler, notFound, AppError };