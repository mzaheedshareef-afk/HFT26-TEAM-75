import axios from 'axios';
import { api, AUTH_USER_STORAGE_KEY } from './api';
import { portfolioService } from './portfolioService';
import type {
  ProfileAssessmentPerformance,
  ProfileConsistencyMetric,
  ProfileImprovementMetric,
  ProfilePortfolioSummary,
  ProfileProjectSummary,
  ProfileVisibility,
  PublicStudentProfile,
  StudentProfileSettings,
  UpdateProfileVisibilityPayload,
  UpdateStudentProfilePayload,
  VerifiedAchievementItem,
} from '../types/profile';

export class ProfileAccessRestrictedError extends Error {
  readonly status: number;

  constructor(
    message = 'This student profile is private and not available for public viewing.',
    status = 403
  ) {
    super(message);
    this.name = 'ProfileAccessRestrictedError';
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const EMAIL_SCRUB_PATTERN =
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT_SCRUB_PATTERN =
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;

function scrubAccidentalSecrets(text: string): string {
  return text
    .replace(EMAIL_SCRUB_PATTERN, '[redacted-email]')
    .replace(JWT_SCRUB_PATTERN, '[redacted-token]')
    .trim();
}

function normalizeStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .filter((item): item is string => typeof item === 'string')
        .map((item) => scrubAccidentalSecrets(item))
        .filter(Boolean)
    )
  );
}

function normalizeVisibility(
  rawVisibility: unknown,
  rawSharingEnabled?: unknown
): ProfileVisibility {
  if (typeof rawVisibility === 'string') {
    const lower = rawVisibility.trim().toLowerCase();
    if (lower === 'public') return 'public';
    if (
      lower === 'shareable_link' ||
      lower === 'shareable' ||
      lower === 'unlisted' ||
      lower === 'link_only'
    ) {
      return 'shareable_link';
    }
    if (lower === 'private') return 'private';
  }
  if (rawSharingEnabled === true) {
    return 'shareable_link';
  }
  return 'private';
}

function readBackendEfficiencyScore(
  raw: Record<string, unknown>
): number | null {
  if (
    typeof raw.ai_efficiency_score === 'number' &&
    Number.isFinite(raw.ai_efficiency_score)
  ) {
    return raw.ai_efficiency_score;
  }
  if (
    typeof raw.efficiency_score === 'number' &&
    Number.isFinite(raw.efficiency_score)
  ) {
    return raw.efficiency_score;
  }
  return null;
}

function normalizeProjects(raw: unknown): ProfileProjectSummary[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((proj, idx) => ({
    id:
      (typeof proj.id === 'string' && proj.id) ||
      `proj-${idx + 1}`,
    title: scrubAccidentalSecrets(
      (typeof proj.title === 'string' && proj.title) ||
        (typeof proj.name === 'string' && proj.name) ||
        `Project ${idx + 1}`
    ),
    description: scrubAccidentalSecrets(
      typeof proj.description === 'string' ? proj.description : ''
    ),
    technologies: normalizeStringList(
      proj.technologies ?? proj.tech_stack ?? proj.stack
    ),
    repo_url:
      typeof proj.repo_url === 'string' && proj.repo_url.trim()
        ? proj.repo_url.trim()
        : typeof proj.url === 'string' && proj.url.trim()
        ? proj.url.trim()
        : undefined,
    live_url:
      typeof proj.live_url === 'string' && proj.live_url.trim()
        ? proj.live_url.trim()
        : undefined,
  }));
}

function normalizePortfolioInfo(
  raw: Record<string, unknown>
): ProfilePortfolioSummary {
  const nested = isRecord(raw.portfolio_info)
    ? raw.portfolio_info
    : isRecord(raw.portfolio)
    ? raw.portfolio
    : raw;

  return {
    github_url:
      typeof nested.github_url === 'string' && nested.github_url.trim()
        ? nested.github_url.trim()
        : typeof nested.githubUrl === 'string' && nested.githubUrl.trim()
        ? nested.githubUrl.trim()
        : undefined,
    linkedin_url:
      typeof nested.linkedin_url === 'string' && nested.linkedin_url.trim()
        ? nested.linkedin_url.trim()
        : undefined,
    experience_level:
      typeof nested.experience_level === 'string'
        ? nested.experience_level
        : undefined,
    primary_focus:
      typeof nested.primary_focus === 'string'
        ? scrubAccidentalSecrets(nested.primary_focus)
        : undefined,
    repositories_count:
      typeof nested.repositories_count === 'number'
        ? nested.repositories_count
        : Array.isArray(nested.repositories)
        ? nested.repositories.length
        : undefined,
    calibrated_tracks: normalizeStringList(
      nested.calibrated_tracks ?? nested.recommended_tracks ?? nested.tracks
    ),
  };
}

