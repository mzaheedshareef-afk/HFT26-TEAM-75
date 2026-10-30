import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  Filter,
  History,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Button } from '../../components/ui/Button';
import { InfoTooltip } from '../../components/ui/InfoTooltip';
import { HistoryTableSkeleton } from '../../components/ui/LoadingSkeleton';
import { formatElapsedTime } from './AssessmentResultsPage';
import { analyticsService } from '../../services/analyticsService';
import { extractApiErrorMessage } from '../../services/api';
import type { AssessmentHistoryItem } from '../../types/analytics';
import type { AssessmentCompletionStatus } from '../../types/assessment';

type DateRangeFilter = 'all' | '7d' | '30d' | '90d';
type ScoreThresholdFilter = 'all' | '80' | '60' | '40' | 'below_60';
type StatusFilter = 'all' | AssessmentCompletionStatus;

const statusBadgeStyles: Record<
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
  in_progress: {
    label: 'In Progress',
    className: 'border-blue-200 bg-blue-50 text-blue-800',
  },
  expired: {
    label: 'Time Expired',
    className: 'border-red-200 bg-red-50 text-red-800',
  },
};

export function AssessmentHistoryPage() {
  const [historyItems, setHistoryItems] = useState<AssessmentHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('all');
  const [fromDateInput, setFromDateInput] = useState('');
  const [scoreFilter, setScoreFilter] = useState<ScoreThresholdFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const loadHistory = useCallback(async (isCancelled?: () => boolean) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const items = await analyticsService.getAssessmentHistory();
      if (isCancelled?.()) return;
      setHistoryItems(items);
    } catch (error) {
      if (isCancelled?.()) return;
      setErrorMessage(
        extractApiErrorMessage(
          error,
          'Unable to load assessment performance history. Ensure the backend service is running.'
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
    void loadHistory(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadHistory]);

  const hasActiveFilters =
    dateFilter !== 'all' ||
    fromDateInput !== '' ||
    scoreFilter !== 'all' ||
    statusFilter !== 'all';

  const handleResetFilters = () => {
    setDateFilter('all');
    setFromDateInput('');
    setScoreFilter('all');
    setStatusFilter('all');
  };

  const filteredItems = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    return historyItems.filter((item) => {
      // 1. Status filter
      if (statusFilter !== 'all' && item.completion_status !== statusFilter) {
        return false;
      }

      // 2. Score filter
      if (scoreFilter === '80' && item.overall_score < 80) return false;
      if (scoreFilter === '60' && item.overall_score < 60) return false;
      if (scoreFilter === '40' && item.overall_score < 40) return false;
      if (scoreFilter === 'below_60' && item.overall_score >= 60) return false;

      // 3. Date preset filter
      if (dateFilter !== 'all') {
        if (!item.date) return false;
        const itemTime = new Date(item.date).getTime();
        if (Number.isNaN(itemTime)) return false;

        const maxAgeDays =
          dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : 90;
        if (now - itemTime > maxAgeDays * dayMs) {
          return false;
        }
      }

      // 4. Exact From-Date calendar filter
      if (fromDateInput) {
        if (!item.date) return false;
        const itemTime = new Date(item.date).getTime();
        const fromTime = new Date(`${fromDateInput}T00:00:00`).getTime();
        if (Number.isNaN(itemTime) || itemTime < fromTime) {
          return false;
        }
      }

      return true;
    });
  }, [dateFilter, fromDateInput, historyItems, scoreFilter, statusFilter]);

  return (
    <DashboardShell role="student">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Student Performance History
            </h1>
            <p className="text-sm text-slate-600">
              Review all personalized technical assessments, coding scores, official backend AI efficiency ratings, durations, and detailed evaluation reports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/student/analytics"
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Analytics Overview
            </Link>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => void loadHistory()}
              leftIcon={
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
                />
              }
            >
              Refresh History
            </Button>
          </div>
        </div>

        {errorMessage && (
          <AlertBanner
            variant="error"
            title="History Service Error"
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
          />
        )}

        {/* Interactive Filters Bar: Date, Score, Assessment Status */}
        <section
          aria-label="Assessment history filters"
          className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <Filter className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
              <span>Filter Performance Records</span>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Date Range Select */}
            <div className="space-y-1">
              <label
                htmlFor="history-date-range"
                className="block text-xs font-medium text-slate-600"
              >
                Date Range
              </label>
              <select
                id="history-date-range"
                aria-label="Filter by date range"
                value={dateFilter}
                onChange={(e) =>
                  setDateFilter(e.target.value as DateRangeFilter)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="all">All Dates</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
            </div>

            {/* Specific From Date Input */}
            <div className="space-y-1">
              <label
                htmlFor="history-from-date"
                className="block text-xs font-medium text-slate-600"
              >
                From Date
              </label>
              <div className="relative">
                <input
                  id="history-from-date"
                  type="date"
                  aria-label="Filter from date"
                  value={fromDateInput}
                  onChange={(e) => setFromDateInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Score Filter */}
            <div className="space-y-1">
              <label
                htmlFor="history-score-filter"
                className="block text-xs font-medium text-slate-600"
              >
                Score Threshold
              </label>
              <select
                id="history-score-filter"
                aria-label="Filter by score"
                value={scoreFilter}
                onChange={(e) =>
                  setScoreFilter(e.target.value as ScoreThresholdFilter)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="all">All Scores</option>
                <option value="80">80+ (Distinction)</option>
                <option value="60">60+ (Proficient)</option>
                <option value="40">40+ (Developing)</option>
                <option value="below_60">Below 60</option>
              </select>
            </div>

            {/* Assessment Status Filter */}
            <div className="space-y-1">
              <label
                htmlFor="history-status-filter"
                className="block text-xs font-medium text-slate-600"
              >
                Assessment Status
              </label>
              <select
                id="history-status-filter"
                aria-label="Filter by assessment status"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="partially_completed">Partially Completed</option>
                <option value="in_progress">In Progress</option>
                <option value="expired">Time Expired</option>
              </select>
            </div>
          </div>
        </section>

        {/* History Records */}
        {isLoading ? (
          <HistoryTableSkeleton />
        ) : historyItems.length === 0 ? (
          <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <History className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="space-y-1.5">
              <h2 className="text-base font-semibold text-slate-900">
                No Assessment History Recorded Yet
              </h2>
              <p className="mx-auto max-w-md text-xs text-slate-500 leading-relaxed">
                Once you generate and complete personalized coding assessments, every session will appear here with scores, durations, and full evaluation links.
              </p>
            </div>
            <Link
              to="/student/assessment/instructions"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <span>Start an Assessment</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </section>
        ) : filteredItems.length === 0 ? (
          <section className="rounded-xl border border-slate-200 bg-white p-10 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              No assessments match your current filters
            </p>
            <p className="text-xs text-slate-500">
              Showing 0 of {historyItems.length} recorded assessments. Adjust your date, score, or status filters.
            </p>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
              >
                Clear All Filters
              </Button>
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Assessment Sessions ({filteredItems.length} of{' '}
                {historyItems.length})
              </h2>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Click View Results to inspect question-level telemetry</span>
              </span>
            </div>

            <div
              tabIndex={0}
              role="region"
              aria-labelledby="student-history-table-caption"
              className="responsive-table-wrapper"
            >
              <table
                className="responsive-table text-left text-xs"
                style={
                  {
                    '--col-stack': '"Date"',
                    '--col-portfolio': '"Score"',
                    '--col-status': '"Coding Score"',
                    '--col-score': '"AI Efficiency"',
                    '--col-actions': '"Duration"',
                    '--col-extra-1': '"Questions"',
                    '--col-extra-2': '"Status"',
                    '--col-extra-3': '"Details"',
                  } as React.CSSProperties
                }
              >
                <caption id="student-history-table-caption" className="sr-only">
                  Student technical assessment performance history
                </caption>
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Assessment Title
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Date
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Score
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Coding Score
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      <span className="inline-flex items-center gap-1">
                        <span>AI Efficiency</span>
                        <InfoTooltip label="About AI Efficiency Score in history">
                          Official AI Efficiency Score returned by the backend grading engine. Never calculated in the frontend.
                        </InfoTooltip>
                      </span>
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Duration
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Questions
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Completion Status
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 font-semibold text-right"
                    >
                      Report
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const badge =
                      statusBadgeStyles[item.completion_status] ??
                      statusBadgeStyles.completed;
                    const hasEfficiency =
                      typeof item.ai_efficiency_score === 'number' &&
                      Number.isFinite(item.ai_efficiency_score);

                    return (
                      <tr
                        key={item.assessment_id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <th
                          scope="row"
                          className="px-5 py-3.5 font-semibold text-slate-900"
                        >
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-slate-900">
                              {item.title}
                            </p>
                            {item.topics.length > 0 && (
                              <p className="text-[11px] font-normal text-slate-500">
                                {item.topics.slice(0, 3).join(' · ')}
                              </p>
                            )}
                          </div>
                        </th>

                        <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                          {item.date
                            ? new Date(item.date).toLocaleDateString()
                            : 'N/A'}
                        </td>

                        <td className="px-4 py-3.5 font-bold tabular-nums text-slate-900">
                          {Math.round(item.overall_score)} / 100
                        </td>

                        <td className="px-4 py-3.5 font-semibold tabular-nums text-slate-800">
                          {Math.round(item.coding_score)} / 100
                        </td>

                        <td className="px-4 py-3.5 tabular-nums text-slate-700">
                          {hasEfficiency ? (
                            <span className="font-semibold text-blue-800">
                              {Math.round(item.ai_efficiency_score as number)} /
                              100
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              Pending Backend
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 tabular-nums text-slate-600 whitespace-nowrap">
                          {formatElapsedTime(item.duration_seconds)}
                        </td>

                        <td className="px-4 py-3.5 tabular-nums text-slate-700">
                          {item.question_count}{' '}
                          {item.question_count === 1 ? 'Question' : 'Questions'}
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 font-semibold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <Link
                            to={`/student/assessment/${encodeURIComponent(
                              item.assessment_id
                            )}/results`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:border-blue-600 hover:text-blue-600 transition-colors"
                          >
                            <span>View Results</span>
                            <ArrowRight
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}

