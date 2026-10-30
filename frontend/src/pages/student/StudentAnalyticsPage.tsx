import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Award,
  BarChart3,
  CheckCircle2,
  Clock,
  Code2,
  Gauge,
  History,
  Percent,
  RefreshCw,
  TrendingUp,
  Trophy,
  XCircle,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { AiInteractionEfficiencyCard } from '../../components/analytics/AiInteractionEfficiencyCard';
import {
  CodingVsEfficiencyChart,
  CompletionHistoryChart,
  DifficultyPerformanceChart,
  ScoreTrendChart,
  TopicPerformanceChart,
} from '../../components/analytics/AnalyticsCharts';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Button } from '../../components/ui/Button';
import { InfoTooltip } from '../../components/ui/InfoTooltip';
import { AnalyticsDashboardSkeleton } from '../../components/ui/LoadingSkeleton';
import { formatElapsedTime } from './AssessmentResultsPage';
import { analyticsService } from '../../services/analyticsService';
import { extractApiErrorMessage } from '../../services/api';
import type { StudentAnalyticsOverview } from '../../types/analytics';

export function StudentAnalyticsPage() {
  const [analytics, setAnalytics] = useState<StudentAnalyticsOverview | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAnalytics = useCallback(async (isCancelled?: () => boolean) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await analyticsService.getStudentAnalytics();
      if (isCancelled?.()) return;
      setAnalytics(data);
    } catch (error) {
      if (isCancelled?.()) return;
      setErrorMessage(
        extractApiErrorMessage(
          error,
          'Unable to load student analytics right now. Please ensure the analytics service is running.'
        )
      );
    } finally {
      if (!isCancelled?.()) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadAnalytics(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadAnalytics]);

  const hasCompletedAssessments =
    (analytics?.total_assessments_completed ?? 0) > 0 ||
    (analytics?.recent_history.length ?? 0) > 0;

  const hasOfficialEfficiency =
    typeof analytics?.ai_efficiency_score === 'number' &&
    Number.isFinite(analytics.ai_efficiency_score);

  return (
    <DashboardShell role="student">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Performance Intelligence &amp; Analytics
            </h1>
            <p className="text-sm text-slate-600">
              Real-time evaluation metrics across portfolio-calibrated assessments, coding accuracy, AI interaction efficiency, consistency, and growth trajectory.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/student/history"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Full History</span>
            </Link>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => void loadAnalytics()}
              leftIcon={
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
                />
              }
            >
              Refresh Analytics
            </Button>
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <AlertBanner
            variant="error"
            title="Analytics Unavailable"
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
          />
        )}

        {/* Loading Skeleton State */}
        {isLoading ? (
          <AnalyticsDashboardSkeleton />
        ) : !analytics || !hasCompletedAssessments ? (
          /* Empty State when student has completed zero assessments */
          <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <BarChart3 className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="space-y-1.5">
              <h2 className="text-base font-semibold text-slate-900">
                No Completed Assessments Yet
              </h2>
              <p className="mx-auto max-w-md text-xs text-slate-500 leading-relaxed">
                Complete your first personalized technical assessment to unlock real score trends, topic and difficulty breakdowns, consistency tracking, and official backend AI efficiency scores.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <Link
                to="/student/portfolio"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Calibrate Portfolio
              </Link>
              <Link
                to="/student/assessment/instructions"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <span>Start First Assessment</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </section>
        ) : (
          <>
            {/* Primary Metrics Row (Metrics 1, 2, 3, 4, 5) */}
            <section
              aria-label="Primary performance metrics"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
            >
              {/* 1. Overall Assessment Score */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Overall Assessment Score</span>
                  <Award className="h-4 w-4 text-blue-600" aria-hidden="true" />
                </div>
                <p className="text-2xl font-bold tabular-nums text-slate-900">
                  {Math.round(analytics.overall_score)}
                  <span className="text-sm font-medium text-slate-500">
                    {' '}
                    / 100
                  </span>
                </p>
                <p className="text-xs text-slate-500">Composite evaluation</p>
              </div>

              {/* 2. Coding Score */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Coding Score</span>
                  <Code2
                    className="h-4 w-4 text-emerald-600"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-2xl font-bold tabular-nums text-slate-900">
                  {Math.round(analytics.coding_score)}
                  <span className="text-sm font-medium text-slate-500">
                    {' '}
                    / 100
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  Deterministic test accuracy
                </p>
              </div>

              {/* 3. AI Efficiency Score (Strictly Backend-Returned Only) */}
              <div className="rounded-xl border border-blue-200/80 bg-blue-50/30 p-5 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                  <span className="inline-flex items-center gap-1">
                    <span>AI Efficiency Score</span>
                    <InfoTooltip label="About AI Efficiency Score">
                      Official AI Efficiency Score computed exclusively by the backend grading engine based on progressive hint usage and solution optimality. Never calculated in the frontend.
                    </InfoTooltip>
                  </span>
                  <Gauge className="h-4 w-4 text-blue-600" aria-hidden="true" />
                </div>
                {hasOfficialEfficiency ? (
                  <p className="text-2xl font-bold tabular-nums text-slate-900">
                    {Math.round(analytics.ai_efficiency_score as number)}
                    <span className="text-sm font-medium text-slate-500">
                      {' '}
                      / 100
                    </span>
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-slate-600 pt-1">
                    Pending Backend
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  Official backend metric
                </p>
              </div>

              {/* 4. Total Assessments Completed */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Assessments Completed</span>
                  <CheckCircle2
                    className="h-4 w-4 text-emerald-600"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-2xl font-bold tabular-nums text-slate-900">
                  {analytics.total_assessments_completed}
                </p>
                <p className="text-xs text-slate-500">
                  Out of {analytics.total_assessments_assigned} total sessions
                </p>
              </div>

              {/* 5 & 6. Average Score & Highest Score */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Average / Highest Score</span>
                  <Trophy
                    className="h-4 w-4 text-amber-600"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-2xl font-bold tabular-nums text-slate-900">
                  {Math.round(analytics.average_score)}%
                  <span className="text-xs font-semibold text-emerald-700 ml-1.5">
                    Peak {Math.round(analytics.highest_score)}%
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  Mean and highest session scores
                </p>
              </div>
            </section>

            {/* Secondary Metrics Row (Metrics 7, 8, 9, 10, 14, 15) */}
            <section
              aria-label="Detailed operational and trajectory metrics"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
            >
              {/* 7. Assessment Completion Rate */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Completion Rate</span>
                  <Percent className="h-4 w-4 text-slate-500" aria-hidden="true" />
                </div>
                <p className="text-xl font-bold tabular-nums text-slate-900">
                  {Math.round(analytics.completion_rate)}%
                </p>
                <p className="text-xs text-slate-500">
                  Finished vs started sessions
                </p>
              </div>

              {/* 8 & 9. Correct & Failed Test Cases */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Test Case Accuracy</span>
                  <CheckCircle2
                    className="h-4 w-4 text-emerald-600"
                    aria-hidden="true"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2.5 text-sm font-bold tabular-nums">
                  <span className="text-emerald-700">
                    {analytics.correct_test_cases} Correct
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-red-700">
                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{analytics.failed_test_cases} Failed</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {analytics.total_test_cases} total sandbox evaluations
                </p>
              </div>

              {/* 10. Average Completion Time */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Avg Completion Time</span>
                  <Clock className="h-4 w-4 text-slate-500" aria-hidden="true" />
                </div>
                <p className="text-xl font-bold tabular-nums text-slate-900">
                  {formatElapsedTime(
                    analytics.average_completion_time_seconds
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  Mean assessment duration
                </p>
              </div>

              {/* 14. Performance Improvement Over Time */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Improvement Over Time</span>
                  <TrendingUp
                    className="h-4 w-4 text-emerald-600"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-xl font-bold tabular-nums text-slate-900">
                  {analytics.improvement_percentage !== null
                    ? `${
                        analytics.improvement_percentage >= 0 ? '+' : ''
                      }${analytics.improvement_percentage.toFixed(1)}%`
                    : 'Baseline'}
                </p>
                <p className="text-xs text-slate-500">
                  {analytics.improvement_label}
                </p>
              </div>

              {/* 15. Consistency Across Assessments */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Consistency Score</span>
                  <Activity
                    className="h-4 w-4 text-blue-600"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-xl font-bold tabular-nums text-slate-900">
                  {analytics.consistency_score !== null
                    ? `${Math.round(analytics.consistency_score)} / 100`
                    : 'Baseline'}
                </p>
                <p className="text-xs text-slate-500">
                  {analytics.consistency_label}
                </p>
              </div>
            </section>

            {/* Module 2: AI Interaction & Efficiency Display */}
            <AiInteractionEfficiencyCard
              totalHintRequests={analytics.ai_interaction.total_hint_requests}
              hintLevelsUsed={analytics.ai_interaction.hint_levels_used}
              usedOrViewedHints={analytics.ai_interaction.used_or_viewed_hints}
              aiAssistanceLabel={
                analytics.ai_interaction.ai_assistance_usage_label
              }
              codingScore={analytics.ai_interaction.coding_score}
              backendAiEfficiencyScore={
                analytics.ai_interaction.ai_efficiency_score
              }
            />

            {/* 5 Analytics Charts Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Chart 1: Score Trend Over Time */}
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Score Trend Over Time
                  </h2>
                  <p className="text-xs text-slate-500">
                    Chronological progression of composite assessment scores across completed sessions.
                  </p>
                </div>
                <ScoreTrendChart data={analytics.score_trend} />
              </section>

              {/* Chart 5: Coding Score vs AI Efficiency Score */}
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Coding Score vs AI Efficiency Score
                  </h2>
                  <p className="text-xs text-slate-500">
                    Side-by-side comparison of deterministic coding accuracy against official backend AI efficiency ratings.
                  </p>
                </div>
                <CodingVsEfficiencyChart data={analytics.score_trend} />
              </section>

              {/* Chart 2 & Metric 12: Topic-Wise Performance */}
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Topic-Wise Performance
                  </h2>
                  <p className="text-xs text-slate-500">
                    Average coding mastery segmented by calibrated engineering domain and topic.
                  </p>
                </div>
                <TopicPerformanceChart data={analytics.topic_performance} />
              </section>

              {/* Chart 3 & Metric 13: Difficulty-Wise Performance */}
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Difficulty-Wise Performance
                  </h2>
                  <p className="text-xs text-slate-500">
                    Mean performance across Easy, Medium, Hard, and Adaptive challenge tiers.
                  </p>
                </div>
                <DifficultyPerformanceChart
                  data={analytics.difficulty_performance}
                />
              </section>
            </div>

            {/* Chart 4 & Metric 11: Assessment Completion History & Recent Assessment History */}
            <div className="grid gap-6 lg:grid-cols-12">
              <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Assessment Completion History
                  </h2>
                  <p className="text-xs text-slate-500">
                    Distribution of completed, partially completed, active, and expired sessions.
                  </p>
                </div>
                <CompletionHistoryChart history={analytics.recent_history} />
              </section>

              <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Recent Assessment History
                    </h2>
                    <p className="text-xs text-slate-500">
                      Most recent technical evaluations with direct access to detailed reports.
                    </p>
                  </div>
                  <Link
                    to="/student/history"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    <span>View All</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>

                {analytics.recent_history.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">
                    No recent assessments recorded yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {analytics.recent_history.slice(0, 5).map((item) => (
                      <li
                        key={item.assessment_id}
                        className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-slate-900">
                            {item.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.date
                              ? new Date(item.date).toLocaleDateString()
                              : 'Recent session'}{' '}
                            &middot; {item.question_count}{' '}
                            {item.question_count === 1
                              ? 'question'
                              : 'questions'}{' '}
                            &middot; {formatElapsedTime(item.duration_seconds)}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right text-xs">
                            <p className="font-bold text-slate-900 tabular-nums">
                              {Math.round(item.overall_score)} / 100
                            </p>
                            <p className="text-[11px] text-slate-500 tabular-nums">
                              AI Eff:{' '}
                              {typeof item.ai_efficiency_score === 'number'
                                ? `${Math.round(item.ai_efficiency_score)}`
                                : 'Pending'}
                            </p>
                          </div>

                          <Link
                            to={`/student/assessment/${encodeURIComponent(
                              item.assessment_id
                            )}/results`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                          >
                            <span>Results</span>
                            <ArrowRight
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

