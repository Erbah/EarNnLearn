import axios from 'axios';

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

let inMemoryToken: string | null = null;

export const setClientToken = (token: string | null) => {
  inMemoryToken = token;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token'); // Clean up legacy localstorage
  }
};

export const getClientToken = () => inMemoryToken;

// Request Interceptor: Attach Token automatically
api.interceptors.request.use(
  (config) => {
    const token = getClientToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
        setClientToken(null);
        document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        // Avoid redirect loop if already on login
        if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/admin-login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
