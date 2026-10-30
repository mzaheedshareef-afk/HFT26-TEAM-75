import React, { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { FormInput } from '../../components/ui/FormInput';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Button } from '../../components/ui/Button';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { authService } from '../../services/authService';
import { extractApiErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { validateEmail, validateLoginPassword } from '../../utils/validation';
import type { LoginFormValues } from '../../types/auth';

type FieldKey = keyof LoginFormValues;

interface LocationState {
  registeredMessage?: string;
  registeredEmail?: string;
}

export function StudentLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { establishSession } = useAuth();

  const routeState = (location.state as LocationState | null) ?? null;

  const [values, setValues] = useState<LoginFormValues>({
    email: routeState?.registeredEmail || '',
    password: '',
  });
  const [dirty, setDirty] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(
    routeState?.registeredMessage || null
  );

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const rawErrors: Partial<Record<FieldKey, string>> = {
    email: validateEmail(values.email, 'Email address'),
    password: validateLoginPassword(values.password),
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setServerError(null);

    if (rawErrors.email || rawErrors.password) {
      if (rawErrors.email) {
        emailRef.current?.focus();
      } else {
        passwordRef.current?.focus();
      }
      return;
    }

    setIsLoading(true);
    try {
      const session = await authService.loginStudent({
        email: values.email,
        password: values.password,
      });
      establishSession(session);
      navigate('/student/dashboard', { replace: true });
    } catch (error) {
      setServerError(
        extractApiErrorMessage(
          error,
          'Unable to sign in. Please verify your credentials and try again.'
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      role="student"
      mode="login"
      title="Sign in to Candidate Portal"
      subtitle="Access your portfolio workspace and adaptive technical assessments."
      footerPrompt="New to GateCode?"
      footerLinkText="Create a candidate account"
      footerLinkTo="/student/signup"
    >
      {infoMessage && !serverError && (
        <AlertBanner
          variant="success"
          message={infoMessage}
          onDismiss={() => setInfoMessage(null)}
        />
      )}

      {serverError && (
        <AlertBanner
          variant="error"
          message={serverError}
          onDismiss={() => setServerError(null)}
        />
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormInput
          ref={emailRef}
          id="student-login-email"
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
          id="student-login-password"
          name="password"
          label="Password"
          placeholder="Enter your password"
          autoComplete="current-password"
          enterKeyHint="done"
          required
          disabled={isLoading}
          value={values.password}
          onChange={handleChange('password')}
          onBlur={handleBlur('password')}
          error={visibleError('password')}
        />

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            loadingText="Signing in..."
          >
            Sign In as Candidate
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}

