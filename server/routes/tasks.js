/**
 * Task Routes - COMPLETE VERSION WITH FILE UPLOAD
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
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Make sure this directory exists
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  },
  fileFilter: function (req, file, cb) {
    // Accept only specific file types
    const allowedTypes = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/jpg'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Excel, and images are allowed.'));
    }
  }
});

// All task routes require authentication
router.use(protect);

/**
 * POST /api/v1/tasks/extract-data
 * NEW: Extract data from uploaded files using AI
 *
 * Body: multipart/form-data with files[]
 * Returns: Extracted financial data (salary, deductions, etc.)
 */
router.post(
  '/extract-data',
  upload.array('files', 5), // Accept up to 5 files
  taskController.extractDataFromFiles
);

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

// Get ITR filing history
/**
 * GET /api/v1/tasks/history/itr
 * Get ITR filing history for authenticated user
 *
 * Returns: List of completed ITR filings
 */
router.get('/history/itr', async (req, res) => {
  try {
    const Task = require('../models/Task');  // Add import here
    
    const history = await Task.find({
      user: req.user.id,
      taskType: 'itr_filing',
      status: 'completed'
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('result createdAt completedAt inputData');

    res.json({ success: true, history });

  } catch (error) {
    console.error('History fetch error:', error);  // Use console.error instead of logger
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;

