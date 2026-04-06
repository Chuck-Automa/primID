import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

// Auto-attach Bearer token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('primid_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — clear token and redirect to onboarding
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('primid_token');
      localStorage.removeItem('primid_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
