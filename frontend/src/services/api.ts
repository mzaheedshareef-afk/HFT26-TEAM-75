import axios, { AxiosError } from 'axios';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:8000';

export const AUTH_TOKEN_STORAGE_KEY = 'gatecode_access_token';
export const AUTH_USER_STORAGE_KEY = 'gatecode_auth_user';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface BackendValidationItem {
  loc?: Array<string | number>;
  msg?: string;
}

interface BackendErrorPayload {
  detail?: string | BackendValidationItem[];
  message?: string;
  error?: string;
}

/**
 * Normalizes Axios, FastAPI/Pydantic, custom JSON, and network errors
 * into clear, actionable messages for end users.
 */
export function extractApiErrorMessage(
  error: unknown,
  fallbackMessage = 'Something went wrong while processing your request. Please try again.'
): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<BackendErrorPayload>;

    // Backend unreachable, connection refused, CORS network block, or timeout
    if (!axiosError.response) {
      if (axiosError.code === 'ECONNABORTED') {
        return 'The server took too long to respond. Please check your connection and try again.';
      }
      return `Unable to reach the server (${API_BASE_URL}). Please ensure the backend service is running and try again.`;
    }

    const { status, data } = axiosError.response;

    if (data) {
      if (typeof data.detail === 'string' && data.detail.trim()) {
        return data.detail.trim();
      }

      if (Array.isArray(data.detail) && data.detail.length > 0) {
        const firstIssue = data.detail[0];
        const field =
          firstIssue.loc && firstIssue.loc.length > 0
            ? String(firstIssue.loc[firstIssue.loc.length - 1]).replace(/_/g, ' ')
            : '';
        if (firstIssue.msg) {
          return field ? `${field}: ${firstIssue.msg}` : firstIssue.msg;
        }
      }

      if (typeof data.message === 'string' && data.message.trim()) {
        return data.message.trim();
      }

      if (typeof data.error === 'string' && data.error.trim()) {
        return data.error.trim();
      }
    }

    if (status === 401) {
      return 'Incorrect email or password. Please verify your credentials and try again.';
    }
    if (status === 403) {
      return 'Access denied for this portal. Please make sure you are signing into the correct account type.';
    }
    if (status === 409) {
      return 'An account with this email address already exists. Please sign in instead.';
    }
    if (status >= 500) {
      return 'A server error occurred while processing your request. Please try again shortly.';
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallbackMessage;
}
