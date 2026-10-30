import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  CheckCircle2,
  Code2,
  ExternalLink,
  FileText,
  FolderGit2,
  Gauge,
  GitCompareArrows,
  Lock,
  Save,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { RecruiterShell } from '../../components/recruiter/RecruiterShell';
import {
  DifficultyPerformanceChart,
  TopicPerformanceChart,
} from '../../components/analytics/AnalyticsCharts';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Button } from '../../components/ui/Button';
import { InfoTooltip } from '../../components/ui/InfoTooltip';
import { ProfilePageSkeleton } from '../../components/ui/LoadingSkeleton';
import { useRecruiterWorkspace } from '../../context/RecruiterWorkspaceContext';
import {
  CandidateAccessDeniedError,
  DuplicateShortlistError,
  recruiterService,
} from '../../services/recruiterService';
import { extractApiErrorMessage } from '../../services/api';
import {
  MAX_COMPARISON_CANDIDATES,
  type RecruiterCandidateSummary,
} from '../../types/recruiter';
import type { AssessmentDifficultyLabel } from '../../types/assessment';

function normalizeDifficultyLabel(raw: string): AssessmentDifficultyLabel {
  const clean = raw.trim().toLowerCase();
  if (clean === 'easy') return 'Easy';
  if (clean === 'hard') return 'Hard';
  return 'Medium';
}

