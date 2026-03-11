import axios from 'axios';

// Create Axios client pointing to the backend
const api = axios.create({
  // Use VITE_API_URL or fallback to /api for production (proxied) or localhost for dev
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api'),
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add interceptor to include auth token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('openbank_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Intercept 401 Unauthorized responses to clear user data
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('openbank_token');
      localStorage.removeItem('openbank_user');
      if (window.location.pathname !== '/login') {
         window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
