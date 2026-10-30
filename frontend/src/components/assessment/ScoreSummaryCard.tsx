import {
  Award,
  CheckCircle2,
  Clock,
  Cpu,
  Gauge,
  HardDrive,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { VerdictBadge } from './TestResultsPanel';
import type { ScoreSummary } from '../../types/assessment';

interface ScoreSummaryCardProps {
  summary: ScoreSummary | null;
  emptyTitle?: string;
  emptyDescription?: string;
}

function formatQualityScore(score: number): string {
  if (score <= 10) {
    return `${score} / 10`;
  }
  return `${Math.round(score)} / 100`;
}

export function ScoreSummaryCard({
  summary,
  emptyTitle = 'No Graded Submissions Yet',
  emptyDescription = 'Complete an adaptive coding assessment to receive deterministic test grading and AI algorithmic efficiency feedback.',
}: ScoreSummaryCardProps) {
  if (!summary) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center space-y-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <Award className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="text-sm font-semibold text-slate-900">{emptyTitle}</h3>
        <p className="mx-auto max-w-md text-xs text-slate-500 leading-relaxed">
          {emptyDescription}
        </p>
      </div>
    );
  }

  const failedTests =
    summary.failed_tests ??
    Math.max(0, summary.total_tests - summary.passed_tests);

  return (
    <section
      aria-label="Assessment score summary"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Final Grading Summary
          </p>
          <h3 className="text-lg font-bold text-slate-900">
            {summary.question_title || 'Adaptive Technical Submission'}
          </h3>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            {summary.submitted_at && (
              <span>
                Submitted {new Date(summary.submitted_at).toLocaleString()}
              </span>
            )}
            {summary.execution_time_ms !== undefined && (
              <span className="inline-flex items-center gap-1 font-mono text-slate-600">
                <Clock className="h-3 w-3" aria-hidden="true" />
                <span>{summary.execution_time_ms} ms</span>
              </span>
            )}
            {summary.memory_used_mb !== undefined && (
              <span className="inline-flex items-center gap-1 font-mono text-slate-600">
                <HardDrive className="h-3 w-3" aria-hidden="true" />
                <span>{summary.memory_used_mb.toFixed(1)} MB</span>
              </span>
            )}
          </div>
        </div>
        <VerdictBadge verdict={summary.overall_verdict} />
      </div>

      {/* Primary Numeric Metrics */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3.5">
          <p className="text-xs font-medium text-slate-500">Final Score</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {Math.round(summary.overall_score)}
            <span className="text-sm font-medium text-slate-500"> / 100</span>
          </p>
        </div>

        <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3.5">
          <p className="text-xs font-medium text-slate-500">
            Deterministic Test Score
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {Math.round(summary.deterministic_score)}%
          </p>
        </div>

        <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-1">
          <p className="text-xs font-medium text-slate-500">
            Test Case Outcomes
          </p>
          <div className="flex flex-wrap items-center gap-2.5 pt-0.5 text-sm font-bold tabular-nums">
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{summary.passed_tests} Passed</span>
            </span>
            <span className="inline-flex items-center gap-1 text-red-700">
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{failedTests} Failed</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-500 tabular-nums">
            {summary.passed_tests} / {summary.total_tests} total cases
          </p>
        </div>
      </div>

      {/* AI Efficiency Breakdown */}
      {summary.efficiency && (
        <div className="rounded-lg border border-blue-200/70 bg-blue-50/40 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-800">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
            <span>AI Algorithmic Efficiency Analysis</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-4 text-xs">
            <div className="rounded-md bg-white p-2.5 border border-slate-200/80">
              <p className="text-slate-500 flex items-center gap-1">
                <Cpu className="h-3 w-3" aria-hidden="true" />
                <span>Time Complexity</span>
              </p>
              <p className="mt-1 font-mono font-semibold text-slate-900">
                {summary.efficiency.detected_time_complexity}
              </p>
            </div>

            <div className="rounded-md bg-white p-2.5 border border-slate-200/80">
              <p className="text-slate-500">Space Complexity</p>
              <p className="mt-1 font-mono font-semibold text-slate-900">
                {summary.efficiency.detected_space_complexity}
              </p>
            </div>

            <div className="rounded-md bg-white p-2.5 border border-slate-200/80">
              <p className="text-slate-500 flex items-center gap-1">
                <Gauge className="h-3 w-3" aria-hidden="true" />
                <span>Optimality</span>
              </p>
              <p className="mt-1 font-semibold tabular-nums text-slate-900">
                {formatQualityScore(summary.efficiency.optimality_score)}
              </p>
            </div>

            <div className="rounded-md bg-white p-2.5 border border-slate-200/80">
              <p className="text-slate-500">Cleanliness</p>
              <p className="mt-1 font-semibold tabular-nums text-slate-900">
                {formatQualityScore(summary.efficiency.cleanliness_score)}
              </p>
            </div>
          </div>

          {summary.efficiency.feedback && (
            <p className="text-xs text-slate-700 leading-relaxed">
              {summary.efficiency.feedback}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
