import React, { useState } from 'react';
import {
  AlertCircle,
  Bot,
  History,
  Lightbulb,
  Loader2,
  Lock,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  User,
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
  sessionHintHistory?: AiHintItem[];
  isLoadingHistory?: boolean;
  totalSessionHintsUsed: number;
  disabled?: boolean;
  panelRef?: React.RefObject<HTMLElement | null>;
  onHintReceived: (hint: AiHintItem) => void;
}

function formatHintTimestamp(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return 'Just now';
  }
  return parsed.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AiHintPanel({
  assessmentId,
  questionId,
  questionTitle,
  language,
  currentCode,
  hintsForQuestion,
  sessionHintHistory = [],
  isLoadingHistory = false,
  totalSessionHintsUsed,
  disabled = false,
  panelRef,
  onHintReceived,
}: AiHintPanelProps) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);
  const [showFullHistory, setShowFullHistory] = useState(false);

  const usedCount = hintsForQuestion.length;
  const hasRemainingHints = usedCount < MAX_HINTS_PER_QUESTION;
  const nextLevel = Math.min(
    MAX_HINTS_PER_QUESTION,
    usedCount + 1
  ) as AiHintLevel;
  const nextTierMeta = HINT_TIER_DEFINITIONS[nextLevel];

  const combinedHistory =
    sessionHintHistory.length > 0 ? sessionHintHistory : hintsForQuestion;

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
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby="ai-hints-panel-heading"
      className="rounded-xl border border-slate-200 bg-white overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
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
              Non-Spoiler AI Tutor:
            </strong>{' '}
            Progressive guidance stays open alongside your editor. The backend controls permitted hint tiers and never reveals full solutions or hidden test cases.
          </p>
        </div>

        {/* Progressive Hint Levels (Hint 1, Hint 2, Hint 3) */}
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
                  <span>Hint {tier}</span>
                  {isUnlocked ? (
                    <span className="text-[11px] text-emerald-700">
                      Unlocked
                    </span>
                  ) : isNext ? (
                    <span className="text-[11px] text-blue-700">Next</span>
                  ) : (
                    <Lock
                      className="h-3 w-3 text-slate-400"
                      aria-hidden="true"
                    />
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

        {/* Chat-Style AI Assistant Stream */}
        <div
          aria-label="AI Tutor chat panel"
          className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-3 max-h-80 overflow-y-auto"
        >
          {isLoadingHistory && hintsForQuestion.length === 0 ? (
            <div
              role="status"
              className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
              <span>Syncing hint history...</span>
            </div>
          ) : hintsForQuestion.length === 0 && !isRequesting ? (
            <div className="flex flex-col items-center justify-center py-4 text-center space-y-1.5">
              <MessageSquare
                className="h-5 w-5 text-slate-400"
                aria-hidden="true"
              />
              <p className="text-xs font-medium text-slate-700">
                No AI hints requested for this question yet
              </p>
              <p className="max-w-xs text-[11px] text-slate-500 leading-relaxed">
                Request Hint 1 for conceptual direction while continuing to edit your code in the workspace.
              </p>
            </div>
          ) : (
            <ol className="space-y-3" aria-label="Unlocked AI hints">
              {hintsForQuestion.map((hint) => {
                const tierMeta = HINT_TIER_DEFINITIONS[hint.level];
                return (
                  <li key={hint.hint_id} className="space-y-2">
                    {/* Student Request Chat Bubble */}
                    <div className="flex items-start justify-end gap-2">
                      <div className="rounded-2xl rounded-tr-xs border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-700 shadow-2xs">
                        <span className="font-semibold text-slate-900">
                          Requested Hint {hint.level}:
                        </span>{' '}
                        {tierMeta.shortLabel}
                      </div>
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                        <User className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </div>

                    {/* Guarded AI Assistant Response Chat Bubble */}
                    <div className="flex items-start gap-2.5">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 border border-amber-200 text-amber-800 mt-0.5">
                        <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>

                      <div className="flex-1 rounded-2xl rounded-tl-xs border border-amber-200/90 bg-white p-3 space-y-1.5 shadow-2xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                            <Sparkles
                              className="h-3.5 w-3.5 text-amber-600"
                              aria-hidden="true"
                            />
                            <span>{hint.category_label}</span>
                          </span>

                          <div className="flex items-center gap-1.5">
                            {hint.redacted_solution_attempt && (
                              <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-800">
                                Solution Guardrail Applied
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-slate-400">
                              {formatHintTimestamp(hint.created_at)}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                          {hint.content}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {/* Live AI Typing State */}
          {isRequesting && (
            <div
              role="status"
              className="flex items-center gap-2.5 rounded-xl border border-amber-200/70 bg-white p-2.5 text-xs text-slate-600"
            >
              <Loader2
                className="h-3.5 w-3.5 animate-spin text-amber-600 shrink-0"
                aria-hidden="true"
              />
              <span>
                Guarded AI Tutor is generating Hint {nextLevel} (
                {nextTierMeta.shortLabel})...
              </span>
            </div>
          )}
        </div>

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
            leftIcon={
              <Sparkles
                className="h-3.5 w-3.5 text-amber-600"
                aria-hidden="true"
              />
            }
          >
            {hasRemainingHints
              ? `Request Hint (Tier ${nextLevel})`
              : 'All Hints Used'}
          </Button>
        </div>

        {/* Session Hint Request History Log */}
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowFullHistory((prev) => !prev)}
              aria-expanded={showFullHistory}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
            >
              <History className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>Hint Request History ({combinedHistory.length})</span>
            </button>

            {combinedHistory.length > 0 && (
              <span className="text-[11px] text-slate-500">
                {showFullHistory ? 'Hide log' : 'View log'}
              </span>
            )}
          </div>

          {showFullHistory && (
            <div
              aria-label="Session hint request history"
              className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 space-y-2"
            >
              {combinedHistory.length === 0 ? (
                <p className="text-[11px] text-slate-500 text-center py-1">
                  No hint requests recorded in this assessment session.
                </p>
              ) : (
                <ul className="divide-y divide-slate-200/70 text-[11px]">
                  {combinedHistory.map((entry) => (
                    <li
                      key={`history-${entry.hint_id}`}
                      className="py-1.5 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex flex-wrap items-center gap-1.5 text-slate-700">
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">
                          Hint {entry.level}
                        </span>
                        <span className="font-medium text-slate-900">
                          {entry.question_title || entry.question_id}
                        </span>
                        <span className="text-slate-500">
                          &middot; {HINT_TIER_DEFINITIONS[entry.level].shortLabel}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500">
                        {formatHintTimestamp(entry.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
