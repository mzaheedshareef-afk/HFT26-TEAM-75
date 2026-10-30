import { Award, Cpu, Gauge, Sparkles } from 'lucide-react';
import { VerdictBadge } from './TestResultsPanel';
import type { ScoreSummary } from '../../types/assessment';

interface ScoreSummaryCardProps {
  summary: ScoreSummary | null;
  emptyTitle?: string;
  emptyDescription?: string;
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

  return (
    <section
      aria-label="Assessment score summary"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Evaluation Summary
          </p>
          <h3 className="text-lg font-bold text-slate-900">
            {summary.question_title || 'Adaptive Technical Submission'}
          </h3>
          {summary.submitted_at && (
            <p className="text-xs text-slate-500">
              Submitted {new Date(summary.submitted_at).toLocaleString()}
            </p>
          )}
        </div>
        <VerdictBadge verdict={summary.overall_verdict} />
      </div>

      {/* Primary Numeric Metrics */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3.5">
          <p className="text-xs font-medium text-slate-500">Overall Score</p>
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

        <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3.5">
          <p className="text-xs font-medium text-slate-500">Test Cases Passed</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {summary.passed_tests}
            <span className="text-sm font-medium text-slate-500">
              {' '}
              / {summary.total_tests}
            </span>
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
                {summary.efficiency.optimality_score} / 10
              </p>
            </div>

            <div className="rounded-md bg-white p-2.5 border border-slate-200/80">
              <p className="text-slate-500">Cleanliness</p>
              <p className="mt-1 font-semibold tabular-nums text-slate-900">
                {summary.efficiency.cleanliness_score} / 10
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

