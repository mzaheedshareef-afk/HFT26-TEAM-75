import {
  Activity,
  Award,
  CheckCircle2,
  Code2,
  ExternalLink,
  FolderGit2,
  Gauge,
  Globe,
  Layers,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { InfoTooltip } from '../ui/InfoTooltip';
import type { PublicStudentProfile } from '../../types/profile';

interface PublicProfileCardProps {
  profile: PublicStudentProfile;
  isPreview?: boolean;
}

export function PublicProfileCard({
  profile,
  isPreview = false,
}: PublicProfileCardProps) {
  const perf = profile.assessment_performance;
  const hasEfficiency =
    typeof perf.ai_efficiency_score === 'number' &&
    Number.isFinite(perf.ai_efficiency_score);

  return (
    <article
      aria-label={`Public profile for ${profile.display_name}`}
      className="space-y-6"
    >
      {/* 1 & 2. Student Name, Headline & Profile Summary */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              <span>
                {isPreview
                  ? 'Live Public Profile Preview'
                  : 'GateCode Verified Candidate Profile'}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {profile.display_name}
            </h1>
            <p className="text-sm font-medium text-slate-600">
              {profile.headline}
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 self-start rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
            <Globe className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
            <span>
              {profile.visibility === 'public'
                ? 'Public Directory Profile'
                : 'Shareable Link Profile'}
            </span>
          </span>
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Profile Summary
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {profile.summary ||
              'No public profile summary has been added yet.'}
          </p>
        </div>
      </section>

      {/* 7, 9, 10. Assessment Performance, Consistency & Improvement Over Time */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold text-slate-900">
            Verified Assessment Performance
          </h2>
          <p className="text-xs text-slate-500">
            Portfolio-calibrated coding assessment metrics, performance consistency, and trajectory over time.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-1">
            <span className="text-xs font-medium text-slate-500">
              Assessments Completed
            </span>
            <p className="text-xl font-bold tabular-nums text-slate-900">
              {perf.total_assessments_completed}
            </p>
            <p className="text-[11px] text-slate-500">
              {perf.completion_rate !== null
                ? `${Math.round(perf.completion_rate)}% completion rate`
                : 'Verified sandbox sessions'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-1">
            <span className="text-xs font-medium text-slate-500">
              Average &amp; Highest Score
            </span>
            <p className="text-xl font-bold tabular-nums text-slate-900">
              {perf.average_score !== null
                ? `${Math.round(perf.average_score)} / 100`
                : 'Not Yet Graded'}
            </p>
            <p className="text-[11px] text-slate-500">
              {perf.highest_score !== null
                ? `Peak Score: ${Math.round(perf.highest_score)} / 100`
                : 'Awaiting completed sessions'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-1">
            <span className="text-xs font-medium text-slate-500">
              Coding Score
            </span>
            <p className="text-xl font-bold tabular-nums text-slate-900">
              {perf.coding_score !== null
                ? `${Math.round(perf.coding_score)} / 100`
                : 'Not Yet Graded'}
            </p>
            <p className="text-[11px] text-slate-500">
              Deterministic test suite score
            </p>
          </div>

          <div className="rounded-lg border border-blue-200/80 bg-blue-50/40 p-4 space-y-1">
            <div className="flex items-center justify-between text-xs font-medium text-slate-700">
              <span className="inline-flex items-center gap-1">
                <span>AI Efficiency Score</span>
                <InfoTooltip label="About public AI Efficiency Score">
                  Official AI Efficiency Score returned by the backend grading engine. Never calculated in the frontend.
                </InfoTooltip>
              </span>
              <Gauge className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
            </div>
            <p className="text-xl font-bold tabular-nums text-slate-900">
              {hasEfficiency
                ? `${Math.round(perf.ai_efficiency_score as number)} / 100`
                : 'Pending Backend'}
            </p>
            <p className="text-[11px] text-slate-500">
              Official backend efficiency rating
            </p>
          </div>
        </div>

        {/* Performance Consistency & Improvement Over Time */}
        <div className="grid gap-4 sm:grid-cols-2 border-t border-slate-100 pt-4">
          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-800">
              <Activity className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Performance Consistency
              </p>
              <p className="text-sm font-bold text-slate-900">
                {profile.consistency.score !== null
                  ? `${Math.round(profile.consistency.score)} / 100 · ${
                      profile.consistency.label
                    }`
                  : profile.consistency.label}
              </p>
              {profile.consistency.summary && (
                <p className="text-xs text-slate-600">
                  {profile.consistency.summary}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Improvement Over Time
              </p>
              <p className="text-sm font-bold text-slate-900">
                {profile.improvement.delta_percentage !== null
                  ? `${
                      profile.improvement.delta_percentage >= 0 ? '+' : ''
                    }${profile.improvement.delta_percentage.toFixed(1)}% · ${
                      profile.improvement.label
                    }`
                  : profile.improvement.label}
              </p>
              {profile.improvement.summary && (
                <p className="text-xs text-slate-600">
                  {profile.improvement.summary}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3 & 4. Skills & Technologies */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-900">Skills</h2>
          </div>
          {profile.skills.length === 0 ? (
            <p className="text-xs text-slate-500">No skills listed yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-md border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-xs font-semibold text-blue-900"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-slate-700" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-900">
              Technologies &amp; Frameworks
            </h2>
          </div>
          {profile.technologies.length === 0 ? (
            <p className="text-xs text-slate-500">
              No technologies or frameworks listed yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {profile.technologies.map((tech) => (
                <span
                  key={tech}
                  className="rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800"
                >
                  {tech}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 5 & 6. Projects & Portfolio Information */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-900">
              Engineering Projects
            </h2>
          </div>

          {profile.projects.length === 0 ? (
            <p className="text-xs text-slate-500">
              No public engineering projects added yet.
            </p>
          ) : (
            <div className="space-y-3">
              {profile.projects.map((proj) => (
                <div
                  key={proj.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {proj.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs">
                      {proj.repo_url && (
                        <a
                          href={proj.repo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                        >
                          <span>Repository</span>
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      )}
                      {proj.live_url && (
                        <a
                          href={proj.live_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-slate-700 hover:underline"
                        >
                          <span>Live Demo</span>
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
                  {proj.description && (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {proj.description}
                    </p>
                  )}
                  {proj.technologies.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {proj.technologies.map((tag) => (
                        <span
                          key={`${proj.id}-${tag}`}
                          className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h2 className="text-base font-semibold text-slate-900">
            Portfolio Information
          </h2>
          <div className="space-y-3 text-xs">
            {profile.portfolio_info.github_url ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                <p className="font-medium text-slate-500">GitHub Profile</p>
                <a
                  href={profile.portfolio_info.github_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline break-all"
                >
                  <span>{profile.portfolio_info.github_url}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            ) : (
              <p className="text-slate-500">No public GitHub link shared.</p>
            )}

            {profile.portfolio_info.linkedin_url && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                <p className="font-medium text-slate-500">LinkedIn</p>
                <a
                  href={profile.portfolio_info.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline break-all"
                >
                  <span>{profile.portfolio_info.linkedin_url}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            )}

            {profile.portfolio_info.experience_level && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-slate-500 font-medium">
                  Calibrated Level
                </span>
                <span className="font-semibold text-slate-900 capitalize">
                  {profile.portfolio_info.experience_level}
                </span>
              </div>
            )}

            {profile.portfolio_info.calibrated_tracks.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-slate-500 font-medium">
                  Calibrated Engineering Tracks
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.portfolio_info.calibrated_tracks.map((track) => (
                    <span
                      key={track}
                      className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-medium text-slate-800"
                    >
                      {track}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 8. Verified Assessment Achievements */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-amber-600" aria-hidden="true" />
          <h2 className="text-base font-semibold text-slate-900">
            Verified Assessment Achievements
          </h2>
        </div>

        {profile.verified_achievements.length === 0 ? (
          <p className="text-xs text-slate-500">
            Verified achievements unlock automatically as assessments are completed and graded by the backend.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profile.verified_achievements.map((ach) => (
              <div
                key={ach.id}
                className="flex items-start gap-3 rounded-lg border border-emerald-200/80 bg-emerald-50/40 p-3.5"
              >
                <CheckCircle2
                  className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5"
                  aria-hidden="true"
                />
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-900">
                    {ach.title}
                  </p>
                  {ach.description && (
                    <p className="text-[11px] text-slate-600 leading-snug">
                      {ach.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}

