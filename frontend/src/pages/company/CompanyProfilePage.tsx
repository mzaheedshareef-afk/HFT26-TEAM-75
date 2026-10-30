import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Globe, Save, ShieldCheck } from 'lucide-react';
import { RecruiterShell } from '../../components/recruiter/RecruiterShell';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Button } from '../../components/ui/Button';
import { ProfilePageSkeleton } from '../../components/ui/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';
import { recruiterService } from '../../services/recruiterService';
import { extractApiErrorMessage } from '../../services/api';
import type { CompanyProfile } from '../../types/recruiter';

function parseCommaValues(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function isValidOptionalUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function CompanyProfilePage() {
  const { user, accessToken, establishSession } = useAuth();

  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form fields
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [headquarters, setHeadquarters] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [description, setDescription] = useState('');
  const [hiringDomainsText, setHiringDomainsText] = useState('');
  const [targetRolesText, setTargetRolesText] = useState('');
  const [preferredLanguagesText, setPreferredLanguagesText] = useState('');

  // Field-level deferred validation errors (validate on blur, clear on input)
  const [nameError, setNameError] = useState<string | null>(null);
  const [websiteError, setWebsiteError] = useState<string | null>(null);

  const hydrateForm = (loaded: CompanyProfile) => {
    setProfile(loaded);
    setCompanyName(loaded.company_name);
    setIndustry(loaded.industry);
    setCompanySize(loaded.company_size);
    setHeadquarters(loaded.headquarters);
    setWebsiteUrl(loaded.website_url);
    setDescription(loaded.description);
    setHiringDomainsText(loaded.hiring_domains.join(', '));
    setTargetRolesText(loaded.target_roles.join(', '));
    setPreferredLanguagesText(loaded.preferred_languages.join(', '));
  };

  const loadCompanyProfile = useCallback(
    async (isCancelled?: () => boolean) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await recruiterService.getCompanyProfile();
        if (isCancelled?.()) return;
        hydrateForm(data);
      } catch (error) {
        if (isCancelled?.()) return;
        setErrorMessage(
          extractApiErrorMessage(
            error,
            'Unable to load company profile details.'
          )
        );
      } finally {
        if (!isCancelled?.()) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    void loadCompanyProfile(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadCompanyProfile]);

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    let hasValidationError = false;
    if (!companyName.trim()) {
      setNameError('Company name is required.');
      hasValidationError = true;
    }
    if (!isValidOptionalUrl(websiteUrl)) {
      setWebsiteError('Please enter a valid http:// or https:// website URL.');
      hasValidationError = true;
    }
    if (hasValidationError) return;

    setIsSaving(true);
    try {
      const updated = await recruiterService.updateCompanyProfile({
        company_name: companyName.trim(),
        industry: industry.trim(),
        company_size: companySize.trim(),
        headquarters: headquarters.trim(),
        website_url: websiteUrl.trim(),
        description: description.trim(),
        hiring_domains: parseCommaValues(hiringDomainsText),
        target_roles: parseCommaValues(targetRolesText),
        preferred_languages: parseCommaValues(preferredLanguagesText),
      });

      hydrateForm(updated);
      if (user && accessToken && updated.company_name !== user.name) {
        establishSession({
          accessToken,
          tokenType: 'bearer',
          user: {
            ...user,
            name: updated.company_name,
          },
        });
      }
      setSuccessMessage('Company profile updated successfully.');
    } catch (error) {
      setErrorMessage(
        extractApiErrorMessage(
          error,
          'Unable to save company profile updates.'
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RecruiterShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Company Profile
          </h1>
          <p className="text-sm text-slate-600">
            View and update your organization&apos;s recruiting profile, engineering domains, and target technical roles.
          </p>
        </div>

        {errorMessage && (
          <AlertBanner
            variant="error"
            title="Company Profile Error"
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
          />
        )}

        {successMessage && (
          <AlertBanner
            variant="success"
            title="Company Profile Saved"
            message={successMessage}
            onDismiss={() => setSuccessMessage(null)}
          />
        )}

        {isLoading ? (
          <ProfilePageSkeleton label="Loading company profile..." />
        ) : (
          <>
            {/* Read-Only Organization Summary Header */}
            {profile && (
              <section
                aria-label="Current company profile summary"
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shrink-0">
                    <Building2 className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="space-y-0.5">
                    <h2 className="text-lg font-bold text-slate-900">
                      {profile.company_name}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {profile.industry}
                      {profile.headquarters ? ` · ${profile.headquarters}` : ''}
                      {profile.company_size ? ` · ${profile.company_size}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {profile.website_url && (
                    <a
                      href={profile.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-blue-700 hover:underline"
                    >
                      <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{profile.website_url}</span>
                    </a>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Verified Company Account</span>
                  </span>
                </div>
              </section>
            )}

            {/* Update Company Profile Form */}
            <form
              method="POST"
              onSubmit={(e) => void handleSaveProfile(e)}
              className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-bold text-slate-900">
                  Update Organization Information
                </h2>
                <p className="text-xs text-slate-500">
                  Update permitted company information. Official login email and authentication credentials are protected and cannot be exposed or modified here.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="company-profile-name"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Company Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="company-profile-name"
                    name="company_name"
                    type="text"
                    required
                    value={companyName}
                    aria-invalid={Boolean(nameError)}
                    aria-describedby={
                      nameError ? 'company-name-error' : undefined
                    }
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      if (nameError) setNameError(null);
                    }}
                    onBlur={() => {
                      if (!companyName.trim()) {
                        setNameError('Company name is required.');
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                  {nameError && (
                    <p
                      id="company-name-error"
                      role="alert"
                      className="text-xs font-medium text-red-600"
                    >
                      {nameError}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="company-profile-industry"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Industry
                  </label>
                  <input
                    id="company-profile-industry"
                    name="industry"
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="e.g., Cloud Infrastructure & FinTech"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="company-profile-size"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Company Size
                  </label>
                  <select
                    id="company-profile-size"
                    name="company_size"
                    value={companySize}
                    onChange={(e) => setCompanySize(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="1–10 employees">1–10 employees</option>
                    <option value="11–50 employees">11–50 employees</option>
                    <option value="51–200 employees">51–200 employees</option>
                    <option value="201–1,000 employees">
                      201–1,000 employees
                    </option>
                    <option value="1,000+ employees">1,000+ employees</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="company-profile-hq"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Headquarters / Location
                  </label>
                  <input
                    id="company-profile-hq"
                    name="headquarters"
                    type="text"
                    value={headquarters}
                    onChange={(e) => setHeadquarters(e.target.value)}
                    placeholder="e.g., Hyderabad, India · Remote-First"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="company-profile-website"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Official Website URL
                </label>
                <input
                  id="company-profile-website"
                  name="website_url"
                  type="url"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={websiteUrl}
                  aria-invalid={Boolean(websiteError)}
                  aria-describedby={
                    websiteError ? 'company-website-error' : undefined
                  }
                  onChange={(e) => {
                    setWebsiteUrl(e.target.value);
                    if (websiteError) setWebsiteError(null);
                  }}
                  onBlur={() => {
                    if (!isValidOptionalUrl(websiteUrl)) {
                      setWebsiteError(
                        'Please enter a valid http:// or https:// website URL.'
                      );
                    }
                  }}
                  placeholder="https://engineering.acme.io"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                {websiteError && (
                  <p
                    id="company-website-error"
                    role="alert"
                    className="text-xs font-medium text-red-600"
                  >
                    {websiteError}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="company-profile-description"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Company &amp; Engineering Overview
                </label>
                <textarea
                  id="company-profile-description"
                  name="description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your engineering culture, technical challenges, and product stack..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="company-hiring-domains"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Hiring Domains (comma-separated)
                  </label>
                  <input
                    id="company-hiring-domains"
                    name="hiring_domains"
                    type="text"
                    value={hiringDomainsText}
                    onChange={(e) => setHiringDomainsText(e.target.value)}
                    placeholder="Distributed Systems, AI Platform"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="company-target-roles"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Target Roles (comma-separated)
                  </label>
                  <input
                    id="company-target-roles"
                    name="target_roles"
                    type="text"
                    value={targetRolesText}
                    onChange={(e) => setTargetRolesText(e.target.value)}
                    placeholder="Backend Engineer, Systems SDE"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="company-preferred-languages"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Preferred Languages (comma-separated)
                  </label>
                  <input
                    id="company-preferred-languages"
                    name="preferred_languages"
                    type="text"
                    value={preferredLanguagesText}
                    onChange={(e) => setPreferredLanguagesText(e.target.value)}
                    placeholder="Python, Go, TypeScript, C++"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSaving}
                  loadingText="Saving Company Profile..."
                  leftIcon={<Save className="h-4 w-4" aria-hidden="true" />}
                >
                  Save Company Profile
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </RecruiterShell>
  );
}

