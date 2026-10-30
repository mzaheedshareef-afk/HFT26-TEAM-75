const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Supports international Unicode letters, numbers (for company names), spaces, hyphens, apostrophes, periods, and ampersands
const UNICODE_NAME_REGEX = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]{1,99}$/u;
const COMPANY_NAME_REGEX = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}\s.&,'’()-]{1,119}$/u;

export const MIN_PASSWORD_LENGTH = 8;

export function validateFullName(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Full name is required.';
  }
  if (trimmed.length < 2) {
    return 'Full name must be at least 2 characters.';
  }
  if (!UNICODE_NAME_REGEX.test(trimmed)) {
    return 'Please enter a valid full name.';
  }
  return undefined;
}

export function validateCompanyName(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Company name is required.';
  }
  if (trimmed.length < 2) {
    return 'Company name must be at least 2 characters.';
  }
  if (!COMPANY_NAME_REGEX.test(trimmed)) {
    return 'Please enter a valid company name.';
  }
  return undefined;
}

export function validateEmail(
  value: string,
  label = 'Email address'
): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return `${label} is required.`;
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return `Please enter a valid ${label.toLowerCase()} (e.g., name@domain.com).`;
  }
  return undefined;
}

export function validateLoginPassword(value: string): string | undefined {
  if (!value) {
    return 'Password is required.';
  }
  return undefined;
}

export function validateSignupPassword(value: string): string | undefined {
  if (!value) {
    return 'Password is required.';
  }
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  if (!/[A-Z]/.test(value)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(value)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/\d/.test(value)) {
    return 'Password must contain at least one number.';
  }
  return undefined;
}

export function validateConfirmPassword(
  password: string,
  confirmPassword: string
): string | undefined {
  if (!confirmPassword) {
    return 'Please confirm your password.';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match.';
  }
  return undefined;
}