export function CandidateProfileDetailPage() {
  const { candidateId = '' } = useParams<{ candidateId: string }>();
  const {
    isInComparison,
    toggleComparisonCandidate,
    shortlistedIds,
    syncShortlistedIds,
    setShortlistedStatus,
  } = useRecruiterWorkspace();

  const [candidate, setCandidate] = useState<RecruiterCandidateSummary | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const [isShortlistBusy, setIsShortlistBusy] = useState(false);
  const [privateNotes, setPrivateNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const loadCandidateProfile = useCallback(
    async (isCancelled?: () => boolean) => {
      if (!candidateId.trim()) {
        setErrorMessage('Invalid candidate identifier.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setIsAccessDenied(false);
      setErrorMessage(null);

      try {
        const [detail, shortlistEntries] = await Promise.all([
          recruiterService.getCandidateDetail(candidateId),
          recruiterService.getShortlist().catch(() => []),
        ]);
        if (isCancelled?.()) return;

        setCandidate(detail);
        syncShortlistedIds(shortlistEntries.map((e) => e.candidate_id));

        const matchedShortlist = shortlistEntries.find(
          (e) =>
            e.candidate_id === detail.candidate_id ||
            e.candidate_id === candidateId
        );
        if (matchedShortlist) {
          setShortlistedStatus(detail.candidate_id, true);
          setPrivateNotes(matchedShortlist.private_notes);
        } else if (detail.is_shortlisted) {
          setShortlistedStatus(detail.candidate_id, true);
        }
      } catch (error) {
        if (isCancelled?.()) return;
        if (error instanceof CandidateAccessDeniedError) {
          setIsAccessDenied(true);
        } else {
          setErrorMessage(
            extractApiErrorMessage(
              error,
              'Unable to retrieve permitted candidate profile details.'
            )
          );
        }
      } finally {
        if (!isCancelled?.()) {
          setIsLoading(false);
        }
      }
    },
    [candidateId, setShortlistedStatus, syncShortlistedIds]
  );

  useEffect(() => {
    let cancelled = false;
    void loadCandidateProfile(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadCandidateProfile]);

  const isShortlisted = candidate
    ? shortlistedIds.has(candidate.candidate_id)
    : false;
  const inComparison = candidate
    ? isInComparison(candidate.candidate_id)
    : false;

  const handleToggleShortlist = async () => {
    if (!candidate || isShortlistBusy) return;
    setIsShortlistBusy(true);
    setFeedbackMessage(null);
    setErrorMessage(null);

    try {
      if (isShortlisted) {
        await recruiterService.removeFromShortlist(candidate.candidate_id);
        setShortlistedStatus(candidate.candidate_id, false);
        setPrivateNotes('');
        setFeedbackMessage(
          `Removed ${candidate.display_name} from your company shortlist.`
        );
      } else {
        const entry = await recruiterService.addToShortlist({
          candidateId: candidate.candidate_id,
          privateNotes,
          candidateSnapshot: candidate,
        });
        setShortlistedStatus(candidate.candidate_id, true);
        setPrivateNotes(entry.private_notes);
        setFeedbackMessage(
          `Shortlisted ${candidate.display_name} for your organization.`
        );
      }
    } catch (error) {
      if (error instanceof DuplicateShortlistError) {
        setShortlistedStatus(candidate.candidate_id, true);
        setFeedbackMessage(error.message);
      } else {
        setErrorMessage(
          extractApiErrorMessage(
            error,
            'Unable to update shortlist entry right now.'
          )
        );
      }
    } finally {
      setIsShortlistBusy(false);
    }
  };

  const handleSaveNotes = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!candidate) return;
    setIsSavingNotes(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      if (!isShortlisted) {
        const created = await recruiterService.addToShortlist({
          candidateId: candidate.candidate_id,
          privateNotes,
          candidateSnapshot: candidate,
        });
        setShortlistedStatus(candidate.candidate_id, true);
        setPrivateNotes(created.private_notes);
      } else {
        const updated = await recruiterService.updateRecruiterNotes(
          candidate.candidate_id,
          privateNotes
        );
        setPrivateNotes(updated.private_notes);
      }
      setFeedbackMessage(
        'Private recruiter notes saved to your company account.'
      );
    } catch (error) {
      setErrorMessage(
        extractApiErrorMessage(
          error,
          'Unable to save private recruiter notes.'
        )
      );
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleToggleCompare = () => {
    if (!candidate) return;
    const result = toggleComparisonCandidate({
      candidate_id: candidate.candidate_id,
      display_name: candidate.display_name,
      headline: candidate.headline,
    });
    if (result.limitReached) {
      setFeedbackMessage(
        `Comparison supports up to ${MAX_COMPARISON_CANDIDATES} candidates simultaneously.`
      );
    }
  };

  return (
    <RecruiterShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/company/candidates"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Candidate Discovery</span>
          </Link>

          <Link
            to="/company/shortlist"
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            View Company Shortlist
          </Link>
        </div>

        {errorMessage && (
          <AlertBanner
            variant="error"
            title="Candidate Profile Error"
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
          />
        )}

        {feedbackMessage && (
          <AlertBanner
            variant="success"
            title="Recruiter Action Completed"
            message={feedbackMessage}
            onDismiss={() => setFeedbackMessage(null)}
          />
        )}

        {isLoading ? (
          <ProfilePageSkeleton label="Loading candidate profile details..." />
        ) : isAccessDenied ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-10 text-center space-y-3">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="text-lg font-bold text-slate-900">
              Candidate Profile Not Permitted for Recruiter Viewing
            </h1>
            <p className="mx-auto max-w-md text-xs text-slate-600 leading-relaxed">
              This student has set their profile visibility to Private. GateCode strictly respects candidate privacy preferences and only displays profiles explicitly shared by the student.
            </p>
            <div className="pt-2">
              <Link
                to="/company/candidates"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Return to Candidate Discovery
              </Link>
            </div>
          </section>
        ) : !candidate ? (
          <section className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
            Candidate profile could not be found.
          </section>
        ) : (
          <>
            {/* Provenance Distinction Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
                  <ShieldCheck
                    className="h-4 w-4 text-emerald-600"
                    aria-hidden="true"
                  />
                  <span>
                    Verified Platform Results: Docker-graded scores, test cases &amp; backend AI efficiency
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                  <FileText
                    className="h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                  <span>
                    Self-Reported Information: Bio, portfolio projects &amp; external links
                  </span>
                </span>
              </div>
            </div>

            {/* Section A: Basic Information + Recruiter Action Controls */}
            <section
              aria-labelledby="candidate-basic-info-heading"
              className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1
                      id="candidate-basic-info-heading"
                      className="text-2xl font-bold tracking-tight text-slate-900"
                    >
                      {candidate.display_name}
                    </h1>
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Permitted Public Profile</span>
                    </span>
                  </div>

                  <p className="text-sm font-medium text-slate-700">
                    {candidate.headline}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                      <Briefcase
                        className="h-3.5 w-3.5 text-slate-400"
                        aria-hidden="true"
                      />
                      <span>Experience: {candidate.experience_level}</span>
                    </span>
                    {candidate.domains.map((domain) => (
                      <span
                        key={domain}
                        className="rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700"
                      >
                        {domain}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Shortlist & Compare Controls */}
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <Button
                    type="button"
                    variant={isShortlisted ? 'secondary' : 'primary'}
                    size="sm"
                    isLoading={isShortlistBusy}
                    loadingText="Updating..."
                    onClick={() => void handleToggleShortlist()}
                    leftIcon={
                      isShortlisted ? (
                        <BookmarkCheck
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                      ) : (
                        <Bookmark className="h-4 w-4" aria-hidden="true" />
                      )
                    }
                  >
                    {isShortlisted
                      ? 'Remove from Shortlist'
                      : 'Shortlist Candidate'}
                  </Button>

                  <Button
                    type="button"
                    variant={inComparison ? 'accent' : 'outline'}
                    size="sm"
                    onClick={handleToggleCompare}
                    leftIcon={
                      <GitCompareArrows
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                    }
                  >
                    {inComparison ? 'In Comparison' : 'Add to Comparison'}
                  </Button>
                </div>
              </div>

              {candidate.summary && (
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Profile Summary (Self-Reported)
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {candidate.summary}
                  </p>
                </div>
              )}

              {/* Skills, Languages & Technologies */}
              <div className="grid gap-4 sm:grid-cols-3 pt-1">
                <div className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Programming Languages
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.programming_languages.length > 0 ? (
                      candidate.programming_languages.map((lang) => (
                        <span
                          key={lang}
                          className="rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800"
                        >
                          {lang}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">
                        Not specified
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Technical Skills
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.technical_skills.length > 0 ? (
                      candidate.technical_skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                        >
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">
                        Not specified
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Technologies &amp; Frameworks
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.frameworks.length > 0 ? (
                      candidate.frameworks.map((tech) => (
                        <span
                          key={tech}
                          className="rounded-md border border-blue-200 bg-blue-50/50 px-2.5 py-1 text-xs font-medium text-blue-900"
                        >
                          {tech}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">
                        Not specified
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Section C: Verified Assessment Performance (Strictly Platform-Verified) */}
            <section
              aria-labelledby="candidate-verified-performance-heading"
              className="rounded-xl border border-emerald-200/80 bg-white p-6 sm:p-8 shadow-2xs space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="space-y-0.5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    <span>GateCode Verified Platform Results</span>
                  </div>
                  <h2
                    id="candidate-verified-performance-heading"
                    className="text-lg font-bold text-slate-900"
                  >
                    Verified Assessment Performance
                  </h2>
                </div>
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
                  {candidate.assessments_completed} Completed{' '}
                  {candidate.assessments_completed === 1
                    ? 'Assessment'
                    : 'Assessments'}
                </span>
              </div>

              {/* 6 Core Verified KPIs */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-1">
                  <span className="text-xs font-medium text-slate-500">
                    Completed
                  </span>
                  <p className="text-xl font-bold tabular-nums text-slate-900">
                    {candidate.assessments_completed}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Average Score</span>
                    <Award
                      className="h-3.5 w-3.5 text-blue-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-xl font-bold tabular-nums text-slate-900">
                    {candidate.overall_score !== null
                      ? `${Math.round(candidate.overall_score)} / 100`
                      : '—'}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-1">
                  <span className="text-xs font-medium text-slate-500">
                    Highest Score
                  </span>
                  <p className="text-xl font-bold tabular-nums text-emerald-700">
                    {candidate.highest_score !== null
                      ? `${Math.round(candidate.highest_score)} / 100`
                      : '—'}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Coding Score</span>
                    <Code2
                      className="h-3.5 w-3.5 text-emerald-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-xl font-bold tabular-nums text-slate-900">
                    {candidate.coding_score !== null
                      ? `${Math.round(candidate.coding_score)} / 100`
                      : '—'}
                  </p>
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                    <span className="inline-flex items-center gap-1">
                      <span>AI Efficiency</span>
                      <InfoTooltip label="Official AI Efficiency Score explanation">
                        Official AI Efficiency Score returned directly by the backend grading engine. Never calculated in the frontend.
                      </InfoTooltip>
                    </span>
                    <Gauge
                      className="h-3.5 w-3.5 text-blue-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-xl font-bold tabular-nums text-slate-900">
                    {candidate.ai_efficiency_score !== null
                      ? `${Math.round(candidate.ai_efficiency_score)} / 100`
                      : 'Pending'}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Trajectory</span>
                    <TrendingUp
                      className="h-3.5 w-3.5 text-emerald-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {candidate.improvement_label}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Consistency:{' '}
                    {candidate.consistency_score !== null
                      ? `${Math.round(candidate.consistency_score)}% (${candidate.consistency_label})`
                      : candidate.consistency_label}
                  </p>
                </div>
              </div>

              {/* Topic-wise and Difficulty-wise Performance Visualizations */}
              <div className="grid gap-6 lg:grid-cols-2">
                <TopicPerformanceChart
                  data={candidate.topic_performance.map((t) => ({
                    topic: t.topic,
                    average_score: t.average_score,
                    assessments_count: t.assessments_count ?? 1,
                    pass_rate: t.success_rate,
                  }))}
                />
                <DifficultyPerformanceChart
                  data={candidate.difficulty_performance.map((d) => ({
                    difficulty: normalizeDifficultyLabel(d.difficulty),
                    average_score: d.average_score,
                    pass_rate: d.pass_rate ?? d.average_score,
                    attempts_count: d.attempts_count ?? 1,
                  }))}
                />
              </div>
            </section>

            {/* Section D: Verified Achievements */}
            <section
              aria-labelledby="candidate-verified-achievements-heading"
              className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Platform-Verified Evidence</span>
                  </span>
                  <h2
                    id="candidate-verified-achievements-heading"
                    className="text-base font-bold text-slate-900"
                  >
                    Verified Achievements &amp; Skill Evidence
                  </h2>
                </div>
              </div>

              {candidate.verified_achievements.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No verified assessment achievement badges earned yet.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {candidate.verified_achievements.map((ach) => (
                    <div
                      key={ach.id}
                      className="rounded-xl border border-emerald-200/80 bg-emerald-50/30 p-4 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900">
                          <ShieldCheck
                            className="h-4 w-4 text-emerald-600 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{ach.title}</span>
                        </span>
                        {typeof ach.score === 'number' && (
                          <span className="rounded bg-emerald-700 px-2 py-0.5 text-xs font-bold text-white tabular-nums">
                            {Math.round(ach.score)} / 100
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {ach.description}
                      </p>
                      {ach.skill_evidence && (
                        <p className="text-[11px] font-semibold text-emerald-800">
                          Skill Evidence: {ach.skill_evidence}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Section B: Self-Reported Portfolio & Projects */}
            <section
              aria-labelledby="candidate-portfolio-heading"
              className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="space-y-0.5">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <FolderGit2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Self-Reported Portfolio Information</span>
                  </span>
                  <h2
                    id="candidate-portfolio-heading"
                    className="text-base font-bold text-slate-900"
                  >
                    Projects &amp; Public Portfolio Highlights
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {candidate.portfolio_github_url && (
                    <a
                      href={candidate.portfolio_github_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <span>GitHub Profile</span>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                  {candidate.portfolio_linkedin_url && (
                    <a
                      href={candidate.portfolio_linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <span>LinkedIn</span>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>

              {candidate.portfolio_highlights.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Public Portfolio Highlights
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-slate-700">
                    {candidate.portfolio_highlights.map((hl, idx) => (
                      <li key={`hl-${idx}`}>{hl}</li>
                    ))}
                  </ul>
                </div>
              )}

              {candidate.projects.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No self-reported projects have been published on this candidate&apos;s public profile.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {candidate.projects.map((project) => (
                    <div
                      key={project.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/40 p-5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            {project.title}
                          </h3>
                          {project.domain && (
                            <p className="text-[11px] font-medium text-blue-700">
                              {project.domain}
                            </p>
                          )}
                        </div>
                        {project.repo_url && (
                          <a
                            href={project.repo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline shrink-0"
                          >
                            <span>Repo</span>
                            <ExternalLink
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                          </a>
                        )}
                      </div>

                      {project.description && (
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {project.description}
                        </p>
                      )}

                      {project.technologies.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {project.technologies.map((tech) => (
                            <span
                              key={tech}
                              className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Private Recruiter Notes Panel (Company-Only) */}
            <section
              aria-labelledby="private-recruiter-notes-heading"
              className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="space-y-0.5">
                  <h2
                    id="private-recruiter-notes-heading"
                    className="text-base font-bold text-slate-900"
                  >
                    Private Recruiter Notes
                  </h2>
                  <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <Lock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span>
                      Strictly confidential to your company account — never visible to students or other organizations.
                    </span>
                  </p>
                </div>
              </div>

              <form onSubmit={(e) => void handleSaveNotes(e)} className="space-y-3">
                <label
                  htmlFor="candidate-private-notes"
                  className="sr-only"
                >
                  Private recruiter notes for {candidate.display_name}
                </label>
                <textarea
                  id="candidate-private-notes"
                  name="private_notes"
                  rows={3}
                  value={privateNotes}
                  onChange={(e) => setPrivateNotes(e.target.value)}
                  placeholder="Record confidential interview observations, role fit, or follow-up questions for your hiring team..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSavingNotes}
                    loadingText="Saving Note..."
                    leftIcon={<Save className="h-3.5 w-3.5" aria-hidden="true" />}
                  >
                    {isShortlisted
                      ? 'Save Private Notes'
                      : 'Shortlist & Save Notes'}
                  </Button>
                </div>
              </form>
            </section>
          </>
        )}
      </div>
    </RecruiterShell>
  );
}

