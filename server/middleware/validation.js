/**
 * Input Validation Middleware
 * 
 * This uses Joi (a powerful validation library) to validate request data.
 * Think of Joi as a bouncer at a club - it checks that incoming data meets
 * all the requirements before letting it through to your business logic.
 * 
 * WHY VALIDATE?
 * - Security: Prevent injection attacks, XSS, etc.
 * - Data quality: Ensure data is in expected format
 * - Better errors: Give users clear feedback on what's wrong
 * - Less bugs: Catch invalid data before it corrupts your database
 */

const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Generic validation middleware factory
 * 
 * This is a higher-order function that creates middleware based on a schema.
 * It's like a template for creating validators for different types of requests.
 * 
 * @param {Joi.Schema} schema - Joi schema to validate against
 * @param {string} property - Which part of request to validate (body, params, query)
 * @returns {Function} Express middleware function
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    // Pre-process the request body to handle edge cases
    if (property === 'body' && req.body) {
      // If conversationContext is explicitly undefined, convert to null
      if ('conversationContext' in req.body && req.body.conversationContext === undefined) {
        req.body.conversationContext = null;
      }
    }

    // Validate the specified property of the request
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Validation failed:', {
        property,
        errors: errorMessages,
        receivedData: req[property]
      });

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorMessages
      });
    }

    req[property] = value;
    next();
  };
};

/**
 * Common validation schemas
 * Define these once and reuse across your application
 */
// User registration validation
const registerSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .lowercase()
    .trim()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),

  password: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'any.required': 'Password is required'
    }),

  fullName: Joi.string()
    .min(2)
    .max(100)
    .required()
    .trim()
    .messages({
      'string.min': 'Full name must be at least 2 characters',
      'string.max': 'Full name cannot exceed 100 characters',
      'any.required': 'Full name is required'
    }),

  dateOfBirth: Joi.date()
    .max('now')
    .required()
    .messages({
      'date.max': 'Date of birth cannot be in the future',
      'any.required': 'Date of birth is required'
    }),

  mobile: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      'string.pattern.base': 'Mobile number must be exactly 10 digits',
      'any.required': 'Mobile number is required'
    }),

  pan: Joi.string()
    .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .required()
    .uppercase()
    .messages({
      'string.pattern.base': 'PAN must be in format: ABCDE1234F',
      'any.required': 'PAN is required'
    })
});

// User login validation
const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .lowercase()
    .trim(),

  password: Joi.string()
    .required()
});

// Task creation from natural language validation
const createTaskSchema = Joi.object({
  message: Joi.string()
    .min(3)
    .max(2000)
    .required()
    .trim()
    .messages({
      'string.min': 'Message must be at least 3 characters',
      'string.max': 'Message cannot exceed 2000 characters',
      'any.required': 'Message is required'
    }),

  conversationContext: Joi.object()
    .unknown(true)  // Allow any properties in the context object
    .allow(null)     // Explicitly allow null
    .optional()      // Make it truly optional
    .default(null)   // Default to null if not provided
    .messages({
      'object.base': 'Conversation context must be an object'
    })
});

// MongoDB ObjectId validation (for route parameters)
const objectIdSchema = Joi.object({
  id: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid ID format'
    })
});

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  createTaskSchema,
  objectIdSchema
};
