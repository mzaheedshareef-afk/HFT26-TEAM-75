import React from 'react';
import {
  BookmarkPlus,
  LayoutGrid,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Table2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import type {
  CandidateSearchQuery,
  CandidateSortOption,
} from '../../types/recruiter';

export const CANDIDATE_SORT_OPTIONS: Array<{
  value: CandidateSortOption;
  label: string;
}> = [
  {
    value: 'highest_assessment_score',
    label: 'Highest assessment score',
  },
  {
    value: 'highest_coding_score',
    label: 'Highest coding score',
  },
  {
    value: 'highest_improvement',
    label: 'Highest improvement',
  },
  {
    value: 'most_consistent',
    label: 'Most consistent performance',
  },
  {
    value: 'most_relevant_skills',
    label: 'Most relevant skills',
  },
  {
    value: 'recently_updated',
    label: 'Recently updated profiles',
  },
];

interface CandidateSearchFiltersBarProps {
  filters: CandidateSearchQuery;
  viewMode: 'cards' | 'table';
  activeFilterCount: number;
  onChangeFilter: <K extends keyof CandidateSearchQuery>(
    key: K,
    value: CandidateSearchQuery[K]
  ) => void;
  onSubmitSearch: (event: React.FormEvent) => void;
  onResetFilters: () => void;
  onChangeViewMode: (mode: 'cards' | 'table') => void;
  onSaveSearch?: () => void;
}

export function CandidateSearchFiltersBar({
  filters,
  viewMode,
  activeFilterCount,
  onChangeFilter,
  onSubmitSearch,
  onResetFilters,
  onChangeViewMode,
  onSaveSearch,
}: CandidateSearchFiltersBarProps) {
  return (
    <form
      method="GET"
      action="/company/candidates"
      onSubmit={onSubmitSearch}
      aria-label="Candidate discovery search and filters"
      className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-5"
    >
      {/* Top Row: Keyword Search, Sort Option, View Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-end gap-4">
        <div className="flex-1 space-y-1.5">
          <label
            htmlFor="candidate-search-q"
            className="block text-xs font-semibold text-slate-700"
          >
            Search Candidates
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="candidate-search-q"
              name="q"
              type="search"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="search"
              value={filters.q ?? ''}
              onChange={(e) => onChangeFilter('q', e.target.value)}
              placeholder="Search by candidate name, summary, skill, or project..."
              className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
            />
          </div>
        </div>

        <div className="w-full sm:w-64 space-y-1.5">
          <label
            htmlFor="candidate-sort-by"
            className="block text-xs font-semibold text-slate-700"
          >
            Sort Candidates By
          </label>
          <select
            id="candidate-sort-by"
            name="sort_by"
            value={filters.sort_by ?? 'highest_assessment_score'}
            onChange={(e) =>
              onChangeFilter('sort_by', e.target.value as CandidateSortOption)
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            {CANDIDATE_SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" size="sm">
            Apply Filters
          </Button>

          <div
            role="group"
            aria-label="Candidate display layout"
            className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-0.5"
          >
            <button
              type="button"
              onClick={() => onChangeViewMode('cards')}
              aria-pressed={viewMode === 'cards'}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode('table')}
              aria-pressed={viewMode === 'table'}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Group 1: Stack, Skills, Domain & Project Experience (Filters 1–5) */}
      <fieldset className="border-t border-slate-100 pt-4 space-y-3">
        <legend className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Technical Stack &amp; Domain Filters</span>
        </legend>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* 1. Programming Language */}
          <div className="space-y-1">
            <label
              htmlFor="filter-language"
              className="block text-xs font-medium text-slate-700"
            >
              Programming Language
            </label>
            <input
              id="filter-language"
              name="language"
              type="text"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={filters.language ?? ''}
              onChange={(e) => onChangeFilter('language', e.target.value)}
              placeholder="e.g., Python, Java, C++"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* 2. Technical Skills */}
          <div className="space-y-1">
            <label
              htmlFor="filter-skill"
              className="block text-xs font-medium text-slate-700"
            >
              Technical Skills
            </label>
            <input
              id="filter-skill"
              name="skill"
              type="text"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={filters.skill ?? ''}
              onChange={(e) => onChangeFilter('skill', e.target.value)}
              placeholder="e.g., Graph Algorithms, SQL"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* 3. Frameworks */}
          <div className="space-y-1">
            <label
              htmlFor="filter-framework"
              className="block text-xs font-medium text-slate-700"
            >
              Frameworks
            </label>
            <input
              id="filter-framework"
              name="framework"
              type="text"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={filters.framework ?? ''}
              onChange={(e) => onChangeFilter('framework', e.target.value)}
              placeholder="e.g., FastAPI, React, Docker"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* 4. Domain Knowledge */}
          <div className="space-y-1">
            <label
              htmlFor="filter-domain"
              className="block text-xs font-medium text-slate-700"
            >
              Domain Knowledge
            </label>
            <input
              id="filter-domain"
              name="domain"
              type="text"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={filters.domain ?? ''}
              onChange={(e) => onChangeFilter('domain', e.target.value)}
              placeholder="e.g., Distributed Systems"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* 5. Project Experience */}
          <div className="space-y-1">
            <label
              htmlFor="filter-project-experience"
              className="block text-xs font-medium text-slate-700"
            >
              Project Experience
            </label>
            <select
              id="filter-project-experience"
              name="project_experience"
              value={filters.project_experience ?? 'any'}
              onChange={(e) =>
                onChangeFilter('project_experience', e.target.value)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
            >
              <option value="any">Any project count</option>
              <option value="1+">1+ portfolio projects</option>
              <option value="2+">2+ portfolio projects</option>
              <option value="3+">3+ portfolio projects</option>
            </select>
          </div>
        </div>
      </fieldset>

      {/* Group 2: Verified Assessment & Performance Filters (Filters 6–12) */}
      <fieldset className="border-t border-slate-100 pt-4 space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Verified Score, Consistency &amp; Portfolio Filters
        </legend>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* 6. Assessment Score Range (Min & Max) */}
          <div className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">
              Assessment Score Range (0–100)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <input
                id="filter-min-score"
                name="min_score"
                type="number"
                min={0}
                max={100}
                aria-label="Minimum assessment score"
                value={filters.min_score ?? ''}
                onChange={(e) =>
                  onChangeFilter(
                    'min_score',
                    e.target.value === '' ? undefined : Number(e.target.value)
                  )
                }
                placeholder="Min"
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
              <input
                id="filter-max-score"
                name="max_score"
                type="number"
                min={0}
                max={100}
                aria-label="Maximum assessment score"
                value={filters.max_score ?? ''}
                onChange={(e) =>
                  onChangeFilter(
                    'max_score',
                    e.target.value === '' ? undefined : Number(e.target.value)
                  )
                }
                placeholder="Max"
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* 7. Minimum Coding Score */}
          <div className="space-y-1">
            <label
              htmlFor="filter-min-coding-score"
              className="block text-xs font-medium text-slate-700"
            >
              Min Coding Score
            </label>
            <input
              id="filter-min-coding-score"
              name="min_coding_score"
              type="number"
              min={0}
              max={100}
              value={filters.min_coding_score ?? ''}
              onChange={(e) =>
                onChangeFilter(
                  'min_coding_score',
                  e.target.value === '' ? undefined : Number(e.target.value)
                )
              }
              placeholder="e.g., 80"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* 8. Minimum AI Efficiency Score */}
          <div className="space-y-1">
            <label
              htmlFor="filter-min-ai-efficiency"
              className="block text-xs font-medium text-slate-700"
            >
              Min AI Efficiency Score
            </label>
            <input
              id="filter-min-ai-efficiency"
              name="min_ai_efficiency"
              type="number"
              min={0}
              max={100}
              value={filters.min_ai_efficiency ?? ''}
              onChange={(e) =>
                onChangeFilter(
                  'min_ai_efficiency',
                  e.target.value === '' ? undefined : Number(e.target.value)
                )
              }
              placeholder="e.g., 75"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* 9. Difficulty Level */}
          <div className="space-y-1">
            <label
              htmlFor="filter-difficulty"
              className="block text-xs font-medium text-slate-700"
            >
              Difficulty Level
            </label>
            <select
              id="filter-difficulty"
              name="difficulty"
              value={filters.difficulty ?? ''}
              onChange={(e) => onChangeFilter('difficulty', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
            >
              <option value="">All difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          {/* 10. Performance Consistency */}
          <div className="space-y-1">
            <label
              htmlFor="filter-consistency"
              className="block text-xs font-medium text-slate-700"
            >
              Performance Consistency
            </label>
            <select
              id="filter-consistency"
              name="consistency"
              value={filters.consistency ?? ''}
              onChange={(e) => onChangeFilter('consistency', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
            >
              <option value="">All consistency tiers</option>
              <option value="high">High (85%+)</option>
              <option value="consistent">Consistent (65%+)</option>
              <option value="developing">Developing</option>
            </select>
          </div>

          {/* 11. Improvement Trend */}
          <div className="space-y-1">
            <label
              htmlFor="filter-improvement-trend"
              className="block text-xs font-medium text-slate-700"
            >
              Improvement Trend
            </label>
            <select
              id="filter-improvement-trend"
              name="improvement_trend"
              value={filters.improvement_trend ?? ''}
              onChange={(e) =>
                onChangeFilter('improvement_trend', e.target.value)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
            >
              <option value="">All trends</option>
              <option value="improving">Improving trajectory</option>
              <option value="steady">Steady performance</option>
            </select>
          </div>

          {/* 12. Portfolio Availability (< 6 mutually exclusive options -> visible radios per forms guide) */}
          <div className="sm:col-span-2 space-y-1.5">
            <span className="block text-xs font-medium text-slate-700">
              Portfolio Availability
            </span>
            <div
              role="radiogroup"
              aria-label="Portfolio availability"
              className="flex flex-wrap items-center gap-3 pt-0.5"
            >
              {(
                [
                  { value: 'all', label: 'All Candidates' },
                  { value: 'yes', label: 'With Portfolio' },
                  { value: 'no', label: 'Assessment Only' },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="portfolio_only"
                    value={option.value}
                    checked={(filters.portfolio_only ?? 'all') === option.value}
                    onChange={() =>
                      onChangeFilter('portfolio_only', option.value)
                    }
                    className="h-3.5 w-3.5"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      {/* Bottom Filter Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <p className="text-xs text-slate-500">
          {activeFilterCount > 0 ? (
            <>
              <strong className="text-slate-900">{activeFilterCount}</strong>{' '}
              active {activeFilterCount === 1 ? 'filter' : 'filters'} synced to
              URL
            </>
          ) : (
            'Showing server-paginated candidate directory'
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {onSaveSearch && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSaveSearch}
              leftIcon={
                <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
              }
            >
              Save Search
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            leftIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            Reset Filters
          </Button>
        </div>
      </div>
    </form>
  );
}

