/**
 * Task Model
 * 
 * This is the heart of your automation system. Every time a user requests
 * an automation task (like filing ITR or downloading from DigiLocker), a
 * Task document is created to track its entire lifecycle.
 * 
 * Think of this like a package tracking system for FedEx or Amazon:
 * - Created: Package received
 * - Queued: Package in sorting facility
 * - Processing: Out for delivery
 * - Completed: Delivered successfully
 * - Failed: Delivery attempt failed
 * 
 * This schema tracks everything: who requested it, what type of task it is,
 * what data it needs, where it is in the process, and what the results are.
 */

const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  // Who owns this task?
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // References the User model - creates a relationship
    required: true
  },
  
  // What type of task is this?
  taskType: {
    type: String,
    required: true,
    enum: ['itr_filing', 'digilocker_download', 'epfo_balance'],  // Only these values allowed
    index: true  // Makes queries on taskType faster
  },
  
  // Current status of the task
  status: {
    type: String,
    enum: [
      'pending',      // Just created, waiting to start
      'queued',       // In the job queue, will start soon
      'processing',   // Currently being executed
      'awaiting_input', // Needs user input (like solving captcha)
      'completed',    // Successfully finished
      'failed',       // Something went wrong
      'cancelled'     // User cancelled the task
    ],
    default: 'pending',
    index: true
  },
  
  // Progress percentage (0-100)
  // This is what drives the progress bar in your UI
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  // Detailed progress information
  // This object stores step-by-step updates that can be displayed to the user
  progressDetails: [{
    step: String,         // e.g., "Logging in", "Navigating to form", "Submitting data"
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed']
    },
    message: String,      // Human-readable message
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Input data for the task
  // This stores all the information needed to complete the task
  // Structure varies by taskType
  inputData: {
    type: Map,  // Flexible structure - can store any key-value pairs
    of: mongoose.Schema.Types.Mixed,  // Values can be any type
    required: true
  },
  
  // Results from the completed task
  result: {
    success: Boolean,
    message: String,
    data: mongoose.Schema.Types.Mixed,  // Could be file paths, URLs, extracted data, etc.
    generatedFiles: [{
      filename: String,
      path: String,
      size: Number,
      mimeType: String
    }]
  },
  
  // Error information if the task failed
  error: {
    code: String,        // Error code for programmatic handling
    message: String,     // Human-readable error message
    stack: String,       // Stack trace for debugging
    timestamp: Date,
    recoverable: Boolean  // Can the user retry this task?
  },
  
  // Metadata for tracking and debugging
  metadata: {
    ipAddress: String,
    userAgent: String,
    executionTimeMs: Number,  // How long did this take?
    retryCount: {
      type: Number,
      default: 0
    },
    maxRetries: {
      type: Number,
      default: 3
    },
    // Screenshots captured during execution (for debugging)
    screenshots: [{
      path: String,
      step: String,
      timestamp: Date
    }],
    // Logs from the automation script
    logs: [String]
  },
  
  // For tasks requiring human intervention (like captcha solving)
  awaitingUserInput: {
    type: {
      type: String,
      enum: ['captcha', 'otp', 'manual_verification']
    },
    prompt: String,
    data: mongoose.Schema.Types.Mixed,
    expiresAt: Date
  },
  
  // Priority for queue processing
  priority: {
    type: Number,
    default: 5,  // 1 = highest priority, 10 = lowest
    min: 1,
    max: 10
  },
  
  // Scheduling
  scheduledFor: Date,  // For future feature: schedule tasks for later
  
  // Timestamps
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  
}, {
  timestamps: true,  // Automatically adds createdAt and updatedAt
  // This creates indexes on frequently queried fields for better performance
  indexes: [
    { user: 1, createdAt: -1 },  // For fetching user's task history
    { status: 1, createdAt: -1 }  // For queue management
  ]
});

