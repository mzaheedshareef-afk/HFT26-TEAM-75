import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Award,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Code2,
  FolderGit2,
  Gauge,
  GitCompareArrows,
  Layers,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { InfoTooltip } from '../ui/InfoTooltip';
import type { RecruiterCandidateSummary } from '../../types/recruiter';

interface CandidateCardProps {
  candidate: RecruiterCandidateSummary;
  isShortlisted: boolean;
  isShortlistLoading?: boolean;
  isInComparison: boolean;
  onToggleShortlist: (candidate: RecruiterCandidateSummary) => void;
  onToggleCompare: (candidate: RecruiterCandidateSummary) => void;
}

export function CandidateCard({
  candidate,
  isShortlisted,
  isShortlistLoading = false,
  isInComparison,
  onToggleShortlist,
  onToggleCompare,
}: CandidateCardProps) {
  const hasEfficiency =
    typeof candidate.ai_efficiency_score === 'number' &&
    Number.isFinite(candidate.ai_efficiency_score);

  return (
    <article
      aria-label={`Candidate card for ${candidate.display_name}`}
      className="recruiter-card-contain flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-2xs hover:border-slate-300 transition-colors space-y-5"
    >
      <div className="space-y-4">
        {/* Header: Name, Headline, Experience & Domains */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 truncate">
                <Link
                  to={`/company/candidates/${encodeURIComponent(
                    candidate.candidate_id
                  )}`}
                  className="hover:text-blue-600 transition-colors"
                >
                  {candidate.display_name}
                </Link>
              </h3>
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                <span>
                  {candidate.assessments_completed} Verified{' '}
                  {candidate.assessments_completed === 1
                    ? 'Assessment'
                    : 'Assessments'}
                </span>
              </span>
            </div>

            <p className="text-xs font-medium text-slate-600">
              {candidate.headline}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                <span>{candidate.experience_level}</span>
              </span>

              {candidate.domains.length > 0 && (
                <>
                  <span aria-hidden="true">&middot;</span>
                  <span className="inline-flex flex-wrap items-center gap-1">
                    {candidate.domains.slice(0, 2).map((domain) => (
                      <span
                        key={domain}
                        className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700"
                      >
                        {domain}
                      </span>
                    ))}
                  </span>
                </>
              )}
            </div>
          </div>

          <span
            className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
              candidate.portfolio_available
                ? 'border-slate-200 bg-slate-50 text-slate-700'
                : 'border-slate-200 bg-white text-slate-400'
            }`}
          >
            {candidate.portfolio_available
              ? 'Portfolio Linked'
              : 'No Portfolio'}
          </span>
        </div>

        {/* Profile Summary */}
        {candidate.summary && (
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
            {candidate.summary}
          </p>
        )}

        {/* Verified Platform Assessment Metrics */}
        <div
          aria-label="Verified assessment metrics"
          className="rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 space-y-2.5"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span className="inline-flex items-center gap-1 text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              <span>Verified Platform Scores</span>
            </span>
            <span>Difficulty: {candidate.difficulty_level}</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-md border border-slate-200/80 bg-white px-2.5 py-2">
              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                <Award className="h-3 w-3 text-blue-600" aria-hidden="true" />
                <span>Assessment</span>
              </div>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                {candidate.overall_score !== null
                  ? `${Math.round(candidate.overall_score)} / 100`
                  : '—'}
              </p>
            </div>

            <div className="rounded-md border border-slate-200/80 bg-white px-2.5 py-2">
              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                <Code2 className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                <span>Coding</span>
              </div>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                {candidate.coding_score !== null
                  ? `${Math.round(candidate.coding_score)} / 100`
                  : '—'}
              </p>
            </div>

            <div className="rounded-md border border-blue-200/70 bg-blue-50/30 px-2.5 py-2">
              <div className="flex items-center gap-1 text-[11px] text-slate-600">
                <Gauge className="h-3 w-3 text-blue-600" aria-hidden="true" />
                <span>AI Efficiency</span>
                <InfoTooltip label={`AI Efficiency Score explanation for ${candidate.display_name}`}>
                  Official AI Efficiency Score returned directly by the backend grading engine based on progressive hint usage and code optimality. Never calculated in the frontend.
                </InfoTooltip>
              </div>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                {hasEfficiency
                  ? `${Math.round(candidate.ai_efficiency_score as number)} / 100`
                  : 'Pending'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs text-slate-600">
            <span>
              Consistency:{' '}
              <strong className="text-slate-900">
                {candidate.consistency_score !== null
                  ? `${Math.round(candidate.consistency_score)}% (${candidate.consistency_label})`
                  : candidate.consistency_label}
              </strong>
            </span>
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              <span>
                Trend:{' '}
                <strong className="text-slate-900">
                  {candidate.improvement_label}
                </strong>
              </span>
            </span>
          </div>
        </div>

        {/* Self-Reported Languages, Technical Skills, Frameworks & Projects */}
        <div className="space-y-2.5 text-xs">
          {candidate.programming_languages.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-slate-500">Languages:</span>
              {candidate.programming_languages.slice(0, 4).map((lang) => (
                <span
                  key={lang}
                  className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 font-medium text-slate-800"
                >
                  {lang}
                </span>
              ))}
            </div>
          )}

          {candidate.technical_skills.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-slate-500">Skills:</span>
              {candidate.technical_skills.slice(0, 4).map((skill) => (
                <span
                  key={skill}
                  className="rounded border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-700"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}

          {candidate.frameworks.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 font-semibold text-slate-500">
                <Layers className="h-3 w-3" aria-hidden="true" />
                <span>Frameworks:</span>
              </span>
              {candidate.frameworks.slice(0, 4).map((fw) => (
                <span
                  key={fw}
                  className="rounded border border-blue-200/70 bg-blue-50/40 px-2 py-0.5 font-medium text-blue-900"
                >
                  {fw}
                </span>
              ))}
            </div>
          )}

          {candidate.projects.length > 0 && (
            <div className="flex items-start gap-1.5 text-slate-600 pt-0.5">
              <FolderGit2
                className="h-3.5 w-3.5 shrink-0 text-slate-400 mt-0.5"
                aria-hidden="true"
              />
              <span className="truncate">
                <strong className="text-slate-800">
                  {candidate.projects.length}{' '}
                  {candidate.projects.length === 1 ? 'Project' : 'Projects'}:
                </strong>{' '}
                {candidate.projects.map((p) => p.title).join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={isShortlisted ? 'secondary' : 'outline'}
            size="sm"
            isLoading={isShortlistLoading}
            loadingText="Updating..."
            onClick={() => onToggleShortlist(candidate)}
            aria-label={
              isShortlisted
                ? `Remove ${candidate.display_name} from shortlist`
                : `Shortlist ${candidate.display_name}`
            }
            leftIcon={
              isShortlisted ? (
                <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
              )
            }
          >
            {isShortlisted ? 'Shortlisted' : 'Shortlist'}
          </Button>

          <Button
            type="button"
            variant={isInComparison ? 'accent' : 'outline'}
            size="sm"
            onClick={() => onToggleCompare(candidate)}
            aria-pressed={isInComparison}
            aria-label={
              isInComparison
                ? `Remove ${candidate.display_name} from comparison`
                : `Add ${candidate.display_name} to comparison`
            }
            leftIcon={
              <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" />
            }
          >
            {isInComparison ? 'In Comparison' : 'Compare'}
          </Button>
        </div>

        <Link
          to={`/company/candidates/${encodeURIComponent(
            candidate.candidate_id
          )}`}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
        >
          <span>View Profile</span>
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

