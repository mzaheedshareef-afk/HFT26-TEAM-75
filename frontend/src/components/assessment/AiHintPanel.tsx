import { useState } from 'react';
import {
  AlertCircle,
  Lightbulb,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';
import {
  assistantService,
  HINT_TIER_DEFINITIONS,
  MAX_HINTS_PER_QUESTION,
} from '../../services/assistantService';
import { extractApiErrorMessage } from '../../services/api';
import type {
  AiHintItem,
  AiHintLevel,
  SupportedLanguage,
} from '../../types/assessment';

interface AiHintPanelProps {
  assessmentId?: string;
  questionId: string | null;
  questionTitle?: string;
  language: SupportedLanguage;
  currentCode: string;
  hintsForQuestion: AiHintItem[];
  totalSessionHintsUsed: number;
  disabled?: boolean;
  onHintReceived: (hint: AiHintItem) => void;
}

export function AiHintPanel({
  assessmentId,
  questionId,
  questionTitle,
  language,
  currentCode,
  hintsForQuestion,
  totalSessionHintsUsed,
  disabled = false,
  onHintReceived,
}: AiHintPanelProps) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);

  const usedCount = hintsForQuestion.length;
  const hasRemainingHints = usedCount < MAX_HINTS_PER_QUESTION;
  const nextLevel = Math.min(
    MAX_HINTS_PER_QUESTION,
    usedCount + 1
  ) as AiHintLevel;
  const nextTierMeta = HINT_TIER_DEFINITIONS[nextLevel];

  const handleRequestNextHint = async () => {
    if (!questionId || !hasRemainingHints || disabled || isRequesting) return;

    setIsRequesting(true);
    setHintError(null);

    try {
      const hint = await assistantService.requestHint({
        assessmentId,
        questionId,
        questionTitle,
        hintLevel: nextLevel,
        language,
        currentCode,
        previousHints: hintsForQuestion.map((item) => item.content),
      });
      onHintReceived(hint);
    } catch (error) {
      setHintError(
        extractApiErrorMessage(
          error,
          'AI hint service is currently unavailable. No hints were consumed.'
        )
      );
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <section
      aria-labelledby="ai-hints-panel-heading"
      className="rounded-xl border border-slate-200 bg-white overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Lightbulb
            className="h-4 w-4 text-amber-600"
            aria-hidden="true"
          />
          <h3
            id="ai-hints-panel-heading"
            className="text-xs font-semibold uppercase tracking-wider text-slate-800"
          >
            Guarded AI Hints
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            aria-label="Question hint usage"
            className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-900 tabular-nums"
          >
            Hints Used: {usedCount} / {MAX_HINTS_PER_QUESTION}
          </span>
          <span
            aria-label="Total session hints used"
            className="rounded-md border border-slate-200 bg-white px-2.5 py-0.5 font-medium text-slate-600 tabular-nums"
          >
            Session Total: {totalSessionHintsUsed}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Guardrail Policy Notice */}
        <div className="flex items-start gap-2.5 rounded-lg border border-blue-200/70 bg-blue-50/40 px-3 py-2.5 text-xs text-slate-700">
          <ShieldCheck
            className="h-4 w-4 shrink-0 text-blue-600 mt-0.5"
            aria-hidden="true"
          />
          <p className="leading-relaxed">
            <strong className="font-semibold text-slate-900">
              Non-Spoiler Tutor Guardrail:
            </strong>{' '}
            Hints unlock progressively across 3 conceptual tiers and never automatically reveal full solutions.
          </p>
        </div>

        {/* Progressive Tier Stepper */}
        <div
          aria-label="Progressive hint tiers"
          className="grid gap-2 sm:grid-cols-3"
        >
          {([1, 2, 3] as AiHintLevel[]).map((tier) => {
            const isUnlocked = usedCount >= tier;
            const isNext = !isUnlocked && tier === nextLevel;
            const meta = HINT_TIER_DEFINITIONS[tier];

            return (
              <div
                key={tier}
                className={`rounded-lg border p-2.5 text-xs space-y-1 ${
                  isUnlocked
                    ? 'border-emerald-200 bg-emerald-50/60 text-emerald-950'
                    : isNext
                    ? 'border-blue-300 bg-blue-50/30 text-slate-900'
                    : 'border-slate-200 bg-slate-50/60 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span>Tier {tier}</span>
                  {isUnlocked ? (
                    <span className="text-[11px] text-emerald-700">
                      Unlocked
                    </span>
                  ) : isNext ? (
                    <span className="text-[11px] text-blue-700">Available</span>
                  ) : (
                    <Lock className="h-3 w-3 text-slate-400" aria-hidden="true" />
                  )}
                </div>
                <p className="text-[11px] leading-snug">{meta.shortLabel}</p>
              </div>
            );
          })}
        </div>

        {/* Error Banner */}
        {hintError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50/70 p-3 text-xs text-red-800"
          >
            <AlertCircle
              className="h-4 w-4 shrink-0 text-red-600 mt-0.5"
              aria-hidden="true"
            />
            <span>{hintError}</span>
          </div>
        )}

        {/* Returned Hints Feed */}
        {hintsForQuestion.length === 0 ? (
          <p className="py-2 text-center text-xs text-slate-500">
            No AI hints requested for this problem yet. Request Tier 1 guidance below if you get stuck.
          </p>
        ) : (
          <ol className="space-y-3" aria-label="Unlocked AI hints">
            {hintsForQuestion.map((hint) => (
              <li
                key={hint.hint_id}
                className="rounded-lg border border-amber-200/80 bg-amber-50/30 p-3.5 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                    <Sparkles
                      className="h-3.5 w-3.5 text-amber-600"
                      aria-hidden="true"
                    />
                    <span>{hint.category_label}</span>
                  </span>

                  {hint.redacted_solution_attempt && (
                    <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                      Solution Guardrail Applied
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                  {hint.content}
                </p>
              </li>
            ))}
          </ol>
        )}

        {/* Request Action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500">
            {hasRemainingHints
              ? `Next: ${nextTierMeta.label}`
              : 'Maximum progressive hints (3/3) reached for this question.'}
          </p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!questionId || !hasRemainingHints || disabled}
            isLoading={isRequesting}
            loadingText="Requesting Hint..."
            onClick={() => void handleRequestNextHint()}
            leftIcon={<Sparkles className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />}
          >
            {hasRemainingHints
              ? `Request Hint (Tier ${nextLevel})`
              : 'All Hints Used'}
          </Button>
        </div>
      </div>
    </section>
  );
}

