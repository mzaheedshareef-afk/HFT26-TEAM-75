import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Clock,
  Code2,
  Layers,
  Play,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { AlertBanner } from '../ui/AlertBanner';
import type {
  AssessmentDifficultyLabel,
  AssessmentLifecycleStatus,
  AssessmentSummaryItem,
} from '../../types/assessment';

interface AssessmentListSectionProps {
  assessments: AssessmentSummaryItem[];
  isLoading?: boolean;
  isGenerating?: boolean;
  generationError?: string | null;
  onDismissError?: () => void;
  onGenerateAssessment?: () => void;
}

const difficultyStyles: Record<AssessmentDifficultyLabel, string> = {
  Easy: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Medium: 'border-amber-200 bg-amber-50 text-amber-800',
  Hard: 'border-red-200 bg-red-50 text-red-800',
  Adaptive: 'border-blue-200 bg-blue-50 text-blue-800',
};

const statusMeta: Record<
  AssessmentLifecycleStatus,
  { label: string; className: string }
> = {
  generating: {
    label: 'Generating',
    className: 'border-purple-200 bg-purple-50 text-purple-800',
  },
  ready: {
    label: 'Ready',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  in_progress: {
    label: 'In Progress',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  completed: {
    label: 'Completed',
    className: 'border-slate-300 bg-slate-100 text-slate-800',
  },
  expired: {
    label: 'Expired',
    className: 'border-red-200 bg-red-50 text-red-800',
  },
};

export function AssessmentListSection({
  assessments,
  isLoading = false,
  isGenerating = false,
  generationError = null,
  onDismissError,
  onGenerateAssessment,
}: AssessmentListSectionProps) {
  return (
    <section
      aria-labelledby="available-assessments-heading"
      className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600">
            <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Personalized Assessments</span>
          </div>
          <h2
            id="available-assessments-heading"
            className="text-lg font-bold tracking-tight text-slate-900"
          >
            Available Technical Assessments
          </h2>
          <p className="text-xs text-slate-500">
            Coding challenges dynamically calibrated to your engineering portfolio, primary stack, and experience tier.
          </p>
        </div>

        {onGenerateAssessment && (
          <Button
            type="button"
            variant="accent"
            size="sm"
            isLoading={isGenerating}
            loadingText="Generating Assessment..."
            onClick={onGenerateAssessment}
            leftIcon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            Generate Personalized Assessment
          </Button>
        )}
      </div>

      {generationError && (
        <AlertBanner
          variant="error"
          title="Assessment Generation Notice"
          message={generationError}
          onDismiss={onDismissError}
        />
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((skeleton) => (
            <div
              key={skeleton}
              aria-hidden="true"
              className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 space-y-3 animate-pulse"
            >
              <div className="h-4 w-1/3 rounded bg-slate-200" />
              <div className="h-5 w-3/4 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : assessments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center space-y-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600">
            <Layers className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">
              No Personalized Assessments Available Yet
            </h3>
            <p className="mx-auto max-w-lg text-xs text-slate-500 leading-relaxed">
              Upload your GitHub portfolio and click{' '}
              <span className="font-semibold text-slate-700">
                Generate Personalized Assessment
              </span>{' '}
              to synthesize calibrated coding challenges, or review the general assessment instructions.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Link
              to="/student/portfolio"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <span>Check Portfolio</span>
            </Link>
            <Link
              to="/student/assessment/instructions"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              <span>View Assessment Instructions</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {assessments.map((assessment) => {
            const status = statusMeta[assessment.status] ?? statusMeta.ready;
            const diffClass =
              difficultyStyles[assessment.difficulty] ??
              difficultyStyles.Adaptive;

            return (
              <article
                key={assessment.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/40 p-5 hover:border-slate-300 transition-colors space-y-5"
              >
                <div className="space-y-3.5">
                  {/* Status & Difficulty Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${status.className}`}
                    >
                      {status.label}
                    </span>

                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${diffClass}`}
                    >
                      {assessment.difficulty}
                    </span>
                  </div>

                  {/* Assessment Title & Target Role */}
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {assessment.title}
                    </h3>
                    {assessment.target_role && (
                      <p className="text-xs font-medium text-slate-500">
                        Track: {assessment.target_role}
                      </p>
                    )}
                  </div>

                  {/* Duration & Question Count Metadata */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <Clock
                        className="h-3.5 w-3.5 text-slate-400"
                        aria-hidden="true"
                      />
                      <span>{assessment.duration_minutes} mins</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <Code2
                        className="h-3.5 w-3.5 text-slate-400"
                        aria-hidden="true"
                      />
                      <span>
                        {assessment.question_count}{' '}
                        {assessment.question_count === 1
                          ? 'Question'
                          : 'Questions'}
                      </span>
                    </span>
                    {typeof assessment.final_score === 'number' && (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Score: {Math.round(assessment.final_score)}%</span>
                      </span>
                    )}
                  </div>

                  {/* Topics Covered */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Topics Covered
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {assessment.topics.length > 0 ? (
                        assessment.topics.map((topic) => (
                          <span
                            key={topic}
                            className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700"
                          >
                            {topic}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">
                          Portfolio-calibrated algorithms &amp; systems
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-4">
                  {assessment.status === 'completed' ? (
                    <>
                      <Link
                        to={`/student/assessment/${encodeURIComponent(
                          assessment.id
                        )}/results`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                      >
                        <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>View Results</span>
                      </Link>
                      <Link
                        to={`/student/assessment/${encodeURIComponent(
                          assessment.id
                        )}/instructions`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        <span>Instructions</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </>
                  ) : assessment.status === 'in_progress' ? (
                    <>
                      <Link
                        to={`/student/assessment/${encodeURIComponent(
                          assessment.id
                        )}/workspace`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                      >
                        <Play className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Start Assessment</span>
                      </Link>
                      <Link
                        to={`/student/assessment/${encodeURIComponent(
                          assessment.id
                        )}/instructions`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        <span>Review Rules</span>
                      </Link>
                    </>
                  ) : (
                    <Link
                      to={`/student/assessment/${encodeURIComponent(
                        assessment.id
                      )}/instructions`}
                      aria-disabled={assessment.status === 'generating' || assessment.status === 'expired'}
                      className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors ${
                        assessment.status === 'generating' ||
                        assessment.status === 'expired'
                          ? 'pointer-events-none bg-slate-200 text-slate-500'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Start Assessment</span>
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

