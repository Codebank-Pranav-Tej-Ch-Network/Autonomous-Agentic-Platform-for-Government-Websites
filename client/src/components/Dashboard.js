/**
 * Enhanced Dashboard Component
 *
 * This is the main application interface that brings together:
 * - TaskSelector for natural language task creation
 * - AgentStatus for real-time progress monitoring
 * - ResultsPanel for task history
 * - Profile completeness warnings
 *
 * It manages the overall application state and coordinates between components.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Clock, CheckCircle, XCircle, User, AlertTriangle } from 'lucide-react';
import TaskSelector from './Taskselector';
import AgentStatus from './AgentStatus';
import ResultsPanel from './ResultsPanel';
import { taskAPI, authAPI } from '../services/api';
import websocket from '../services/websocket';
import ProfileManagement from './ProfileManagement';
import { toast } from 'react-toastify';

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    loadInitialData();

    // Connect WebSocket
    const token = localStorage.getItem('authToken');
    if (token) {
      websocket.connect(token);
    }

    // Listen for task updates
    websocket.on('task:progress', handleTaskProgress);
    websocket.on('task:completed', handleTaskCompleted);
    websocket.on('task:failed', handleTaskFailed);

    return () => {
      websocket.off('task:progress', handleTaskProgress);
      websocket.off('task:completed', handleTaskCompleted);
      websocket.off('task:failed', handleTaskFailed);
    };
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Load user profile and tasks in parallel
      const [profileResponse, tasksResponse] = await Promise.all([
        authAPI.getProfile(),
        taskAPI.getAll({ page: 1, limit: 50 })
      ]);

      setUserProfile(profileResponse.data.data.user);
      setTasks(tasksResponse.data.data);

      // If there's an active task, set it
      const activeTasks = tasksResponse.data.data.filter(t =>
        ['pending', 'queued', 'processing'].includes(t.status)
      );
      if (activeTasks.length > 0) {
        setActiveTask(activeTasks[0]);
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskProgress = (data) => {
    setTasks(prev => prev.map(task =>
      task._id === data.taskId ? { ...task, ...data } : task
    ));
    if (activeTask?._id === data.taskId) {
      setActiveTask(prev => ({ ...prev, ...data }));
    }
  };

  const handleTaskCompleted = (data) => {
    toast.success(`Task completed successfully!`);
    loadInitialData(); // Reload to get updated data
  };

  const handleTaskFailed = (data) => {
    toast.error(`Task failed: ${data.error?.message || 'Unknown error'}`);
    loadInitialData();
  };

  const handleTaskCreated = (newTask) => {
    setTasks(prev => [newTask, ...prev]);
    setActiveTask(newTask);
    toast.success('Task created and processing started!');
  };

  const handleViewTask = (task) => {
    setActiveTask(task);
  };

  const handleRetryTask = async (task) => {
    try {
      const response = await taskAPI.retry(task._id);
      toast.success('Task retry initiated!');
      setActiveTask(response.data.newTask);
      loadInitialData();
    } catch (error) {
      toast.error('Failed to retry task');
    }
  };

  const stats = {
    active: tasks.filter(t => ['pending', 'queued', 'processing'].includes(t.status)).length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    total: tasks.length
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <Activity className="w-16 h-16 animate-spin mx-auto mb-4" />
          <p className="text-xl">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-white mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                Welcome, {userProfile?.personalInfo?.fullName || 'User'}!
              </h1>
              <p className="text-gray-300">Intelligent Government Services Automation</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm mb-1">
                  <User className="w-4 h-4" />
                  <span>Profile Completeness</span>
                </div>
                <div className="text-3xl font-bold">{userProfile?.profileCompleteness || 0}%</div>
              </div>
              <button
                onClick={() => setShowProfileModal(true)}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <User className="w-5 h-5" />
                Profile
              </button>
            </div>
          </div>
        </motion.div>

        {/* Profile Completeness Warning */}
        {userProfile && userProfile.profileCompleteness < 80 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-lg"
          >
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-yellow-800 mb-1">
                  Complete Your Profile
                </h3>
                <p className="text-sm text-yellow-700">
                  Your profile is {userProfile.profileCompleteness}% complete. Complete your profile
                  to unlock all automation features. Missing information may be requested during task creation.
                </p>
                <button className="mt-2 text-sm font-medium text-yellow-800 hover:text-yellow-900 underline">
                  Update Profile →
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<Activity />}
            label="Total Tasks"
            value={stats.total}
            color="blue"
          />
          <StatCard
            icon={<Clock />}
            label="Active Tasks"
            value={stats.active}
            color="yellow"
          />
          <StatCard
            icon={<CheckCircle />}
            label="Completed"
            value={stats.completed}
            color="green"
          />
          <StatCard
            icon={<XCircle />}
            label="Failed"
            value={stats.failed}
            color="red"
          Next />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Task Creation */}
          <div>
            <TaskSelector onTaskCreated={handleTaskCreated} />
          </div>

          {/* Active Task Status */}
          <div>
            {activeTask ? (
              <AgentStatus task={activeTask} />
            ) : (
              <EmptyState />
            )}
          </div>
        </div>

        {/* Task History */}
        <div>
          <ResultsPanel
            tasks={tasks}
            onViewTask={handleViewTask}
            onRetryTask={handleRetryTask}
          />
        </div>

        {/* Profile Management Modal */}
        <ProfileManagement
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onLogout={() => {
            setShowProfileModal(false);
            window.location.href = '/';
          }}
          onProfileUpdated={() => {
            loadInitialData();
          }}
        />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    blue: 'from-blue-500 to-blue-700',
    green: 'from-green-500 to-green-700',
    red: 'from-red-500 to-red-700',
    yellow: 'from-yellow-500 to-yellow-700'
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`bg-gradient-to-r ${colors[color]} rounded-lg p-6 text-white shadow-lg`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-80">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <div className="text-4xl opacity-80">{icon}</div>
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-xl shadow-lg p-12 text-center h-full flex items-center justify-center">
      <div className="text-gray-400">
        <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-xl font-semibold">No Active Task</p>
        <p className="text-sm mt-2">Create a new task to get started</p>
      </div>
    </div>
  );
}
