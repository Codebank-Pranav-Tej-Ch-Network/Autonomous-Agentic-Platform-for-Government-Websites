const Task = require('../models/Task');
const queueManager = require('../services/queueManager');
const logger = require('../utils/logger');
const searchVehicle = require('../automation/searchVehicle'); // ← ADD THIS

exports.submitCaptcha = async (req, res) => {
    try {
        const { taskId, captcha, sessionId } = req.body;
        const userId = req.user.id;

        logger.info('Captcha submission received', { taskId, sessionId, captchaLength: captcha?.length });

        if (!taskId || !captcha || !sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: taskId, captcha, and sessionId'
            });
        }

        const task = await Task.findOne({ _id: taskId, user: userId });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        if (task.status !== 'awaiting_input') {
            return res.status(400).json({
                success: false,
                message: `Task is not awaiting input (current status: ${task.status})`
            });
        }

        // Update task with captcha
        task.inputData.set('captcha', captcha);
        task.inputData.set('sessionId', sessionId);
        task.status = 'processing';
        task.progress = 50;
        await task.save();

        logger.info('Captcha submitted, task resumed', { taskId });

        // ← NEW: Trigger Step 2 immediately in background
        setImmediate(async () => {
            try {
                const inputDataObj = {};
                for (const [key, value] of task.inputData.entries()) {
                    inputDataObj[key] = value;
                }

                const result = await searchVehicle(inputDataObj);
                
                if (result.success) {
                    task.status = 'completed';
                    task.progress = 100;
                    task.result = result;
                } else {
                    task.status = 'failed';
                    task.error = { message: result.message };
                }
                await task.save();
            } catch (error) {
                logger.error('Error continuing task:', error);
                task.status = 'failed';
                task.error = { message: error.message };
                await task.save();
            }
        });

        res.json({
            success: true,
            message: 'Captcha submitted successfully. Task is being processed.'
        });

    } catch (error) {
        logger.error('Error submitting captcha:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit captcha'
        });
    }
};

module.exports = exports;

