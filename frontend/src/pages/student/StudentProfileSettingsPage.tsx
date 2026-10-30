import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Link2,
  Lock,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { PublicProfileCard } from '../../components/profile/PublicProfileCard';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Button } from '../../components/ui/Button';
import { ProfilePageSkeleton } from '../../components/ui/LoadingSkeleton';
import {
  buildShareableProfileUrl,
  profileService,
  toPublicProfilePreview,
} from '../../services/profileService';
import { extractApiErrorMessage } from '../../services/api';
import type {
  ProfileProjectSummary,
  ProfileVisibility,
  StudentProfileSettings,
} from '../../types/profile';

function parseCommaList(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

const VISIBILITY_OPTIONS: Array<{
  value: ProfileVisibility;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: 'private',
    title: 'Private',
    description:
      'Only visible to you. All public and shareable URLs are blocked.',
    icon: Lock,
  },
  {
    value: 'public',
    title: 'Public',
    description:
      'Publicly viewable with verified assessment metrics and portfolio.',
    icon: Globe,
  },
  {
    value: 'shareable_link',
    title: 'Shareable Link',
    description:
      'Unlisted — accessible only to recruiters with your shareable URL.',
    icon: Link2,
  },
];

export function StudentProfileSettingsPage() {
  const [profile, setProfile] = useState<StudentProfileSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Editable form fields
  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [summary, setSummary] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [technologiesText, setTechnologiesText] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [projects, setProjects] = useState<ProfileProjectSummary[]>([]);

  const syncFormFromProfile = (loaded: StudentProfileSettings) => {
    setProfile(loaded);
    setDisplayName(loaded.display_name);
    setHeadline(loaded.headline);
    setSummary(loaded.summary);
    setSkillsText(loaded.skills.join(', '));
    setTechnologiesText(loaded.technologies.join(', '));
    setGithubUrl(loaded.portfolio_info.github_url ?? '');
    setLinkedinUrl(loaded.portfolio_info.linkedin_url ?? '');
    setProjects(loaded.projects);
  };

  const loadProfile = useCallback(async (isCancelled?: () => boolean) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await profileService.getMyProfile();
      if (isCancelled?.()) return;
      syncFormFromProfile(data);
    } catch (error) {
      if (isCancelled?.()) return;
      setErrorMessage(
        extractApiErrorMessage(
          error,
          'Unable to load student profile settings.'
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
    void loadProfile(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  const liveDraftSettings: StudentProfileSettings | null = useMemo(() => {
    if (!profile) return null;
    return {
      ...profile,
      display_name: displayName.trim() || profile.display_name,
      headline: headline.trim() || profile.headline,
      summary: summary.trim(),
      skills: parseCommaList(skillsText),
      technologies: parseCommaList(technologiesText),
      projects,
      portfolio_info: {
        ...profile.portfolio_info,
        github_url: githubUrl.trim() || undefined,
        linkedin_url: linkedinUrl.trim() || undefined,
      },
    };
  }, [
    displayName,
    githubUrl,
    headline,
    linkedinUrl,
    profile,
    projects,
    skillsText,
    summary,
    technologiesText,
  ]);

  const resolvedShareUrl = useMemo(() => {
    if (!profile || !profile.is_sharing_enabled) return null;
    return (
      profile.share_url ??
      buildShareableProfileUrl(profile.share_slug, profile.share_url)
    );
  }, [profile]);

  const handleVisibilityChange = async (nextVisibility: ProfileVisibility) => {
    if (!profile || isUpdatingVisibility) return;

    setIsUpdatingVisibility(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setCopiedUrl(false);

    try {
      const updated = await profileService.updateProfileVisibility({
        visibility: nextVisibility,
        is_sharing_enabled: nextVisibility !== 'private',
      });
      syncFormFromProfile(updated);
      setSuccessMessage(
        nextVisibility === 'private'
          ? 'Profile sharing disabled. Your profile is now Private.'
          : nextVisibility === 'public'
          ? 'Profile visibility updated to Public.'
          : 'Shareable Link enabled. Anyone with your link can view your verified profile.'
      );
    } catch (error) {
      setErrorMessage(
        extractApiErrorMessage(
          error,
          'Unable to update profile visibility right now.'
        )
      );
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const handleToggleSharing = async () => {
    if (!profile) return;
    if (profile.is_sharing_enabled) {
      await handleVisibilityChange('private');
    } else {
      await handleVisibilityChange('shareable_link');
    }
  };

  const handleCopyProfileUrl = async () => {
    if (!resolvedShareUrl) return;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(resolvedShareUrl);
      }
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      setErrorMessage(
        'Could not automatically copy to clipboard. You can select and copy the URL directly.'
      );
    }
  };

  const handleAddProject = () => {
    setProjects((prev) => [
      ...prev,
      {
        id: `proj-${Date.now()}`,
        title: '',
        description: '',
        technologies: [],
        repo_url: '',
      },
    ]);
  };

  const handleProjectFieldChange = (
    index: number,
    field: 'title' | 'description' | 'repo_url' | 'technologies',
    value: string
  ) => {
    setProjects((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        if (field === 'technologies') {
          return { ...item, technologies: parseCommaList(value) };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const handleRemoveProject = (index: number) => {
    setProjects((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveProfileDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!displayName.trim()) {
      setErrorMessage('Display name is required for your candidate profile.');
      return;
    }

    setIsSavingDetails(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const cleanedProjects = projects
        .filter((p) => p.title.trim().length > 0)
        .map((p) => ({
          ...p,
          title: p.title.trim(),
          description: p.description.trim(),
          repo_url: p.repo_url?.trim() || undefined,
        }));

      const updated = await profileService.updateMyProfile({
        display_name: displayName.trim(),
        headline: headline.trim(),
        summary: summary.trim(),
        skills: parseCommaList(skillsText),
        technologies: parseCommaList(technologiesText),
        projects: cleanedProjects,
        github_url: githubUrl.trim() || undefined,
        linkedin_url: linkedinUrl.trim() || undefined,
      });

      syncFormFromProfile(updated);
      setSuccessMessage('Public profile details updated successfully.');
    } catch (error) {
      setErrorMessage(
        extractApiErrorMessage(
          error,
          'Unable to save profile details right now.'
        )
      );
    } finally {
      setIsSavingDetails(false);
    }
  };

  return (
    <DashboardShell role="student">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Student Profile &amp; Public Sharing
            </h1>
            <p className="text-sm text-slate-600">
              Curate your verified technical profile, control visibility settings, preview your public view, and share your assessment achievements safely.
            </p>
          </div>

          {!isLoading && liveDraftSettings && (
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                variant={isPreviewMode ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setIsPreviewMode((prev) => !prev)}
                leftIcon={
                  isPreviewMode ? (
                    <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  )
                }
              >
                {isPreviewMode
                  ? 'Exit Public Preview'
                  : 'Preview Public Profile'}
              </Button>
            </div>
          )}
        </div>

        {errorMessage && (
          <AlertBanner
            variant="error"
            title="Profile Update Error"
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
          />
        )}

        {successMessage && (
          <AlertBanner
            variant="success"
            title="Profile Updated"
            message={successMessage}
            onDismiss={() => setSuccessMessage(null)}
          />
        )}

        {isLoading ? (
          <ProfilePageSkeleton />
        ) : !profile || !liveDraftSettings ? (
          <section className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Student profile configuration could not be initialized.
          </section>
        ) : (
          <>
            {/* Privacy & Visibility Controls */}
            <section
              aria-labelledby="profile-visibility-heading"
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="space-y-0.5">
                  <h2
                    id="profile-visibility-heading"
                    className="text-base font-semibold text-slate-900"
                  >
                    Profile Visibility &amp; Sharing Controls
                  </h2>
                  <p className="text-xs text-slate-500">
                    Choose who can access your verified profile. Your email address and authentication credentials are never exposed publicly.
                  </p>
                </div>

                <Button
                  type="button"
                  variant={profile.is_sharing_enabled ? 'outline' : 'accent'}
                  size="sm"
                  isLoading={isUpdatingVisibility}
                  loadingText="Updating..."
                  onClick={() => void handleToggleSharing()}
                >
                  {profile.is_sharing_enabled
                    ? 'Disable Sharing'
                    : 'Enable Sharing'}
                </Button>
              </div>

              {/* Three Visibility Options: Private, Public, Shareable Link */}
              <div
                role="radiogroup"
                aria-label="Profile visibility mode"
                className="grid gap-3 sm:grid-cols-3"
              >
                {VISIBILITY_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = profile.visibility === opt.value;

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-label={opt.title}
                      aria-checked={isSelected}
                      disabled={isUpdatingVisibility}
                      onClick={() => void handleVisibilityChange(opt.value)}
                      className={`flex flex-col items-start rounded-xl border p-4 text-left transition-colors cursor-pointer disabled:opacity-60 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-600'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <Icon
                            className={`h-4 w-4 ${
                              isSelected ? 'text-blue-600' : 'text-slate-500'
                            }`}
                          />
                          <span>{opt.title}</span>
                        </span>
                        {isSelected && (
                          <span className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                        {opt.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Shareable Public URL Box */}
              {profile.is_sharing_enabled && resolvedShareUrl ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-2">
                  <label
                    htmlFor="public-profile-share-url"
                    className="block text-xs font-semibold text-slate-800"
                  >
                    Shareable Public Profile URL
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="public-profile-share-url"
                      type="text"
                      readOnly
                      aria-label="Public profile URL"
                      value={resolvedShareUrl}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-800"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleCopyProfileUrl()}
                        leftIcon={
                          copiedUrl ? (
                            <Check
                              className="h-3.5 w-3.5 text-emerald-400"
                              aria-hidden="true"
                            />
                          ) : (
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          )
                        }
                      >
                        {copiedUrl ? 'Copied URL!' : 'Copy Profile URL'}
                      </Button>

                      {profile.share_slug && (
                        <Link
                          to={`/profile/${encodeURIComponent(
                            profile.share_slug
                          )}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <span>Open Link</span>
                          <ExternalLink
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  <Lock
                    className="h-4 w-4 shrink-0 text-slate-500"
                    aria-hidden="true"
                  />
                  <span>
                    Sharing is currently disabled (<strong>Private</strong>). Enable sharing or select <strong>Public</strong> / <strong>Shareable Link</strong> to generate your public profile URL.
                  </span>
                </div>
              )}
            </section>

            {/* Either Live Public Profile Preview OR Editable Details Form */}
            {isPreviewMode ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-950">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <ShieldCheck
                      className="h-4 w-4 text-emerald-600 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Previewing public-safe fields only — private account details, email address, and tokens are strictly excluded.
                    </span>
                  </span>
                </div>

                <PublicProfileCard
                  profile={toPublicProfilePreview(liveDraftSettings)}
                  isPreview
                />
              </div>
            ) : (
              <form
                onSubmit={(e) => void handleSaveProfileDetails(e)}
                className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Update Public Profile Details
                    </h2>
                    <p className="text-xs text-slate-500">
                      Customize the summary, skills, technologies, and projects displayed on your public profile.
                    </p>
                  </div>

                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    <span>Email &amp; tokens never shared</span>
                  </span>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="profile-display-name"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Student Display Name
                    </label>
                    <input
                      id="profile-display-name"
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g., Zaheed Shareef"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="profile-headline"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Professional Headline
                    </label>
                    <input
                      id="profile-headline"
                      type="text"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="e.g., Full-Stack & Distributed Systems Engineer"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="profile-summary"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Profile Summary
                  </label>
                  <textarea
                    id="profile-summary"
                    rows={3}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Summarize your engineering focus, systems experience, and problem-solving strengths..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="profile-skills"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Skills (comma-separated)
                    </label>
                    <input
                      id="profile-skills"
                      type="text"
                      value={skillsText}
                      onChange={(e) => setSkillsText(e.target.value)}
                      placeholder="Python, TypeScript, Distributed Systems, Algorithms"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="profile-technologies"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Technologies &amp; Frameworks (comma-separated)
                    </label>
                    <input
                      id="profile-technologies"
                      type="text"
                      value={technologiesText}
                      onChange={(e) => setTechnologiesText(e.target.value)}
                      placeholder="FastAPI, React, Docker, PostgreSQL"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="profile-github-url"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Public GitHub URL
                    </label>
                    <input
                      id="profile-github-url"
                      type="url"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/username"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="profile-linkedin-url"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Public LinkedIn URL
                    </label>
                    <input
                      id="profile-linkedin-url"
                      type="url"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/username"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Featured Engineering Projects Editor */}
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Featured Projects
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddProject}
                      leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                    >
                      Add Project
                    </Button>
                  </div>

                  {projects.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No featured projects added yet. Click Add Project to highlight key repositories.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {projects.map((proj, idx) => (
                        <div
                          key={proj.id}
                          className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-700">
                              Project #{idx + 1}
                            </span>
                            <button
                              type="button"
                              aria-label={`Remove project ${idx + 1}`}
                              onClick={() => handleRemoveProject(idx)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Remove</span>
                            </button>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <input
                              type="text"
                              aria-label={`Project ${idx + 1} title`}
                              value={proj.title}
                              onChange={(e) =>
                                handleProjectFieldChange(
                                  idx,
                                  'title',
                                  e.target.value
                                )
                              }
                              placeholder="Project Title"
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                            />
                            <input
                              type="url"
                              aria-label={`Project ${idx + 1} repository URL`}
                              value={proj.repo_url ?? ''}
                              onChange={(e) =>
                                handleProjectFieldChange(
                                  idx,
                                  'repo_url',
                                  e.target.value
                                )
                              }
                              placeholder="https://github.com/username/project"
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                            />
                          </div>

                          <input
                            type="text"
                            aria-label={`Project ${idx + 1} technologies`}
                            value={proj.technologies.join(', ')}
                            onChange={(e) =>
                              handleProjectFieldChange(
                                idx,
                                'technologies',
                                e.target.value
                              )
                            }
                            placeholder="Technologies (e.g., Python, Redis, Docker)"
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                          />

                          <textarea
                            rows={2}
                            aria-label={`Project ${idx + 1} description`}
                            value={proj.description}
                            onChange={(e) =>
                              handleProjectFieldChange(
                                idx,
                                'description',
                                e.target.value
                              )
                            }
                            placeholder="Brief engineering description and impact..."
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end border-t border-slate-100 pt-4">
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isSavingDetails}
                    loadingText="Saving Profile..."
                    leftIcon={<Save className="h-4 w-4" aria-hidden="true" />}
                  >
                    Save Profile Details
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

