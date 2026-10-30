import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id: string;
  name: string;
  label: string;
  hint?: string;
  error?: string;
}

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  PasswordInputProps
>(function PasswordInput(
  { id, name, label, hint, error, disabled, className = '', ...props },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);

  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const hasError = Boolean(error);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>

      {/* Rules/hints placed above the input so mobile keyboards do not obscure them */}
      {hint && (
        <p id={hintId} className="text-xs text-slate-500 leading-relaxed">
          {hint}
        </p>
      )}

      <div className="relative">
        <span
          className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 ${
            hasError ? 'text-red-500' : 'text-slate-400'
          }`}
          aria-hidden="true"
        >
          <Lock className="h-4 w-4" />
        </span>

        <input
          ref={ref}
          id={id}
          name={name}
          type={showPassword ? 'text' : 'password'}
          disabled={disabled}
          aria-invalid={hasError ? 'true' : undefined}
          aria-describedby={describedBy}
          className={`block w-full rounded-lg border pl-10 pr-11 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 ${
            hasError
              ? 'border-red-600 bg-red-50/40 focus:border-red-600 focus:ring-red-600/15'
              : 'border-slate-300 bg-white hover:border-slate-400 focus:border-blue-600 focus:ring-blue-600/15'
          } disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ${className}`}
          {...props}
        />

        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={showPassword}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 focus:outline-none focus-visible:text-blue-600 disabled:opacity-50 cursor-pointer"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium text-red-600 pt-0.5"
        >
          <AlertCircle
            className="h-3.5 w-3.5 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
});
