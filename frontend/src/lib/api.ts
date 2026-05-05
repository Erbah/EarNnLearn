import axios from 'axios';

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

// Request Interceptor: Attach Token automatically
api.interceptors.request.use(
  (config) => {
    // We only access localStorage on the client side
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle 401s globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Detailed logging for diagnosing "Network Error"
    if (error.message === 'Network Error') {
      const detail = {
        message: error.message,
        code: error.code,
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL,
        headers: error.config?.headers,
      };
      console.error('API Network Error detected. Backend might be unreachable at:', error.config?.baseURL || API_BASE_URL);
      console.error('Error Details:', detail);
    }

    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        // Avoid redirect loop if already on login
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
