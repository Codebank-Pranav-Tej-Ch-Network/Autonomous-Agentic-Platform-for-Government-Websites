/**
 * Logger Utility
 * 
 * This creates a centralized logging system using Winston.
 * Think of this as your application's diary - it records everything
 * that happens, from mundane events to critical errors.
 * 
 * Why Winston instead of console.log?
 * - Automatic timestamps on every message
 * - Log levels (info, warn, error, debug) that you can filter
 * - Can write to multiple places simultaneously (console, file, database)
 * - Structured logging (can log objects, not just strings)
 * - Production-ready with log rotation and formatting
 */

const winston = require('winston');
const path = require('path');

// Define log levels with priority
// Lower numbers = higher priority
// error: 0, warn: 1, info: 2, debug: 3
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each level (makes console output easier to read)
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

// Tell winston to use these colors
winston.addColors(colors);

// Define the format for log messages
// This determines how each log line looks
const format = winston.format.combine(
  // Add timestamp to every log
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  
  // Add colors (only for console output)
  winston.format.colorize({ all: true }),
  
  // Define the actual format of the message
  winston.format.printf((info) => {
    // If there's additional metadata, stringify it
    const meta = info.metadata && Object.keys(info.metadata).length 
      ? `\n${JSON.stringify(info.metadata, null, 2)}`
      : '';
    
    return `${info.timestamp} [${info.level}]: ${info.message}${meta}`;
  })
);

// Define where logs should be written (transports)
const transports = [
  // Always log to console
  new winston.transports.Console({
    format: format
  }),
  
  // Write error logs to a separate file
  // This makes it easy to find errors later
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json() // File logs are JSON for easier parsing
    )
  }),
  
  // Write all logs to a combined file
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  })
];

// Create the logger instance
const logger = winston.createLogger({
  // Use the log level from environment or default to 'info'
  // In production, you might set this to 'warn' to reduce noise
  level: process.env.LOG_LEVEL || 'info',
  levels,
  transports
});

// Export the logger so other files can use it
module.exports = logger;