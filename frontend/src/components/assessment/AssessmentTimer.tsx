import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

export interface AssessmentTimerProps {
  initialSeconds: number;
  isRunning?: boolean;
  warningThresholdSeconds?: number;
  onExpire?: () => void;
  onTick?: (remainingSeconds: number) => void;
}

export function formatDuration(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function AssessmentTimer({
  initialSeconds,
  isRunning = true,
  warningThresholdSeconds = 300,
  onExpire,
  onTick,
}: AssessmentTimerProps) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor(initialSeconds))
  );
  const expiredFiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  const onTickRef = useRef(onTick);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    setRemaining(Math.max(0, Math.floor(initialSeconds)));
    expiredFiredRef.current = false;
  }, [initialSeconds]);

  useEffect(() => {
    onTickRef.current?.(remaining);
    if (remaining <= 0 && !expiredFiredRef.current) {
      expiredFiredRef.current = true;
      onExpireRef.current?.();
    }
  }, [remaining]);

  useEffect(() => {
    if (!isRunning || remaining <= 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isRunning, remaining]);

  const isExpired = remaining === 0;
  const isWarning = !isExpired && remaining <= warningThresholdSeconds;

  const badgeStyle = isExpired
    ? 'border-red-300 bg-red-50 text-red-800'
    : isWarning
    ? 'border-amber-300 bg-amber-50 text-amber-900'
    : 'border-slate-200 bg-slate-50 text-slate-800';

  return (
    <div
      role="timer"
      aria-label="Assessment time remaining"
      aria-live={isExpired ? 'assertive' : 'off'}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold tabular-nums ${badgeStyle}`}
    >
      {isWarning || isExpired ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Clock className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
      )}
      <span>{isExpired ? 'Time Expired (00:00)' : formatDuration(remaining)}</span>
    </div>
  );
}