function normalizeAssessmentPerformance(
  raw: Record<string, unknown>
): ProfileAssessmentPerformance {
  const perf = isRecord(raw.assessment_performance)
    ? raw.assessment_performance
    : isRecord(raw.performance)
    ? raw.performance
    : raw;

  return {
    total_assessments_completed:
      typeof perf.total_assessments_completed === 'number'
        ? perf.total_assessments_completed
        : typeof perf.assessments_completed === 'number'
        ? perf.assessments_completed
        : 0,
    average_score:
      typeof perf.average_score === 'number'
        ? perf.average_score
        : typeof perf.overall_score === 'number'
        ? perf.overall_score
        : null,
    highest_score:
      typeof perf.highest_score === 'number' ? perf.highest_score : null,
    coding_score:
      typeof perf.coding_score === 'number'
        ? perf.coding_score
        : typeof perf.deterministic_score === 'number'
        ? perf.deterministic_score
        : null,
    ai_efficiency_score: readBackendEfficiencyScore(perf),
    completion_rate:
      typeof perf.completion_rate === 'number' ? perf.completion_rate : null,
  };
}

function normalizeAchievements(raw: unknown): VerifiedAchievementItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((ach, idx) => {
    const cat =
      ach.category === 'consistency' ||
      ach.category === 'efficiency' ||
      ach.category === 'portfolio'
        ? ach.category
        : 'assessment';
    return {
      id: (typeof ach.id === 'string' && ach.id) || `ach-${idx + 1}`,
      title: scrubAccidentalSecrets(
        (typeof ach.title === 'string' && ach.title) || 'Verified Milestone'
      ),
      description: scrubAccidentalSecrets(
        typeof ach.description === 'string' ? ach.description : ''
      ),
      category: cat,
      earned_at: typeof ach.earned_at === 'string' ? ach.earned_at : undefined,
    };
  });
}

function normalizeConsistency(
  raw: Record<string, unknown>
): ProfileConsistencyMetric {
  const c = isRecord(raw.consistency) ? raw.consistency : null;
  const score =
    c && typeof c.score === 'number'
      ? c.score
      : typeof raw.consistency_score === 'number'
      ? raw.consistency_score
      : null;

  return {
    score,
    label:
      (c && typeof c.label === 'string' && scrubAccidentalSecrets(c.label)) ||
      (typeof raw.consistency_label === 'string' &&
        scrubAccidentalSecrets(raw.consistency_label)) ||
      (score !== null
        ? `${Math.round(score)} / 100 stability`
        : 'Building assessment history'),
    summary:
      c && typeof c.summary === 'string'
        ? scrubAccidentalSecrets(c.summary)
        : undefined,
  };
}

