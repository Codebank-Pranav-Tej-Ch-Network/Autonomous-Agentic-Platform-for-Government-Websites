/**
 * Task Controller - WITH USER-FRIENDLY ERROR MESSAGES
 * NEW: Integrated errorTranslator for friendly error messages
 */

const Task = require('../models/Task');
const User = require('../models/User');
const llmRouter = require('../services/llmRouter');
const queueManager = require('../services/queueManager');
const { emitTaskProgress, emitTaskCompleted, emitTaskFailed } = require('../services/websocket');
const logger = require('../utils/logger');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');
const xlsx = require('xlsx');
const errorTranslator = require('../services/errorTranslator'); // ← NEW: Error translator

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Initiate Task Creation from Natural Language
 */
exports.createTaskFromNaturalLanguage = async (req, res, next) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;

    logger.info('Received task creation request', {
      userId,
      messageLength: message.length,
      message: message.substring(0, 100)
    });

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a message describing what you want to do'
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Message is too long. Please keep it under 2000 characters.'
      });
    }

    let classification;

    try {
      classification = await llmRouter.classifyWithUserContext(
        message,
        userId,
        { conversationContext: req.body.conversationContext || null }
      );

      logger.info('Classification completed', {
        taskType: classification.taskType,
        confidence: classification.confidence,
        readyToExecute: classification.readyToExecute,
        missingFieldsCount: classification.missingFields?.length || 0
      });

    } catch (llmError) {
      logger.error('LLM classification failed:', llmError);

      // NEW: Use error translator for LLM errors
      const friendlyError = await errorTranslator.translateError(llmError.message, {
        taskType: 'classification',
        step: 'Understanding your request'
      });

      return res.status(500).json({
        success: false,
        message: friendlyError,
        technicalDetails: process.env.NODE_ENV === 'development' ? llmError.message : undefined
      });
    }

    if (!classification || !classification.taskType) {
      return res.status(400).json({
        success: false,
        message: 'Unable to determine what task you want to perform. Please be more specific.',
        needsClarification: true,
        lowConfidence: true
      });
    }

    if (classification.confidence < 0.5) {
      return res.json({
        success: true,
        needsClarification: true,
        lowConfidence: true,
        message: "I'm not quite sure what you want to do. Could you please rephrase your request? For example, you could say 'File my income tax return' or 'Download my driving license from DigiLocker'."
      });
    }

    if (classification.clarificationNeeded && !classification.readyToExecute) {
      if (!classification.clarificationQuestion) {
        logger.error('Classification needs clarification but no question provided');
        return res.status(500).json({
          success: false,
          message: 'Unable to determine what information is needed. Please start over with a more detailed request.'
        });
      }

      return res.json({
        success: true,
        needsClarification: true,
        taskType: classification.taskType,
        question: classification.clarificationQuestion,
        missingFields: classification.missingFields || [],
        extractedParams: classification.extractedParams || {},
        conversationId: generateConversationId()
      });
    }

    if (!classification.profileData && !classification.extractedParams) {
      logger.error('Classification ready but no data provided');
      return res.status(500).json({
        success: false,
        message: 'Unable to extract necessary information. Please provide more details about your request.'
      });
    }

    logger.info('Creating task with full data', {
      userId,
      taskType: classification.taskType,
      profileDataKeys: Object.keys(classification.profileData || {}),
      extractedParamsKeys: Object.keys(classification.extractedParams || {})
    });

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
      message: 'Task created successfully and is being processed',
      task: {
        id: task._id,
        taskType: task.taskType,
        status: task.status,
        createdAt: task.createdAt
      }
    });

  } catch (error) {
    logger.error('Error in createTaskFromNaturalLanguage:', {
      error: error.message,
      stack: error.stack
    });

    // NEW: Translate general errors
    const friendlyError = await errorTranslator.translateError(error.message, {
      taskType: 'task_creation',
      step: 'Creating your task'
    });

    return res.status(500).json({
      success: false,
      message: friendlyError,
      technicalDetails: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Handle Clarification Response
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

    if (!response || !previousContext) {
      return res.status(400).json({
        success: false,
        message: 'Invalid clarification response. Please provide the requested information.'
      });
    }

    if (!previousContext.originalMessage) {
      return res.status(400).json({
        success: false,
        message: 'Conversation context is invalid. Please start over.'
      });
    }

    const fullMessage = `${previousContext.originalMessage}\n\nAdditional information: ${response}`;

    let classification;

    try {
      classification = await llmRouter.classifyWithUserContext(
        fullMessage,
        userId,
        {
          conversationContext: previousContext,
          previousExtractedParams: previousContext.extractedParams || {}
        }
      );
      console.log('🔍 DEBUG: Previous params:', previousContext.extractedParams);
      console.log('🔍 DEBUG: New classification:', classification.extractedParams);
      console.log('🔍 DEBUG: Missing fields:', classification.missingFields);

    } catch (llmError) {
      logger.error('LLM classification failed on clarification:', llmError);

      // NEW: Translate clarification errors
      const friendlyError = await errorTranslator.translateError(llmError.message, {
        taskType: 'clarification',
        step: 'Processing your response'
      });

      return res.status(500).json({
        success: false,
        message: friendlyError,
        technicalDetails: process.env.NODE_ENV === 'development' ? llmError.message : undefined
      });
    }

    if (classification.clarificationNeeded && !classification.readyToExecute) {
      const clarificationCount = previousContext.clarificationCount || 0;

      if (clarificationCount >= 3) {
        logger.warn('Too many clarification attempts', { userId, conversationId });
        return res.status(400).json({
          success: false,
          message: 'Unable to understand your requirements after multiple attempts. Please start over with a more detailed request, or complete your profile to provide the missing information automatically.'
        });
      }

      return res.json({
        success: true,
        needsClarification: true,
        taskType: classification.taskType,
        question: classification.clarificationQuestion,
        missingFields: classification.missingFields,
        extractedParams: {
          ...previousContext.extractedParams,
          ...classification.extractedParams
        },
        conversationId: conversationId,
        clarificationCount: clarificationCount + 1
      });
    }

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

    // NEW: Translate errors
    const friendlyError = await errorTranslator.translateError(error.message, {
      taskType: 'clarification',
      step: 'Processing your response'
    });

    return res.status(500).json({
      success: false,
      message: friendlyError,
      technicalDetails: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create Task with Complete Data
 */
exports.createTaskWithFullData = async (userId, taskType, inputData, req) => {
  try {
    logger.info('Creating task with full data', {
      userId,
      taskType,
      dataKeys: Object.keys(inputData)
    });

    const inputDataMap = new Map();
    for (const [key, value] of Object.entries(inputData)) {
      if (value !== undefined && value !== null) {
        inputDataMap.set(key, value);
      }
    }

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

    await task.addProgressUpdate(
      'Task Created',
      'completed',
      `Your ${taskType.replace('_', ' ')} task has been created and is being queued for processing.`
    );

    try {
      await queueManager.addTask(task);
      logger.info('Task added to queue', { taskId: task._id });

      emitTaskProgress(userId.toString(), {
        taskId: task._id,
        status: 'queued',
        message: 'Task queued for processing',
        percentage: 0
      });

    } catch (queueError) {
      logger.error('Failed to add task to queue', { taskId: task._id, error: queueError });

      // NEW: Translate queue errors
      const friendlyError = await errorTranslator.translateError(queueError.message, {
        taskType: taskType,
        step: 'Queueing your task'
      });

      task.status = 'failed';
      task.error = {
        code: 'QUEUE_ERROR',
        message: friendlyError, // ← NEW: User-friendly error
        timestamp: new Date()
      };
      await task.save();

      throw new Error(friendlyError);
    }

    return task;

  } catch (error) {
    logger.error('Error creating task with full data:', error);
    throw error;
  }
};

/**
 * Extract data from uploaded files using ONLY Gemini
 */
exports.extractDataFromFiles = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    logger.info('Processing uploaded files', {
      count: req.files.length,
      files: req.files.map(f => ({ name: f.originalname, type: f.mimetype, size: f.size }))
    });

    const extractedData = {
      salary: null,
      deductions: null,
      otherIncome: null,
      taxPaid: null,
      rawText: []
    };

    for (const file of req.files) {
      try {
        let text = '';

        if (file.mimetype.includes('sheet') || file.mimetype.includes('excel')) {
          text = await extractTextFromExcel(file.path);
        } else {
          text = await extractTextWithGemini(file.path, file.mimetype);
        }

        extractedData.rawText.push({
          filename: file.originalname,
          text: text
        });

        const structured = await extractFinancialDataWithGemini(text);

        if (structured.salary && !extractedData.salary) {
          extractedData.salary = structured.salary;
        }
        if (structured.deductions && !extractedData.deductions) {
          extractedData.deductions = structured.deductions;
        }
        if (structured.otherIncome && !extractedData.otherIncome) {
          extractedData.otherIncome = structured.otherIncome;
        }
        if (structured.taxPaid && !extractedData.taxPaid) {
          extractedData.taxPaid = structured.taxPaid;
        }

        await fs.unlink(file.path);

      } catch (fileError) {
        logger.error(`Error processing file ${file.originalname}:`, fileError);
        // Continue with other files
      }
    }

    logger.info('Data extraction completed', extractedData);

    res.json({
      success: true,
      extractedData: {
        salary: extractedData.salary,
        deductions: extractedData.deductions,
        otherIncome: extractedData.otherIncome,
        taxPaid: extractedData.taxPaid
      },
      rawText: extractedData.rawText
    });

  } catch (error) {
    logger.error('Error in extractDataFromFiles:', error);
    
    // NEW: Translate file extraction errors
    const friendlyError = await errorTranslator.translateError(error.message, {
      taskType: 'file_upload',
      step: 'Reading your documents'
    });
    
    res.status(500).json({
      success: false,
      message: friendlyError
    });
  }
};

async function extractTextFromExcel(filePath) {
  const workbook = xlsx.readFile(filePath);
  let text = '';

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    jsonData.forEach(row => {
      text += row.join(' | ') + '\n';
    });
  });

  return text;
}

async function extractTextWithGemini(filePath, mimeType) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const fileData = await fs.readFile(filePath);
    const base64Data = fileData.toString('base64');

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      },
      'Extract all text from this document/image. Focus on financial information like salary, income, deductions, tax amounts, and other monetary values. Return the complete text content.'
    ]);

    const response = await result.response;
    return response.text();

  } catch (error) {
    logger.error('Gemini document extraction error:', error);
    throw new Error('Failed to extract text from file');
  }
}

