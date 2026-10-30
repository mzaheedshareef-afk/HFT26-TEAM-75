import {
  api,
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
} from './api';
import type {
  AuthSession,
  AuthSuccessResponse,
  AuthUser,
  RegisterAckResponse,
  UserRole,
} from '../types/auth';

export interface StudentRegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface CompanyRegisterPayload {
  companyName: string;
  officialEmail: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

function validateAuthSuccessPayload(
  data: AuthSuccessResponse,
  expectedRole: UserRole
): AuthSession {
  if (data.success === false) {
    throw new Error(
      data.message || 'Authentication failed. Please check your credentials.'
    );
  }

  if (!data.access_token || !data.user) {
    throw new Error(
      'Received an incomplete authentication response from the server.'
    );
  }

  if (data.user.role && data.user.role !== expectedRole) {
    const portalLabel = expectedRole === 'student' ? 'Candidate' : 'Company';
    const actualLabel = data.user.role === 'student' ? 'Candidate' : 'Company';
    throw new Error(
      `This account is registered as a ${actualLabel} account and cannot sign in through the ${portalLabel} portal.`
    );
  }

  return {
    accessToken: data.access_token,
    tokenType: data.token_type || 'bearer',
    user: {
      ...data.user,
      role: data.user.role || expectedRole,
    },
  };
}

export const authService = {
  async registerStudent(
    payload: StudentRegisterPayload
  ): Promise<{ session: AuthSession | null; message?: string }> {
    const trimmedName = payload.name.trim();
    const trimmedEmail = payload.email.trim().toLowerCase();

    const response = await api.post<RegisterAckResponse>(
      '/api/auth/student/register',
      {
        name: trimmedName,
        full_name: trimmedName,
        email: trimmedEmail,
        password: payload.password,
      }
    );

    const data = response.data;
    if (data.success === false) {
      throw new Error(data.message || 'Unable to register student account.');
    }

    if (data.access_token && data.user) {
      const session = validateAuthSuccessPayload(
        data as AuthSuccessResponse,
        'student'
      );
      return { session, message: data.message };
    }

    return {
      session: null,
      message:
        data.message || 'Candidate account created successfully. Please sign in.',
    };
  },

  async loginStudent(payload: LoginPayload): Promise<AuthSession> {
    const trimmedEmail = payload.email.trim().toLowerCase();

    const response = await api.post<AuthSuccessResponse>(
      '/api/auth/student/login',
      {
        email: trimmedEmail,
        password: payload.password,
      }
    );

    return validateAuthSuccessPayload(response.data, 'student');
  },

  async registerCompany(
    payload: CompanyRegisterPayload
  ): Promise<{ session: AuthSession | null; message?: string }> {
    const trimmedCompany = payload.companyName.trim();
    const trimmedEmail = payload.officialEmail.trim().toLowerCase();

    const response = await api.post<RegisterAckResponse>(
      '/api/auth/company/register',
      {
        name: trimmedCompany,
        company_name: trimmedCompany,
        email: trimmedEmail,
        official_email: trimmedEmail,
        password: payload.password,
      }
    );

    const data = response.data;
    if (data.success === false) {
      throw new Error(data.message || 'Unable to register company account.');
    }

    if (data.access_token && data.user) {
      const session = validateAuthSuccessPayload(
        data as AuthSuccessResponse,
        'company'
      );
      return { session, message: data.message };
    }

    return {
      session: null,
      message:
        data.message || 'Company account created successfully. Please sign in.',
    };
  },

  async loginCompany(payload: LoginPayload): Promise<AuthSession> {
    const trimmedEmail = payload.email.trim().toLowerCase();

    const response = await api.post<AuthSuccessResponse>(
      '/api/auth/company/login',
      {
        email: trimmedEmail,
        official_email: trimmedEmail,
        password: payload.password,
      }
    );

    return validateAuthSuccessPayload(response.data, 'company');
  },

  saveSession(session: AuthSession): void {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, session.accessToken);
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(session.user));
  },

  getStoredSession(): AuthSession | null {
    try {
      const accessToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      const rawUser = localStorage.getItem(AUTH_USER_STORAGE_KEY);
      if (!accessToken || !rawUser) {
        return null;
      }
      const user = JSON.parse(rawUser) as AuthUser;
      if (!user?.id || !user?.email || !user?.role) {
        return null;
      }
      return {
        accessToken,
        tokenType: 'bearer',
        user,
      };
    } catch {
      return null;
    }
  },

  clearSession(): void {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  },
};

