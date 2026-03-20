// src/config/axiosConfig.ts
// ─────────────────────────────────────────────────────────────
// Single source of truth for the API base URL.
// Set REACT_APP_API_URL in your .env file:
//   Local:      REACT_APP_API_URL=http://192.168.43.131:8000
//   Production: REACT_APP_API_URL=https://riskguardian.onrender.com
// ─────────────────────────────────────────────────────────────
import axios from 'axios';

export const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'https://riskguardian.onrender.com';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;