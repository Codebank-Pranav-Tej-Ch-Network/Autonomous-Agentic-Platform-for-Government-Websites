/**
 * WebSocket Service
 * 
 * This sets up Socket.IO for real-time, bidirectional communication
 * between the server and connected clients.
 * 
 * Why WebSockets?
 * Traditional HTTP is like sending letters - you send a request, wait for response.
 * WebSockets are like a phone call - constant two-way communication channel.
 * Perfect for real-time updates like progress bars or live notifications.
 */

const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');

/**
 * Setup WebSocket server with Socket.IO
 * 
 * @param {SocketIO.Server} io - The Socket.IO server instance
 */
function setupWebSocket(io) {
  // Middleware to authenticate socket connections
  // Before accepting a connection, verify the user has a valid JWT token
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }
    
    try {
      // Verify the JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Attach user info to socket for later use
      socket.userId = decoded.id;
      socket.userEmail = decoded.email;
      
      next();
    } catch (error) {
      logger.error('WebSocket authentication failed:', error);
      next(new Error('Invalid token'));
    }
  });
  
  // Handle new connections
  io.on('connection', (socket) => {
    logger.info(`WebSocket client connected: ${socket.id}`, {
      userId: socket.userId,
      email: socket.userEmail
    });
    
    // Join a room specific to this user
    // This allows us to send messages only to specific users
    socket.join(`user:${socket.userId}`);
    
    // Send welcome message
    socket.emit('connected', {
      message: 'Successfully connected to WebSocket server',
      socketId: socket.id
    });
    
    // Handle client disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`WebSocket client disconnected: ${socket.id}`, { reason });
    });
    
    // Handle errors
    socket.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });
    
    // You can add custom event handlers here
    // For example, if frontend wants to request task status:
    socket.on('request:task:status', async (data) => {
      try {
        // Fetch task status and emit back to this client
        // Implementation would go here
        socket.emit('task:status', { taskId: data.taskId, status: 'processing' });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });
  });
  
  // Store io instance globally so other parts of the app can emit events
  global.io = io;
  
  logger.info('WebSocket server initialized');
}

/**
 * Helper function to emit progress updates to a specific user
 * This can be called from anywhere in the application
 * 
 * @param {string} userId - The user ID to send to
 * @param {object} data - The progress data to send
 */
function emitTaskProgress(userId, data) {
  if (global.io) {
    global.io.to(`user:${userId}`).emit('task:progress', data);
  }
}

/**
 * Helper function to emit task completion
 */
function emitTaskCompleted(userId, data) {
  if (global.io) {
    global.io.to(`user:${userId}`).emit('task:completed', data);
  }
}

/**
 * Helper function to emit task failure
 */
function emitTaskFailed(userId, data) {
  if (global.io) {
    global.io.to(`user:${userId}`).emit('task:failed', data);
  }
}

module.exports = {
  setupWebSocket,
  emitTaskProgress,
  emitTaskCompleted,
  emitTaskFailed
};