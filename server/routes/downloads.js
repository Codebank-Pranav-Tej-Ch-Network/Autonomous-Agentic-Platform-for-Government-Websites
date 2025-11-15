const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');
const Task = require('../models/Task');

// Download ITR document
router.get('/:taskId/:filename', protect, async (req, res) => {
  try {
    const { taskId, filename } = req.params;
    
    const task = await Task.findOne({ 
      _id: taskId, 
      user: req.user.id 
    });
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const filePath = path.join(__dirname, '../downloads', taskId, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(filePath, filename);
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

module.exports = router;

