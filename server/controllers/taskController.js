/**
 * Task Controller - The Orchestration Layer
 * 
 * This controller is the heart of the application's task management system.
 * It handles the complete lifecycle of a task from the moment a user expresses
 * intent through natural language to the completion of the automation and delivery
 * of results.
 * 
 * The flow it manages:
 * 1. User sends natural language message
 * 2. Controller uses LLM Router to understand intent
 * 3. If information is missing, starts a conversation to collect it
 * 4. Once all data is collected, creates a Task in MongoDB
 * 5. Adds task to Bull queue for background processing
 * 6. Monitors execution and streams real-time updates via WebSocket
 * 7. Returns final results to user
 */

const Task = require('../models/Task');
const User = require('../models/User');
const llmRouter = require('../services/llmRouter');
const queueManager = require('../services/queueManager');
const { emitTaskProgress, emitTaskCompleted, emitTaskFailed } = require('../services/websocket');
const logger = require('../utils/logger');

/**
 * Initiate Task Creation from Natural Language
 * 
 * This is the main entry point when a user sends a message. The message might be
 * a complete request with all information, or it might be partial. This method
 * handles both cases intelligently.
 * 
 * The response can be one of three types:
 * 1. "needsClarification" - More information required, includes a question
 * 2. "taskCreated" - Task successfully created and queued
 * 3. "error" - Something went wrong
 */
exports.createTaskFromNaturalLanguage = async (req, res, next) => {
  try {
    const { message, conversationContext } = req.body;
    const userId = req.user.id;

    logger.info('Received task creation request', {
      userId,
      messageLength: message.length,
      hasContext: !!conversationContext
    });

    // Validate input
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a message describing what you want to do'
      });
    }

    // Use LLM Router to classify and enrich with user profile data
    const classification = await llmRouter.classifyWithUserContext(
      message,
      userId,
      { conversationContext }
    );

    logger.info('Classification completed', {
      taskType: classification.taskType,
      confidence: classification.confidence,
      readyToExecute: classification.readyToExecute
    });

    // If confidence is too low, ask user to clarify
    if (classification.confidence < 0.5) {
      return res.json({
        success: true,
        needsClarification: true,
        lowConfidence: true,
        message: "I'm not quite sure what you want to do. Could you please rephrase your request? For example, you could say 'File my income tax return' or 'Download my driving license from DigiLocker'."
      });
    }

    // If we need more information, return the clarification question
    if (classification.clarificationNeeded && !classification.readyToExecute) {
      return res.json({
        success: true,
        needsClarification: true,
        taskType: classification.taskType,
        question: classification.clarificationQuestion,
        missingFields: classification.missingFields,
        extractedParams: classification.extractedParams,
        // Include a conversation ID so the frontend can track this exchange
        conversationId: generateConversationId()
      });
    }

    // We have everything we need - create the task
    const task = await this.createTaskWithFullData(
      userId,
      classification.taskType,
      {
        ...classification.profileData,
        ...classification.extractedParams
      },
      req
    );

    // Return success with task details
    return res.status(201).json({
      success: true,
      message: 'Task created successfully and is being processed',
      task: {
        id: task._id,
        taskType: task.taskType,
        status: task.status,
        createdAt: task.createdAt
      }
    });

  } catch (error) {
    logger.error('Error in createTaskFromNaturalLanguage:', error);
    next(error);
  }
};

/**
 * Handle Clarification Response
 * 
 * When we ask the user for more information, they respond with this endpoint.
 * We take their response, combine it with the previous context, and attempt
 * to create the task again.
 */
exports.handleClarificationResponse = async (req, res, next) => {
  try {
    const { conversationId, response, previousContext } = req.body;
    const userId = req.user.id;

    logger.info('Received clarification response', {
      userId,
      conversationId,
      responseLength: response.length
    });

    // Validate input
    if (!response || !previousContext) {
      return res.status(400).json({
        success: false,
        message: 'Invalid clarification response'
      });
    }

    // Combine the original message with the new response
    const fullMessage = `${previousContext.originalMessage}\n\nAdditional information: ${response}`;

    // Try classification again with the additional information
    const classification = await llmRouter.classifyWithUserContext(
      fullMessage,
      userId,
      { 
        conversationContext: previousContext,
        previousExtractedParams: previousContext.extractedParams
      }
    );

    // Check if we still need more information
    if (classification.clarificationNeeded && !classification.readyToExecute) {
      return res.json({
        success: true,
        needsClarification: true,
        taskType: classification.taskType,
        question: classification.clarificationQuestion,
        missingFields: classification.missingFields,
        extractedParams: classification.extractedParams,
        conversationId: conversationId
      });
    }

    // Create the task now that we have all information
    const task = await this.createTaskWithFullData(
      userId,
      classification.taskType,
      {
        ...classification.profileData,
        ...classification.extractedParams
      },
      req
    );

    return res.status(201).json({
      success: true,
      message: 'Task created successfully with your additional information',
      task: {
        id: task._id,
        taskType: task.taskType,
        status: task.status,
        createdAt: task.createdAt
      }
    });

  } catch (error) {
    logger.error('Error in handleClarificationResponse:', error);
    next(error);
  }
};

/**
 * Create Task with Complete Data
 * 
 * This internal method is called once we have all the information needed to
 * create a task. It creates the MongoDB document, validates the data, adds
 * the task to the processing queue, and returns the created task.
 */
