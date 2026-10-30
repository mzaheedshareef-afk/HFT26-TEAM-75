import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Check,
  GitCompareArrows,
  RotateCcw,
  Users,
} from 'lucide-react';
import { RecruiterShell } from '../../components/recruiter/RecruiterShell';
import { CandidateCard } from '../../components/recruiter/CandidateCard';
import { CandidateSearchFiltersBar } from '../../components/recruiter/CandidateSearchFiltersBar';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Button } from '../../components/ui/Button';
import { InfoTooltip } from '../../components/ui/InfoTooltip';
import { CandidateDiscoverySkeleton } from '../../components/ui/LoadingSkeleton';
import { useRecruiterWorkspace } from '../../context/RecruiterWorkspaceContext';
import {
  buildCandidateSearchParams,
  DuplicateShortlistError,
  recruiterService,
} from '../../services/recruiterService';
import { extractApiErrorMessage } from '../../services/api';
import {
  MAX_COMPARISON_CANDIDATES,
  type CandidateSearchQuery,
  type CandidateSortOption,
  type PaginatedCandidateSearchResponse,
  type RecruiterCandidateSummary,
} from '../../types/recruiter';

function parseQueryFromUrlParams(params: URLSearchParams): CandidateSearchQuery {
  const parseNum = (val: string | null): number | undefined => {
    if (!val || !val.trim()) return undefined;
    const parsed = Number(val);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const rawPortfolio = params.get('portfolio_only');
  const portfolioOnly: 'all' | 'yes' | 'no' =
    rawPortfolio === 'yes' || rawPortfolio === 'no' ? rawPortfolio : 'all';

  const rawSort = params.get('sort_by') as CandidateSortOption | null;
  const validSorts: CandidateSortOption[] = [
    'highest_assessment_score',
    'highest_coding_score',
    'highest_improvement',
    'most_consistent',
    'most_relevant_skills',
    'recently_updated',
  ];
  const sortBy: CandidateSortOption =
    rawSort && validSorts.includes(rawSort)
      ? rawSort
      : 'highest_assessment_score';

  return {
    q: params.get('q') ?? '',
    language: params.get('language') ?? '',
    skill: params.get('skill') ?? '',
    framework: params.get('framework') ?? '',
    domain: params.get('domain') ?? '',
    project_experience: params.get('project_experience') ?? 'any',
    min_score: parseNum(params.get('min_score')),
    max_score: parseNum(params.get('max_score')),
    min_coding_score: parseNum(params.get('min_coding_score')),
    min_ai_efficiency: parseNum(params.get('min_ai_efficiency')),
    difficulty: params.get('difficulty') ?? '',
    consistency: params.get('consistency') ?? '',
    improvement_trend: params.get('improvement_trend') ?? '',
    portfolio_only: portfolioOnly,
    sort_by: sortBy,
    page: Math.max(1, parseNum(params.get('page')) ?? 1),
    page_size: Math.max(1, parseNum(params.get('page_size')) ?? 12),
  };
}

function countActiveFilters(query: CandidateSearchQuery): number {
  let count = 0;
  if (query.q && query.q.trim()) count += 1;
  if (query.language && query.language.trim()) count += 1;
  if (query.skill && query.skill.trim()) count += 1;
  if (query.framework && query.framework.trim()) count += 1;
  if (query.domain && query.domain.trim()) count += 1;
  if (query.project_experience && query.project_experience !== 'any') {
    count += 1;
  }
  if (typeof query.min_score === 'number' && query.min_score > 0) count += 1;
  if (typeof query.max_score === 'number' && query.max_score < 100) count += 1;
  if (typeof query.min_coding_score === 'number' && query.min_coding_score > 0) {
    count += 1;
  }
  if (
    typeof query.min_ai_efficiency === 'number' &&
    query.min_ai_efficiency > 0
  ) {
    count += 1;
  }
  if (query.difficulty && query.difficulty.trim()) count += 1;
  if (query.consistency && query.consistency.trim()) count += 1;
  if (query.improvement_trend && query.improvement_trend.trim()) count += 1;
  if (query.portfolio_only && query.portfolio_only !== 'all') count += 1;
  return count;
}

export function CandidateDiscoveryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const committedQuery = useMemo(
    () => parseQueryFromUrlParams(searchParams),
    [searchParams]
  );

  const [draftFilters, setDraftFilters] =
    useState<CandidateSearchQuery>(committedQuery);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const [searchResult, setSearchResult] =
    useState<PaginatedCandidateSearchResponse>({
      items: [],
      total: 0,
      page: 1,
      page_size: 12,
      total_pages: 0,
    });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [shortlistBusyId, setShortlistBusyId] = useState<string | null>(null);

  const {
    comparisonTray,
    isInComparison,
    toggleComparisonCandidate,
    shortlistedIds,
    syncShortlistedIds,
    setShortlistedStatus,
  } = useRecruiterWorkspace();

  // Keep draft filters aligned when URL changes externally (e.g. saved search click)
  useEffect(() => {
    setDraftFilters(committedQuery);
  }, [committedQuery]);

  // Hydrate company shortlist IDs once on mount
  useEffect(() => {
    let cancelled = false;
    void recruiterService
      .getShortlist()
      .then((entries) => {
        if (!cancelled) {
          syncShortlistedIds(entries.map((e) => e.candidate_id));
        }
      })
      .catch(() => {
        // Non-blocking background hydration
      });
    return () => {
      cancelled = true;
    };
  }, [syncShortlistedIds]);

  const executeServerSearch = useCallback(
    async (queryToRun: CandidateSearchQuery, isCancelled?: () => boolean) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await recruiterService.searchCandidates(queryToRun);
        if (isCancelled?.()) return;
        setSearchResult(res);

        // Sync any `is_shortlisted: true` flags returned by search payload
        res.items.forEach((cand) => {
          if (cand.is_shortlisted === true) {
            setShortlistedStatus(cand.candidate_id, true);
          }
        });
      } catch (error) {
        if (isCancelled?.()) return;
        setErrorMessage(
          extractApiErrorMessage(
            error,
            'Unable to query candidates from the recruiter search service.'
          )
        );
      } finally {
        if (!isCancelled?.()) {
          setIsLoading(false);
        }
      }
    },
    [setShortlistedStatus]
  );

  useEffect(() => {
    let cancelled = false;
    void executeServerSearch(committedQuery, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [committedQuery, executeServerSearch]);

  const commitFiltersToUrl = (nextQuery: CandidateSearchQuery) => {
    const params = buildCandidateSearchParams(nextQuery);
    setSearchParams(params);
  };

  const handleFilterChange = <K extends keyof CandidateSearchQuery>(
    key: K,
    value: CandidateSearchQuery[K]
  ) => {
    const updated: CandidateSearchQuery = {
      ...draftFilters,
      [key]: value,
      page: 1,
    };
    setDraftFilters(updated);

    // Immediate server sync for discrete select/radio controls & sorting
    if (
      key === 'sort_by' ||
      key === 'difficulty' ||
      key === 'consistency' ||
      key === 'improvement_trend' ||
      key === 'portfolio_only' ||
      key === 'project_experience'
    ) {
      commitFiltersToUrl(updated);
    }
  };

  const handleSubmitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    commitFiltersToUrl({ ...draftFilters, page: 1 });
  };

  const handleResetFilters = () => {
    const clean: CandidateSearchQuery = {
      q: '',
      language: '',
      skill: '',
      framework: '',
      domain: '',
      project_experience: 'any',
      min_score: undefined,
      max_score: undefined,
      min_coding_score: undefined,
      min_ai_efficiency: undefined,
      difficulty: '',
      consistency: '',
      improvement_trend: '',
      portfolio_only: 'all',
      sort_by: 'highest_assessment_score',
      page: 1,
      page_size: draftFilters.page_size ?? 12,
    };
    setDraftFilters(clean);
    setSearchParams(new URLSearchParams());
  };

  const handlePageChange = (nextPage: number) => {
    const bounded = Math.max(1, nextPage);
    commitFiltersToUrl({
      ...committedQuery,
      page: bounded,
    });
  };

  const handlePageSizeChange = (nextSize: number) => {
    commitFiltersToUrl({
      ...committedQuery,
      page: 1,
      page_size: nextSize,
    });
  };

  const handleSaveCurrentSearch = async () => {
    const params = buildCandidateSearchParams({ ...draftFilters, page: 1 });
    const parts: string[] = [];
    if (draftFilters.q) parts.push(`"${draftFilters.q}"`);
    if (draftFilters.language) parts.push(draftFilters.language);
    if (draftFilters.skill) parts.push(draftFilters.skill);
    if (draftFilters.framework) parts.push(draftFilters.framework);
    if (draftFilters.domain) parts.push(draftFilters.domain);
    if (typeof draftFilters.min_score === 'number') {
      parts.push(`Score >= ${draftFilters.min_score}`);
    }

    const summary =
      parts.length > 0 ? parts.join(' · ') : 'All verified candidates';
    const presetName =
      parts.length > 0 ? `Search: ${parts.slice(0, 2).join(', ')}` : 'Top Verified Talent';

    try {
      await recruiterService.saveCandidateSearch({
        name: presetName,
        query_string: params.toString(),
        filters_summary: summary,
      });
      setInfoMessage(`Saved search preset "${presetName}" to your dashboard.`);
    } catch (error) {
      setErrorMessage(
        extractApiErrorMessage(error, 'Unable to save search preset.')
      );
    }
  };

  const handleToggleShortlist = async (
    candidate: RecruiterCandidateSummary
  ) => {
    if (shortlistBusyId) return;
    setShortlistBusyId(candidate.candidate_id);
    setInfoMessage(null);

    const currentlyShortlisted = shortlistedIds.has(candidate.candidate_id);

    try {
      if (currentlyShortlisted) {
        await recruiterService.removeFromShortlist(candidate.candidate_id);
        setShortlistedStatus(candidate.candidate_id, false);
      } else {
        await recruiterService.addToShortlist({
          candidateId: candidate.candidate_id,
          candidateSnapshot: candidate,
        });
        setShortlistedStatus(candidate.candidate_id, true);
      }
    } catch (error) {
      if (error instanceof DuplicateShortlistError) {
        setShortlistedStatus(candidate.candidate_id, true);
        setInfoMessage(error.message);
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
    const res = toggleComparisonCandidate({
      candidate_id: candidate.candidate_id,
      display_name: candidate.display_name,
      headline: candidate.headline,
    });
    if (res.limitReached) {
      setInfoMessage(
        `Comparison supports up to ${MAX_COMPARISON_CANDIDATES} candidates at once. Remove a candidate from comparison to add another.`
      );
    }
  };

  const activeFilterCount = countActiveFilters(committedQuery);

  const tableColumnVars = {
    '--col-stack': '"Languages & Frameworks"',
    '--col-portfolio': '"Domain & Experience"',
    '--col-status': '"Assessment Score"',
    '--col-score': '"Coding / AI Eff."',
    '--col-actions': '"Consistency & Trend"',
    '--col-extra-1': '"Projects"',
    '--col-extra-2': '"Actions"',
  } as React.CSSProperties;

  return (
    <RecruiterShell>
      <div className="space-y-6">
        {/* Page Header + Comparison Tray Action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Candidate Discovery
            </h1>
            <p className="text-sm text-slate-600">
              Search, filter, and sort opted-in engineering candidates using server-side pagination and verified sandbox assessment metrics.
            </p>
          </div>

          {comparisonTray.length > 0 && (
            <Link
              to={`/company/compare?ids=${encodeURIComponent(
                comparisonTray.map((c) => c.candidate_id).join(',')
              )}`}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-2xs"
            >
              <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
              <span>
                Open Comparison ({comparisonTray.length}/
                {MAX_COMPARISON_CANDIDATES})
              </span>
            </Link>
          )}
        </div>

        {errorMessage && (
          <AlertBanner
            variant="error"
            title="Candidate Search Error"
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
          />
        )}

        {infoMessage && (
          <AlertBanner
            variant="success"
            title="Recruiter Discovery"
            message={infoMessage}
            onDismiss={() => setInfoMessage(null)}
          />
        )}

        {/* Search & 12-Filter Form */}
        <CandidateSearchFiltersBar
          filters={draftFilters}
          viewMode={viewMode}
          activeFilterCount={activeFilterCount}
          onChangeFilter={handleFilterChange}
          onSubmitSearch={handleSubmitSearch}
          onResetFilters={handleResetFilters}
          onChangeViewMode={setViewMode}
          onSaveSearch={() => void handleSaveCurrentSearch()}
        />

        {/* Results Count & Page Size Summary Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600">
          <p>
            {isLoading ? (
              'Querying verified candidate directory...'
            ) : (
              <>
                Showing{' '}
                <strong className="text-slate-900">
                  {searchResult.items.length}
                </strong>{' '}
                of{' '}
                <strong className="text-slate-900">{searchResult.total}</strong>{' '}
                {searchResult.total === 1 ? 'candidate' : 'candidates'} (Page{' '}
                {searchResult.page} of {Math.max(1, searchResult.total_pages)})
              </>
            )}
          </p>

          <div className="inline-flex items-center gap-2">
            <label htmlFor="discovery-page-size" className="font-medium">
              Results per page:
            </label>
            <select
              id="discovery-page-size"
              value={committedQuery.page_size ?? 12}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800"
            >
              <option value={6}>6</option>
              <option value={12}>12</option>
              <option value={24}>24</option>
            </select>
          </div>
        </div>

        {/* Results Content: Loading Skeleton, Empty State, Cards Grid, or Structured Table */}
        {isLoading ? (
          <CandidateDiscoverySkeleton />
        ) : searchResult.items.length === 0 ? (
          <section className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-2xs space-y-4">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Users className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900">
                No Matching Candidates Found
              </h2>
              <p className="mx-auto max-w-md text-xs text-slate-500 leading-relaxed">
                {activeFilterCount > 0
                  ? 'No opted-in candidates matched your active search query and score thresholds. Try broadening your filters or resetting search criteria.'
                  : 'No candidate profiles are publicly available in the recruiter directory yet.'}
              </p>
            </div>
            {activeFilterCount > 0 && (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  leftIcon={
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  }
                >
                  Reset All Filters
                </Button>
              </div>
            )}
          </section>
        ) : viewMode === 'cards' ? (
          <div className="grid gap-5 md:grid-cols-2">
            {searchResult.items.map((candidate) => (
              <CandidateCard
                key={candidate.candidate_id}
                candidate={candidate}
                isShortlisted={shortlistedIds.has(candidate.candidate_id)}
                isShortlistLoading={shortlistBusyId === candidate.candidate_id}
                isInComparison={isInComparison(candidate.candidate_id)}
                onToggleShortlist={(cand) => void handleToggleShortlist(cand)}
                onToggleCompare={handleToggleCompare}
              />
            ))}
          </div>
        ) : (
          <section className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="candidate-discovery-table-caption"
              className="responsive-table-wrapper"
            >
              <table
                style={tableColumnVars}
                className="responsive-table text-left text-xs"
              >
                <caption
                  id="candidate-discovery-table-caption"
                  className="sr-only"
                >
                  Candidate discovery results table
                </caption>
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Candidate
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Languages &amp; Frameworks
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Domain &amp; Experience
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Assessment Score
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      <span className="inline-flex items-center gap-1">
                        <span>Coding / AI Eff.</span>
                        <InfoTooltip label="About table AI Efficiency column">
                          Official backend AI Efficiency Score paired with verified Coding Score.
                        </InfoTooltip>
                      </span>
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Consistency &amp; Trend
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Projects
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 font-semibold text-right"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {searchResult.items.map((cand) => {
                    const shortlisted = shortlistedIds.has(cand.candidate_id);
                    const comparing = isInComparison(cand.candidate_id);

                    return (
                      <tr
                        key={cand.candidate_id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <th
                          scope="row"
                          className="px-5 py-3.5 font-medium text-slate-900"
                        >
                          <div className="space-y-0.5">
                            <Link
                              to={`/company/candidates/${encodeURIComponent(
                                cand.candidate_id
                              )}`}
                              className="text-sm font-semibold text-slate-900 hover:text-blue-600"
                            >
                              {cand.display_name}
                            </Link>
                            <p className="text-xs font-normal text-slate-500">
                              {cand.headline}
                            </p>
                          </div>
                        </th>

                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {[
                              ...cand.programming_languages.slice(0, 2),
                              ...cand.frameworks.slice(0, 2),
                            ].map((item) => (
                              <span
                                key={item}
                                className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-slate-700">
                          <div>
                            <p className="font-medium">
                              {cand.experience_level}
                            </p>
                            {cand.domains.length > 0 && (
                              <p className="text-slate-500">
                                {cand.domains.slice(0, 2).join(', ')}
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 font-bold tabular-nums text-slate-900">
                          {cand.overall_score !== null
                            ? `${Math.round(cand.overall_score)} / 100`
                            : '—'}
                        </td>

                        <td className="px-4 py-3.5 tabular-nums text-slate-800">
                          <span className="font-semibold">
                            {cand.coding_score !== null
                              ? `${Math.round(cand.coding_score)}`
                              : '—'}
                          </span>{' '}
                          /{' '}
                          <span className="font-semibold text-blue-700">
                            {cand.ai_efficiency_score !== null
                              ? `${Math.round(cand.ai_efficiency_score)}`
                              : 'Pending'}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-slate-700">
                          <p className="font-medium">{cand.consistency_label}</p>
                          <p className="text-slate-500">
                            {cand.improvement_label}
                          </p>
                        </td>

                        <td className="px-4 py-3.5 text-slate-700">
                          {cand.projects.length}{' '}
                          {cand.projects.length === 1 ? 'project' : 'projects'}
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              aria-label={
                                shortlisted
                                  ? `Remove ${cand.display_name} from shortlist`
                                  : `Shortlist ${cand.display_name}`
                              }
                              onClick={() => void handleToggleShortlist(cand)}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold cursor-pointer ${
                                shortlisted
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {shortlisted ? (
                                <BookmarkCheck
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Bookmark
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                              )}
                              <span>{shortlisted ? 'Saved' : 'Shortlist'}</span>
                            </button>

                            <button
                              type="button"
                              aria-pressed={comparing}
                              aria-label={
                                comparing
                                  ? `Remove ${cand.display_name} from comparison`
                                  : `Add ${cand.display_name} to comparison`
                              }
                              onClick={() => handleToggleCompare(cand)}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold cursor-pointer ${
                                comparing
                                  ? 'border-blue-600 bg-blue-600 text-white'
                                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {comparing && (
                                <Check className="h-3 w-3" aria-hidden="true" />
                              )}
                              <span>Compare</span>
                            </button>

                            <Link
                              to={`/company/candidates/${encodeURIComponent(
                                cand.candidate_id
                              )}`}
                              className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-200"
                            >
                              <span>Profile</span>
                              <ArrowUpRight
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Server-Side Pagination Controls */}
        {!isLoading && searchResult.total_pages > 1 && (
          <nav
            aria-label="Candidate discovery pagination"
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3.5 shadow-2xs"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={searchResult.page <= 1}
              onClick={() => handlePageChange(searchResult.page - 1)}
              leftIcon={<ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Previous Page
            </Button>

            <span className="text-xs font-semibold text-slate-700 tabular-nums">
              Page {searchResult.page} of {searchResult.total_pages}
            </span>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={searchResult.page >= searchResult.total_pages}
              onClick={() => handlePageChange(searchResult.page + 1)}
              rightIcon={
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              }
            >
              Next Page
            </Button>
          </nav>
        )}
      </div>
    </RecruiterShell>
  );
}

