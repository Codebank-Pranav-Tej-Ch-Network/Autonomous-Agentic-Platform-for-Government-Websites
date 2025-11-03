/**
 * Queue Manager Service
 * 
 * This manages background job processing using Bull.
 * Think of this like a task management system at a restaurant:
 * - Orders (tasks) come in
 * - They're added to a queue
 * - Kitchen workers (job processors) take orders one at a time
 * - If an order fails, it can be retried
 * - Multiple workers can process orders simultaneously
 * 
 * WHY USE A QUEUE?
 * - Long-running tasks don't block the API
 * - Automatic retries on failure
 * - Process tasks in order of priority
 * - Distribute work across multiple servers (scalability)
 * - Persist tasks (survive server restarts)
 */

const Bull = require('bull');
const logger = require('../utils/logger');
const Task = require('../models/Task');
const { emitTaskProgress, emitTaskCompleted, emitTaskFailed } = require('./websocket');

// Import automation scripts
const executeITRFiling = require('../automation/scripts/itrFiling');
const executeDigiLocker = require('../automation/scripts/digilocker');
const executeEPFO = require('../automation/scripts/epfo');

/**
 * Create the task queue
 * 
 * Bull needs Redis to store queue data. If you don't have Redis installed,
 * Bull can use an in-memory store (but you lose persistence across restarts).
 */
const taskQueue = new Bull('automation-tasks', {
  redis: process.env.REDIS_URL || {
    host: '127.0.0.1',
    port: 6379
  },
  defaultJobOptions: {
    attempts: 3,              // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',    // Wait longer between each retry
      delay: 5000             // Start with 5 second delay
    },
    removeOnComplete: false,  // Keep completed jobs for history
    removeOnFail: false       // Keep failed jobs for debugging
  }
});

/**
 * Map of task types to their automation functions
 * This is like a phone directory - given a task type, look up which function to call
 */
const TASK_EXECUTORS = {
  'itr_filing': executeITRFiling,
  'digilocker_download': executeDigiLocker,
  'epfo_balance': executeEPFO
};

/**
 * Process jobs from the queue
 * 
 * This function is called by Bull whenever there's a job to process.
 * It's like a worker who constantly checks for new orders to fulfill.
 */
taskQueue.process(async (job) => {
  const { taskId } = job.data;
  
  logger.info(`Processing task ${taskId}`, {
    jobId: job.id,
    attemptNumber: job.attemptsMade + 1
  });

  try {
    // Fetch the task from database
    const task = await Task.findById(taskId);
    
    if (!task) {
      throw new Error(`Task ${taskId} not found in database`);
    }

    // Update task status to processing
    task.status = 'processing';
    task.startedAt = new Date();
    await task.save();

    // Emit status update via WebSocket
    emitTaskProgress(task.user.toString(), {
      taskId: task._id,
      status: 'processing',
      message: 'Task processing started'
    });

    // Get the appropriate executor function for this task type
    const executor = TASK_EXECUTORS[task.taskType];
    
    if (!executor) {
      throw new Error(`No executor found for task type: ${task.taskType}`);
    }

    // Create progress callback
    // The automation script will call this to report progress
    const progressCallback = (progressData) => {
      // Update task in database
      task.addProgressUpdate(
        progressData.message,
        'in_progress',
        progressData.message
      );

      // Emit to user via WebSocket
      emitTaskProgress(task.user.toString(), {
        taskId: task._id,
        ...progressData
      });
    };

    // Execute the automation script
    const result = await executor(task, progressCallback);

    // Mark task as completed
    await task.markAsCompleted(result);

    // Notify user
    emitTaskCompleted(task.user.toString(), {
      taskId: task._id,
      result
    });

    logger.info(`Task ${taskId} completed successfully`);

    return result;

  } catch (error) {
    logger.error(`Task ${taskId} failed:`, {
      error: error.message,
      stack: error.stack
    });

    // Update task in database
    const task = await Task.findById(taskId);
    if (task) {
      await task.markAsFailed(error);
      
      // Notify user
      emitTaskFailed(task.user.toString(), {
        taskId: task._id,
        error: {
          message: error.message,
          recoverable: error.recoverable !== false
        }
      });
    }

    // Re-throw error so Bull knows the job failed
    throw error;
  }
});

/**
 * Event listeners for queue monitoring
 * These help you understand what's happening with your queue
 */

taskQueue.on('completed', (job, result) => {
  logger.info(`Job ${job.id} completed`, {
    taskId: job.data.taskId,
    duration: Date.now() - job.timestamp
  });
});

taskQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed`, {
    taskId: job.data.taskId,
    error: err.message,
    attempts: job.attemptsMade
  });
});

taskQueue.on('stalled', (job) => {
  logger.warn(`Job ${job.id} stalled`, {
    taskId: job.data.taskId
  });
});

/**
 * Add a task to the queue
 * 
 * @param {Object} task - Mongoose task document
 * @returns {Promise<Job>} Bull job object
 */
async function addTask(task) {
  try {
    // Update task status
    task.status = 'queued';
    await task.save();

    // Add to Bull queue
    const job = await taskQueue.add(
      {
        taskId: task._id.toString(),
        userId: task.user.toString()
      },
      {
        priority: task.priority || 5,
        jobId: task._id.toString() // Use task ID as job ID for easy tracking
      }
    );

    logger.info(`Task ${task._id} added to queue`, {
      jobId: job.id,
      priority: task.priority
    });

    return job;

  } catch (error) {
    logger.error('Failed to add task to queue:', error);
    
    // Update task status to failed
    task.status = 'failed';
    task.error = {
      message: 'Failed to queue task',
      timestamp: new Date()
    };
    await task.save();

    throw error;
  }
}

/**
 * Remove a task from the queue (for cancellation)
 */
async function removeTask(taskId) {
  try {
    const job = await taskQueue.getJob(taskId.toString());
    
    if (job) {
      await job.remove();
      logger.info(`Task ${taskId} removed from queue`);
      return true;
    }
    
    return false;

  } catch (error) {
    logger.error('Failed to remove task from queue:', error);
    throw error;
  }
}

/**
 * Get queue statistics
 * Useful for monitoring and admin dashboards
 */
async function getQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    taskQueue.getWaitingCount(),
    taskQueue.getActiveCount(),
    taskQueue.getCompletedCount(),
    taskQueue.getFailedCount()
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    total: waiting + active + completed + failed
  };
}

/**
 * Clean up old jobs
 * Run this periodically to prevent queue from growing indefinitely
 */
async function cleanOldJobs(daysOld = 7) {
  const timestamp = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
  
  await taskQueue.clean(timestamp, 'completed');
  await taskQueue.clean(timestamp, 'failed');
  
  logger.info(`Cleaned jobs older than ${daysOld} days`);
}

module.exports = {
  taskQueue,
  addTask,
  removeTask,
  getQueueStats,
  cleanOldJobs
};