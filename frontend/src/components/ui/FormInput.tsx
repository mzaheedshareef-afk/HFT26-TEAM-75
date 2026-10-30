import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface FormInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  name: string;
  label: string;
  hint?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  function FormInput(
    { id, name, label, hint, error, icon, className = '', ...props },
    ref
  ) {
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy =
      [hintId, errorId].filter(Boolean).join(' ') || undefined;
    const hasError = Boolean(error);

    return (
      <div className="space-y-1.5">
        <label
          htmlFor={id}
          className="block text-sm font-medium text-slate-800"
        >
          {label}
        </label>

        {/* Format hints placed above the input so autofill popovers and mobile keyboards never cover them */}
        {hint && (
          <p id={hintId} className="text-xs text-slate-500 leading-relaxed">
            {hint}
          </p>
        )}

        <div className="relative">
          {icon && (
            <span
              className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 ${
                hasError ? 'text-red-500' : 'text-slate-400'
              }`}
              aria-hidden="true"
            >
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            name={name}
            aria-invalid={hasError ? 'true' : undefined}
            aria-describedby={describedBy}
            className={`block w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 ${
              icon ? 'pl-10' : ''
            } ${
              hasError
                ? 'border-red-600 bg-red-50/40 focus:border-red-600 focus:ring-red-600/15'
                : 'border-slate-300 bg-white hover:border-slate-400 focus:border-blue-600 focus:ring-blue-600/15'
            } disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ${className}`}
            {...props}
          />
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
  }
);

