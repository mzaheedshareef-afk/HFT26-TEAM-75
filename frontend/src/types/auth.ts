export type UserRole = 'student' | 'company';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthSuccessResponse {
  success: boolean;
  access_token: string;
  token_type: string;
  user: AuthUser;
  message?: string;
}

export interface RegisterAckResponse {
  success: boolean;
  access_token?: string;
  token_type?: string;
  user?: AuthUser;
  message?: string;
}

export interface StudentSignupFormValues {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface CompanySignupFormValues {
  companyName: string;
  officialEmail: string;
  password: string;
  confirmPassword: string;
}

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface AuthSession {
  accessToken: string;
  tokenType: string;
  user: AuthUser;
}

