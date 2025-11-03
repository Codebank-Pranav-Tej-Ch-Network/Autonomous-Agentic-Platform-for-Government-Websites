/**
 * Database Configuration
 * 
 * This file centralizes all MongoDB connection logic.
 * By keeping database configuration separate from the main server file,
 * we follow the principle of "separation of concerns" - each file has
 * one clear responsibility.
 * 
 * Why separate this out?
 * - Easier to test (you can mock the database connection)
 * - Easier to switch databases later (just change this file)
 * - Cleaner code organization
 * - Can reuse connection logic in scripts or tests
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Connect to MongoDB
 * 
 * Mongoose is an ODM (Object Data Modeling) library for MongoDB.
 * It provides a schema-based solution to model your data, which adds
 * structure and validation to what is normally a schema-less database.
 * 
 * @returns {Promise} Resolves when connected, rejects on error
 */
const connectDB = async () => {
  try {
    // Mongoose options for connection
    const options = {
      useNewUrlParser: true,     // Use new URL parser instead of deprecated one
      useUnifiedTopology: true,   // Use new connection management engine
      // These options help with connection stability
      maxPoolSize: 10,            // Maximum number of connections in the pool
      serverSelectionTimeoutMS: 5000,  // Timeout for server selection
      socketTimeoutMS: 45000,     // Socket timeout
    };

    // Attempt to connect
    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    logger.info(`MongoDB connected successfully: ${conn.connection.host}`);
    
    // Log the database name we're connected to (helpful for debugging)
    logger.info(`Database name: ${conn.connection.name}`);

    return conn;

  } catch (error) {
    logger.error('MongoDB connection error:', {
      message: error.message,
      stack: error.stack
    });
    
    // In development, you might want to continue without DB
    // In production, you should exit if DB is unavailable
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      logger.warn('Running without database connection in development mode');
    }
  }
};

/**
 * Gracefully close database connection
 * This is important during server shutdown to prevent data corruption
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error);
  }
};

/**
 * Listen to connection events
 * These help you understand what's happening with your database connection
 */
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  logger.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose disconnected from MongoDB');
});

// If the Node process ends, close the Mongoose connection
// This is the graceful shutdown we talked about earlier
process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

module.exports = { connectDB, disconnectDB };