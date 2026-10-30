import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  GitCompareArrows,
  Plus,
  Scale,
  Trash2,
  X,
} from 'lucide-react';
import { RecruiterShell } from '../../components/recruiter/RecruiterShell';
import {
  ComparisonScoreBarsChart,
  ComparisonTopicDifficultyCharts,
} from '../../components/recruiter/ComparisonCharts';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Button } from '../../components/ui/Button';
import { InfoTooltip } from '../../components/ui/InfoTooltip';
import { CandidateComparisonSkeleton } from '../../components/ui/LoadingSkeleton';
import { useRecruiterWorkspace } from '../../context/RecruiterWorkspaceContext';
import { recruiterService } from '../../services/recruiterService';
import { extractApiErrorMessage } from '../../services/api';
import {
  MAX_COMPARISON_CANDIDATES,
  type RecruiterCandidateSummary,
} from '../../types/recruiter';

export function CandidateComparisonPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    comparisonTray,
    addComparisonCandidatesByIds,
    removeComparisonCandidate,
    clearComparison,
  } = useRecruiterWorkspace();

  const urlIds = useMemo(() => {
    const raw = searchParams.get('ids') ?? '';
    return Array.from(
      new Set(
        raw
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      )
    ).slice(0, MAX_COMPARISON_CANDIDATES);
  }, [searchParams]);

  const activeIds = useMemo(() => {
    if (urlIds.length > 0) return urlIds;
    return comparisonTray
      .map((item) => item.candidate_id)
      .slice(0, MAX_COMPARISON_CANDIDATES);
  }, [comparisonTray, urlIds]);

  const [comparedCandidates, setComparedCandidates] = useState<
    RecruiterCandidateSummary[]
  >([]);
  const [availablePool, setAvailablePool] = useState<
    RecruiterCandidateSummary[]
  >([]);
  const [selectedPickerId, setSelectedPickerId] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);

  // Load candidate picker pool (shortlisted + first page of discovered candidates)
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      recruiterService.getShortlist().catch(() => []),
      recruiterService
        .searchCandidates({ page: 1, page_size: 12 })
        .catch(() => ({
          items: [],
          total: 0,
          page: 1,
          page_size: 12,
          total_pages: 0,
        })),
    ]).then(([shortlist, discovered]) => {
      if (cancelled) return;
      const byId = new Map<string, RecruiterCandidateSummary>();
      shortlist.forEach((s) => byId.set(s.candidate_id, s.candidate));
      discovered.items.forEach((c) => {
        if (!byId.has(c.candidate_id)) {
          byId.set(c.candidate_id, c);
        }
      });
      setAvailablePool(Array.from(byId.values()));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const loadComparison = useCallback(
    async (ids: string[], isCancelled?: () => boolean) => {
      if (ids.length === 0) {
        setComparedCandidates([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      try {
        const result = await recruiterService.compareCandidates(ids);
        if (isCancelled?.()) return;
        setComparedCandidates(result);
        addComparisonCandidatesByIds(
          result.map((c) => ({
            candidate_id: c.candidate_id,
            display_name: c.display_name,
            headline: c.headline,
          }))
        );
      } catch (error) {
        if (isCancelled?.()) return;
        setErrorMessage(
          extractApiErrorMessage(
            error,
            'Unable to load candidate comparison metrics.'
          )
        );
      } finally {
        if (!isCancelled?.()) {
          setIsLoading(false);
        }
      }
    },
    [addComparisonCandidatesByIds]
  );

  useEffect(() => {
    let cancelled = false;
    void loadComparison(activeIds, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [activeIds, loadComparison]);

  const syncIdsToUrl = (nextIds: string[]) => {
    if (nextIds.length === 0) {
      setSearchParams(new URLSearchParams());
    } else {
      setSearchParams(new URLSearchParams({ ids: nextIds.join(',') }));
    }
  };

  const handleAddFromPicker = () => {
    if (!selectedPickerId) return;
    setLimitNotice(null);

    if (activeIds.includes(selectedPickerId)) {
      setSelectedPickerId('');
      return;
    }

    if (activeIds.length >= MAX_COMPARISON_CANDIDATES) {
      setLimitNotice(
        `You can compare up to ${MAX_COMPARISON_CANDIDATES} candidates simultaneously. Remove one before adding another.`
      );
      return;
    }

    const picked = availablePool.find(
      (c) => c.candidate_id === selectedPickerId
    );
    if (picked) {
      addComparisonCandidatesByIds([
        {
          candidate_id: picked.candidate_id,
          display_name: picked.display_name,
          headline: picked.headline,
        },
      ]);
    }
    const nextIds = [...activeIds, selectedPickerId];
    syncIdsToUrl(nextIds);
    setSelectedPickerId('');
  };

  const handleRemoveCandidateColumn = (candidateId: string) => {
    setLimitNotice(null);
    removeComparisonCandidate(candidateId);
    const nextIds = activeIds.filter((id) => id !== candidateId);
    syncIdsToUrl(nextIds);
  };

  const handleClearAll = () => {
    setLimitNotice(null);
    clearComparison();
    syncIdsToUrl([]);
  };

  const selectablePool = availablePool.filter(
    (c) => !activeIds.includes(c.candidate_id)
  );

  return (
    <RecruiterShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Candidate Comparison Dashboard
            </h1>
            <p className="text-sm text-slate-600">
              Compare up to {MAX_COMPARISON_CANDIDATES} candidates side by side across verified assessment performance, coding accuracy, AI efficiency, and portfolio depth.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {activeIds.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                leftIcon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Clear All ({activeIds.length}/{MAX_COMPARISON_CANDIDATES})
              </Button>
            )}
            <Link
              to="/company/candidates"
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Browse Candidates
            </Link>
          </div>
        </div>

        {/* Evidence-Based Neutrality Notice */}
        <section
          aria-label="Evidence-based comparison notice"
          className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-xs text-slate-700"
        >
          <Scale
            className="h-4 w-4 text-blue-600 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="space-y-0.5">
            <p className="font-semibold text-slate-900">
              Objective Evidence — Recruiter-Led Decision Making
            </p>
            <p className="leading-relaxed">
              GateCode presents measurable sandbox assessment scores, backend-computed AI efficiency metrics, and self-reported portfolio evidence side by side. The platform does not rank or declare one candidate objectively better so your hiring team can weigh trade-offs for your specific role.
            </p>
          </div>
        </section>

        {/* Candidate Selector Bar (Up to 4 Slots) */}
        <section
          aria-label="Select candidates to compare"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="flex-1 max-w-md space-y-1">
              <label
                htmlFor="comparison-candidate-picker"
                className="block text-xs font-semibold text-slate-700"
              >
                Add Candidate to Comparison ({activeIds.length}/
                {MAX_COMPARISON_CANDIDATES} selected)
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="comparison-candidate-picker"
                  value={selectedPickerId}
                  onChange={(e) => setSelectedPickerId(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                >
                  <option value="">
                    {selectablePool.length > 0
                      ? 'Choose a shortlisted or discovered candidate...'
                      : 'No additional candidates loaded'}
                  </option>
                  {selectablePool.map((cand) => (
                    <option key={cand.candidate_id} value={cand.candidate_id}>
                      {cand.display_name} — {cand.headline}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!selectedPickerId}
                  onClick={handleAddFromPicker}
                  leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                >
                  Add
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {comparedCandidates.map((cand) => (
                <span
                  key={cand.candidate_id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 pl-3 pr-1.5 py-1 text-xs font-semibold text-slate-800"
                >
                  <span>{cand.display_name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${cand.display_name} from comparison`}
                    onClick={() =>
                      handleRemoveCandidateColumn(cand.candidate_id)
                    }
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </section>

        {errorMessage && (
          <AlertBanner
            variant="error"
            title="Comparison Error"
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
          />
        )}

        {limitNotice && (
          <AlertBanner
            variant="info"
            title="Comparison Limit Reached"
            message={limitNotice}
            onDismiss={() => setLimitNotice(null)}
          />
        )}

        {isLoading ? (
          <CandidateComparisonSkeleton />
        ) : comparedCandidates.length === 0 ? (
          <section className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-2xs space-y-3">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <GitCompareArrows className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="text-base font-bold text-slate-900">
              Select Candidates to Compare Side by Side
            </h2>
            <p className="mx-auto max-w-md text-xs text-slate-500 leading-relaxed">
              Choose up to {MAX_COMPARISON_CANDIDATES} candidates using the selector above or click <strong>Compare</strong> on any candidate card in Find Candidates or Shortlisted Candidates.
            </p>
            <div className="pt-1">
              <Link
                to="/company/candidates"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Go to Candidate Discovery
              </Link>
            </div>
          </section>
        ) : (
          <>
            {/* Visual Charts */}
            <ComparisonScoreBarsChart candidates={comparedCandidates} />
            <ComparisonTopicDifficultyCharts candidates={comparedCandidates} />

            {/* 11-Dimension Comparison Table */}
            <section className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-base font-bold text-slate-900">
                  Structured Side-by-Side Comparison Matrix
                </h2>
                <p className="text-xs text-slate-500">
                  Verified assessment metrics and self-reported portfolio dimensions across selected candidates.
                </p>
              </div>

              <div
                tabIndex={0}
                role="region"
                aria-labelledby="candidate-comparison-matrix-caption"
                className="comparison-matrix-wrapper"
              >
                <table className="comparison-matrix text-left text-xs">
                  <caption
                    id="candidate-comparison-matrix-caption"
                    className="sr-only"
                  >
                    Side-by-side candidate comparison table
                  </caption>
                  <thead className="bg-slate-100 text-slate-800 border-b border-slate-200">
                    <tr>
                      <th
                        scope="col"
                        className="w-48 px-5 py-3.5 font-bold border-b border-r border-slate-200"
                      >
                        Evaluation Dimension
                      </th>
                      {comparedCandidates.map((cand) => (
                        <th
                          key={cand.candidate_id}
                          scope="col"
                          className="min-w-[210px] px-5 py-3.5 border-b border-slate-200 bg-slate-50"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <Link
                                to={`/company/candidates/${encodeURIComponent(
                                  cand.candidate_id
                                )}`}
                                className="inline-flex items-center gap-1 text-sm font-bold text-slate-900 hover:text-blue-600"
                              >
                                <span>{cand.display_name}</span>
                                <ArrowUpRight
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              </Link>
                              <p className="text-[11px] font-normal text-slate-500">
                                {cand.headline}
                              </p>
                            </div>
                            <button
                              type="button"
                              aria-label={`Remove column for ${cand.display_name}`}
                              onClick={() =>
                                handleRemoveCandidateColumn(cand.candidate_id)
                              }
                              className="text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200">
                    {/* 1. Assessment Scores */}
                    <tr>
                      <th
                        scope="row"
                        className="px-5 py-3.5 font-semibold text-slate-800 border-r border-slate-200"
                      >
                        Assessment Scores (Verified)
                      </th>
                      {comparedCandidates.map((cand) => (
                        <td
                          key={`assess-${cand.candidate_id}`}
                          className="px-5 py-3.5 text-slate-800"
                        >
                          <p className="text-sm font-bold tabular-nums text-slate-900">
                            {cand.overall_score !== null
                              ? `${Math.round(cand.overall_score)} / 100`
                              : '—'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Peak:{' '}
                            {cand.highest_score !== null
                              ? `${Math.round(cand.highest_score)}/100`
                              : '—'}{' '}
                            &middot; {cand.assessments_completed} completed
                          </p>
                        </td>
                      ))}
                    </tr>

                    {/* 2. Coding Scores */}
                    <tr>
                      <th
                        scope="row"
                        className="px-5 py-3.5 font-semibold text-slate-800 border-r border-slate-200"
                      >
                        Coding Scores (Verified)
                      </th>
                      {comparedCandidates.map((cand) => (
                        <td
                          key={`coding-${cand.candidate_id}`}
                          className="px-5 py-3.5 font-bold tabular-nums text-slate-900"
                        >
                          {cand.coding_score !== null
                            ? `${Math.round(cand.coding_score)} / 100`
                            : '—'}
                        </td>
                      ))}
                    </tr>

                    {/* 3. AI Efficiency Scores (Backend-only) */}
                    <tr>
                      <th
                        scope="row"
                        className="px-5 py-3.5 font-semibold text-slate-800 border-r border-slate-200"
                      >
                        <span className="inline-flex items-center gap-1">
                          <span>AI Efficiency Score</span>
                          <InfoTooltip label="Comparison AI Efficiency Score explanation">
                            Official AI Efficiency Score returned by the backend grading engine. Never calculated in the frontend.
                          </InfoTooltip>
                        </span>
                      </th>
                      {comparedCandidates.map((cand) => (
                        <td
                          key={`eff-${cand.candidate_id}`}
                          className="px-5 py-3.5 font-bold tabular-nums text-blue-800"
                        >
                          {cand.ai_efficiency_score !== null
                            ? `${Math.round(cand.ai_efficiency_score)} / 100`
                            : 'Pending Backend Score'}
                        </td>
                      ))}
                    </tr>

                    {/* 4. Consistency */}
                    <tr>
                      <th
                        scope="row"
                        className="px-5 py-3.5 font-semibold text-slate-800 border-r border-slate-200"
                      >
                        Performance Consistency
                      </th>
                      {comparedCandidates.map((cand) => (
                        <td
                          key={`cons-${cand.candidate_id}`}
                          className="px-5 py-3.5 text-slate-800"
                        >
                          <span className="font-semibold">
                            {cand.consistency_score !== null
                              ? `${Math.round(cand.consistency_score)} / 100`
                              : '—'}
                          </span>{' '}
                          <span className="text-slate-500">
                            ({cand.consistency_label})
                          </span>
                        </td>
                      ))}
                    </tr>

                    {/* 5. Improvement Trends */}
                    <tr>
                      <th
                        scope="row"
                        className="px-5 py-3.5 font-semibold text-slate-800 border-r border-slate-200"
                      >
                        Improvement Trend
                      </th>
                      {comparedCandidates.map((cand) => (
                        <td
                          key={`imp-${cand.candidate_id}`}
                          className="px-5 py-3.5 font-medium text-slate-800"
                        >
                          {cand.improvement_label}
                        </td>
                      ))}
                    </tr>

                    {/* 6. Topic-Wise Performance */}
                    <tr>
                      <th
                        scope="row"
                        className="px-5 py-3.5 font-semibold text-slate-800 border-r border-slate-200"
                      >
                        Topic-Wise Performance
                      </th>
                      {comparedCandidates.map((cand) => (
                        <td
                          key={`topics-${cand.candidate_id}`}
                          className="px-5 py-3.5 text-slate-700"
                        >
                          {cand.topic_performance.length === 0 ? (
                            <span className="text-slate-400">No topic data</span>
                          ) : (
                            <ul className="space-y-1">
                              {cand.topic_performance.slice(0, 4).map((t) => (
                                <li
                                  key={t.topic}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <span>{t.topic}</span>
                                  <strong className="tabular-nums text-slate-900">
                                    {Math.round(t.average_score)}%
                                  </strong>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* 7. Difficulty-Wise Performance */}
                    <tr>
                      <th
                        scope="row"
                        className="px-5 py-3.5 font-semibold text-slate-800 border-r border-slate-200"
                      >
                        Difficulty-Wise Performance
                      </th>
                      {comparedCandidates.map((cand) => (
                        <td
                          key={`diff-${cand.candidate_id}`}
                          className="px-5 py-3.5 text-slate-700"
                        >
                          {cand.difficulty_performance.length === 0 ? (
                            <span>Primary Tier: {cand.difficulty_level}</span>
                          ) : (
                            <ul className="space-y-1">
                              {cand.difficulty_performance.map((d) => (
                                <li
                                  key={d.difficulty}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <span>{d.difficulty}</span>
                                  <strong className="tabular-nums text-slate-900">
                                    {Math.round(d.average_score)}%
                                  </strong>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* 8. Programming Languages */}
                    <tr>
                      <th
                        scope="row"
                        className="px-5 py-3.5 font-semibold text-slate-800 border-r border-slate-200"
                      >
                        Programming Languages
                      </th>
                      {comparedCandidates.map((cand) => (
                        <td
                          key={`langs-${cand.candidate_id}`}
                          className="px-5 py-3.5"
                        >
                          <div className="flex flex-wrap gap-1">
                            {cand.programming_languages.length > 0 ? (
                              cand.programming_languages.map((lang) => (
                                <span
                                  key={lang}
                                  className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 font-medium text-slate-800"
                                >
                                  {lang}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400">Unspecified</span>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* 9. Technical Skills */}
                    <tr>
                      <th
                        scope="row"
                        className="px-5 py-3.5 font-semibold text-slate-800 border-r border-slate-200"
                      >
                        Technical Skills
                      </th>
                      {comparedCandidates.map((cand) => (
                        <td
                          key={`skills-${cand.candidate_id}`}
                          className="px-5 py-3.5"
                        >
                          <div className="flex flex-wrap gap-1">
                            {cand.technical_skills.length > 0 ? (
                              cand.technical_skills.map((sk) => (
                                <span
                                  key={sk}
                                  className="rounded border border-slate-200 bg-white px-2 py-0.5 text-slate-700"
                                >
                                  {sk}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400">Unspecified</span>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* 10. Frameworks */}
                    <tr>
                      <th
                        scope="row"
                        className="px-5 py-3.5 font-semibold text-slate-800 border-r border-slate-200"
                      >
                        Frameworks &amp; Tooling
                      </th>
                      {comparedCandidates.map((cand) => (
                        <td
                          key={`fw-${cand.candidate_id}`}
                          className="px-5 py-3.5"
                        >
                          <div className="flex flex-wrap gap-1">
                            {cand.frameworks.length > 0 ? (
                              cand.frameworks.map((fw) => (
                                <span
                                  key={fw}
                                  className="rounded border border-blue-200 bg-blue-50/40 px-2 py-0.5 text-blue-900"
                                >
                                  {fw}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400">Unspecified</span>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* 11. Project Experience */}
                    <tr>
                      <th
                        scope="row"
                        className="px-5 py-3.5 font-semibold text-slate-800 border-r border-slate-200"
                      >
                        Project Experience (Self-Reported)
                      </th>
                      {comparedCandidates.map((cand) => (
                        <td
                          key={`proj-${cand.candidate_id}`}
                          className="px-5 py-3.5 text-slate-700"
                        >
                          <p className="font-semibold text-slate-900">
                            {cand.projects.length}{' '}
                            {cand.projects.length === 1
                              ? 'Portfolio Project'
                              : 'Portfolio Projects'}
                          </p>
                          {cand.projects.length > 0 && (
                            <ul className="mt-1 list-disc pl-4 space-y-0.5 text-[11px] text-slate-600">
                              {cand.projects.slice(0, 3).map((p) => (
                                <li key={p.id}>{p.title}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </RecruiterShell>
  );
}