async function extractFinancialDataWithGemini(text) {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    });

    const prompt = `Analyze this financial document text and extract the following information in JSON format:

{
  "salary": "annual salary amount in rupees (numbers only, no commas or currency symbols)",
  "deductions": "total tax deductions amount (80C, 80D, etc.)",
  "otherIncome": "other income amounts if mentioned",
  "taxPaid": "tax already paid amount if mentioned"
}

If a field is not found, return null for that field.
Only return the JSON, no additional text.

Document text:
${text.substring(0, 8000)}

JSON:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        salary: parsed.salary ? parseInt(parsed.salary.toString().replace(/,/g, '')) : null,
        deductions: parsed.deductions ? parseInt(parsed.deductions.toString().replace(/,/g, '')) : null,
        otherIncome: parsed.otherIncome ? parseInt(parsed.otherIncome.toString().replace(/,/g, '')) : null,
        taxPaid: parsed.taxPaid ? parseInt(parsed.taxPaid.toString().replace(/,/g, '')) : null
      };
    }

    return { salary: null, deductions: null, otherIncome: null, taxPaid: null };

  } catch (error) {
    logger.error('Gemini extraction error:', error);
    return { salary: null, deductions: null, otherIncome: null, taxPaid: null };
  }
}

exports.getAllTasks = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    const query = { user: userId };

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

    if (!['pending', 'queued', 'awaiting_input'].includes(task.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel task in ${task.status} status`
      });
    }

    task.status = 'cancelled';
    task.cancelledAt = new Date();
    await task.save();

    try {
      await queueManager.removeTask(task._id);
      logger.info('Task removed from queue', { taskId: task._id });
    } catch (queueError) {
      logger.warn('Failed to remove task from queue (may already be removed)', {
        taskId: task._id,
        error: queueError.message
      });
    }

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

exports.retryTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

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

// NEW: Test endpoint for error translation
exports.testErrorTranslation = async (req, res) => {
  try {
    const technicalError = "page.selectOption: Timeout 60000ms exceeded. Call log: waiting for locator('select[name=\"itrType\"]')";
    
    const friendlyError = await errorTranslator.translateError(technicalError, {
      taskType: 'itr_filing',
      step: 'Selecting ITR form'
    });
    
    res.json({
      technical: technicalError,
      friendly: friendlyError
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = exports;

