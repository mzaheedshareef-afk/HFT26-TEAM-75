import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Mail } from 'lucide-react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { FormInput } from '../../components/ui/FormInput';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Button } from '../../components/ui/Button';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { authService } from '../../services/authService';
import { extractApiErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  validateCompanyName,
  validateConfirmPassword,
  validateEmail,
  validateSignupPassword,
} from '../../utils/validation';
import type { CompanySignupFormValues } from '../../types/auth';

type FieldKey = keyof CompanySignupFormValues;

export function CompanySignupPage() {
  const navigate = useNavigate();
  const { establishSession } = useAuth();

  const [values, setValues] = useState<CompanySignupFormValues>({
    companyName: '',
    officialEmail: '',
    password: '',
    confirmPassword: '',
  });
  const [dirty, setDirty] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const companyNameRef = useRef<HTMLInputElement>(null);
  const officialEmailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const rawErrors: Partial<Record<FieldKey, string>> = {
    companyName: validateCompanyName(values.companyName),
    officialEmail: validateEmail(values.officialEmail, 'Official email'),
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
    if (rawErrors.companyName) {
      companyNameRef.current?.focus();
    } else if (rawErrors.officialEmail) {
      officialEmailRef.current?.focus();
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
      const result = await authService.registerCompany({
        companyName: values.companyName,
        officialEmail: values.officialEmail,
        password: values.password,
      });

      if (result.session) {
        establishSession(result.session);
        navigate('/company/dashboard', { replace: true });
      } else {
        navigate('/company/login', {
          replace: true,
          state: {
            registeredMessage:
              result.message ||
              'Company account created successfully. Please sign in.',
            registeredEmail: values.officialEmail.trim().toLowerCase(),
          },
        });
      }
    } catch (error) {
      setServerError(
        extractApiErrorMessage(
          error,
          'Unable to register your company account. Please try again.'
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      role="company"
      mode="signup"
      title="Register your company"
      subtitle="Set up your hiring workspace to run portfolio-driven technical assessments."
      footerPrompt="Already registered your organization?"
      footerLinkText="Sign in to Company Portal"
      footerLinkTo="/company/login"
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
          ref={companyNameRef}
          id="company-name"
          name="companyName"
          type="text"
          label="Company name"
          placeholder="e.g., Acme Engineering Labs"
          autoComplete="organization"
          enterKeyHint="next"
          required
          disabled={isLoading}
          value={values.companyName}
          onChange={handleChange('companyName')}
          onBlur={handleBlur('companyName')}
          error={visibleError('companyName')}
          icon={<Building2 className="h-4 w-4" />}
        />

        <FormInput
          ref={officialEmailRef}
          id="company-official-email"
          name="officialEmail"
          type="email"
          label="Official email"
          hint="Use your work or organization email address (e.g., talent@company.com)."
          placeholder="talent@company.com"
          autoComplete="username"
          spellCheck={false}
          enterKeyHint="next"
          required
          disabled={isLoading}
          value={values.officialEmail}
          onChange={handleChange('officialEmail')}
          onBlur={handleBlur('officialEmail')}
          error={visibleError('officialEmail')}
          icon={<Mail className="h-4 w-4" />}
        />

        <PasswordInput
          ref={passwordRef}
          id="company-password"
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
          id="company-confirm-password"
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
            loadingText="Creating company account..."
          >
            Create Company Account
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
