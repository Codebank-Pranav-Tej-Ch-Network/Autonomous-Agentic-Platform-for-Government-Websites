/**
 * Main Server File for Government Automation Agent
 * 
 * This server acts as the central coordinator for the entire application.
 * It handles:
 * - HTTP requests from the React frontend
 * - WebSocket connections for real-time updates
 * - Database connections to MongoDB
 * - Integration with the LLM (Gemini) for intelligent routing
 * - Job queue management for background tasks
 * 
 * Think of this as the "brain" that coordinates all the different parts.
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { connectDB } = require('./config/database')
// Import custom modules
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { setupWebSocket } = require('./services/websocket');
const downloadRoutes = require('./routes/downloads');

// Import routes
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const resultRoutes = require('./routes/results');

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO for real-time communication
// This allows us to push updates to the frontend without the frontend having to constantly poll
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Make io accessible to routes (we'll use this to emit events)
app.set('io', io);

/**
 * MIDDLEWARE SETUP
 * Middleware functions are like security checkpoints and data processors
 * that every request passes through before reaching your route handlers.
 */

// Security middleware - protects against common web vulnerabilities
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  }
}));

// CORS - allows your React frontend to make requests to this backend
// Without this, browsers would block the requests due to "Same-Origin Policy"
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware - converts JSON in requests to JavaScript objects
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression - makes responses smaller for faster transmission
app.use(compression());

// Security: Sanitize data to prevent MongoDB injection attacks
// This removes any keys that start with $ or contain . in the request body
app.use(mongoSanitize());

// Security: Clean user input to prevent Cross-Site Scripting (XSS) attacks
app.use(xss());

// Request logging - helps with debugging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

app.use('/api/v1/downloads', downloadRoutes);

/**
 * DATABASE CONNECTION
 * MongoDB stores all our data: users, tasks, results, sessions
 * We use Mongoose as an ODM (Object Data Modeling) library
 * which makes working with MongoDB much easier
 */

// Handle MongoDB connection events
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB error:', err);
});

/**
 * API ROUTES
 * These define the endpoints that your frontend can call
 * Think of routes as different doors into your application
 */

// Health check endpoint - useful for monitoring if the server is running
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API version prefix - good practice for API versioning
const API_PREFIX = '/api/v1';

// Mount route handlers
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/tasks`, taskRoutes);
app.use(`${API_PREFIX}/results`, resultRoutes);

// Catch-all for undefined routes - returns 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handling middleware - catches all errors and formats them nicely
// This should always be the last middleware
app.use(errorHandler);

/**
 * WEBSOCKET SETUP
 * WebSockets allow two-way communication between client and server
 * Perfect for real-time updates like "Task 50% complete" without polling
 */
setupWebSocket(io);

/**
 * GRACEFUL SHUTDOWN
 * This ensures that when the server stops, it cleanly closes all connections
 * Prevents data corruption and ensures all pending tasks are handled
 */
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  httpServer.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Close database connection
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
      
      // Close WebSocket connections
      io.close(() => {
        logger.info('Socket.IO connections closed');
        process.exit(0);
      });
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('Graceful shutdown timeout. Forcing exit...');
    process.exit(1);
  }, 30000);
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and unhandled promise rejections
// These are last-resort error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

/**
 * START SERVER
 * Connect to database first, then start listening for requests
 */
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB first
    await connectDB();
    
    // Then start the HTTP server
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      logger.info(`📡 WebSocket server ready`);
      logger.info(`🔗 Client URL: ${process.env.CLIENT_URL}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Initialize the server
startServer();

// Export for testing purposes
module.exports = { app, io };
