import {
  Bot,
  Code2,
  Eye,
  Gauge,
  Layers,
  Sparkles,
} from 'lucide-react';
import { InfoTooltip } from '../ui/InfoTooltip';
import { HINT_TIER_DEFINITIONS } from '../../services/assistantService';
import type { AiHintLevel } from '../../types/assessment';

interface AiInteractionEfficiencyCardProps {
  totalHintRequests: number;
  hintLevelsUsed: AiHintLevel[];
  usedOrViewedHints: boolean;
  aiAssistanceLabel?: string;
  codingScore: number;
  /**
   * Official AI efficiency score returned by the backend.
   * CRITICAL: Never calculate or approximate this value in the frontend.
   */
  backendAiEfficiencyScore: number | null | undefined;
}

export function AiInteractionEfficiencyCard({
  totalHintRequests,
  hintLevelsUsed,
  usedOrViewedHints,
  aiAssistanceLabel,
  codingScore,
  backendAiEfficiencyScore,
}: AiInteractionEfficiencyCardProps) {
  const hasOfficialEfficiencyScore =
    typeof backendAiEfficiencyScore === 'number' &&
    Number.isFinite(backendAiEfficiencyScore);

  const assistanceSummary =
    aiAssistanceLabel ??
    (totalHintRequests === 0 && !usedOrViewedHints
      ? 'Solved independently without AI tutor assistance'
      : `Assisted via ${totalHintRequests} progressive AI ${
          totalHintRequests === 1 ? 'hint' : 'hints'
        }`);

  return (
    <section
      aria-labelledby="ai-interaction-efficiency-heading"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <h2
              id="ai-interaction-efficiency-heading"
              className="text-base font-semibold text-slate-900"
            >
              AI Interaction &amp; Efficiency Overview
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Tracks progressive AI tutor usage alongside deterministic coding accuracy and official backend AI efficiency evaluation.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
          <Sparkles className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
          <span>Backend-Verified Telemetry</span>
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 1. Official Backend AI Efficiency Score */}
        <div className="rounded-lg border border-blue-200/80 bg-blue-50/40 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-700">
            <span className="inline-flex items-center gap-1">
              <span>AI Efficiency Score</span>
              <InfoTooltip label="Explain AI Efficiency Score metric">
                Official AI Efficiency Score returned directly by the backend evaluation engine. It measures independent problem solving, hint tier discipline, and solution optimality. This score is never calculated in the frontend.
              </InfoTooltip>
            </span>
            <Gauge className="h-4 w-4 text-blue-600" aria-hidden="true" />
          </div>

          {hasOfficialEfficiencyScore ? (
            <p
              data-testid="backend-ai-efficiency-value"
              className="text-xl font-bold tabular-nums text-slate-900"
            >
              {Math.round(backendAiEfficiencyScore)} / 100
            </p>
          ) : (
            <p
              data-testid="backend-ai-efficiency-value"
              className="text-sm font-semibold text-slate-600"
            >
              Pending Backend Score
            </p>
          )}

          <p className="text-[11px] text-slate-500">
            {hasOfficialEfficiencyScore
              ? 'Official score supplied by backend engine'
              : 'Displayed only when returned by backend'}
          </p>
        </div>

        {/* 2. Coding Performance */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Coding Performance</span>
            <Code2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          </div>
          <p className="text-xl font-bold tabular-nums text-slate-900">
            {Math.round(codingScore)} / 100 pts
          </p>
          <p className="text-[11px] text-slate-500">
            Deterministic test-suite coding score
          </p>
        </div>

        {/* 3. Total AI Hint Requests */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Total AI Hint Requests</span>
            <Sparkles className="h-4 w-4 text-amber-600" aria-hidden="true" />
          </div>
          <p className="text-xl font-bold tabular-nums text-slate-900">
            {totalHintRequests}{' '}
            <span className="text-xs font-medium text-slate-500">
              {totalHintRequests === 1 ? 'Request' : 'Requests'}
            </span>
          </p>
          <p className="text-[11px] text-slate-500">{assistanceSummary}</p>
        </div>

        {/* 4. Hint Levels Used */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Hint Levels Used</span>
            <Layers className="h-4 w-4 text-slate-500" aria-hidden="true" />
          </div>
          {hintLevelsUsed.length === 0 ? (
            <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              No Hint Tiers Used
            </span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {hintLevelsUsed.map((lvl) => (
                <span
                  key={lvl}
                  title={HINT_TIER_DEFINITIONS[lvl].description}
                  className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900"
                >
                  Hint {lvl}: {HINT_TIER_DEFINITIONS[lvl].shortLabel}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 5. Viewed / Requested Hints Indicator */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Hints Viewed or Requested</span>
            <Eye className="h-4 w-4 text-slate-500" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-slate-900">
            {usedOrViewedHints
              ? 'Yes — Hints Requested / Viewed'
              : 'No — Solved Independently'}
          </p>
          <p className="text-[11px] text-slate-500">
            Indicates whether progressive AI guidance was consulted
          </p>
        </div>

        {/* 6. AI Assistance Usage Summary */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>AI Assistance Usage</span>
            <Bot className="h-4 w-4 text-slate-500" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-slate-900">
            {totalHintRequests === 0
              ? 'Independent Mode'
              : totalHintRequests <= 2
              ? 'Light Conceptual Guidance'
              : 'Multi-Tier Guided Solving'}
          </p>
          <p className="text-[11px] text-slate-500">{assistanceSummary}</p>
        </div>
      </div>
    </section>
  );
}
