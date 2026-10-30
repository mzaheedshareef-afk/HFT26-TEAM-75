import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Accessible interest-triggered information tooltip.
 * Uses native `interestfor` + `popover="hint"` where supported (Chrome/Edge 142+)
 * without redundant `role="tooltip"` or `aria-describedby` attributes, and
 * degrades gracefully with a WCAG 1.4.13 compliant (dismissible, hoverable,
 * persistent) fallback when `interestForElement` is absent on HTMLButtonElement.prototype.
 */
export function InfoTooltip({
  label,
  children,
  className = '',
}: InfoTooltipProps) {
  const reactId = useId();
  const tooltipId = useMemo(
    () => `hint-tip-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [reactId]
  );

  const supportsNativeInterest = useMemo(() => {
    if (typeof window === 'undefined' || typeof HTMLButtonElement === 'undefined') {
      return false;
    }
    return Object.prototype.hasOwnProperty.call(
      HTMLButtonElement.prototype,
      'interestForElement'
    );
  }, []);

  const [isFallbackOpen, setIsFallbackOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (supportsNativeInterest || !isFallbackOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsFallbackOpen(false);
      }
    };

    const handlePointerDownOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        event.target instanceof Node &&
        !wrapperRef.current.contains(event.target)
      ) {
        setIsFallbackOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDownOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDownOutside);
    };
  }, [isFallbackOpen, supportsNativeInterest]);

  const interestTriggerAttr = {
    interestfor: tooltipId,
  } as Record<string, unknown>;

  const hintPopoverAttr = {
    popover: 'hint',
  } as Record<string, unknown>;

  return (
    <span
      ref={wrapperRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={
        supportsNativeInterest ? undefined : () => setIsFallbackOpen(true)
      }
      onMouseLeave={
        supportsNativeInterest ? undefined : () => setIsFallbackOpen(false)
      }
      onFocus={
        supportsNativeInterest ? undefined : () => setIsFallbackOpen(true)
      }
      onBlur={
        supportsNativeInterest
          ? undefined
          : (event) => {
              if (
                wrapperRef.current &&
                event.relatedTarget instanceof Node &&
                wrapperRef.current.contains(event.relatedTarget)
              ) {
                return;
              }
              setIsFallbackOpen(false);
            }
      }
    >
      <button
        type="button"
        aria-label={label}
        {...interestTriggerAttr}
        onClick={
          supportsNativeInterest
            ? undefined
            : () => setIsFallbackOpen(true)
        }
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 transition-colors cursor-pointer ${
          !supportsNativeInterest && isFallbackOpen ? 'interest-source text-blue-600' : ''
        }`}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {/* Native popover="hint" gains an implicit minimum role of tooltip; do NOT set role="tooltip" explicitly */}
      <div
        id={tooltipId}
        {...hintPopoverAttr}
        className={`info-tooltip-popover ${
          !supportsNativeInterest
            ? `info-tooltip-fallback ${
                isFallbackOpen ? 'interest-target :popover-open' : ''
              }`
            : ''
        }`}
      >
        {children}
      </div>
    </span>
  );
}

