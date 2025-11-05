/**
 * AgentStatus Component
 *
 * Displays real-time status updates for a running automation task.
 * Connects via WebSocket to receive live progress updates as the
 * automation script executes.
 *
 * Visual elements:
 * - Progress bar showing completion percentage
 * - Step-by-step log of what's happening
 * - Live status badges (queued, processing, completed, failed)
 * - Screenshots captured during execution (if available)
 * - Error messages if something goes wrong
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Loader,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Download
} from 'lucide-react';
import websocket from '../services/websocket';
import { taskAPI } from '../services/api';

export default function AgentStatus({ task: initialTask }) {
  const [task, setTask] = useState(initialTask);
  const [progressHistory, setProgressHistory] = useState([]);

  useEffect(() => {
    if (!task) return;

    // Connect to WebSocket if not already connected
    const token = localStorage.getItem('authToken');
    if (token) {
      websocket.connect(token);
    }

    // Listen for progress updates for this specific task
    const handleProgress = (data) => {
      if (data.taskId === task.id || data.taskId === task._id) {
        setTask(prev => ({
          ...prev,
          status: data.status || prev.status,
          progress: data.percentage !== undefined ? data.percentage : prev.progress
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
        setTask(prev => ({
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
        setTask(prev => ({
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

    // Also poll for status updates (fallback if WebSocket fails)
    const pollInterval = setInterval(async () => {
      try {
        const response = await taskAPI.getStatus(task.id || task._id);
        if (response.data.data) {
          setTask(prev => ({
            ...prev,
            ...response.data.data
          }));
        }
      } catch (error) {
        console.error('Error polling task status:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => {
      websocket.off('task:progress', handleProgress);
      websocket.off('task:completed', handleCompleted);
      websocket.off('task:failed', handleFailed);
      clearInterval(pollInterval);
    };
  }, [task]);

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
      case 'queued':
      case 'pending':
        return <Clock className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  const statusColor = getStatusColor();
  const statusIcon = getStatusIcon();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-lg overflow-hidden"
    >
      {/* Header with Status */}
      <div className={`bg-gradient-to-r from-${statusColor}-500 to-${statusColor}-600 p-6 text-white`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {statusIcon}
            <div>
              <h3 className="text-xl font-bold capitalize">
                {task.taskType?.replace('_', ' ')}
              </h3>
              <p className="text-sm opacity-90 capitalize">
                Status: {task.status}
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

        {/* Progress Bar */}
        <div className="w-full bg-white bg-opacity-20 rounded-full h-3 overflow-hidden">
          <motion.div
            className="h-full bg-white rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${task.progress || 0}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Progress History */}
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

        {/* Error Display */}
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
                <p className="text-sm text-red-700">{task.error.message || task.error}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Download Results Button */}
        {task.status === 'completed' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <button className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2">
              <Download className="w-5 h-5" />
              Download Results
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
