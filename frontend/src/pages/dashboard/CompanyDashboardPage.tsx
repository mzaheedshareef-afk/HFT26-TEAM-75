import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Award,
  Bookmark,
  BookmarkCheck,
  Building2,
  CheckCircle2,
  Code2,
  ExternalLink,
  Gauge,
  GitCompareArrows,
  Globe,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { RecruiterShell } from '../../components/recruiter/RecruiterShell';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Button } from '../../components/ui/Button';
import { InfoTooltip } from '../../components/ui/InfoTooltip';
import { RecruiterDashboardSkeleton } from '../../components/ui/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';
import { useRecruiterWorkspace } from '../../context/RecruiterWorkspaceContext';
import {
  DuplicateShortlistError,
  recruiterService,
} from '../../services/recruiterService';
import { extractApiErrorMessage } from '../../services/api';
import {
  MAX_COMPARISON_CANDIDATES,
  type RecruiterCandidateSummary,
  type RecruiterDashboardOverview,
} from '../../types/recruiter';

export function CompanyDashboardPage() {
  const { user } = useAuth();
  const {
    isInComparison,
    toggleComparisonCandidate,
    shortlistedIds,
    syncShortlistedIds,
    setShortlistedStatus,
  } = useRecruiterWorkspace();

  const [overview, setOverview] = useState<RecruiterDashboardOverview | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [shortlistBusyId, setShortlistBusyId] = useState<string | null>(null);

  const loadDashboard = useCallback(
    async (isCancelled?: () => boolean) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await recruiterService.getDashboardOverview();
        if (isCancelled?.()) return;
        setOverview(data);
        syncShortlistedIds(
          data.shortlisted_candidates.map((entry) => entry.candidate_id)
        );
      } catch (error) {
        if (isCancelled?.()) return;
        setErrorMessage(
          extractApiErrorMessage(
            error,
            'Recruiter dashboard service is not currently reachable.'
          )
        );
      } finally {
        if (!isCancelled?.()) {
          setIsLoading(false);
        }
      }
    },
    [syncShortlistedIds]
  );

  useEffect(() => {
    let cancelled = false;
    void loadDashboard(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadDashboard]);

  const handleToggleShortlist = async (
    candidate: RecruiterCandidateSummary
  ) => {
    if (shortlistBusyId) return;
    setShortlistBusyId(candidate.candidate_id);
    setFeedbackBanner(null);

    const currentlyShortlisted = shortlistedIds.has(candidate.candidate_id);

    try {
      if (currentlyShortlisted) {
        await recruiterService.removeFromShortlist(candidate.candidate_id);
        setShortlistedStatus(candidate.candidate_id, false);
        setOverview((prev) =>
          prev
            ? {
                ...prev,
                total_shortlisted_candidates: Math.max(
                  0,
                  prev.total_shortlisted_candidates - 1
                ),
                shortlisted_candidates: prev.shortlisted_candidates.filter(
                  (item) => item.candidate_id !== candidate.candidate_id
                ),
              }
            : prev
        );
      } else {
        const entry = await recruiterService.addToShortlist({
          candidateId: candidate.candidate_id,
          candidateSnapshot: candidate,
        });
        setShortlistedStatus(candidate.candidate_id, true);
        setOverview((prev) =>
          prev
            ? {
                ...prev,
                total_shortlisted_candidates:
                  prev.total_shortlisted_candidates + 1,
                shortlisted_candidates: [entry, ...prev.shortlisted_candidates],
              }
            : prev
        );
      }
    } catch (error) {
      if (error instanceof DuplicateShortlistError) {
        setShortlistedStatus(candidate.candidate_id, true);
        setFeedbackBanner(error.message);
      } else {
        setErrorMessage(
          extractApiErrorMessage(
            error,
            'Unable to update shortlist right now.'
          )
        );
      }
    } finally {
      setShortlistBusyId(null);
    }
  };

  const handleToggleCompare = (candidate: RecruiterCandidateSummary) => {
    const result = toggleComparisonCandidate({
      candidate_id: candidate.candidate_id,
      display_name: candidate.display_name,
      headline: candidate.headline,
    });
    if (result.limitReached) {
      setFeedbackBanner(
        `You can select up to ${MAX_COMPARISON_CANDIDATES} candidates for side-by-side comparison.`
      );
    }
  };

  const resolvedCompanyName =
    overview?.company_profile.company_name || user?.name || 'Company Team';

  return (
    <RecruiterShell>
      <div className="space-y-7">
        {/* Company Welcome & Quick Actions Header */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-7 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2
                  className="h-4 w-4 text-emerald-600"
                  aria-hidden="true"
                />
                <span>Authenticated Company Session</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Welcome, {resolvedCompanyName}
              </h1>
              <p className="text-sm text-slate-600">
                Discover portfolio-calibrated engineering candidates, evaluate sandbox-verified coding performance, and manage your company shortlist.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                to="/company/candidates"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Find Candidates</span>
              </Link>

              <Link
                to="/company/compare"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Compare Candidates</span>
              </Link>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading}
                onClick={() => void loadDashboard()}
                leftIcon={
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                }
              >
                Refresh
              </Button>
            </div>
          </div>
        </section>

        {errorMessage && (
          <AlertBanner
            variant="info"
            title="Recruiter Dashboard Notice"
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
          />
        )}

        {feedbackBanner && (
          <AlertBanner
            variant="info"
            title="Recruiter Workspace"
            message={feedbackBanner}
            onDismiss={() => setFeedbackBanner(null)}
          />
        )}

        {isLoading && !overview ? (
          <RecruiterDashboardSkeleton />
        ) : (
          overview && (
            <>
              {/* Top KPI & Platform Statistics Row */}
              <section
                aria-label="Recruiter overview and platform statistics"
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Total Available Candidates</span>
                    <Users
                      className="h-4 w-4 text-blue-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-slate-900">
                    {overview.total_available_candidates}
                  </p>
                  <p className="text-xs text-slate-500">
                    Opted-in public &amp; recruiter profiles
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Total Shortlisted Candidates</span>
                    <BookmarkCheck
                      className="h-4 w-4 text-emerald-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-slate-900">
                    {overview.total_shortlisted_candidates}
                  </p>
                  <p className="text-xs text-slate-500">
                    Saved privately to your company
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Platform Verified Assessments</span>
                    <ShieldCheck
                      className="h-4 w-4 text-emerald-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-slate-900">
                    {overview.platform_statistics.total_verified_assessments}
                  </p>
                  <p className="text-xs text-slate-500">
                    Avg Score:{' '}
                    {overview.platform_statistics.average_assessment_score !==
                    null
                      ? `${Math.round(
                          overview.platform_statistics.average_assessment_score
                        )}%`
                      : '—'}
                  </p>
                </div>

                <div className="rounded-xl border border-blue-200/80 bg-blue-50/30 p-5 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                    <span className="inline-flex items-center gap-1">
                      <span>Platform Coding / AI Efficiency</span>
                      <InfoTooltip label="Platform AI Efficiency Score benchmark">
                        Aggregate official AI Efficiency Score computed exclusively on the backend across completed candidate assessments.
                      </InfoTooltip>
                    </span>
                    <Gauge
                      className="h-4 w-4 text-blue-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-xl font-bold tabular-nums text-slate-900">
                    {overview.platform_statistics.average_coding_score !== null
                      ? `${Math.round(
                          overview.platform_statistics.average_coding_score
                        )}%`
                      : '—'}{' '}
                    <span className="text-xs font-medium text-slate-500">
                      Coding
                    </span>{' '}
                    &middot;{' '}
                    {overview.platform_statistics
                      .average_ai_efficiency_score !== null
                      ? `${Math.round(
                          overview.platform_statistics
                            .average_ai_efficiency_score
                        )}%`
                      : '—'}{' '}
                    <span className="text-xs font-medium text-slate-500">
                      AI Eff.
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {overview.platform_statistics.top_verified_skills.length > 0
                      ? `Top skills: ${overview.platform_statistics.top_verified_skills
                          .slice(0, 3)
                          .join(', ')}`
                      : 'Sandbox-graded benchmarks'}
                  </p>
                </div>
              </section>

              {/* Company Profile Summary + Saved Searches Row */}
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Company Profile Card */}
                <section
                  aria-labelledby="dashboard-company-profile-heading"
                  className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4"
                >
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                        <Building2 className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h2
                          id="dashboard-company-profile-heading"
                          className="text-base font-semibold text-slate-900"
                        >
                          {overview.company_profile.company_name}
                        </h2>
                        <p className="text-xs text-slate-500">
                          {overview.company_profile.industry}
                          {overview.company_profile.headquarters
                            ? ` · ${overview.company_profile.headquarters}`
                            : ''}
                          {overview.company_profile.company_size
                            ? ` · ${overview.company_profile.company_size}`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <Link
                      to="/company/profile"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Edit Company Profile
                    </Link>
                  </div>

                  {overview.company_profile.description ? (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {overview.company_profile.description}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Add your engineering mission, hiring domains, and target technical roles in Company Profile settings.
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {overview.company_profile.website_url && (
                      <a
                        href={overview.company_profile.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-blue-700 hover:underline"
                      >
                        <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Website</span>
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    )}

                    {overview.company_profile.hiring_domains.map((domain) => (
                      <span
                        key={domain}
                        className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 font-medium text-blue-800"
                      >
                        {domain}
                      </span>
                    ))}

                    {overview.company_profile.preferred_languages.map(
                      (lang) => (
                        <span
                          key={lang}
                          className="rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 font-medium text-slate-700"
                        >
                          {lang}
                        </span>
                      )
                    )}
                  </div>
                </section>

                {/* Saved Candidate Searches */}
                <section
                  aria-labelledby="dashboard-saved-searches-heading"
                  className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h2
                      id="dashboard-saved-searches-heading"
                      className="text-base font-semibold text-slate-900"
                    >
                      Saved Candidate Searches
                    </h2>
                    <Sparkles
                      className="h-4 w-4 text-blue-600"
                      aria-hidden="true"
                    />
                  </div>

                  {overview.saved_searches.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-500 space-y-2">
                      <p>
                        No saved candidate searches yet. Configure filters in Find Candidates and click <strong>Save Search</strong> for one-click access.
                      </p>
                      <Link
                        to="/company/candidates"
                        className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"
                      >
                        <span>Configure search filters</span>
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    </div>
                  ) : (
                    <ul className="space-y-2.5">
                      {overview.saved_searches.slice(0, 4).map((saved) => (
                        <li key={saved.id}>
                          <Link
                            to={`/company/candidates${
                              saved.query_string.startsWith('?')
                                ? saved.query_string
                                : saved.query_string
                                ? `?${saved.query_string}`
                                : ''
                            }`}
                            className="block rounded-lg border border-slate-200 bg-slate-50/60 p-3 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-900">
                                {saved.name}
                              </span>
                              <ArrowRight
                                className="h-3.5 w-3.5 text-blue-600 shrink-0"
                                aria-hidden="true"
                              />
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                              {saved.filters_summary}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              {/* Recently Added Candidates & Shortlisted Candidates + Activity */}
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Recently Added Candidates */}
                <section
                  aria-labelledby="recently-added-candidates-heading"
                  className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h2
                        id="recently-added-candidates-heading"
                        className="text-base font-semibold text-slate-900"
                      >
                        Recently Added Candidates
                      </h2>
                      <p className="text-xs text-slate-500">
                        Latest opted-in candidate profiles with verified assessment evidence.
                      </p>
                    </div>

                    <Link
                      to="/company/candidates"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                    >
                      <span>Browse All</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>

                  {overview.recently_added_candidates.length === 0 ? (
                    <div className="py-8 text-center space-y-2">
                      <Users
                        className="mx-auto h-6 w-6 text-slate-400"
                        aria-hidden="true"
                      />
                      <p className="text-sm font-semibold text-slate-900">
                        No Public Candidates Available Yet
                      </p>
                      <p className="mx-auto max-w-md text-xs text-slate-500">
                        Candidates appear here automatically once they enable public profile sharing and complete assessments.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {overview.recently_added_candidates.map((cand) => {
                        const isShortlisted = shortlistedIds.has(
                          cand.candidate_id
                        );
                        const inComp = isInComparison(cand.candidate_id);

                        return (
                          <div
                            key={cand.candidate_id}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  to={`/company/candidates/${encodeURIComponent(
                                    cand.candidate_id
                                  )}`}
                                  className="text-sm font-semibold text-slate-900 hover:text-blue-600"
                                >
                                  {cand.display_name}
                                </Link>
                                <span className="text-xs text-slate-500">
                                  &middot; {cand.headline}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                                <span className="inline-flex items-center gap-1 font-medium">
                                  <Award
                                    className="h-3.5 w-3.5 text-blue-600"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    Score:{' '}
                                    <strong>
                                      {cand.overall_score !== null
                                        ? `${Math.round(cand.overall_score)}/100`
                                        : '—'}
                                    </strong>
                                  </span>
                                </span>

                                <span className="inline-flex items-center gap-1 font-medium">
                                  <Code2
                                    className="h-3.5 w-3.5 text-emerald-600"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    Coding:{' '}
                                    <strong>
                                      {cand.coding_score !== null
                                        ? `${Math.round(cand.coding_score)}/100`
                                        : '—'}
                                    </strong>
                                  </span>
                                </span>

                                {cand.technical_skills.slice(0, 3).map((sk) => (
                                  <span
                                    key={sk}
                                    className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-700"
                                  >
                                    {sk}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <Button
                                type="button"
                                variant={isShortlisted ? 'secondary' : 'outline'}
                                size="sm"
                                isLoading={
                                  shortlistBusyId === cand.candidate_id
                                }
                                onClick={() => void handleToggleShortlist(cand)}
                                leftIcon={
                                  isShortlisted ? (
                                    <BookmarkCheck
                                      className="h-3.5 w-3.5"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Bookmark
                                      className="h-3.5 w-3.5"
                                      aria-hidden="true"
                                    />
                                  )
                                }
                              >
                                {isShortlisted ? 'Shortlisted' : 'Shortlist'}
                              </Button>

                              <Button
                                type="button"
                                variant={inComp ? 'accent' : 'outline'}
                                size="sm"
                                onClick={() => handleToggleCompare(cand)}
                              >
                                {inComp ? 'Comparing' : 'Compare'}
                              </Button>

                              <Link
                                to={`/company/candidates/${encodeURIComponent(
                                  cand.candidate_id
                                )}`}
                                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                              >
                                Profile
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Right Column: Shortlisted Candidates & Candidate Discovery Activity */}
                <div className="space-y-6">
                  {/* Shortlisted Candidates Preview */}
                  <section
                    aria-labelledby="dashboard-shortlist-heading"
                    className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h2
                        id="dashboard-shortlist-heading"
                        className="text-base font-semibold text-slate-900"
                      >
                        Shortlisted Candidates
                      </h2>
                      <Link
                        to="/company/shortlist"
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Manage ({overview.total_shortlisted_candidates})
                      </Link>
                    </div>

                    {overview.shortlisted_candidates.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Your company shortlist is currently empty. Shortlist promising candidates to track them and record private notes.
                      </p>
                    ) : (
                      <ul className="space-y-2.5">
                        {overview.shortlisted_candidates
                          .slice(0, 4)
                          .map((entry) => (
                            <li
                              key={entry.shortlist_id}
                              className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <Link
                                  to={`/company/candidates/${encodeURIComponent(
                                    entry.candidate_id
                                  )}`}
                                  className="text-xs font-semibold text-slate-900 hover:text-blue-600 truncate"
                                >
                                  {entry.candidate.display_name}
                                </Link>
                                <span className="text-xs font-bold tabular-nums text-slate-800">
                                  {entry.candidate.overall_score !== null
                                    ? `${Math.round(
                                        entry.candidate.overall_score
                                      )}/100`
                                    : '—'}
                                </span>
                              </div>
                              {entry.private_notes && (
                                <p className="inline-flex items-center gap-1 text-[11px] text-slate-600 truncate">
                                  <Lock
                                    className="h-3 w-3 shrink-0 text-slate-400"
                                    aria-hidden="true"
                                  />
                                  <span className="truncate">
                                    {entry.private_notes}
                                  </span>
                                </p>
                              )}
                            </li>
                          ))}
                      </ul>
                    )}
                  </section>

                  {/* Candidate Discovery Activity */}
                  <section
                    aria-labelledby="dashboard-activity-heading"
                    className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h2
                        id="dashboard-activity-heading"
                        className="text-base font-semibold text-slate-900"
                      >
                        Candidate Discovery Activity
                      </h2>
                      <Activity
                        className="h-4 w-4 text-slate-400"
                        aria-hidden="true"
                      />
                    </div>

                    {overview.discovery_activity.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Recent candidate searches, profile reviews, and shortlist updates for your organization will appear here.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {overview.discovery_activity.slice(0, 5).map((item) => (
                          <li
                            key={item.id}
                            className="border-l-2 border-blue-600 pl-3 space-y-0.5"
                          >
                            <p className="text-xs font-semibold text-slate-900">
                              {item.action}
                            </p>
                            <p className="text-xs text-slate-600">
                              {item.description}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              </div>
            </>
          )
        )}
      </div>
    </RecruiterShell>
  );
}
