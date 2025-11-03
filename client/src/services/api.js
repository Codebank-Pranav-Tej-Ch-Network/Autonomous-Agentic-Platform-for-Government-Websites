import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data)
};

export const taskAPI = {
  create: (data) => api.post('/tasks/create', data),
  clarify: (data) => api.post('/tasks/clarify', data),
  getAll: (params) => api.get('/tasks', { params }),
  getById: (id) => api.get(`/tasks/${id}`),
  getStatus: (id) => api.get(`/tasks/${id}/status`),
  cancel: (id) => api.post(`/tasks/${id}/cancel`),
  retry: (id) => api.post(`/tasks/${id}/retry`),
  getActive: () => api.get('/tasks/active')
};

export const resultAPI = {
  getByTaskId: (taskId) => api.get(`/results/task/${taskId}`),
  downloadFile: (taskId, fileId) => api.get(`/results/download/${taskId}/${fileId}`, {
    responseType: 'blob'
  })
};

export default api;