/**
 * VIRTUAL PROPERTY: Duration
 * 
 * Calculates how long a task took from start to completion.
 * This doesn't get stored in the database, it's calculated on the fly.
 * 
 * Why virtual? Because we can always calculate it from startedAt and completedAt,
 * so there's no need to store it separately (DRY principle).
 */
taskSchema.virtual('duration').get(function() {
  if (this.startedAt && this.completedAt) {
    return this.completedAt - this.startedAt;  // Returns milliseconds
  }
  return null;
});

/**
 * VIRTUAL PROPERTY: Is Active
 * 
 * Determines if a task is currently active (not in a terminal state).
 * Useful for queries like "show me all active tasks".
 */
taskSchema.virtual('isActive').get(function() {
  return ['pending', 'queued', 'processing', 'awaiting_input'].includes(this.status);
});

/**
 * INSTANCE METHOD: Add Progress Update
 * 
 * A helper method to add a new progress step and emit it via WebSocket.
 * This keeps your code DRY and ensures consistent progress tracking.
 * 
 * Usage:
 * await task.addProgressUpdate('Logging in', 'in_progress', 'Entering credentials');
 */
taskSchema.methods.addProgressUpdate = async function(step, status, message) {
  this.progressDetails.push({
    step,
    status,
    message,
    timestamp: new Date()
  });
  
  // Update overall progress based on completed steps
  const completedSteps = this.progressDetails.filter(p => p.status === 'completed').length;
  const totalSteps = this.progressDetails.length;
  this.progress = Math.round((completedSteps / Math.max(totalSteps, 1)) * 100);
  
  await this.save();
  
  // Emit progress update via WebSocket (handled by the service layer)
  return this;
};

/**
 * INSTANCE METHOD: Mark As Failed
 * 
 * Centralized way to mark a task as failed with error details.
 * This ensures all failed tasks have consistent error information.
 */
taskSchema.methods.markAsFailed = async function(error) {
  this.status = 'failed';
  this.error = {
    code: error.code || 'UNKNOWN_ERROR',
    message: error.message,
    stack: error.stack,
    timestamp: new Date(),
    recoverable: error.recoverable !== false  // Default to true
  };
  this.completedAt = new Date();
  this.metadata.executionTimeMs = this.startedAt ? Date.now() - this.startedAt : 0;
  
  await this.save();
  return this;
};

/**
 * INSTANCE METHOD: Mark As Completed
 * 
 * Marks a task as successfully completed with results.
 */
taskSchema.methods.markAsCompleted = async function(result) {
  this.status = 'completed';
  this.progress = 100;
  this.result = result;
  this.completedAt = new Date();
  this.metadata.executionTimeMs = this.startedAt ? Date.now() - this.startedAt : 0;
  
  await this.save();
  return this;
};

/**
 * STATIC METHOD: Get User's Active Tasks
 * 
 * Retrieves all active tasks for a specific user.
 * This is a common query, so we create a helper method for it.
 */
taskSchema.statics.getUserActiveTasks = async function(userId) {
  return this.find({
    user: userId,
    status: { $in: ['pending', 'queued', 'processing', 'awaiting_input'] }
  }).sort({ createdAt: -1 });
};

/**
 * PRE-SAVE HOOK: Validate Input Data
 * 
 * Before saving a task, validate that it has all required input data
 * based on its taskType. This prevents incomplete tasks from being created.
 */
taskSchema.pre('save', function(next) {
  // Only validate on creation
  if (!this.isNew) {
    return next();
  }
  
  const inputData = this.inputData;
  
  // Define required fields for each task type
  const requiredFields = {
    itr_filing: ['pan', 'financialYear', 'income'],
    digilocker_download: ['aadhaar', 'documentType'],
    epfo_balance: ['uan', 'password']
  };
  
  const required = requiredFields[this.taskType] || [];
  
  for (const field of required) {
    if (!inputData.get(field)) {
      return next(new Error(`Missing required field: ${field} for task type ${this.taskType}`));
    }
  }
  
  next();
});

/**
 * Export the model
 */
module.exports = mongoose.model('Task', taskSchema);