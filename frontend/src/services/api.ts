import axios, { AxiosError } from 'axios';
import type { ApiError } from '../types';

// Use the Vite proxy for development (empty base = same origin)
// Falls back to direct backend URL in production via VITE_API_URL env var
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Axios instance with httpOnly cookie support (no localStorage!)
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send/receive httpOnly cookies automatically
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor — handle 401 with silent cookie-based refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(null);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as AxiosError['config'] & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest?._retry) {
      // /me is the session-check endpoint — 401 just means "not logged in", don't refresh
      if (originalRequest?.url?.includes('/api/v1/auth/me')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest!))
          .catch((err) => Promise.reject(err));
      }

      if (originalRequest) {
        originalRequest._retry = true;
      }
      isRefreshing = true;

      try {
        // Refresh via httpOnly cookie — no token management in JS
        await axios.post(
          `${API_BASE_URL}/api/v1/auth/refresh`,
          {},
          { withCredentials: true },
        );
        processQueue(null);
        return api(originalRequest!);
      } catch {
        processQueue(new Error('Refresh failed'));
        // Session expired — fire event so AuthContext can redirect
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// Typed API functions
export const apiService = {
  get: <T>(url: string, params?: Record<string, unknown>) =>
    api.get<T>(url, { params }).then((res) => res.data),

  post: <T>(url: string, data?: unknown) =>
    api.post<T>(url, data).then((res) => res.data),

  put: <T>(url: string, data?: unknown) =>
    api.put<T>(url, data).then((res) => res.data),

  delete: <T>(url: string) =>
    api.delete<T>(url).then((res) => res.data),
};

export default api;
