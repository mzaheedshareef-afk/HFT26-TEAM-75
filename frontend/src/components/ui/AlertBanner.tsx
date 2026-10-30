import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

interface AlertBannerProps {
  variant: 'error' | 'success' | 'info';
  title?: string;
  message: string;
  onDismiss?: () => void;
}

const styles = {
  error: {
    container: 'border-red-200 bg-red-50/80 text-red-800',
    icon: <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />,
    role: 'alert' as const,
  },
  success: {
    container: 'border-emerald-200 bg-emerald-50/80 text-emerald-900',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />,
    role: 'status' as const,
  },
  info: {
    container: 'border-blue-200 bg-blue-50/70 text-blue-900',
    icon: <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />,
    role: 'status' as const,
  },
};

export function AlertBanner({
  variant,
  title,
  message,
  onDismiss,
}: AlertBannerProps) {
  const current = styles[variant];

  return (
    <div
      role={current.role}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={`flex items-start justify-between gap-3 rounded-lg border px-3.5 py-3 text-sm ${current.container}`}
    >
      <div className="flex items-start gap-2.5">
        {current.icon}
        <div className="space-y-0.5">
          {title && <p className="font-semibold text-xs uppercase tracking-wide">{title}</p>}
          <p className="text-sm leading-snug">{message}</p>
        </div>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="rounded p-0.5 opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-current cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

