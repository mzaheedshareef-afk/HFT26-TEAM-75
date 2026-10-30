import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, User } from 'lucide-react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { FormInput } from '../../components/ui/FormInput';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Button } from '../../components/ui/Button';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { authService } from '../../services/authService';
import { extractApiErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validateSignupPassword,
} from '../../utils/validation';
import type { StudentSignupFormValues } from '../../types/auth';

type FieldKey = keyof StudentSignupFormValues;

export function StudentSignupPage() {
  const navigate = useNavigate();
  const { establishSession } = useAuth();

  const [values, setValues] = useState<StudentSignupFormValues>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [dirty, setDirty] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const fullNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const rawErrors: Partial<Record<FieldKey, string>> = {
    fullName: validateFullName(values.fullName),
    email: validateEmail(values.email, 'Email address'),
    password: validateSignupPassword(values.password),
    confirmPassword: validateConfirmPassword(
      values.password,
      values.confirmPassword
    ),
  };

  const shouldShowError = (field: FieldKey) =>
    submitAttempted || Boolean(dirty[field] && touched[field]);

  const visibleError = (field: FieldKey) =>
    shouldShowError(field) ? rawErrors[field] : undefined;

  const handleChange =
    (field: FieldKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = e.target.value;
      setValues((prev) => ({ ...prev, [field]: nextValue }));
      setDirty((prev) => ({ ...prev, [field]: true }));
      if (serverError) {
        setServerError(null);
      }
    };

  const handleBlur = (field: FieldKey) => () => {
    if (dirty[field]) {
      setTouched((prev) => ({ ...prev, [field]: true }));
    }
  };

  const focusFirstInvalid = () => {
    if (rawErrors.fullName) {
      fullNameRef.current?.focus();
    } else if (rawErrors.email) {
      emailRef.current?.focus();
    } else if (rawErrors.password) {
      passwordRef.current?.focus();
    } else if (rawErrors.confirmPassword) {
      confirmPasswordRef.current?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setServerError(null);

    const hasValidationErrors = Object.values(rawErrors).some(Boolean);
    if (hasValidationErrors) {
      focusFirstInvalid();
      return;
    }

    setIsLoading(true);
    try {
      const result = await authService.registerStudent({
        name: values.fullName,
        email: values.email,
        password: values.password,
      });

      if (result.session) {
        establishSession(result.session);
        navigate('/student/dashboard', { replace: true });
      } else {
        navigate('/student/login', {
          replace: true,
          state: {
            registeredMessage:
              result.message ||
              'Candidate account created successfully. Please sign in.',
            registeredEmail: values.email.trim().toLowerCase(),
          },
        });
      }
    } catch (error) {
      setServerError(
        extractApiErrorMessage(
          error,
          'Unable to create your candidate account. Please try again.'
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      role="student"
      mode="signup"
      title="Create your candidate account"
      subtitle="Join GateCode to take adaptive technical assessments calibrated to your engineering portfolio."
      footerPrompt="Already have a candidate account?"
      footerLinkText="Sign in"
      footerLinkTo="/student/login"
    >
      {serverError && (
        <AlertBanner
          variant="error"
          message={serverError}
          onDismiss={() => setServerError(null)}
        />
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormInput
          ref={fullNameRef}
          id="student-full-name"
          name="fullName"
          type="text"
          label="Full name"
          placeholder="e.g., Arjun Mehta"
          autoComplete="name"
          enterKeyHint="next"
          required
          disabled={isLoading}
          value={values.fullName}
          onChange={handleChange('fullName')}
          onBlur={handleBlur('fullName')}
          error={visibleError('fullName')}
          icon={<User className="h-4 w-4" />}
        />

        <FormInput
          ref={emailRef}
          id="student-email"
          name="email"
          type="email"
          label="Email address"
          placeholder="you@university.edu"
          autoComplete="username"
          spellCheck={false}
          enterKeyHint="next"
          required
          disabled={isLoading}
          value={values.email}
          onChange={handleChange('email')}
          onBlur={handleBlur('email')}
          error={visibleError('email')}
          icon={<Mail className="h-4 w-4" />}
        />

        <PasswordInput
          ref={passwordRef}
          id="student-password"
          name="password"
          label="Password"
          hint="Minimum 8 characters."
          placeholder="Create a strong password"
          autoComplete="new-password"
          enterKeyHint="next"
          required
          disabled={isLoading}
          value={values.password}
          onChange={handleChange('password')}
          onBlur={handleBlur('password')}
          error={visibleError('password')}
        />

        <PasswordInput
          ref={confirmPasswordRef}
          id="student-confirm-password"
          name="confirmPassword"
          label="Confirm password"
          placeholder="Re-enter your password"
          autoComplete="new-password"
          enterKeyHint="done"
          required
          disabled={isLoading}
          value={values.confirmPassword}
          onChange={handleChange('confirmPassword')}
          onBlur={handleBlur('confirmPassword')}
          error={visibleError('confirmPassword')}
        />

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            loadingText="Creating candidate account..."
          >
            Create Candidate Account
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
