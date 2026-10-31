import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  HardDrive,
  HelpCircle,
  Layers,
  Lightbulb,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { AiInteractionEfficiencyCard } from '../../components/analytics/AiInteractionEfficiencyCard';
import { VerdictBadge } from '../../components/assessment/TestResultsPanel';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Button } from '../../components/ui/Button';
import { assessmentService } from '../../services/assessmentService';
import { extractApiErrorMessage } from '../../services/api';
import type {
  AssessmentCompletionStatus,
  AssessmentResultDetail,
  QuestionDifficulty,
} from '../../types/assessment';

interface ResultsLocationState {
  result?: AssessmentResultDetail;
}

const completionStatusMeta: Record<
  AssessmentCompletionStatus,
  { label: string; className: string }
> = {
  completed: {
    label: 'Completed',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  partially_completed: {
    label: 'Partially Completed',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  expired: {
    label: 'Time Expired',
    className: 'border-red-200 bg-red-50 text-red-800',
  },
  in_progress: {
    label: 'In Progress',
    className: 'border-blue-200 bg-blue-50 text-blue-800',
  },
};

const difficultyStyles: Record<QuestionDifficulty, string> = {
  Easy: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Medium: 'border-amber-200 bg-amber-50 text-amber-800',
  Hard: 'border-red-200 bg-red-50 text-red-800',
};

export function formatElapsedTime(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function AssessmentResultsPage() {
  const location = useLocation();
  const { assessmentId } = useParams<{ assessmentId?: string }>();

  const stateResult =
    (location.state as ResultsLocationState | null)?.result ?? null;

  const [result, setResult] = useState<AssessmentResultDetail | null>(
    stateResult
  );
  const [isLoading, setIsLoading] = useState(!stateResult);
  const [fetchNotice, setFetchNotice] = useState<string | null>(null);

  const loadResults = useCallback(
    async (isCancelled?: () => boolean) => {
      setIsLoading(true);
      setFetchNotice(null);

      try {
        const fetched = await assessmentService.getAssessmentResults(
          assessmentId
        );
        if (isCancelled?.()) return;
        if (fetched) {
          setResult(fetched);
        }
      } catch (error) {
        if (isCancelled?.()) return;
        if (!stateResult) {
          setFetchNotice(
            extractApiErrorMessage(
              error,
              'Assessment results endpoint is not currently reachable.'
            )
          );
        }
      } finally {
        if (!isCancelled?.()) {
          setIsLoading(false);
        }
      }
    },
    [assessmentId, stateResult]
  );

  useEffect(() => {
    let cancelled = false;
    if (
      !stateResult ||
      (assessmentId && stateResult.assessment_id !== assessmentId)
    ) {
      void loadResults(() => cancelled);
    }
    return () => {
      cancelled = true;
    };
  }, [assessmentId, stateResult, loadResults]);

  const statusBadge = result
    ? completionStatusMeta[result.completion_status] ??
      completionStatusMeta.completed
    : null;

  const hasPeakMemory = result?.peak_memory_mb !== undefined;

  return (
    <DashboardShell role="student">
      <div className="space-y-8">
        {/* Top Breadcrumb & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <Link
              to="/student/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Back to Candidate Dashboard</span>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {result?.assessment_title || 'Assessment Results & Analytics'}
            </h1>
            <p className="text-sm text-slate-600">
              Comprehensive evaluation summary covering multi-format scores, test execution results, runtime &amp; memory telemetry, and question-wise breakdown.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/student/analytics"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Analytics Dashboard
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => void loadResults()}
              leftIcon={
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
                />
              }
            >
              Refresh Results
            </Button>
          </div>
        </div>

        {fetchNotice && (
          <AlertBanner
            variant="info"
            title="Results Service Notice"
            message={fetchNotice}
            onDismiss={() => setFetchNotice(null)}
          />
        )}

        {isLoading && !result ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Loading assessment evaluation report...
          </div>
        ) : !result ? (
          <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Award className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="space-y-1.5">
              <h2 className="text-base font-semibold text-slate-900">
                No Completed Assessment Results Yet
              </h2>
              <p className="mx-auto max-w-md text-xs text-slate-500 leading-relaxed">
                Complete and submit solutions in an active personalized coding assessment to view your final score, passed and failed test cases, execution time, and question-wise breakdown.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <Link
                to="/student/dashboard"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                View Available Assessments
              </Link>
              <Link
                to="/student/assessment/instructions"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <span>Start Assessment</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </section>
        ) : (
          <>
            {/* Completion Status Banner */}
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Assessment Completion Status
                </p>
                <div className="flex flex-wrap items-center gap-2.5">
                  {statusBadge && (
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${statusBadge.className}`}
                    >
                      {statusBadge.label}
                    </span>
                  )}
                  <span className="font-mono text-xs text-slate-500">
                    ID: {result.assessment_id}
                  </span>
                </div>
              </div>

              {result.completed_at && (
                <p className="text-xs text-slate-500">
                  Completed on{' '}
                  <span className="font-medium text-slate-800">
                    {new Date(result.completed_at).toLocaleString()}
                  </span>
                </p>
              )}
            </section>

            {/* Primary KPI Grid */}
            <section
              aria-label="Assessment result metrics"
              className={`grid gap-4 sm:grid-cols-2 ${
                hasPeakMemory ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
              }`}
            >
              {/* Final Score */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Final Composite Score</span>
                  <Award
                    className="h-4 w-4 text-blue-600"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-2xl font-bold tabular-nums text-slate-900">
                  {Math.round(result.final_score)}
                  <span className="text-sm font-medium text-slate-500">
                    {' '}
                    / 100
                  </span>
                </p>
                {result.percentage !== undefined && (
                  <p className="text-xs text-slate-500">
                    Weighted Percentage:{' '}
                    <span className="font-semibold text-slate-700">
                      {Math.round(result.percentage)}%
                    </span>
                  </p>
                )}
              </div>

              {/* Passed & Failed Test Cases */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Test Case Results</span>
                  <CheckCircle2
                    className="h-4 w-4 text-emerald-600"
                    aria-hidden="true"
                  />
                </div>
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 tabular-nums">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{result.correct_test_cases} Passed</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-red-700 tabular-nums">
                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{result.failed_test_cases} Failed</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 tabular-nums">
                  {result.correct_test_cases} of {result.total_test_cases} total test cases passed
                </p>
              </div>

              {/* Execution & Elapsed Time */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Execution Time</span>
                  <Clock
                    className="h-4 w-4 text-slate-500"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-2xl font-bold tabular-nums text-slate-900">
                  {result.total_execution_time_ms !== undefined
                    ? `${result.total_execution_time_ms} ms`
                    : formatElapsedTime(result.time_taken_seconds)}
                </p>
                <p className="text-xs text-slate-500 tabular-nums">
                  {result.total_execution_time_ms !== undefined ? (
                    <>
                      Session duration:{' '}
                      <span className="font-medium text-slate-700">
                        {formatElapsedTime(result.time_taken_seconds)}
                      </span>
                    </>
                  ) : result.time_limit_seconds !== undefined ? (
                    `Out of ${formatElapsedTime(result.time_limit_seconds)} limit`
                  ) : (
                    'Assessment session duration'
                  )}
                </p>
              </div>

              {/* Memory Usage */}
              {result.peak_memory_mb !== undefined && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Memory Usage</span>
                    <HardDrive
                      className="h-4 w-4 text-indigo-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-slate-900">
                    {result.peak_memory_mb.toFixed(1)}
                    <span className="text-sm font-medium text-slate-500">
                      {' '}
                      MB
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Peak sandbox memory usage
                  </p>
                </div>
              )}

              {/* AI Hint Usage */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>AI Hint Usage</span>
                  <Lightbulb
                    className="h-4 w-4 text-amber-600"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-2xl font-bold tabular-nums text-slate-900">
                  {result.total_hints_used}{' '}
                  <span className="text-sm font-medium text-slate-500">
                    {result.total_hints_used === 1 ? 'Hint' : 'Hints'}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  Progressive conceptual tutor guidance
                </p>
              </div>
            </section>

            {/* Multi-Format Round Breakdown Strip */}
            {(result.mcq_score !== undefined || result.msq_score !== undefined || result.coding_score !== undefined) && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-600" />
                    <span>Multi-Format Examination Performance</span>
                  </h2>
                  <span className="text-xs font-semibold text-slate-500">
                    Portfolio-Calibrated Evaluation
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {/* Round 1: MCQ */}
                  <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-blue-800">
                      <span>Round 1 &middot; Single Choice (MCQ)</span>
                      <span className="bg-blue-100 px-2 py-0.5 rounded text-[11px]">
                        {result.mcq_score ?? 0} / {result.mcq_max ?? 6} pts
                      </span>
                    </div>
                    <p className="text-2xl font-extrabold text-blue-950 tabular-nums">
                      {result.mcq_max ? Math.round(((result.mcq_score ?? 0) / result.mcq_max) * 100) : 0}%
                    </p>
                    <p className="text-xs text-blue-700">
                      {result.mcq_score ?? 0} marks earned out of {result.mcq_max ?? 6}
                    </p>
                  </div>

                  {/* Round 2: MSQ */}
                  <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-purple-800">
                      <span>Round 2 &middot; Multiple Select (MSQ)</span>
                      <span className="bg-purple-100 px-2 py-0.5 rounded text-[11px]">
                        {result.msq_score ?? 0} / {result.msq_max ?? 6} pts
                      </span>
                    </div>
                    <p className="text-2xl font-extrabold text-purple-950 tabular-nums">
                      {result.msq_max ? Math.round(((result.msq_score ?? 0) / result.msq_max) * 100) : 0}%
                    </p>
                    <p className="text-xs text-purple-700">
                      {result.msq_score ?? 0} marks earned out of {result.msq_max ?? 6} (Exact Match)
                    </p>
                  </div>

                  {/* Round 3: Coding */}
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
                      <span>Round 3 &middot; Coding Sandbox</span>
                      <span className="bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                        {result.coding_score ?? 0} / {result.coding_max ?? 10} pts
                      </span>
                    </div>
                    <p className="text-2xl font-extrabold text-emerald-950 tabular-nums">
                      {result.coding_max ? Math.round(((result.coding_score ?? 0) / result.coding_max) * 100) : 0}%
                    </p>
                    <p className="text-xs text-emerald-700">
                      {result.coding_score ?? 0} marks earned out of {result.coding_max ?? 10}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Module 2: AI Interaction & Efficiency Display */}
            <AiInteractionEfficiencyCard
              totalHintRequests={result.total_hints_used}
              hintLevelsUsed={result.hint_levels_used ?? []}
              usedOrViewedHints={
                result.hints_viewed ?? result.total_hints_used > 0
              }
              codingScore={
                result.coding_score ??
                result.deterministic_score ??
                result.final_score
              }
              backendAiEfficiencyScore={result.ai_efficiency_score}
            />

            {/* Detailed Question Review with Explanations */}
            {result.evaluated_questions && result.evaluated_questions.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                <div className="border-b border-slate-200 p-5 bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Detailed Solutions, Answer Keys &amp; AI Explanations
                    </h2>
                    <p className="text-xs text-slate-500">
                      Review your submitted choices against verified answer keys and conceptual AI explanations.
                    </p>
                  </div>
                  <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
                    {result.evaluated_questions.filter((q) => q.is_correct).length} of {result.evaluated_questions.length} Correct
                  </span>
                </div>

                <div className="divide-y divide-slate-100 p-6 space-y-6">
                  {result.evaluated_questions.map((eq, idx) => (
                    <div key={eq.question_id || idx} className="space-y-4 pt-4 first:pt-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                            Q{idx + 1}
                          </span>
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase ${
                            eq.question_type === 'mcq'
                              ? 'bg-blue-100 text-blue-800'
                              : eq.question_type === 'msq'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {eq.question_type}
                          </span>
                          <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded">
                            {eq.topic}
                          </span>
                          {eq.portfolio_skill_reference && (
                            <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-blue-500" />
                              Portfolio: {eq.portfolio_skill_reference}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            eq.is_correct
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-red-100 text-red-800 border border-red-200'
                          }`}>
                            {eq.is_correct ? 'Correct' : 'Incorrect'} ({eq.marks_earned} / {eq.marks_possible} Marks)
                          </span>
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-slate-900">
                        {eq.title}
                      </h3>

                      {eq.description && (
                        <p className="text-sm text-slate-700 whitespace-pre-line bg-slate-50 p-3 rounded-lg border border-slate-200">
                          {eq.description}
                        </p>
                      )}

                      {/* Options Display for MCQ / MSQ */}
                      {eq.options && eq.options.length > 0 && (
                        <div className="grid gap-2 sm:grid-cols-2 pt-1">
                          {eq.options.map((opt) => {
                            const isSelected =
                              eq.question_type === 'mcq'
                                ? eq.selected_option === opt.id
                                : eq.selected_options?.includes(opt.id);
                            const isCorrect =
                              eq.question_type === 'mcq'
                                ? eq.correct_answer === opt.id
                                : eq.correct_answers?.includes(opt.id);

                            return (
                              <div
                                key={opt.id}
                                className={`p-3 rounded-xl border text-xs font-medium flex items-start gap-2.5 ${
                                  isCorrect
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 font-semibold'
                                    : isSelected
                                    ? 'border-red-300 bg-red-50 text-red-950'
                                    : 'border-slate-200 bg-white text-slate-700'
                                }`}
                              >
                                <span className={`w-5 h-5 rounded flex items-center justify-center shrink-0 font-bold ${
                                  isCorrect ? 'bg-emerald-600 text-white' : isSelected ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {opt.id}
                                </span>
                                <span className="flex-1">{opt.text}</span>
                                {isCorrect && (
                                  <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                    Correct Answer
                                  </span>
                                )}
                                {isSelected && !isCorrect && (
                                  <span className="text-[10px] uppercase font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                                    Your Answer
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* AI Explanation Box */}
                      {eq.explanation && (
                        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-950 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-blue-900">
                            <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                            <span>AI Tutor Conceptual Explanation</span>
                          </div>
                          <p className="leading-relaxed text-slate-700">
                            {eq.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Question-Wise Performance Summary Table */}
            <section className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              <div className="border-b border-slate-200 p-5">
                <h2 className="text-base font-semibold text-slate-900">
                  Question-Wise Summary
                </h2>
                <p className="text-xs text-slate-500">
                  Per-problem test case execution outcomes, runtime &amp; memory telemetry, complexity feedback, and composite scores.
                </p>
              </div>

              {result.question_performance.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No individual question submissions were recorded for this session.
                </div>
              ) : (
                <div
                  tabIndex={0}
                  role="region"
                  aria-labelledby="question-performance-caption"
                  className="responsive-table-wrapper"
                >
                  <table
                    className="responsive-table text-left text-xs"
                    style={
                      {
                        '--col-stack': '"Difficulty"',
                        '--col-portfolio': '"Verdict"',
                        '--col-status': '"Test Cases"',
                        '--col-score': '"Runtime & Hints"',
                        '--col-actions': '"Score"',
                      } as React.CSSProperties
                    }
                  >
                    <caption
                      id="question-performance-caption"
                      className="sr-only"
                    >
                      Question-wise technical assessment results
                    </caption>
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th scope="col" className="px-5 py-3 font-semibold">
                          Question
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          Difficulty
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          Verdict
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          Test Cases
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          Runtime &amp; Hints
                        </th>
                        <th
                          scope="col"
                          className="px-5 py-3 font-semibold text-right"
                        >
                          Score
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.question_performance.map((q, index) => (
                        <tr
                          key={q.question_id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <th
                            scope="row"
                            className="px-5 py-3.5 font-medium text-slate-900"
                          >
                            <div className="space-y-0.5">
                              <p className="text-sm font-semibold text-slate-900">
                                Q{index + 1}. {q.title}
                              </p>
                              {q.detected_time_complexity && (
                                <p className="font-mono text-[11px] font-normal text-slate-500">
                                  Detected Complexity:{' '}
                                  {q.detected_time_complexity}
                                </p>
                              )}
                            </div>
                          </th>

                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 font-semibold ${
                                difficultyStyles[q.difficulty]
                              }`}
                            >
                              {q.difficulty}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            {q.verdict === 'PENDING' ? (
                              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                                Not Submitted
                              </span>
                            ) : (
                              <VerdictBadge verdict={q.verdict} />
                            )}
                          </td>

                          <td className="px-4 py-3.5 tabular-nums text-slate-700">
                            <span className="font-semibold text-emerald-700">
                              {q.passed_tests} passed
                            </span>{' '}
                            &middot;{' '}
                            <span className="font-medium text-red-700">
                              {q.failed_tests} failed
                            </span>{' '}
                            <span className="text-slate-400">
                              ({q.total_tests} total)
                            </span>
                          </td>

                          <td className="px-4 py-3.5 tabular-nums text-slate-700">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {q.execution_time_ms !== undefined && (
                                <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                                  {q.execution_time_ms} ms
                                </span>
                              )}
                              {q.memory_used_mb !== undefined && (
                                <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                                  {q.memory_used_mb.toFixed(1)} MB
                                </span>
                              )}
                              <span className="font-medium text-slate-600">
                                {q.hints_used}{' '}
                                {q.hints_used === 1 ? 'hint' : 'hints'}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-3.5 text-right font-bold tabular-nums text-slate-900">
                            {Math.round(q.score)} / 100
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