function normalizeImprovement(
  raw: Record<string, unknown>
): ProfileImprovementMetric {
  const imp = isRecord(raw.improvement) ? raw.improvement : null;
  const delta =
    imp && typeof imp.delta_percentage === 'number'
      ? imp.delta_percentage
      : typeof raw.improvement_percentage === 'number'
      ? raw.improvement_percentage
      : null;

  return {
    delta_percentage: delta,
    label:
      (imp &&
        typeof imp.label === 'string' &&
        scrubAccidentalSecrets(imp.label)) ||
      (typeof raw.improvement_label === 'string' &&
        scrubAccidentalSecrets(raw.improvement_label)) ||
      (delta !== null
        ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% score trajectory`
        : 'Baseline trajectory'),
    summary:
      imp && typeof imp.summary === 'string'
        ? scrubAccidentalSecrets(imp.summary)
        : undefined,
  };
}

export function buildShareableProfileUrl(
  shareSlug: string | null | undefined,
  backendShareUrl?: string | null
): string | null {
  if (shareSlug && shareSlug.trim()) {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost:5173';
    return `${origin}/profile/${encodeURIComponent(shareSlug.trim())}`;
  }
  if (backendShareUrl && backendShareUrl.trim()) {
    return backendShareUrl.trim();
  }
  return null;
}

export function normalizeStudentProfileSettings(
  raw: Record<string, unknown>
): StudentProfileSettings {
  const payload = isRecord(raw.profile)
    ? raw.profile
    : isRecord(raw.data)
    ? raw.data
    : raw;

  const visibility = normalizeVisibility(
    payload.visibility,
    payload.is_sharing_enabled
  );
  const isSharingEnabled =
    typeof payload.is_sharing_enabled === 'boolean'
      ? payload.is_sharing_enabled && visibility !== 'private'
      : visibility !== 'private';

  const shareSlug =
    (typeof payload.share_slug === 'string' && payload.share_slug.trim()) ||
    (typeof payload.public_slug === 'string' && payload.public_slug.trim()) ||
    (typeof payload.share_id === 'string' && payload.share_id.trim()) ||
    null;

  const backendShareUrl =
    typeof payload.share_url === 'string' ? payload.share_url : null;

  return {
    profile_id:
      (typeof payload.profile_id === 'string' && payload.profile_id) ||
      (typeof payload.id === 'string' && payload.id) ||
      'student-profile',
    display_name: scrubAccidentalSecrets(
      (typeof payload.display_name === 'string' && payload.display_name) ||
        (typeof payload.name === 'string' && payload.name) ||
        'Candidate'
    ),
    headline: scrubAccidentalSecrets(
      (typeof payload.headline === 'string' && payload.headline) ||
        'Software Engineering Candidate'
    ),
    summary: scrubAccidentalSecrets(
      typeof payload.summary === 'string'
        ? payload.summary
        : typeof payload.bio === 'string'
        ? payload.bio
        : ''
    ),
    skills: normalizeStringList(payload.skills ?? payload.primary_languages),
    technologies: normalizeStringList(
      payload.technologies ?? payload.frameworks
    ),
    projects: normalizeProjects(payload.projects),
    portfolio_info: normalizePortfolioInfo(payload),
    assessment_performance: normalizeAssessmentPerformance(payload),
    verified_achievements: normalizeAchievements(
      payload.verified_achievements ?? payload.achievements
    ),
    consistency: normalizeConsistency(payload),
    improvement: normalizeImprovement(payload),
    visibility: isSharingEnabled ? visibility : 'private',
    is_sharing_enabled: isSharingEnabled,
    share_slug: shareSlug,
    share_url: isSharingEnabled
      ? buildShareableProfileUrl(shareSlug, backendShareUrl)
      : null,
    updated_at:
      typeof payload.updated_at === 'string' ? payload.updated_at : undefined,
  };
}

/**
 * Strictly sanitizes a public profile response to guarantee private student data,
 * email addresses, user IDs, and auth tokens can NEVER reach public profile views.
 * Throws ProfileAccessRestrictedError if the profile is marked private.
 */
export function sanitizePublicProfile(
  raw: Record<string, unknown>,
  fallbackSlug: string
): PublicStudentProfile {
  const payload = isRecord(raw.profile)
    ? raw.profile
    : isRecord(raw.public_profile)
    ? raw.public_profile
    : isRecord(raw.data)
    ? raw.data
    : raw;

  const visibility = normalizeVisibility(
    payload.visibility,
    payload.is_sharing_enabled ?? true
  );

  if (
    visibility === 'private' ||
    payload.is_private === true ||
    payload.is_sharing_enabled === false
  ) {
    throw new ProfileAccessRestrictedError();
  }

  return {
    share_slug:
      (typeof payload.share_slug === 'string' && payload.share_slug) ||
      (typeof payload.public_slug === 'string' && payload.public_slug) ||
      fallbackSlug,
    display_name: scrubAccidentalSecrets(
      (typeof payload.display_name === 'string' && payload.display_name) ||
        (typeof payload.name === 'string' && payload.name) ||
        'Candidate'
    ),
    headline: scrubAccidentalSecrets(
      (typeof payload.headline === 'string' && payload.headline) ||
        'Verified Technical Candidate'
    ),
    summary: scrubAccidentalSecrets(
      typeof payload.summary === 'string'
        ? payload.summary
        : typeof payload.bio === 'string'
        ? payload.bio
        : ''
    ),
    skills: normalizeStringList(payload.skills ?? payload.primary_languages),
    technologies: normalizeStringList(
      payload.technologies ?? payload.frameworks
    ),
    projects: normalizeProjects(payload.projects),
    portfolio_info: normalizePortfolioInfo(payload),
    assessment_performance: normalizeAssessmentPerformance(payload),
    verified_achievements: normalizeAchievements(
      payload.verified_achievements ?? payload.achievements
    ),
    consistency: normalizeConsistency(payload),
    improvement: normalizeImprovement(payload),
    visibility: visibility === 'public' ? 'public' : 'shareable_link',
  };
}

/**
 * Projects the authenticated student's editable profile settings into the exact
 * public-safe representation rendered on /profile/:shareId for live previewing.
 */
export function toPublicProfilePreview(
  settings: StudentProfileSettings
): PublicStudentProfile {
  return {
    share_slug: settings.share_slug ?? 'preview',
    display_name: scrubAccidentalSecrets(settings.display_name || 'Candidate'),
    headline: scrubAccidentalSecrets(
      settings.headline || 'Verified Technical Candidate'
    ),
    summary: scrubAccidentalSecrets(settings.summary),
    skills: normalizeStringList(settings.skills),
    technologies: normalizeStringList(settings.technologies),
    projects: settings.projects.map((p) => ({
      ...p,
      title: scrubAccidentalSecrets(p.title),
      description: scrubAccidentalSecrets(p.description),
      technologies: normalizeStringList(p.technologies),
    })),
    portfolio_info: settings.portfolio_info,
    assessment_performance: settings.assessment_performance,
    verified_achievements: settings.verified_achievements,
    consistency: settings.consistency,
    improvement: settings.improvement,
    visibility:
      settings.visibility === 'public' ? 'public' : 'shareable_link',
  };
}

function readCachedCandidateName(): string {
  try {
    const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!raw) return 'Candidate';
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed) && typeof parsed.name === 'string' && parsed.name) {
      return scrubAccidentalSecrets(parsed.name);
    }
  } catch {
    // Ignore storage parse failures
  }
  return 'Candidate';
}

export const profileService = {
  /**
   * Fetches the authenticated student's editable profile and sharing configuration.
   */
  async getMyProfile(): Promise<StudentProfileSettings> {
    try {
      const response = await api.get<unknown>('/api/profile/me');
      if (isRecord(response.data)) {
        return normalizeStudentProfileSettings(response.data);
      }
      throw new Error('Malformed profile response returned by server.');
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        try {
          const fallback = await api.get<unknown>('/api/profiles/me');
          if (isRecord(fallback.data)) {
            return normalizeStudentProfileSettings(fallback.data);
          }
        } catch (secondError) {
          if (
            !axios.isAxiosError(secondError) ||
            secondError.response?.status !== 404
          ) {
            throw secondError;
          }
        }

        // Compose initial private profile strictly from authenticated candidate name & portfolio
        const portfolio = await portfolioService.getMyPortfolio();
        return {
          profile_id: 'student-profile',
          display_name: readCachedCandidateName(),
          headline: 'Software Engineering Candidate',
          summary: portfolio?.summaryNote ?? '',
          skills: portfolio?.primaryLanguages ?? [],
          technologies: portfolio?.frameworks ?? [],
          projects: (portfolio?.repositories ?? []).map((repo, idx) => ({
            id: `repo-${idx + 1}`,
            title: repo.name,
            description: repo.description ?? '',
            technologies: repo.primaryLanguage ? [repo.primaryLanguage] : [],
            repo_url: repo.url,
          })),
          portfolio_info: {
            github_url: portfolio?.githubUrl || undefined,
            experience_level: portfolio?.experience_level,
            repositories_count: portfolio?.repositories?.length,
            calibrated_tracks: portfolio?.recommended_tracks ?? [],
          },
          assessment_performance: {
            total_assessments_completed: 0,
            average_score: null,
            highest_score: null,
            coding_score: null,
            ai_efficiency_score: null,
            completion_rate: null,
          },
          verified_achievements: [],
          consistency: {
            score: null,
            label: 'Building assessment history',
          },
          improvement: {
            delta_percentage: null,
            label: 'Baseline trajectory',
          },
          visibility: 'private',
          is_sharing_enabled: false,
          share_slug: null,
          share_url: null,
        };
      }
      throw error;
    }
  },

  /**
   * Updates the authenticated student's public-facing profile fields.
   */
  async updateMyProfile(
    payload: UpdateStudentProfilePayload
  ): Promise<StudentProfileSettings> {
    const body = {
      display_name: scrubAccidentalSecrets(payload.display_name),
      headline: payload.headline
        ? scrubAccidentalSecrets(payload.headline)
        : undefined,
      summary: scrubAccidentalSecrets(payload.summary),
      skills: normalizeStringList(payload.skills),
      technologies: normalizeStringList(payload.technologies),
      projects: payload.projects,
      github_url: payload.github_url?.trim() || undefined,
      linkedin_url: payload.linkedin_url?.trim() || undefined,
    };

    try {
      const response = await api.put<unknown>('/api/profile/me', body);
      if (isRecord(response.data)) {
        return normalizeStudentProfileSettings(response.data);
      }
      throw new Error('Malformed profile update response.');
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        const fallback = await api.patch<unknown>('/api/profile/me', body);
        if (isRecord(fallback.data)) {
          return normalizeStudentProfileSettings(fallback.data);
        }
      }
      throw error;
    }
  },

  /**
   * Updates profile visibility ('private' | 'public' | 'shareable_link') and sharing status.
   */
  async updateProfileVisibility(
    payload: UpdateProfileVisibilityPayload
  ): Promise<StudentProfileSettings> {
    const effectiveVisibility: ProfileVisibility = payload.is_sharing_enabled
      ? payload.visibility === 'private'
        ? 'shareable_link'
        : payload.visibility
      : 'private';

    const body = {
      visibility: effectiveVisibility,
      is_sharing_enabled: effectiveVisibility !== 'private',
    };

    try {
      const response = await api.patch<unknown>(
        '/api/profile/visibility',
        body
      );
      if (isRecord(response.data)) {
        return normalizeStudentProfileSettings(response.data);
      }
      throw new Error('Malformed visibility update response.');
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        const fallback = await api.put<unknown>(
          '/api/profile/me/visibility',
          body
        );
        if (isRecord(fallback.data)) {
          return normalizeStudentProfileSettings(fallback.data);
        }
      }
      throw error;
    }
  },

  /**
   * Retrieves a public student profile by share slug / share ID.
   * Respects backend privacy controls (403 -> ProfileAccessRestrictedError)
   * and strips all non-public fields via sanitizePublicProfile.
   */
  async getPublicProfile(shareSlug: string): Promise<PublicStudentProfile> {
    const encoded = encodeURIComponent(shareSlug.trim());
    try {
      const response = await api.get<unknown>(
        `/api/profile/public/${encoded}`
      );
      if (isRecord(response.data)) {
        return sanitizePublicProfile(response.data, shareSlug);
      }
      throw new Error('Malformed public profile response.');
    } catch (error) {
      if (error instanceof ProfileAccessRestrictedError) {
        throw error;
      }
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 403 || status === 401) {
          throw new ProfileAccessRestrictedError(
            'This student profile is private and not available for public viewing.',
            403
          );
        }
        if (status === 404) {
          try {
            const fallback = await api.get<unknown>(
              `/api/public-profile/${encoded}`
            );
            if (isRecord(fallback.data)) {
              return sanitizePublicProfile(fallback.data, shareSlug);
            }
          } catch (fallbackErr) {
            if (fallbackErr instanceof ProfileAccessRestrictedError) {
              throw fallbackErr;
            }
            if (
              axios.isAxiosError(fallbackErr) &&
              (fallbackErr.response?.status === 403 ||
                fallbackErr.response?.status === 401)
            ) {
              throw new ProfileAccessRestrictedError(
                'This student profile is private and not available for public viewing.',
                403
              );
            }
            throw fallbackErr;
          }
        }
      }
      throw error;
    }
  },
};

