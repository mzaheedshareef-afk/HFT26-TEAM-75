import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FolderGit2,
  RefreshCw,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { PortfolioUploadForm } from '../../components/portfolio/PortfolioUploadForm';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Button } from '../../components/ui/Button';
import { portfolioService } from '../../services/portfolioService';
import { extractApiErrorMessage } from '../../services/api';
import type {
  PortfolioIngestionStatus,
  PortfolioProfile,
  PortfolioUploadInput,
} from '../../types/portfolio';

const statusBadgeMap: Record<
  PortfolioIngestionStatus,
  { label: string; className: string }
> = {
  not_uploaded: {
    label: 'Not Uploaded',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
  },
  pending: {
    label: 'Queued for Analysis',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  analyzing: {
    label: 'Analyzing Repositories',
    className: 'border-blue-200 bg-blue-50 text-blue-800',
  },
  ready: {
    label: 'Calibrated & Ready',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  failed: {
    label: 'Analysis Failed',
    className: 'border-red-200 bg-red-50 text-red-800',
  },
};

export function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<PortfolioProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [fetchNotice, setFetchNotice] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const loadPortfolio = useCallback(async () => {
    setIsLoadingProfile(true);
    setFetchNotice(null);
    try {
      const data = await portfolioService.getMyPortfolio();
      setPortfolio(data);
    } catch (error) {
      setFetchNotice(
        extractApiErrorMessage(
          error,
          'Portfolio service is currently unreachable.'
        )
      );
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  const handleUpload = async (input: PortfolioUploadInput) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const response = await portfolioService.uploadPortfolio(input);
      if (response.portfolio) {
        setPortfolio(response.portfolio);
      }
      setSubmitSuccess(
        response.message ||
          'Portfolio submitted successfully for adaptive assessment calibration.'
      );
    } catch (error) {
      setSubmitError(
        extractApiErrorMessage(
          error,
          'Unable to upload portfolio. Please verify the backend portfolio endpoint is active.'
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStatus: PortfolioIngestionStatus =
    portfolio?.status ?? 'not_uploaded';
  const badge = statusBadgeMap[currentStatus];

  return (
    <DashboardShell role="student">
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Engineering Portfolio &amp; Stack Profile
            </h1>
            <p className="text-sm text-slate-600">
              Connect your GitHub repositories and technical artifacts so GateCode can calibrate coding tasks to your real work.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadPortfolio()}
              disabled={isLoadingProfile}
              leftIcon={
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    isLoadingProfile ? 'animate-spin' : ''
                  }`}
                />
              }
            >
              Refresh Status
            </Button>
            <Link
              to="/student/assessment/instructions"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              <span>Assessment Briefing</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {fetchNotice && (
          <AlertBanner
            variant="info"
            title="Portfolio Service Status"
            message={fetchNotice}
            onDismiss={() => setFetchNotice(null)}
          />
        )}

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Upload Form Card */}
          <section className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-semibold text-slate-900">
                Submit or Update Portfolio Sources
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                All repository links and uploaded files are sent directly to the portfolio ingestion service.
              </p>
            </div>

            <PortfolioUploadForm
              key={portfolio?.id || 'empty-portfolio'}
              initialGithubUrl={portfolio?.githubUrl || ''}
              initialLanguages={portfolio?.primaryLanguages || []}
              initialFrameworks={portfolio?.frameworks || []}
              isSubmitting={isSubmitting}
              serverError={submitError}
              successMessage={submitSuccess}
              onDismissError={() => setSubmitError(null)}
              onSubmit={handleUpload}
            />
          </section>

          {/* Current Ingestion Status Sidebar */}
          <aside className="lg:col-span-4 space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">
                  Ingestion Status
                </h2>
                <span
                  className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>

              {isLoadingProfile ? (
                <div className="flex items-center gap-2 py-4 text-xs text-slate-500">
                  <Clock className="h-4 w-4 animate-pulse" />
                  <span>Checking current portfolio record...</span>
                </div>
              ) : !portfolio ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-600 space-y-1.5">
                  <p className="font-medium text-slate-800">
                    No portfolio record on file
                  </p>
                  <p className="leading-relaxed">
                    Submit your GitHub URL and primary languages on the left to initialize adaptive challenge generation.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                    <p className="text-slate-500 font-medium">Linked GitHub</p>
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
                        Declared Languages
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {portfolio.primaryLanguages.map((lang) => (
                          <span
                            key={lang}
                            className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-medium text-slate-700"
                          >
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {portfolio.updatedAt && (
                    <p className="text-[11px] text-slate-400 pt-1">
                      Last updated:{' '}
                      {new Date(portfolio.updatedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FolderGit2 className="h-4 w-4 text-blue-600" />
                <span>How Calibration Works</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Extracts real language distribution and project structure from public repositories.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Selects validated coding problems matching your demonstrated technical domain.
                  </span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}
