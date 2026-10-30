import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  ExternalLink,
  FolderGit2,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { ScoreSummaryCard } from '../../components/assessment/ScoreSummaryCard';
import { Button } from '../../components/ui/Button';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { useAuth } from '../../context/AuthContext';
import { portfolioService } from '../../services/portfolioService';
import { assessmentService } from '../../services/assessmentService';
import type { PortfolioProfile } from '../../types/portfolio';
import type { ScoreSummary } from '../../types/assessment';

export function StudentDashboardPage() {
  const { user } = useAuth();

  const [portfolio, setPortfolio] = useState<PortfolioProfile | null>(null);
  const [latestScore, setLatestScore] = useState<ScoreSummary | null>(null);
  const [isSyncing, setIsSyncing] = useState(true);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const loadWorkspaceData = useCallback(
    async (isCancelled?: () => boolean) => {
      setIsSyncing(true);
      setSyncNotice(null);

      const [portfolioResult, scoreResult] = await Promise.allSettled([
        portfolioService.getMyPortfolio(),
        assessmentService.getLatestScoreSummary(),
      ]);

      if (isCancelled?.()) return;

      if (portfolioResult.status === 'fulfilled') {
        setPortfolio(portfolioResult.value);
      }
      if (scoreResult.status === 'fulfilled') {
        setLatestScore(scoreResult.value);
      }

      if (
        portfolioResult.status === 'rejected' &&
        scoreResult.status === 'rejected'
      ) {
        setSyncNotice(
          'Portfolio and assessment endpoints are not currently reachable. You can still configure your portfolio upload and explore the assessment workspace.'
        );
      }

      setIsSyncing(false);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    void loadWorkspaceData(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadWorkspaceData]);

  return (
    <DashboardShell role="student">
      <div className="space-y-8">
        {/* Welcome & Quick Actions Banner */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2
                  className="h-4 w-4 text-emerald-600"
                  aria-hidden="true"
                />
                <span>Authenticated Candidate Session</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Welcome, {user?.name || 'Candidate'}
              </h1>
              <p className="text-sm text-slate-600">
                Manage your engineering portfolio, review sandbox specifications, and launch adaptive coding assessments.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {user && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-600">
                  <span className="font-medium text-slate-800">ID:</span>{' '}
                  <span className="font-mono">{user.id}</span> &middot;{' '}
                  <span className="uppercase font-mono">{user.role}</span>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSyncing}
                onClick={() => void loadWorkspaceData()}
                leftIcon={
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${
                      isSyncing ? 'animate-spin' : ''
                    }`}
                  />
                }
              >
                Sync Workspace
              </Button>
            </div>
          </div>

          {/* Primary Candidate Action Bar */}
          <div className="grid gap-3 sm:grid-cols-3 border-t border-slate-100 pt-5">
            <Link
              to="/student/portfolio"
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4 hover:border-blue-600 hover:bg-blue-50/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-800 group-hover:text-blue-600">
                  <FolderGit2 className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Upload Portfolio
                  </p>
                  <p className="text-xs text-slate-500">
                    GitHub &amp; project artifacts
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
            </Link>

            <Link
              to="/student/assessment/instructions"
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4 hover:border-blue-600 hover:bg-blue-50/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-800 group-hover:text-blue-600">
                  <Terminal className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Assessment Briefing
                  </p>
                  <p className="text-xs text-slate-500">
                    Rules &amp; sandbox constraints
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
            </Link>

            <Link
              to="/student/assessment/workspace"
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4 hover:border-blue-600 hover:bg-blue-50/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-800 group-hover:text-blue-600">
                  <Code2 className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Coding Workspace
                  </p>
                  <p className="text-xs text-slate-500">
                    Monaco IDE &amp; test runner
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
            </Link>
          </div>
        </section>

        {syncNotice && (
          <AlertBanner
            variant="info"
            title="Backend Integration Notice"
            message={syncNotice}
            onDismiss={() => setSyncNotice(null)}
          />
        )}

        {/* Two-Column Status & Evaluation Grid */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Portfolio Calibration Card */}
          <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 shadow-2xs flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  Portfolio Calibration
                </h2>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700 capitalize">
                  {portfolio?.status?.replace('_', ' ') || 'Not Uploaded'}
                </span>
              </div>

              {!portfolio ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-5 text-center space-y-2">
                  <p className="text-sm font-medium text-slate-800">
                    No Portfolio Connected Yet
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Link your GitHub profile and select your primary programming languages to calibrate your coding challenges.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                    <p className="text-slate-500 font-medium">GitHub Source</p>
                    <a
                      href={portfolio.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline break-all"
                    >
                      <span>{portfolio.githubUrl}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>

                  {portfolio.primaryLanguages.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-slate-500 font-medium">
                        Calibrated Stack
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {portfolio.primaryLanguages.map((lang) => (
                          <span
                            key={lang}
                            className="rounded-md border border-blue-200/70 bg-blue-50 px-2 py-0.5 font-medium text-blue-800"
                          >
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link
              to="/student/portfolio"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            >
              <span>
                {portfolio ? 'Update Portfolio Sources' : 'Configure Portfolio'}
              </span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>

          {/* Right Column: Latest Score Summary */}
          <div className="lg:col-span-7 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Latest Assessment Result
            </h2>
            <ScoreSummaryCard summary={latestScore} />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
