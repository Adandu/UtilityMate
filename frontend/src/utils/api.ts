import axios from 'axios';
import { clearAuthToken, getAuthToken } from './authToken';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? '';
    const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/register');
    
    if (error.response?.status === 401 && !isAuthRoute) {
      clearAuthToken();
      window.location.href = '/login';
    } else if (!error.response) {
      console.error('Network Error: Please check your internet connection.');
    } else if (error.response.status >= 500) {
      console.error('Server Error:', error.response.data?.detail || 'An unexpected error occurred.');
    }
    
    return Promise.reject(error);
  }
);

export default api;
