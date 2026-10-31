import axios, { AxiosError } from 'axios';

const rawBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000';

// Normalize base URL: strip trailing slashes and any trailing /api to prevent double /api/api
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '').replace(/\/api$/, '');

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
  // Guard against accidental double /api/api
  if (config.url?.startsWith('/api/api/')) {
    config.url = config.url.replace(/^\/api\/api\//, '/api/');
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        // Backend unreachable / connection refused / network error
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('gatecode:backend_offline', {
              detail: {
                message: `Backend service is unreachable at ${API_BASE_URL}. Please ensure the backend server is running on http://127.0.0.1:8000.`,
                url: error.config?.url,
                code: error.code || 'ERR_CONNECTION_REFUSED',
              },
            })
          );
        }
      } else if (error.response.status === 401) {
        const url = error.config?.url || '';
        // Only clear session on protected endpoints, not when attempting initial login
        if (!url.includes('/login')) {
          localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
          localStorage.removeItem(AUTH_USER_STORAGE_KEY);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('gatecode:unauthorized'));
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

interface BackendValidationItem {
  loc?: Array<string | number>;
  msg?: string;
}

interface BackendErrorObject {
  code?: string;
  message?: string;
}

interface BackendErrorPayload {
  success?: boolean;
  detail?: string | BackendValidationItem[];
  message?: string;
  error?: string | BackendErrorObject;
}

export interface HealthCheckResponse {
  status: string;
  service?: string;
  version?: string;
  environment?: string;
}

/**
 * Performs a connectivity probe to verify that the FastAPI backend is running
 * and responding on /api/health.
 */
export async function checkBackendHealth(): Promise<HealthCheckResponse> {
  const response = await api.get<HealthCheckResponse>('/api/health');
  return response.data;
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

    // Case 1: Backend unreachable, connection refused, CORS network block, or timeout
    if (!axiosError.response) {
      if (axiosError.code === 'ECONNABORTED') {
        return 'The server took too long to respond. Please check your connection and try again.';
      }
      return `Unable to reach the server (${API_BASE_URL}). Connection refused. Please ensure the backend service is running and try again.`;
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

      if (
        typeof data.error === 'object' &&
        data.error !== null &&
        typeof data.error.message === 'string' &&
        data.error.message.trim()
      ) {
        return data.error.message.trim();
      }
    }

    // Case 2: HTTP 401 Unauthorized
    if (status === 401) {
      return 'Incorrect email or password, or your session has expired. Please verify your credentials and sign in again.';
    }

    // Case 3: HTTP 403 Forbidden
    if (status === 403) {
      return 'Access denied for this portal. Please make sure you are signing into the correct account type.';
    }

    // Case 4: HTTP 404 Not Found
    if (status === 404) {
      return (
        (typeof data?.error === 'object' && data?.error?.message) ||
        data?.message ||
        'The requested backend resource was not found. Please verify the URL.'
      );
    }

    // Case 5: HTTP 409 Conflict
    if (status === 409) {
      return 'An account with this email address already exists. Please sign in instead.';
    }

    // Case 6: HTTP 422 Validation Error
    if (status === 422) {
      return 'The submitted data is invalid. Please review the highlighted fields.';
    }

    // Case 7: HTTP 500+ Internal Server Error
    if (status >= 500) {
      return 'A backend server error occurred while processing your request. Please try again shortly.';
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallbackMessage;
}
