/**
 * Integrated Server File for Combined Automation Portals
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
const { connectDB } = require('./config/database');
const path = require('path');
const vehicleRoutes = require('./routes/vehicle');
// Import custom modules
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { setupWebSocket } = require('./services/websocket');
const downloadRoutes = require('./routes/downloads');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const resultRoutes = require('./routes/results');

// Friend’s automation and brain routes
const automationRoutes = require('./routes/automationRoutes');

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
  }
});

app.set('io', io);

// Middleware setup
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
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());
app.use(mongoSanitize());
app.use(xss());
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});
// Add this to your server.js BEFORE your API routes
app.use('/vahan', express.static(path.join(__dirname, '../mock-portals/vahan-portal')));
app.use('/api/vehicle', vehicleRoutes);
app.use('/api/v1/downloads', downloadRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/llm', taskRoutes);
app.use('/api/v1/results', resultRoutes);

// Mount friend’s automation routes without version prefix to avoid breaking theirs,
// but consider adding versioning or namespace later if needed
app.use('/api/automation', automationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Catch-all 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handling middleware, last in chain
app.use(errorHandler);

// WebSocket setup
setupWebSocket(io);

// Graceful shutdown handlers (SIGTERM, SIGINT, unhandled errors)
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  httpServer.close(async () => {
    logger.info('HTTP server closed');
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
      io.close(() => {
        logger.info('Socket.IO connections closed');
        process.exit(0);
      });
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
  setTimeout(() => {
    logger.error('Graceful shutdown timeout. Forcing exit...');
    process.exit(1);
  }, 30000);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB (monolithic connection)
    await connectDB();

    // Start HTTP + Socket.IO server for frontend and APIs
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      logger.info(`📡 WebSocket server ready`);
      logger.info(`🔗 Client URL: ${process.env.CLIENT_URL}`);
      logger.info(`🤖 Automation routes at /api/automation and /api/brain`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, io };

