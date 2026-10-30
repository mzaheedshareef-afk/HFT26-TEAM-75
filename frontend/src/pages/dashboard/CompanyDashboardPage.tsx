import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { ScoreSummaryCard } from '../../components/assessment/ScoreSummaryCard';
import { Button } from '../../components/ui/Button';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { useAuth } from '../../context/AuthContext';
import { recruiterService } from '../../services/recruiterService';
import { extractApiErrorMessage } from '../../services/api';
import type {
  CandidateEvaluationRecord,
  CandidateEvaluationStatus,
  CompanyOverviewMetrics,
} from '../../types/recruiter';

const statusBadgeStyles: Record<
  CandidateEvaluationStatus,
  { label: string; className: string }
> = {
  awaiting_portfolio: {
    label: 'Awaiting Portfolio',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
  },
  ready_for_assessment: {
    label: 'Ready for Assessment',
    className: 'border-blue-200 bg-blue-50 text-blue-800',
  },
  in_progress: {
    label: 'In Progress',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  evaluated: {
    label: 'Evaluated',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
};

export function CompanyDashboardPage() {
  const { user } = useAuth();

  const [metrics, setMetrics] = useState<CompanyOverviewMetrics>({
    total_candidates: 0,
    evaluated_candidates: 0,
    in_progress_candidates: 0,
    average_overall_score: null,
  });
  const [candidates, setCandidates] = useState<CandidateEvaluationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchNotice, setFetchNotice] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCandidate, setSelectedCandidate] =
    useState<CandidateEvaluationRecord | null>(null);

  const loadCandidates = useCallback(async (isCancelled?: () => boolean) => {
    setIsLoading(true);
    setFetchNotice(null);
    try {
      const data = await recruiterService.getCandidateEvaluations();
      if (isCancelled?.()) return;
      setMetrics(data.metrics);
      setCandidates(data.candidates);
    } catch (error) {
      if (isCancelled?.()) return;
      setFetchNotice(
        extractApiErrorMessage(
          error,
          'Recruiter candidate analytics service is not currently reachable.'
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
    void loadCandidates(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadCandidates]);

  const filteredCandidates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return candidates.filter((c) => {
      const matchesStatus =
        statusFilter === 'all' || c.evaluation_status === statusFilter;
      const matchesQuery =
        !query ||
        c.full_name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.primary_stack.some((s) => s.toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [candidates, searchQuery, statusFilter]);

  return (
    <DashboardShell role="company">
      <div className="space-y-8">
        {/* Company Welcome Header */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2
                  className="h-4 w-4 text-emerald-600"
                  aria-hidden="true"
                />
                <span>Authenticated Company Session</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Welcome, {user?.name || 'Company Team'}
              </h1>
              <p className="text-sm text-slate-600">
                Review portfolio-calibrated candidate evaluations, deterministic grading scores, and AI efficiency reports.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {user && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-600">
                  <span className="font-medium text-slate-800">Org ID:</span>{' '}
                  <span className="font-mono">{user.id}</span> &middot;{' '}
                  <span className="uppercase font-mono">{user.role}</span>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading}
                onClick={() => void loadCandidates()}
                leftIcon={
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
                  />
                }
              >
                Refresh Candidates
              </Button>
            </div>
          </div>
        </section>

        {fetchNotice && (
          <AlertBanner
            variant="info"
            title="Recruiter Service Notice"
            message={fetchNotice}
            onDismiss={() => setFetchNotice(null)}
          />
        )}

        {/* KPI Summary Strip */}
        <section
          aria-label="Hiring overview metrics"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Total Candidates</span>
              <Users className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
              {metrics.total_candidates}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Evaluated</span>
              <CheckCircle2
                className="h-4 w-4 text-emerald-500"
                aria-hidden="true"
              />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
              {metrics.evaluated_candidates}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Assessments In Progress</span>
              <Clock className="h-4 w-4 text-amber-500" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
              {metrics.in_progress_candidates}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Average Overall Score</span>
              <Award className="h-4 w-4 text-blue-600" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
              {metrics.average_overall_score !== null
                ? `${Math.round(metrics.average_overall_score)}%`
                : '—'}
            </p>
          </div>
        </section>

        {/* Candidate Evaluation Directory */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 p-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Candidate Evaluations
              </h2>
              <p className="text-xs text-slate-500">
                Real-time technical assessment outcomes synced from the recruiter service.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label="Filter candidates by name, email, or stack"
                  placeholder="Search name, email, or stack..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-60 rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                />
              </div>

              <select
                aria-label="Filter by evaluation status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="evaluated">Evaluated</option>
                <option value="in_progress">In Progress</option>
                <option value="ready_for_assessment">
                  Ready for Assessment
                </option>
                <option value="awaiting_portfolio">Awaiting Portfolio</option>
              </select>
            </div>
          </div>

          {filteredCandidates.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Users className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-sm font-semibold text-slate-900">
                {candidates.length === 0
                  ? 'No Candidate Evaluations Available Yet'
                  : 'No Candidates Match Your Filter'}
              </h3>
              <p className="mx-auto max-w-md text-xs text-slate-500 leading-relaxed">
                {candidates.length === 0
                  ? 'Candidate profiles, portfolio stacks, and graded submission scores will appear here automatically once candidates complete assessments on the backend.'
                  : 'Try clearing your search query or switching the status filter to view all candidates.'}
              </p>
            </div>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="candidate-evaluations-caption"
              className="responsive-table-wrapper"
            >
              <table className="responsive-table text-left text-xs">
                <caption
                  id="candidate-evaluations-caption"
                  className="sr-only"
                >
                  Candidate technical evaluation directory
                </caption>
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Candidate
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Primary Stack
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Portfolio
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Assessment Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Overall Score
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold text-right">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCandidates.map((candidate) => {
                    const badge =
                      statusBadgeStyles[candidate.evaluation_status];
                    return (
                      <tr
                        key={candidate.candidate_id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <th
                          scope="row"
                          className="px-5 py-3.5 font-medium text-slate-900"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {candidate.full_name}
                            </p>
                            <p className="text-xs font-normal text-slate-500">
                              {candidate.email}
                            </p>
                          </div>
                        </th>

                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {candidate.primary_stack.length > 0 ? (
                              candidate.primary_stack.map((tech) => (
                                <span
                                  key={tech}
                                  className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-medium text-slate-700"
                                >
                                  {tech}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400">Unspecified</span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          {candidate.github_url ? (
                            <a
                              href={candidate.github_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                            >
                              <span>GitHub</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400">Not linked</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 font-semibold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 font-semibold tabular-nums text-slate-900">
                          {candidate.latest_score
                            ? `${Math.round(
                                candidate.latest_score.overall_score
                              )} / 100`
                            : '—'}
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCandidate(candidate)}
                          >
                            View Report
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Selected Candidate Score Breakdown Panel */}
        {selectedCandidate && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Candidate Score Report &middot; {selectedCandidate.full_name}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>Close Report</span>
              </button>
            </div>

            <ScoreSummaryCard
              summary={selectedCandidate.latest_score ?? null}
              emptyTitle="No Graded Submission for This Candidate Yet"
              emptyDescription="This candidate has not completed a graded coding assessment submission yet."
            />
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
