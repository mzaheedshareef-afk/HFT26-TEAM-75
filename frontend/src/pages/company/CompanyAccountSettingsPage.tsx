import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Save, ShieldCheck, Sliders } from 'lucide-react';
import { RecruiterShell } from '../../components/recruiter/RecruiterShell';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Button } from '../../components/ui/Button';
import { ProfilePageSkeleton } from '../../components/ui/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';
import { recruiterService } from '../../services/recruiterService';
import { extractApiErrorMessage } from '../../services/api';
import type {
  CompanyNotificationPreferences,
  CompanyProfile,
} from '../../types/recruiter';

export function CompanyAccountSettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [defaultView, setDefaultView] = useState<'cards' | 'table'>('cards');
  const [notifications, setNotifications] =
    useState<CompanyNotificationPreferences>({
      shortlist_alerts: true,
      weekly_talent_digest: true,
      assessment_completion_updates: true,
    });

  const loadSettings = useCallback(async (isCancelled?: () => boolean) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await recruiterService.getCompanyProfile();
      if (isCancelled?.()) return;
      setProfile(data);
      setDefaultView(data.default_discovery_view);
      setNotifications(data.notification_preferences);
    } catch (error) {
      if (isCancelled?.()) return;
      setErrorMessage(
        extractApiErrorMessage(
          error,
          'Unable to load company account settings.'
        )
      );
    } finally {
      if (!isCancelled?.()) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadSettings(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadSettings]);

  const handleSaveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updated = await recruiterService.updateCompanySettings({
        default_discovery_view: defaultView,
        notification_preferences: notifications,
      });
      setProfile(updated);
      setDefaultView(updated.default_discovery_view);
      setNotifications(updated.notification_preferences);
      setSuccessMessage('Company recruiter settings saved successfully.');
    } catch (error) {
      setErrorMessage(
        extractApiErrorMessage(
          error,
          'Unable to save company settings right now.'
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleAccountLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <RecruiterShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Account Settings
          </h1>
          <p className="text-sm text-slate-600">
            Review your authenticated company account details, manage recruiter workspace preferences, and control your session.
          </p>
        </div>

        {errorMessage && (
          <AlertBanner
            variant="error"
            title="Account Settings Error"
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
          />
        )}

        {successMessage && (
          <AlertBanner
            variant="success"
            title="Settings Updated"
            message={successMessage}
            onDismiss={() => setSuccessMessage(null)}
          />
        )}

        {isLoading ? (
          <ProfilePageSkeleton label="Loading company account settings..." />
        ) : (
          <>
            {/* Authenticated Account Details (Never Exposes Credentials/Tokens) */}
            <section
              aria-labelledby="account-details-heading"
              className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h2
                    id="account-details-heading"
                    className="text-base font-bold text-slate-900"
                  >
                    Authenticated Company Account Details
                  </h2>
                  <p className="text-xs text-slate-500">
                    Authentication tokens, passwords, and secrets are strictly redacted and never exposed in the browser UI.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Credentials Protected</span>
                </span>
              </div>

              <dl className="grid gap-4 sm:grid-cols-3 text-xs">
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-1">
                  <dt className="font-semibold text-slate-500">
                    Organization Name
                  </dt>
                  <dd className="text-sm font-bold text-slate-900">
                    {profile?.company_name || user?.name || 'Company Account'}
                  </dd>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-1">
                  <dt className="font-semibold text-slate-500">
                    Official Account Email
                  </dt>
                  <dd className="text-sm font-semibold text-slate-900 break-all">
                    {profile?.official_email || user?.email || '—'}
                  </dd>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-1">
                  <dt className="font-semibold text-slate-500">
                    Account Role &amp; Org ID
                  </dt>
                  <dd className="text-sm font-mono font-semibold text-slate-900">
                    COMPANY &middot; {profile?.company_id || user?.id || '—'}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Recruiter Workspace & Notification Settings */}
            <form
              method="POST"
              onSubmit={(e) => void handleSaveSettings(e)}
              className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                <Sliders
                  className="h-4 w-4 text-blue-600"
                  aria-hidden="true"
                />
                <h2 className="text-base font-bold text-slate-900">
                  Recruiter Workspace Preferences
                </h2>
              </div>

              <fieldset className="space-y-2.5">
                <legend className="text-xs font-semibold text-slate-800">
                  Default Candidate Discovery Display
                </legend>
                <div className="flex flex-wrap gap-4 text-xs text-slate-700">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="default_discovery_view"
                      value="cards"
                      checked={defaultView === 'cards'}
                      onChange={() => setDefaultView('cards')}
                    />
                    <span>Candidate Cards Grid</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="default_discovery_view"
                      value="table"
                      checked={defaultView === 'table'}
                      onChange={() => setDefaultView('table')}
                    />
                    <span>Structured Comparison Table</span>
                  </label>
                </div>
              </fieldset>

              <fieldset className="space-y-3 border-t border-slate-100 pt-4">
                <legend className="text-xs font-semibold text-slate-800">
                  Recruiter Email Notifications
                </legend>

                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    name="shortlist_alerts"
                    checked={notifications.shortlist_alerts}
                    onChange={(e) =>
                      setNotifications((prev) => ({
                        ...prev,
                        shortlist_alerts: e.target.checked,
                      }))
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <strong>Shortlist Team Alerts</strong> — Receive updates when shortlisted candidates complete new verified assessments.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    name="weekly_talent_digest"
                    checked={notifications.weekly_talent_digest}
                    onChange={(e) =>
                      setNotifications((prev) => ({
                        ...prev,
                        weekly_talent_digest: e.target.checked,
                      }))
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <strong>Weekly Verified Talent Digest</strong> — Summary of newly shared candidate profiles matching your hiring domains.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    name="assessment_completion_updates"
                    checked={notifications.assessment_completion_updates}
                    onChange={(e) =>
                      setNotifications((prev) => ({
                        ...prev,
                        assessment_completion_updates: e.target.checked,
                      }))
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <strong>Assessment Benchmark Updates</strong> — Platform notifications when new domain calibration tracks are released.
                  </span>
                </label>
              </fieldset>

              <div className="flex justify-end border-t border-slate-100 pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSaving}
                  loadingText="Saving Preferences..."
                  leftIcon={<Save className="h-3.5 w-3.5" aria-hidden="true" />}
                >
                  Save Workspace Settings
                </Button>
              </div>
            </form>

            {/* Session Control & Log Out */}
            <section
              aria-labelledby="session-control-heading"
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div className="space-y-1">
                <h2
                  id="session-control-heading"
                  className="text-sm font-bold text-slate-900"
                >
                  Company Session Control
                </h2>
                <p className="text-xs text-slate-500">
                  Log out of this browser session and clear local comparison tray state.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAccountLogout}
                leftIcon={<LogOut className="h-4 w-4" aria-hidden="true" />}
              >
                Log Out of Company Account
              </Button>
            </section>
          </>
        )}
      </div>
    </RecruiterShell>
  );
}

