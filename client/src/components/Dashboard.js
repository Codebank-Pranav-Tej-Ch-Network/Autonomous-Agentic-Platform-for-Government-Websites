/**
 * Dashboard - WITH CONVERSATION PERSISTENCE & NO FULL REFRESH
 * 
 * FIXES:
 * - Conversations saved to localStorage
 * - Only task list refreshes, NOT entire page
 * - Conversation history persists across refreshes
 * - Better UI/UX for chat history
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Clock, CheckCircle, XCircle, User, AlertTriangle, MessageSquare, Trash2, X } from 'lucide-react';
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
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  // Load chat history from localStorage on mount
  useEffect(() => {
    const savedChats = localStorage.getItem('chatHistory');
    if (savedChats) {
      try {
        setChatHistory(JSON.parse(savedChats));
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    }
  }, []);

  // Save new conversations to chat history
  const saveConversationToHistory = useCallback((conversation, taskType) => {
    const chatEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      taskType: taskType || 'unknown',
      messages: conversation,
      preview: conversation[0]?.content.substring(0, 100) || 'No preview'
    };

    setChatHistory(prev => {
      const updated = [chatEntry, ...prev].slice(0, 20); // Keep last 20 conversations
      localStorage.setItem('chatHistory', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearChatHistory = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all chat history?')) {
      setChatHistory([]);
      localStorage.removeItem('chatHistory');
      toast.success('Chat history cleared');
    }
  }, []);

  // Load tasks ONLY (not full reload)
  const loadTasks = useCallback(async () => {
    try {
      const tasksResponse = await taskAPI.getAll({ page: 1, limit: 50 });
      const fetchedTasks = tasksResponse.data.data;
      
      setTasks(fetchedTasks);

      if (activeTask) {
        const updatedActiveTask = fetchedTasks.find(t => t._id === activeTask._id);
        if (updatedActiveTask) {
          setActiveTask(updatedActiveTask);
        }
      }

      console.log('[Dashboard] Tasks reloaded:', fetchedTasks.length);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }, [activeTask]);

  const loadProfile = useCallback(async () => {
    try {
      const profileResponse = await authAPI.getProfile();
      setUserProfile(profileResponse.data.data.user);
      console.log('[Dashboard] Profile loaded');
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([loadProfile(), loadTasks()]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [loadProfile, loadTasks]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // WebSocket setup
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      websocket.connect(token);
    }

    const handleTaskProgress = (data) => {
      console.log('[Dashboard] Task progress:', data);
      
      setTasks(prev => prev.map(task =>
        task._id === data.taskId ? { ...task, status: data.status, progress: data.percentage } : task
      ));

      if (activeTask?._id === data.taskId) {
        setActiveTask(prev => ({ ...prev, status: data.status, progress: data.percentage }));
      }

      // Light refresh after 2 seconds
      setTimeout(() => loadTasks(), 2000);
    };

    const handleTaskCompleted = (data) => {
      console.log('[Dashboard] Task completed:', data);
      toast.success(`Task completed successfully!`);
      
      setTasks(prev => prev.map(task =>
        task._id === data.taskId ? { ...task, status: 'completed', progress: 100 } : task
      ));
      
      if (activeTask?._id === data.taskId) {
        setActiveTask(prev => ({ ...prev, status: 'completed', progress: 100 }));
      }

      setTimeout(() => loadTasks(), 2000);
    };

    const handleTaskFailed = (data) => {
      console.log('[Dashboard] Task failed:', data);
      toast.error(`Task failed: ${data.error?.message || 'Unknown error'}`);
      
      setTasks(prev => prev.map(task =>
        task._id === data.taskId ? { ...task, status: 'failed', error: data.error } : task
      ));
      
      if (activeTask?._id === data.taskId) {
        setActiveTask(prev => ({ ...prev, status: 'failed', error: data.error }));
      }

      setTimeout(() => loadTasks(), 2000);
    };

    websocket.on('task:progress', handleTaskProgress);
    websocket.on('task:completed', handleTaskCompleted);
    websocket.on('task:failed', handleTaskFailed);

    return () => {
      websocket.off('task:progress', handleTaskProgress);
      websocket.off('task:completed', handleTaskCompleted);
      websocket.off('task:failed', handleTaskFailed);
    };
  }, [activeTask, loadTasks]);

  // Polling for active tasks (LIGHT refresh - tasks only)
  useEffect(() => {
    const hasActiveTasks = tasks.some(t => 
      ['pending', 'queued', 'processing'].includes(t.status)
    );

    if (!hasActiveTasks) return;

    console.log('[Dashboard] Active tasks detected, enabling polling');

    const pollInterval = setInterval(() => {
      console.log('[Dashboard] Polling for task updates...');
      loadTasks(); // Only reload tasks, not profile
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [tasks, loadTasks]);

  const handleTaskCreated = useCallback((newTask, conversation) => {
    console.log('[Dashboard] New task created:', newTask);
    
    setTasks(prev => [newTask, ...prev]);
    setActiveTask(newTask);
    
    // Save conversation to history
    if (conversation && conversation.length > 0) {
      saveConversationToHistory(conversation, newTask.taskType);
    }
    
    toast.success('Task created and processing started!');
    setTimeout(() => loadTasks(), 2000);
  }, [loadTasks, saveConversationToHistory]);

  const handleViewTask = useCallback((task) => {
    setActiveTask(task);
  }, []);

  const handleRetryTask = useCallback(async (task) => {
    try {
      const response = await taskAPI.retry(task._id);
      toast.success('Task retry initiated!');
      
      const newTask = response.data.newTask;
      setActiveTask(newTask);
      setTasks(prev => [newTask, ...prev]);
      
      setTimeout(() => loadTasks(), 2000);
    } catch (error) {
      toast.error('Failed to retry task');
    }
  }, [loadTasks]);

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
              <button
                onClick={() => setShowChatHistory(true)}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors relative"
              >
                <MessageSquare className="w-5 h-5" />
                Chat History
                {chatHistory.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                    {chatHistory.length}
                  </span>
                )}
              </button>
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

        {/* Profile Warning */}
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
                  to unlock all automation features.
                </p>
                <button 
                  onClick={() => setShowProfileModal(true)}
                  className="mt-2 text-sm font-medium text-yellow-800 hover:text-yellow-900 underline"
                >
                  Update Profile →
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard icon={<Activity />} label="Total Tasks" value={stats.total} color="blue" />
          <StatCard icon={<Clock />} label="Active Tasks" value={stats.active} color="yellow" />
          <StatCard icon={<CheckCircle />} label="Completed" value={stats.completed} color="green" />
          <StatCard icon={<XCircle />} label="Failed" value={stats.failed} color="red" />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div>
            <TaskSelector 
              onTaskCreated={handleTaskCreated}
              onConversationUpdate={saveConversationToHistory}
            />
          </div>
          <div>
            {activeTask ? <AgentStatus task={activeTask} /> : <EmptyState />}
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

        {/* Modals */}
        <ProfileManagement
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onLogout={() => {
            setShowProfileModal(false);
            localStorage.removeItem('authToken');
            window.location.href = '/';
          }}
          onProfileUpdated={() => {
            loadProfile(); // Only reload profile, not tasks
            toast.success('Profile updated!');
          }}
        />

        {/* Chat History Modal */}
        <AnimatePresence>
          {showChatHistory && (
            <ChatHistoryModal
              chatHistory={chatHistory}
              onClose={() => setShowChatHistory(false)}
              onClear={clearChatHistory}
            />
          )}
        </AnimatePresence>
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

function ChatHistoryModal({ chatHistory, onClose, onClear }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
      >
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6" />
            <h2 className="text-2xl font-bold">Chat History</h2>
          </div>
          <div className="flex items-center gap-2">
            {chatHistory.length > 0 && (
              <button
                onClick={onClear}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(80vh-100px)] p-6">
          {chatHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">No chat history yet</p>
              <p className="text-sm mt-2">Your conversations will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {chatHistory.map((chat) => (
                <div key={chat.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-purple-600 uppercase">
                          {chat.taskType.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(chat.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">{chat.preview}</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {chat.messages.length} messages
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
