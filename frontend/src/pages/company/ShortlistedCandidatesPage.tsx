import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Award,
  BookmarkCheck,
  Code2,
  Gauge,
  GitCompareArrows,
  Lock,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { RecruiterShell } from '../../components/recruiter/RecruiterShell';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Button } from '../../components/ui/Button';
import { InfoTooltip } from '../../components/ui/InfoTooltip';
import { HistoryTableSkeleton } from '../../components/ui/LoadingSkeleton';
import { useRecruiterWorkspace } from '../../context/RecruiterWorkspaceContext';
import { recruiterService } from '../../services/recruiterService';
import { extractApiErrorMessage } from '../../services/api';
import {
  MAX_COMPARISON_CANDIDATES,
  type ShortlistEntry,
  type ShortlistFilterQuery,
} from '../../types/recruiter';

export function ShortlistedCandidatesPage() {
  const {
    comparisonTray,
    isInComparison,
    toggleComparisonCandidate,
    syncShortlistedIds,
    setShortlistedStatus,
  } = useRecruiterWorkspace();

  const [entries, setEntries] = useState<ShortlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search, Filter & Sort state for shortlisted candidates
  const [searchQuery, setSearchQuery] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [minScoreFilter, setMinScoreFilter] = useState<string>('all');
  const [portfolioFilter, setPortfolioFilter] = useState<'all' | 'yes' | 'no'>(
    'all'
  );
  const [sortBy, setSortBy] =
    useState<NonNullable<ShortlistFilterQuery['sort_by']>>(
      'recently_shortlisted'
    );

  // Per-entry private notes draft & busy trackers
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadShortlist = useCallback(
    async (isCancelled?: () => boolean) => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const list = await recruiterService.getShortlist();
        if (isCancelled?.()) return;
        setEntries(list);
        syncShortlistedIds(list.map((e) => e.candidate_id));

        const initialDrafts: Record<string, string> = {};
        list.forEach((entry) => {
          initialDrafts[entry.candidate_id] = entry.private_notes;
        });
        setNoteDrafts(initialDrafts);
      } catch (error) {
        if (isCancelled?.()) return;
        setErrorMessage(
          extractApiErrorMessage(
            error,
            'Unable to load your company shortlist right now.'
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
    void loadShortlist(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadShortlist]);

  const filteredAndSortedEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const skill = skillFilter.trim().toLowerCase();
    const minScore =
      minScoreFilter === 'all' ? null : Number(minScoreFilter);

    const filtered = entries.filter((entry) => {
      const cand = entry.candidate;
      const allSkills = [
        ...cand.programming_languages,
        ...cand.technical_skills,
        ...cand.frameworks,
      ];

      if (q) {
        const matchesText =
          cand.display_name.toLowerCase().includes(q) ||
          cand.headline.toLowerCase().includes(q) ||
          cand.summary.toLowerCase().includes(q) ||
          entry.private_notes.toLowerCase().includes(q) ||
          allSkills.some((s) => s.toLowerCase().includes(q));
        if (!matchesText) return false;
      }

      if (skill) {
        const matchesSkill = allSkills.some((s) =>
          s.toLowerCase().includes(skill)
        );
        if (!matchesSkill) return false;
      }

      if (minScore !== null && Number.isFinite(minScore)) {
        if ((cand.overall_score ?? -1) < minScore) return false;
      }

      if (portfolioFilter === 'yes' && !cand.portfolio_available) return false;
      if (portfolioFilter === 'no' && cand.portfolio_available) return false;

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'highest_assessment_score') {
        return (
          (b.candidate.overall_score ?? -1) - (a.candidate.overall_score ?? -1)
        );
      }
      if (sortBy === 'highest_coding_score') {
        return (
          (b.candidate.coding_score ?? -1) - (a.candidate.coding_score ?? -1)
        );
      }
      if (sortBy === 'name_asc') {
        return a.candidate.display_name.localeCompare(
          b.candidate.display_name
        );
      }
      return (
        new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
      );
    });
  }, [
    entries,
    minScoreFilter,
    portfolioFilter,
    searchQuery,
    skillFilter,
    sortBy,
  ]);

  const handleSavePrivateNote = async (candidateId: string) => {
    if (savingNoteId) return;
    setSavingNoteId(candidateId);
    setErrorMessage(null);
    setSuccessMessage(null);

    const draftText = noteDrafts[candidateId] ?? '';

    try {
      const updated = await recruiterService.updateRecruiterNotes(
        candidateId,
        draftText
      );
      setEntries((prev) =>
        prev.map((item) =>
          item.candidate_id === candidateId
            ? {
                ...item,
                private_notes: updated.private_notes,
                updated_at: updated.updated_at,
              }
            : item
        )
      );
      setSuccessMessage('Private recruiter notes updated.');
    } catch (error) {
      setErrorMessage(
        extractApiErrorMessage(
          error,
          'Unable to update private recruiter notes.'
        )
      );
    } finally {
      setSavingNoteId(null);
    }
  };

  const handleRemoveCandidate = async (
    candidateId: string,
    displayName: string
  ) => {
    if (removingId) return;
    setRemovingId(candidateId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await recruiterService.removeFromShortlist(candidateId);
      setEntries((prev) =>
        prev.filter((item) => item.candidate_id !== candidateId)
      );
      setShortlistedStatus(candidateId, false);
      setSuccessMessage(`Removed ${displayName} from your company shortlist.`);
    } catch (error) {
      setErrorMessage(
        extractApiErrorMessage(
          error,
          'Unable to remove candidate from shortlist.'
        )
      );
    } finally {
      setRemovingId(null);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSkillFilter('');
    setMinScoreFilter('all');
    setPortfolioFilter('all');
    setSortBy('recently_shortlisted');
  };

  return (
    <RecruiterShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Shortlisted Candidates
            </h1>
            <p className="inline-flex items-center gap-1.5 text-sm text-slate-600">
              <Lock className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
              <span>
                Shortlist entries and private notes are isolated to your company account and never visible to candidates or other companies.
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {comparisonTray.length > 0 && (
              <Link
                to={`/company/compare?ids=${encodeURIComponent(
                  comparisonTray.map((c) => c.candidate_id).join(',')
                )}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  Compare ({comparisonTray.length}/{MAX_COMPARISON_CANDIDATES})
                </span>
              </Link>
            )}
            <Link
              to="/company/candidates"
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Discover More Candidates
            </Link>
          </div>
        </div>

        {errorMessage && (
          <AlertBanner
            variant="error"
            title="Shortlist Error"
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
          />
        )}

        {successMessage && (
          <AlertBanner
            variant="success"
            title="Shortlist Updated"
            message={successMessage}
            onDismiss={() => setSuccessMessage(null)}
          />
        )}

        {/* Shortlist Search, Filter & Sort Controls */}
        <section
          aria-label="Shortlist search, filter, and sort controls"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2 space-y-1">
              <label
                htmlFor="shortlist-search-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Search Shortlisted Candidates
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="shortlist-search-input"
                  type="search"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, skill, or private notes..."
                  className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="shortlist-skill-filter"
                className="block text-xs font-semibold text-slate-700"
              >
                Filter by Skill / Language
              </label>
              <input
                id="shortlist-skill-filter"
                type="text"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                placeholder="e.g., Python, FastAPI"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="shortlist-min-score"
                className="block text-xs font-semibold text-slate-700"
              >
                Minimum Score
              </label>
              <select
                id="shortlist-min-score"
                value={minScoreFilter}
                onChange={(e) => setMinScoreFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
              >
                <option value="all">All Scores</option>
                <option value="90">90+ Distinction</option>
                <option value="80">80+ Strong</option>
                <option value="70">70+ Qualified</option>
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="shortlist-sort-by"
                className="block text-xs font-semibold text-slate-700"
              >
                Sort Shortlist By
              </label>
              <select
                id="shortlist-sort-by"
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as NonNullable<
                      ShortlistFilterQuery['sort_by']
                    >
                  )
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
              >
                <option value="recently_shortlisted">
                  Recently shortlisted
                </option>
                <option value="highest_assessment_score">
                  Highest assessment score
                </option>
                <option value="highest_coding_score">
                  Highest coding score
                </option>
                <option value="name_asc">Candidate name (A–Z)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
              <span className="font-semibold text-slate-600">Portfolio:</span>
              {(
                [
                  { value: 'all', label: 'All' },
                  { value: 'yes', label: 'With Portfolio' },
                  { value: 'no', label: 'Assessment Only' },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className="inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="shortlist_portfolio_filter"
                    value={opt.value}
                    checked={portfolioFilter === opt.value}
                    onChange={() => setPortfolioFilter(opt.value)}
                    className="h-3.5 w-3.5"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Reset Shortlist Filters
            </Button>
          </div>
        </section>

        {/* Shortlist Entries */}
        {isLoading ? (
          <HistoryTableSkeleton label="Loading shortlisted candidates..." />
        ) : entries.length === 0 ? (
          <section className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-2xs space-y-3">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <BookmarkCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="text-base font-bold text-slate-900">
              No Candidates Shortlisted Yet
            </h2>
            <p className="mx-auto max-w-md text-xs text-slate-500 leading-relaxed">
              Browse Candidate Discovery to shortlist qualified engineers and record private hiring notes for your team.
            </p>
            <div className="pt-1">
              <Link
                to="/company/candidates"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Find Candidates
              </Link>
            </div>
          </section>
        ) : filteredAndSortedEntries.length === 0 ? (
          <section className="rounded-xl border border-slate-200 bg-white p-10 text-center space-y-3">
            <h2 className="text-sm font-bold text-slate-900">
              No Shortlisted Candidates Match Your Filter
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
            >
              Clear Shortlist Filters
            </Button>
          </section>
        ) : (
          <div className="space-y-4">
            {filteredAndSortedEntries.map((entry) => {
              const cand = entry.candidate;
              const inComp = isInComparison(entry.candidate_id);
              const noteDraft = noteDrafts[entry.candidate_id] ?? '';

              return (
                <article
                  key={entry.shortlist_id}
                  aria-label={`Shortlisted candidate ${cand.display_name}`}
                  className="recruiter-card-contain rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900">
                          <Link
                            to={`/company/candidates/${encodeURIComponent(
                              entry.candidate_id
                            )}`}
                            className="hover:text-blue-600"
                          >
                            {cand.display_name}
                          </Link>
                        </h2>
                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          Shortlisted
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-600">
                        {cand.headline} &middot; {cand.experience_level}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-700">
                        <span className="inline-flex items-center gap-1">
                          <Award
                            className="h-3.5 w-3.5 text-blue-600"
                            aria-hidden="true"
                          />
                          <span>
                            Score:{' '}
                            <strong>
                              {cand.overall_score !== null
                                ? `${Math.round(cand.overall_score)} / 100`
                                : '—'}
                            </strong>
                          </span>
                        </span>

                        <span className="inline-flex items-center gap-1">
                          <Code2
                            className="h-3.5 w-3.5 text-emerald-600"
                            aria-hidden="true"
                          />
                          <span>
                            Coding:{' '}
                            <strong>
                              {cand.coding_score !== null
                                ? `${Math.round(cand.coding_score)} / 100`
                                : '—'}
                            </strong>
                          </span>
                        </span>

                        <span className="inline-flex items-center gap-1">
                          <Gauge
                            className="h-3.5 w-3.5 text-blue-600"
                            aria-hidden="true"
                          />
                          <span>
                            AI Efficiency:{' '}
                            <strong>
                              {cand.ai_efficiency_score !== null
                                ? `${Math.round(cand.ai_efficiency_score)} / 100`
                                : 'Pending'}
                            </strong>
                          </span>
                          <InfoTooltip
                            label={`AI Efficiency info for ${cand.display_name}`}
                          >
                            Official backend-returned AI Efficiency Score. Never calculated in the frontend.
                          </InfoTooltip>
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[
                          ...cand.programming_languages.slice(0, 3),
                          ...cand.technical_skills.slice(0, 3),
                        ].map((tag) => (
                          <span
                            key={tag}
                            className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant={inComp ? 'accent' : 'outline'}
                        size="sm"
                        onClick={() => {
                          const res = toggleComparisonCandidate({
                            candidate_id: entry.candidate_id,
                            display_name: cand.display_name,
                            headline: cand.headline,
                          });
                          if (res.limitReached) {
                            setErrorMessage(
                              `You can compare at most ${MAX_COMPARISON_CANDIDATES} candidates simultaneously.`
                            );
                          }
                        }}
                        leftIcon={
                          <GitCompareArrows
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        }
                      >
                        {inComp ? 'In Comparison' : 'Compare'}
                      </Button>

                      <Link
                        to={`/company/candidates/${encodeURIComponent(
                          entry.candidate_id
                        )}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        <span>View Profile</span>
                        <ArrowUpRight
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      </Link>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        isLoading={removingId === entry.candidate_id}
                        loadingText="Removing..."
                        aria-label={`Remove ${cand.display_name} from shortlist`}
                        onClick={() =>
                          void handleRemoveCandidate(
                            entry.candidate_id,
                            cand.display_name
                          )
                        }
                        leftIcon={
                          <Trash2
                            className="h-3.5 w-3.5 text-red-600"
                            aria-hidden="true"
                          />
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </div>

                  {/* Private Recruiter Notes Form */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor={`shortlist-note-${entry.candidate_id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800"
                      >
                        <Lock
                          className="h-3.5 w-3.5 text-slate-500"
                          aria-hidden="true"
                        />
                        <span>Private Recruiter Notes</span>
                      </label>
                      <span className="text-[11px] text-slate-500">
                        Visible only to your company
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <textarea
                        id={`shortlist-note-${entry.candidate_id}`}
                        rows={2}
                        aria-label={`Private recruiter notes for ${cand.display_name}`}
                        value={noteDraft}
                        onChange={(e) =>
                          setNoteDrafts((prev) => ({
                            ...prev,
                            [entry.candidate_id]: e.target.value,
                          }))
                        }
                        placeholder="Add confidential evaluation notes, interview stage, or team fit observations..."
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                      <div className="flex sm:flex-col justify-end">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          isLoading={savingNoteId === entry.candidate_id}
                          loadingText="Saving..."
                          aria-label={`Save notes for ${cand.display_name}`}
                          onClick={() =>
                            void handleSavePrivateNote(entry.candidate_id)
                          }
                          leftIcon={
                            <Save className="h-3.5 w-3.5" aria-hidden="true" />
                          }
                        >
                          Save Note
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </RecruiterShell>
  );
}