exports.createTaskWithFullData = async (userId, taskType, inputData, req) => {
  try {
    logger.info('Creating task with full data', {
      userId,
      taskType,
      dataKeys: Object.keys(inputData)
    });

    // Convert inputData object to Map (Task model expects Map)
    const inputDataMap = new Map();
    for (const [key, value] of Object.entries(inputData)) {
      if (value !== undefined && value !== null) {
        inputDataMap.set(key, value);
      }
    }

    // Create the task document
    const task = await Task.create({
      user: userId,
      taskType: taskType,
      status: 'pending',
      inputData: inputDataMap,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        createdVia: 'natural_language'
      }
    });

    logger.info('Task created in database', {
      taskId: task._id,
      taskType: task.taskType
    });

    // Add progress update: Task created
    await task.addProgressUpdate(
      'Task Created',
      'completed',
      `Your ${taskType.replace('_', ' ')} task has been created and is being queued for processing.`
    );

    // Add to processing queue
    try {
      await queueManager.addTask(task);
      logger.info('Task added to queue', { taskId: task._id });

      // Emit WebSocket event that task was created
      emitTaskProgress(userId.toString(), {
        taskId: task._id,
        status: 'queued',
        message: 'Task queued for processing',
        percentage: 0
      });

    } catch (queueError) {
      logger.error('Failed to add task to queue', { taskId: task._id, error: queueError });
      
      // Update task status to failed
      task.status = 'failed';
      task.error = {
        code: 'QUEUE_ERROR',
        message: 'Failed to queue task for processing',
        timestamp: new Date()
      };
      await task.save();

      throw new Error('Failed to queue task for processing. Please try again.');
    }

    return task;

  } catch (error) {
    logger.error('Error creating task with full data:', error);
    throw error;
  }
};

/**
 * Get All Tasks for Current User
 * 
 * Returns a paginated list of all tasks belonging to the authenticated user,
 * sorted by most recent first.
 */
exports.getAllTasks = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    const query = { user: userId };
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    const tasks = await Task.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await Task.countDocuments(query);

    res.json({
      success: true,
      data: tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Error in getAllTasks:', error);
    next(error);
  }
};

/**
 * Get Task by ID
 * 
 * Returns detailed information about a specific task, including its current
 * status, progress history, and results if completed.
 */
exports.getTaskById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const task = await Task.findOne({
      _id: id,
      user: userId
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.json({
      success: true,
      data: task
    });

  } catch (error) {
    logger.error('Error in getTaskById:', error);
    next(error);
  }
};

/**
 * Get Task Status (Lightweight)
 * 
 * Returns just the status information for a task, useful for polling
 * or quick status checks without loading the full task data.
 */
exports.getTaskStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const task = await Task.findOne(
      { _id: id, user: userId },
      'status progress progressDetails error result.success'
    ).lean();

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: task._id,
        status: task.status,
        progress: task.progress,
        latestUpdate: task.progressDetails?.[task.progressDetails.length - 1] || null,
        hasError: !!task.error,
        isComplete: task.result?.success === true
      }
    });

  } catch (error) {
    logger.error('Error in getTaskStatus:', error);
    next(error);
  }
};

/**
 * Cancel Task
 * 
 * Attempts to cancel a task that is pending or queued. Once a task is
 * actively processing, it may not be cancellable depending on how far
 * along it is in the automation workflow.
 */
exports.cancelTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const task = await Task.findOne({
      _id: id,
      user: userId
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check if task can be cancelled
    if (!['pending', 'queued', 'awaiting_input'].includes(task.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel task in ${task.status} status`
      });
    }

    // Update task status
    task.status = 'cancelled';
    task.cancelledAt = new Date();
    await task.save();

    // Remove from queue if it's still there
    try {
      await queueManager.removeTask(task._id);
      logger.info('Task removed from queue', { taskId: task._id });
    } catch (queueError) {
      logger.warn('Failed to remove task from queue (may already be removed)', {
        taskId: task._id,
        error: queueError.message
      });
    }

    // Emit WebSocket event
    emitTaskProgress(userId.toString(), {
      taskId: task._id,
      status: 'cancelled',
      message: 'Task cancelled by user'
    });

    res.json({
      success: true,
      message: 'Task cancelled successfully',
      data: task
    });

  } catch (error) {
    logger.error('Error in cancelTask:', error);
    next(error);
  }
};

/**
 * Get Active Tasks
 * 
 * Returns all tasks that are currently active (pending, queued, or processing)
 * for the authenticated user. Useful for dashboard displays showing current activity.
 */
exports.getActiveTasks = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const activeTasks = await Task.getUserActiveTasks(userId);

    res.json({
      success: true,
      count: activeTasks.length,
      data: activeTasks
    });

  } catch (error) {
    logger.error('Error in getActiveTasks:', error);
    next(error);
  }
};

/**
 * Retry Failed Task
 * 
 * Creates a new task with the same parameters as a failed task, allowing
 * the user to retry the operation without re-entering all information.
 */
exports.retryTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find the original failed task
    const originalTask = await Task.findOne({
      _id: id,
      user: userId
    });

    if (!originalTask) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (originalTask.status !== 'failed') {
      return res.status(400).json({
        success: false,
        message: 'Can only retry failed tasks'
      });
    }

    // Create a new task with the same data
    const inputDataObject = {};
    for (const [key, value] of originalTask.inputData.entries()) {
      inputDataObject[key] = value;
    }

    const newTask = await this.createTaskWithFullData(
      userId,
      originalTask.taskType,
      inputDataObject,
      req
    );

    res.status(201).json({
      success: true,
      message: 'Task retry initiated',
      originalTaskId: originalTask._id,
      newTask: {
        id: newTask._id,
        taskType: newTask.taskType,
        status: newTask.status,
        createdAt: newTask.createdAt
      }
    });

  } catch (error) {
    logger.error('Error in retryTask:', error);
    next(error);
  }
};

/**
 * Utility function to generate conversation IDs
 */
function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = exports;
