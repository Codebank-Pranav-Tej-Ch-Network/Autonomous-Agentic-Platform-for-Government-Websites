/**
 * API Service Layer - FIXED VERSION
 * 
 * FIXES:
 * - Increased timeout to 60 seconds for LLM operations
 * - File upload support
 * - Better error handling
 * - Request/response interceptors for debugging
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // CRITICAL FIX: 60 seconds timeout (was 30s)
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - add auth token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log request for debugging
    console.log(`[API] ${config.method.toUpperCase()} ${config.url}`, {
      params: config.params,
      data: config.data
    });
    
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - handle common errors
api.interceptors.response.use(
  (response) => {
    console.log(`[API] Response from ${response.config.url}:`, response.data);
    return response;
  },
  (error) => {
    console.error('[API] Response error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message
    });

    // Handle 401 Unauthorized - redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/';
    }

    return Promise.reject(error);
  }
);

/**
 * Authentication APIs
 */
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  
  login: (data) => api.post('/auth/login', data),
  
  getProfile: () => api.get('/auth/profile'),
  
  updateProfile: (data) => {
    console.log('[authAPI] Updating profile with data:', data);
    return api.put('/auth/profile', data);
  },
  
  logout: () => api.post('/auth/logout')
};

/**
 * Task APIs
 */
export const taskAPI = {
  /**
   * Create new task from natural language
   * FIXED: Support for extended timeout and file uploads
   */
  create: (data, config = {}) => {
    return api.post('/tasks/create', data, {
      timeout: config.timeout || 60000, // 60 seconds
      ...config
    });
  },

  /**
   * Handle clarification response
   * FIXED: Extended timeout
   */
  clarify: (data, config = {}) => {
    return api.post('/tasks/clarify', data, {
      timeout: config.timeout || 60000,
      ...config
    });
  },

  /**
   * NEW: Extract data from uploaded files using Gemini Vision
   */
  extractDataFromFiles: (formData) => {
    return api.post('/tasks/extract-data', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 90000 // 90 seconds for file processing
    });
  },

  /**
   * Get all tasks for current user
   */
  getAll: (params) => api.get('/tasks', { params }),

  /**
   * Get active tasks
   */
  getActive: () => api.get('/tasks/active'),

  /**
   * Get task by ID
   */
  getById: (id) => api.get(`/tasks/${id}`),

  /**
   * Get task status (lightweight)
   */
  getStatus: (id) => api.get(`/tasks/${id}/status`),

  /**
   * Cancel task
   */
  cancel: (id) => api.post(`/tasks/${id}/cancel`),

  /**
   * Retry failed task
   */
  retry: (id) => api.post(`/tasks/${id}/retry`)
};
// Add these inside your existing exports in api.js or create new named exports

export const classify = (data) => {
  return api.post('/llm/classify', data);
};

export const executeAutomation = (data) => {
  return api.post('/automation/execute', data);
};

export default api;
