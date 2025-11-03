/**
 * Task Routes
 * 
 * These routes define the API endpoints that the React frontend will call
 * to interact with the task system. Each route is protected by authentication
 * middleware, ensuring only logged-in users can access their tasks.
 */

const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { protect } = require('../middleware/auth');
const { validate, createTaskSchema } = require('../middleware/validation');

// All task routes require authentication
router.use(protect);

/**
 * POST /api/v1/tasks/create
 * Create a new task from natural language input
 * 
 * Body: { message: string, conversationContext?: object }
 * Returns: Task object or clarification request
 */
router.post(
  '/create',
  validate(createTaskSchema),
  taskController.createTaskFromNaturalLanguage
);

/**
 * POST /api/v1/tasks/clarify
 * Provide clarification in response to a question
 * 
 * Body: { conversationId: string, response: string, previousContext: object }
 * Returns: Task object or follow-up clarification
 */
router.post(
  '/clarify',
  taskController.handleClarificationResponse
);

/**
 * GET /api/v1/tasks
 * Get all tasks for the authenticated user
 * 
 * Query params: page?, limit?, status?
 * Returns: Paginated list of tasks
 */
router.get(
  '/',
  taskController.getAllTasks
);

/**
 * GET /api/v1/tasks/active
 * Get currently active tasks
 * 
 * Returns: List of active tasks
 */
router.get(
  '/active',
  taskController.getActiveTasks
);

/**
 * GET /api/v1/tasks/:id
 * Get detailed information about a specific task
 * 
 * Returns: Complete task object with history
 */
router.get(
  '/:id',
  taskController.getTaskById
);

/**
 * GET /api/v1/tasks/:id/status
 * Get lightweight status information
 * 
 * Returns: Just the status and progress info
 */
router.get(
  '/:id/status',
  taskController.getTaskStatus
);

/**
 * POST /api/v1/tasks/:id/cancel
 * Cancel a pending or queued task
 * 
 * Returns: Updated task object
 */
router.post(
  '/:id/cancel',
  taskController.cancelTask
);

/**
 * POST /api/v1/tasks/:id/retry
 * Retry a failed task
 * 
 * Returns: New task object
 */
router.post(
  '/:id/retry',
  taskController.retryTask
);

module.exports = router;
