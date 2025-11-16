import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Loader,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Download,
  Image as ImageIcon
} from 'lucide-react';
import websocket from '../services/websocket';
import { taskAPI } from '../services/api';
import axios from 'axios';
// Helper function to safely handle task data
const sanitizeTask = (taskData) => {
  if (!taskData) return null;
  
  const safeTask = { ...taskData };
  
  // Convert empty objects to null to prevent React errors
  if (safeTask.inputData && typeof safeTask.inputData === 'object' && Object.keys(safeTask.inputData).length === 0) {
    safeTask.inputData = null;
  }
  if (safeTask.result && typeof safeTask.result === 'object' && Object.keys(safeTask.result).length === 0) {
    safeTask.result = null;
  }
  
  return safeTask;
};

export default function AgentStatus({ task: initialTask }) {
  const [task, setTask] = useState(() => sanitizeTask(initialTask));
  const [progressHistory, setProgressHistory] = useState([]);
  const [captchaSolution, setCaptchaSolution] = useState('');
  const [submittingCaptcha, setSubmittingCaptcha] = useState(false);

  // Load full task data on mount
  useEffect(() => {
    const loadFullTask = async () => {
      if (initialTask && (initialTask.id || initialTask._id)) {
        try {
          const response = await taskAPI.getStatus(initialTask.id || initialTask._id);
          if (response.data.data) {
            setTask(sanitizeTask(response.data.data));
          }
        } catch (error) {
          console.error('Error loading full task:', error);
        }
      }
    };
    loadFullTask();
  }, [initialTask]);

  useEffect(() => {
    if (!task) return;

    const token = localStorage.getItem('authToken');
    if (token) {
      websocket.connect(token);
    }

    const handleProgress = (data) => {
      if (data.taskId === task.id || data.taskId === task._id) {
        setTask(prev => sanitizeTask({
          ...prev,
          status: data.status || prev.status,
          progress: data.percentage !== undefined ? data.percentage : prev.progress,
          result: data.captchaImageBase64 ? {
            ...(prev.result || {}),
            captchaImageBase64: data.captchaImageBase64,
            sessionId: data.sessionId
          } : prev.result
        }));

        setProgressHistory(prev => [...prev, {
          message: data.message,
          percentage: data.percentage,
          timestamp: new Date()
        }]);
      }
    };

    const handleCompleted = (data) => {
      if (data.taskId === task.id || data.taskId === task._id) {
        setTask(prev => sanitizeTask({
          ...prev,
          status: 'completed',
          progress: 100
        }));

        setProgressHistory(prev => [...prev, {
          message: 'Task completed successfully!',
          percentage: 100,
          timestamp: new Date(),
          isComplete: true
        }]);
      }
    };

    const handleFailed = (data) => {
      if (data.taskId === task.id || data.taskId === task._id) {
        setTask(prev => sanitizeTask({
          ...prev,
          status: 'failed',
          error: data.error
        }));

        setProgressHistory(prev => [...prev, {
          message: `Task failed: ${data.error?.message || 'Unknown error'}`,
          timestamp: new Date(),
          isError: true
        }]);
      }
    };

    websocket.on('task:progress', handleProgress);
    websocket.on('task:completed', handleCompleted);
    websocket.on('task:failed', handleFailed);

    const pollInterval = setInterval(async () => {
    // ⬇️⬇️⬇️ ADD THESE 4 LINES ⬇️⬇️⬇️
    if (task.status === 'awaiting_input') {
        console.log('⏸️ Skipping poll - awaiting user input');
        return;
    }
    // ⬆️⬆️⬆️ END OF NEW CODE ⬆️⬆️⬆️
    
    try {
        const response = await taskAPI.getStatus(task._id || task.id);
        if (response.data.data) {
            setTask(prev => ({ ...prev, ...response.data.data }));
        }
    } catch (error) {
        console.error('Error polling task status:', error);
    }
}, 5000);

    return () => {
      websocket.off('task:progress', handleProgress);
      websocket.off('task:completed', handleCompleted);
      websocket.off('task:failed', handleFailed);
      clearInterval(pollInterval);
    };
  }, [task]);

  const handleCaptchaSubmit = async () => {
    if (!captchaSolution.trim()) {
      alert('Please enter the captcha code');
      return;
    }

setSubmittingCaptcha(true);
try {
  const response = await axios.post('/api/v1/tasks/captcha/submit', {
    taskId: task._id || task.id,
    captcha: captchaSolution,
    sessionId: task.result?.sessionId || task.sessionId
  }, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`
    }
  });

  if (response.data.success) {
    alert('Captcha submitted! Processing...');
    setCaptchaSolution('');
    // Task will be resumed automatically by the backend
  } else {
    alert(`Error: ${response.data.message || 'Failed to submit captcha'}`);
  }
} catch (error) {
  console.error('Captcha submission error:', error);
  alert(`Failed to submit captcha: ${error.response?.data?.message || error.message}`);
} finally {
  setSubmittingCaptcha(false);
}
};
  if (!task) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center text-gray-500">
        <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No active task</p>
      </div>
    );
  }

  const getStatusColor = () => {
    switch (task.status) {
      case 'completed':
        return 'green';
      case 'failed':
      case 'cancelled':
        return 'red';
      case 'processing':
        return 'blue';
      case 'awaiting_input':
        return 'yellow';
      case 'queued':
      case 'pending':
        return 'yellow';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = () => {
    switch (task.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5" />;
      case 'failed':
        return <XCircle className="w-5 h-5" />;
      case 'processing':
        return <Loader className="w-5 h-5 animate-spin" />;
      case 'awaiting_input':
        return <AlertCircle className="w-5 h-5" />;
      case 'queued':
      case 'pending':
        return <Clock className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  const statusColor = getStatusColor();
  const statusIcon = getStatusIcon();

  const handleDownloadResults = async () => {
    try {
      if (!task.result?.documents || task.result.documents.length === 0) {
        alert('No documents available for download');
        return;
      }

      const doc = task.result.documents[0];
      const downloadUrl = `http://localhost:5001${doc.url}`;

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = doc.filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download document. Please try again.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-lg overflow-hidden"
    >
      <div className={`bg-gradient-to-r from-${statusColor}-500 to-${statusColor}-600 p-6 text-white`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {statusIcon}
            <div>
              <h3 className="text-xl font-bold capitalize">
                {task.taskType?.replace('_', ' ') || 'Task'}
              </h3>
              <p className="text-sm opacity-90 capitalize">
                Status: {task.status?.replace('_', ' ') || 'unknown'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {task.progress || 0}%
            </div>
            <p className="text-sm opacity-90">Complete</p>
          </div>
        </div>

        <div className="w-full bg-white bg-opacity-20 rounded-full h-3 overflow-hidden">
          <motion.div
            className="h-full bg-white rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${task.progress || 0}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {task.status === 'awaiting_input' && task.result?.captchaImageBase64 && (
        <div className="p-6 bg-yellow-50 border-t-4 border-yellow-400">
          <div className="flex items-center gap-2 mb-4 text-yellow-800">
            <AlertCircle className="w-6 h-6" />
            <h4 className="font-bold text-lg">Captcha Verification Required</h4>
          </div>

          <div className="bg-white rounded-lg p-4 mb-4 flex justify-center border-2 border-yellow-300">
            <img
              src={task.result.captchaImageBase64}
              alt="Captcha"
              className="border-2 border-gray-300 rounded-lg"
              style={{ maxHeight: '150px', maxWidth: '100%' }}
            />
          </div>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Enter the captcha code"
              value={captchaSolution}
              onChange={(e) => setCaptchaSolution(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && handleCaptchaSubmit()}
              className="w-full px-4 py-3 border-2 border-yellow-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-lg font-mono text-center"
              disabled={submittingCaptcha}
              autoFocus
            />

            <button
              onClick={handleCaptchaSubmit}
              disabled={submittingCaptcha || !captchaSolution.trim()}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submittingCaptcha ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Submit Captcha
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="p-6">
        <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Live Activity Log
        </h4>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          <AnimatePresence>
            {progressHistory.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  item.isComplete
                    ? 'bg-green-50 border border-green-200'
                    : item.isError
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                  item.isComplete
                    ? 'bg-green-500'
                    : item.isError
                    ? 'bg-red-500'
                    : 'bg-blue-500'
                }`} />

                <div className="flex-1">
                  <p className={`text-sm ${
                    item.isComplete
                      ? 'text-green-800 font-semibold'
                      : item.isError
                      ? 'text-red-800'
                      : 'text-gray-700'
                  }`}>
                    {item.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {item.timestamp.toLocaleTimeString()}
                    {item.percentage !== undefined && ` • ${item.percentage}%`}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {progressHistory.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Waiting for updates...</p>
            </div>
          )}
        </div>

        {task.error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg"
          >
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="font-semibold text-red-800 mb-1">Task Failed</h5>
                <p className="text-sm text-red-700">
                  {typeof task.error === 'string' ? task.error : task.error?.message || 'Unknown error'}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {task.status === 'completed' && (
          <button
            onClick={handleDownloadResults}
            className="mt-6 w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg transition-colors font-semibold"
          >
            <Download className="w-5 h-5" />
            Download Results
          </button>
        )}
      </div>
    </motion.div>
  );
}

