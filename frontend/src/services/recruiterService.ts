import axios from 'axios';
import { api } from './api';
import { authService } from './authService';
import {
  MAX_COMPARISON_CANDIDATES,
  type CandidateDifficultyMetric,
  type CandidateEvaluationRecord,
  type CandidateImprovementTrend,
  type CandidateProjectItem,
  type CandidateSearchQuery,
  type CandidateTopicMetric,
  type CandidateVerifiedAchievement,
  type CompanyDashboardData,
  type CompanyNotificationPreferences,
  type CompanyOverviewMetrics,
  type CompanyProfile,
  type CompanyProfileUpdatePayload,
  type CompanySettingsUpdatePayload,
  type DiscoveryActivityItem,
  type PaginatedCandidateSearchResponse,
  type PlatformStatisticsSummary,
  type RecruiterCandidateSummary,
  type RecruiterDashboardOverview,
  type SavedCandidateSearch,
  type ShortlistEntry,
  type ShortlistFilterQuery,
} from '../types/recruiter';

export class CandidateAccessDeniedError extends Error {
  constructor(
    message = 'This candidate profile is private or has not granted recruiter visibility.'
  ) {
    super(message);
    this.name = 'CandidateAccessDeniedError';
  }
}

export class DuplicateShortlistError extends Error {
  constructor(
    message = 'This candidate is already in your company shortlist.'
  ) {
    super(message);
    this.name = 'DuplicateShortlistError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function asNumber(value: unknown, fallback = 0): number {
  const num = asNumberOrNull(value);
  return num !== null ? num : fallback;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter(Boolean)
      )
    );
  }
  if (typeof value === 'string' && value.trim()) {
    return Array.from(
      new Set(
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  }
  return [];
}

function scrubPrivateLeakTokens(text: string): string {
  if (!text) return '';
  // Guardrail against accidental JWT or bearer token leakage in free-text fields
  return text.replace(
    /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    '[REDACTED]'
  );
}

function normalizeProject(
  raw: Record<string, unknown>,
  idx: number
): CandidateProjectItem | null {
  const title = asString(raw.title ?? raw.name);
  if (!title) return null;

  return {
    id: asString(raw.id ?? raw.project_id, `proj-${idx + 1}`),
    title: scrubPrivateLeakTokens(title),
    description: scrubPrivateLeakTokens(
      asString(raw.description ?? raw.summary)
    ),
    technologies: asStringArray(
      raw.technologies ?? raw.tech_stack ?? raw.languages ?? raw.stack
    ),
    repo_url: asString(raw.repo_url ?? raw.github_url ?? raw.url) || undefined,
    demo_url: asString(raw.demo_url ?? raw.live_url) || undefined,
    highlights: asStringArray(raw.highlights),
    domain: asString(raw.domain ?? raw.category) || undefined,
  };
}

function normalizeTopicMetric(
  raw: Record<string, unknown>
): CandidateTopicMetric | null {
  const topic = asString(raw.topic ?? raw.name ?? raw.category);
  if (!topic) return null;

  return {
    topic,
    average_score: asNumber(raw.average_score ?? raw.score, 0),
    assessments_count:
      asNumberOrNull(
        raw.assessments_count ?? raw.total_questions ?? raw.attempts_count
      ) ?? undefined,
    success_rate:
      asNumberOrNull(raw.success_rate ?? raw.pass_rate) ?? undefined,
  };
}

function normalizeDifficultyMetric(
  raw: Record<string, unknown>
): CandidateDifficultyMetric | null {
  const difficulty = asString(raw.difficulty ?? raw.level);
  if (!difficulty) return null;

  return {
    difficulty,
    average_score: asNumber(raw.average_score ?? raw.score, 0),
    pass_rate: asNumberOrNull(raw.pass_rate ?? raw.success_rate) ?? undefined,
    attempts_count:
      asNumberOrNull(
        raw.attempts_count ?? raw.total_questions ?? raw.assessments_count
      ) ?? undefined,
  };
}

function normalizeAchievement(
  raw: Record<string, unknown>,
  idx: number
): CandidateVerifiedAchievement | null {
  const title = asString(raw.title ?? raw.badge ?? raw.name);
  if (!title) return null;

  return {
    id: asString(raw.id ?? raw.achievement_id, `ach-${idx + 1}`),
    title,
    description: asString(raw.description ?? raw.summary),
    score: asNumberOrNull(raw.score ?? raw.verified_score),
    verified_at: asString(raw.verified_at ?? raw.completed_at) || undefined,
    skill_evidence:
      asString(raw.skill_evidence ?? raw.evidence ?? raw.topic) || undefined,
    level: asString(raw.level ?? raw.tier) || undefined,
  };
}

function deriveImprovementTrend(
  rawTrend: unknown,
  delta: number | null
): CandidateImprovementTrend {
  const clean = asString(rawTrend).toLowerCase();
  if (
    clean === 'improving' ||
    clean === 'upward' ||
    clean === 'positive' ||
    clean === 'accelerating'
  ) {
    return 'improving';
  }
  if (clean === 'steady' || clean === 'stable' || clean === 'consistent') {
    return 'steady';
  }
  if (clean === 'declining' || clean === 'downward' || clean === 'negative') {
    return 'declining';
  }
  if (delta !== null) {
    if (delta > 2) return 'improving';
    if (delta < -2) return 'declining';
    return 'steady';
  }
  return 'insufficient_data';
}

/**
 * Sanitizes and normalizes a candidate record for recruiter viewing.
 * - Enforces candidate visibility permissions (blocks `private` profiles).
 * - Strips private student identifiers (`email`, `access_token`, `raw_code`, `hidden_test_cases`).
 * - Never calculates `ai_efficiency_score` in the frontend (preserves backend score or `null`).
 */
export function sanitizeCandidateForRecruiter(
  rawInput: unknown
): RecruiterCandidateSummary {
  const root = isRecord(rawInput) ? rawInput : {};
  const raw = isRecord(root.candidate)
    ? root.candidate
    : isRecord(root.profile)
    ? root.profile
    : root;

  const visibility = asString(raw.visibility).toLowerCase();
  if (visibility === 'private' || raw.is_permitted === false) {
    throw new CandidateAccessDeniedError();
  }

  const perf = isRecord(raw.assessment_performance)
    ? raw.assessment_performance
    : isRecord(raw.performance_summary)
    ? raw.performance_summary
    : isRecord(raw.analytics)
    ? raw.analytics
    : {};

  const portfolioInfo = isRecord(raw.portfolio_info)
    ? raw.portfolio_info
    : isRecord(raw.portfolio)
    ? raw.portfolio
    : {};

  const consistencyObj = isRecord(raw.consistency) ? raw.consistency : {};
  const improvementObj = isRecord(raw.improvement) ? raw.improvement : {};

  const candidateId = asString(
    raw.candidate_id ?? raw.share_id ?? raw.share_slug ?? raw.profile_id ?? raw.id,
    'candidate'
  );
  const shareId =
    asString(raw.share_id ?? raw.share_slug) || undefined;

  const displayName = scrubPrivateLeakTokens(
    asString(
      raw.display_name ?? raw.public_name ?? raw.name ?? raw.full_name,
      'Verified Candidate'
    )
  );

  const programmingLanguages = asStringArray(
    raw.programming_languages ??
      raw.primary_languages ??
      portfolioInfo.primary_languages ??
      portfolioInfo.primaryLanguages
  );
  const technicalSkills = asStringArray(
    raw.technical_skills ?? raw.skills ?? perf.top_topics
  );
  const frameworks = asStringArray(
    raw.frameworks ??
      raw.technologies ??
      portfolioInfo.frameworks
  );

  const projectsRaw = Array.isArray(raw.projects)
    ? raw.projects
    : Array.isArray(portfolioInfo.projects)
    ? portfolioInfo.projects
    : [];
  const projects = projectsRaw
    .filter(isRecord)
    .map((p, idx) => normalizeProject(p, idx))
    .filter((p): p is CandidateProjectItem => p !== null);

  const githubUrl =
    asString(
      raw.portfolio_github_url ??
        raw.github_url ??
        portfolioInfo.github_url ??
        portfolioInfo.githubUrl
    ) || undefined;

  const linkedinUrl =
    asString(
      raw.portfolio_linkedin_url ??
        raw.linkedin_url ??
        portfolioInfo.linkedin_url ??
        portfolioInfo.linkedinUrl
    ) || undefined;

  const rawHighlights = Array.isArray(raw.portfolio_highlights)
    ? raw.portfolio_highlights
    : [];
  const portfolioHighlights = rawHighlights
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (isRecord(item)) {
        return asString(item.title ?? item.summary ?? item.description);
      }
      return '';
    })
    .filter(Boolean);

  const portfolioAvailable =
    typeof raw.portfolio_available === 'boolean'
      ? raw.portfolio_available
      : typeof raw.has_portfolio === 'boolean'
      ? raw.has_portfolio
      : Boolean(
          projects.length > 0 ||
            githubUrl ||
            portfolioHighlights.length > 0
        );

  const overallScore = asNumberOrNull(
    raw.overall_score ??
      raw.average_score ??
      perf.average_score ??
      perf.overall_score
  );
  const highestScore = asNumberOrNull(
    raw.highest_score ?? perf.highest_score ?? overallScore
  );
  const codingScore = asNumberOrNull(
    raw.coding_score ?? perf.coding_score
  );
  // STRICT RULE: Never compute official AI efficiency score on the frontend
  const aiEfficiencyScore = asNumberOrNull(
    raw.ai_efficiency_score ?? perf.ai_efficiency_score
  );

  const consistencyScore = asNumberOrNull(
    raw.consistency_score ??
      consistencyObj.score ??
      perf.performance_consistency_score ??
      perf.consistency_score
  );
  const consistencyLabel = asString(
    raw.consistency_label ??
      consistencyObj.label ??
      perf.consistency_rating,
    consistencyScore !== null
      ? consistencyScore >= 85
        ? 'High'
        : consistencyScore >= 65
        ? 'Consistent'
        : 'Developing'
      : 'Pending'
  );

  const improvementDelta = asNumberOrNull(
    raw.improvement_delta ??
      raw.improvement_percentage ??
      improvementObj.delta_percentage ??
      perf.improvement_delta
  );
  const improvementTrend = deriveImprovementTrend(
    raw.improvement_trend ?? improvementObj.trend ?? improvementObj.label,
    improvementDelta
  );
  const improvementLabel = asString(
    raw.improvement_label ?? improvementObj.label,
    improvementDelta !== null
      ? `${improvementDelta >= 0 ? '+' : ''}${improvementDelta.toFixed(1)}%`
      : improvementTrend === 'improving'
      ? 'Improving'
      : improvementTrend === 'steady'
      ? 'Steady'
      : 'Baseline'
  );

  const topicsRaw = Array.isArray(raw.topic_performance)
    ? raw.topic_performance
    : Array.isArray(perf.topic_performance)
    ? perf.topic_performance
    : Array.isArray(perf.top_topics)
    ? (perf.top_topics as unknown[]).map((t) =>
        typeof t === 'string'
          ? { topic: t, average_score: overallScore ?? 0 }
          : t
      )
    : [];
  const topicPerformance = topicsRaw
    .filter(isRecord)
    .map(normalizeTopicMetric)
    .filter((item): item is CandidateTopicMetric => item !== null);

  const diffsRaw = Array.isArray(raw.difficulty_performance)
    ? raw.difficulty_performance
    : Array.isArray(perf.difficulty_performance)
    ? perf.difficulty_performance
    : [];
  const difficultyPerformance = diffsRaw
    .filter(isRecord)
    .map(normalizeDifficultyMetric)
    .filter((item): item is CandidateDifficultyMetric => item !== null);

  const achievementsRaw = Array.isArray(raw.verified_achievements)
    ? raw.verified_achievements
    : [];
  const verifiedAchievements = achievementsRaw
    .filter(isRecord)
    .map((item, idx) => normalizeAchievement(item, idx))
    .filter((item): item is CandidateVerifiedAchievement => item !== null);

  const domains = asStringArray(
    raw.domains ??
      raw.relevant_domains ??
      portfolioInfo.calibrated_tracks ??
      topicPerformance.slice(0, 3).map((t) => t.topic)
  );

  return {
    candidate_id: candidateId,
    share_id: shareId,
    display_name: displayName,
    headline: scrubPrivateLeakTokens(
      asString(raw.headline, 'Software Engineering Candidate')
    ),
    summary: scrubPrivateLeakTokens(
      asString(raw.summary ?? raw.bio, '')
    ),
    experience_level: asString(
      raw.experience_level ??
        raw.experience ??
        portfolioInfo.experience_level,
      'Early Career / Engineering Candidate'
    ),
    years_of_experience: asNumberOrNull(raw.years_of_experience),
    domains,
    programming_languages:
      programmingLanguages.length > 0
        ? programmingLanguages
        : technicalSkills.filter((s) =>
            /^(python|java|c\+\+|cpp|typescript|javascript|go|rust|c#|sql)$/i.test(
              s
            )
          ),
    technical_skills: technicalSkills,
    frameworks,
    projects,
    portfolio_available: portfolioAvailable,
    portfolio_github_url: githubUrl,
    portfolio_linkedin_url: linkedinUrl,
    portfolio_highlights: portfolioHighlights,
    assessments_completed: asNumber(
      raw.assessments_completed ??
        perf.total_assessments_completed ??
        perf.completed_assessments,
      0
    ),
    overall_score: overallScore,
    highest_score: highestScore,
    coding_score: codingScore,
    ai_efficiency_score: aiEfficiencyScore,
    difficulty_level: asString(raw.difficulty_level ?? raw.difficulty, 'Medium'),
    consistency_score: consistencyScore,
    consistency_label: consistencyLabel,
    improvement_delta: improvementDelta,
    improvement_trend: improvementTrend,
    improvement_label: improvementLabel,
    topic_performance: topicPerformance,
    difficulty_performance: difficultyPerformance,
    verified_achievements: verifiedAchievements,
    updated_at: asString(
      raw.updated_at ?? raw.member_since ?? raw.created_at,
      new Date().toISOString()
    ),
    member_since: asString(raw.member_since ?? raw.created_at) || undefined,
    is_shortlisted:
      typeof raw.is_shortlisted === 'boolean' ? raw.is_shortlisted : undefined,
  };
}

function normalizeShortlistEntry(
  raw: Record<string, unknown>,
  fallbackCompanyId: string
): ShortlistEntry | null {
  const candidateSource = isRecord(raw.candidate) ? raw.candidate : raw;
  let candidate: RecruiterCandidateSummary;
  try {
    candidate = sanitizeCandidateForRecruiter(candidateSource);
  } catch {
    return null;
  }

  const candidateId = asString(
    raw.candidate_id ?? candidate.candidate_id,
    candidate.candidate_id
  );

  return {
    shortlist_id: asString(
      raw.shortlist_id ?? raw.id,
      `sl-${fallbackCompanyId}-${candidateId}`
    ),
    company_id: asString(raw.company_id, fallbackCompanyId),
    candidate_id: candidateId,
    candidate: {
      ...candidate,
      candidate_id: candidateId,
      is_shortlisted: true,
    },
    private_notes: scrubPrivateLeakTokens(
      typeof raw.private_notes === 'string'
        ? raw.private_notes
        : typeof raw.notes === 'string'
        ? raw.notes
        : ''
    ),
    added_at: asString(
      raw.added_at ?? raw.created_at,
      new Date().toISOString()
    ),
    updated_at: asString(
      raw.updated_at ?? raw.added_at ?? raw.created_at,
      new Date().toISOString()
    ),
  };
}

function getAuthenticatedCompanyFallback(): {
  id: string;
  name: string;
  email: string;
} {
  const session = authService.getStoredSession();
  if (session?.user && session.user.role === 'company') {
    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    };
  }
  return {
    id: 'company',
    name: 'Company Team',
    email: '',
  };
}

function normalizeCompanyProfile(rawInput: unknown): CompanyProfile {
  const fallback = getAuthenticatedCompanyFallback();
  const root = isRecord(rawInput) ? rawInput : {};
  const raw = isRecord(root.company)
    ? root.company
    : isRecord(root.profile)
    ? root.profile
    : isRecord(root.user)
    ? root.user
    : root;

  const rawPrefs = isRecord(raw.notification_preferences)
    ? raw.notification_preferences
    : {};

  const notificationPreferences: CompanyNotificationPreferences = {
    shortlist_alerts:
      typeof rawPrefs.shortlist_alerts === 'boolean'
        ? rawPrefs.shortlist_alerts
        : true,
    weekly_talent_digest:
      typeof rawPrefs.weekly_talent_digest === 'boolean'
        ? rawPrefs.weekly_talent_digest
        : true,
    assessment_completion_updates:
      typeof rawPrefs.assessment_completion_updates === 'boolean'
        ? rawPrefs.assessment_completion_updates
        : true,
  };

  return {
    company_id: asString(raw.company_id ?? raw.id, fallback.id),
    company_name: asString(
      raw.company_name ?? raw.name ?? raw.full_name,
      fallback.name
    ),
    official_email: asString(
      raw.official_email ?? raw.email,
      fallback.email
    ),
    industry: asString(raw.industry, 'Technology & Software Engineering'),
    website_url: asString(raw.website_url ?? raw.website),
    company_size: asString(raw.company_size ?? raw.size, '51–200 employees'),
    headquarters: asString(raw.headquarters ?? raw.location, ''),
    description: asString(raw.description ?? raw.bio, ''),
    hiring_domains: asStringArray(raw.hiring_domains ?? raw.domains),
    target_roles: asStringArray(raw.target_roles ?? raw.open_roles),
    preferred_languages: asStringArray(
      raw.preferred_languages ?? raw.languages
    ),
    default_discovery_view:
      raw.default_discovery_view === 'table' ? 'table' : 'cards',
    notification_preferences: notificationPreferences,
    created_at: asString(raw.created_at) || undefined,
    updated_at: asString(raw.updated_at) || undefined,
  };
}

export function buildCandidateSearchParams(
  query: CandidateSearchQuery
): URLSearchParams {
  const params = new URLSearchParams();

  if (query.q && query.q.trim()) params.set('q', query.q.trim());
  if (query.language && query.language.trim()) {
    params.set('language', query.language.trim());
  }
  if (query.skill && query.skill.trim()) {
    params.set('skill', query.skill.trim());
  }
  if (query.framework && query.framework.trim()) {
    params.set('framework', query.framework.trim());
  }
  if (query.domain && query.domain.trim()) {
    params.set('domain', query.domain.trim());
  }
  if (query.project_experience && query.project_experience !== 'any') {
    params.set('project_experience', query.project_experience);
  }
  if (
    typeof query.min_score === 'number' &&
    Number.isFinite(query.min_score) &&
    query.min_score > 0
  ) {
    params.set('min_score', String(query.min_score));
  }
  if (
    typeof query.max_score === 'number' &&
    Number.isFinite(query.max_score) &&
    query.max_score < 100
  ) {
    params.set('max_score', String(query.max_score));
  }
  if (
    typeof query.min_coding_score === 'number' &&
    Number.isFinite(query.min_coding_score) &&
    query.min_coding_score > 0
  ) {
    params.set('min_coding_score', String(query.min_coding_score));
  }
  if (
    typeof query.min_ai_efficiency === 'number' &&
    Number.isFinite(query.min_ai_efficiency) &&
    query.min_ai_efficiency > 0
  ) {
    params.set('min_ai_efficiency', String(query.min_ai_efficiency));
  }
  if (query.difficulty && query.difficulty.trim()) {
    params.set('difficulty', query.difficulty.trim());
  }
  if (query.consistency && query.consistency.trim()) {
    params.set('consistency', query.consistency.trim());
  }
  if (query.improvement_trend && query.improvement_trend.trim()) {
    params.set('improvement_trend', query.improvement_trend.trim());
  }
  if (query.portfolio_only && query.portfolio_only !== 'all') {
    params.set('portfolio_only', query.portfolio_only);
  }
  if (query.sort_by) {
    params.set('sort_by', query.sort_by);
  }
  params.set('page', String(Math.max(1, query.page ?? 1)));
  params.set('page_size', String(Math.max(1, query.page_size ?? 12)));

  return params;
}

const EMPTY_LEGACY_METRICS: CompanyOverviewMetrics = {
  total_candidates: 0,
  evaluated_candidates: 0,
  in_progress_candidates: 0,
  average_overall_score: null,
};

function getSavedSearchStorageKey(companyId: string): string {
  return `gatecode_saved_searches_${companyId}`;
}

function readLocalSavedSearches(companyId: string): SavedCandidateSearch[] {
  try {
    const raw = localStorage.getItem(getSavedSearchStorageKey(companyId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord).map((item, idx) => ({
      id: asString(item.id, `saved-${idx + 1}`),
      name: asString(item.name, `Saved Search #${idx + 1}`),
      query_string: asString(item.query_string),
      filters_summary: asString(item.filters_summary, 'All candidates'),
      created_at: asString(item.created_at, new Date().toISOString()),
    }));
  } catch {
    return [];
  }
}

// Track known shortlisted IDs per authenticated company to prevent duplicate POST calls
const companyShortlistGuard = new Map<string, Set<string>>();

function getCompanyGuardSet(companyId: string): Set<string> {
  let set = companyShortlistGuard.get(companyId);
  if (!set) {
    set = new Set<string>();
    companyShortlistGuard.set(companyId, set);
  }
  return set;
}

export const recruiterService = {
  /**
   * Resets in-memory shortlist duplicate guard (useful on sign-out or test teardown).
   */
  resetClientGuards(): void {
    companyShortlistGuard.clear();
  },

  /**
   * Legacy compatibility helper returning evaluation overview records.
   */
  async getCandidateEvaluations(): Promise<CompanyDashboardData> {
    try {
      const response = await api.get<{
        success?: boolean;
        metrics?: CompanyOverviewMetrics;
        candidates?: CandidateEvaluationRecord[];
      }>('/api/recruiter/candidates');
      const candidates = Array.isArray(response.data?.candidates)
        ? response.data.candidates
        : [];
      const metrics = response.data?.metrics ?? {
        total_candidates: candidates.length,
        evaluated_candidates: candidates.filter(
          (c) => c.evaluation_status === 'evaluated'
        ).length,
        in_progress_candidates: candidates.filter(
          (c) => c.evaluation_status === 'in_progress'
        ).length,
        average_overall_score: null,
      };
      return { metrics, candidates };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return { metrics: EMPTY_LEGACY_METRICS, candidates: [] };
      }
      throw error;
    }
  },

  /**
   * Module 1: Retrieves complete Company Recruiter Dashboard overview data.
   * Never fabricates fake candidates when backend returns 404 or zero rows.
   */
  async getDashboardOverview(): Promise<RecruiterDashboardOverview> {
    const companyAuth = getAuthenticatedCompanyFallback();

    const parseOverview = (payload: unknown): RecruiterDashboardOverview => {
      const root = isRecord(payload) ? payload : {};
      const data = isRecord(root.dashboard) ? root.dashboard : root;

      const companyProfile = normalizeCompanyProfile(
        data.company_profile ?? data.company ?? companyAuth
      );

      const recentRaw = Array.isArray(data.recently_added_candidates)
        ? data.recently_added_candidates
        : Array.isArray(data.recent_candidates)
        ? data.recent_candidates
        : [];
      const recentlyAdded = recentRaw
        .map((item) => {
          try {
            return sanitizeCandidateForRecruiter(item);
          } catch {
            return null;
          }
        })
        .filter((item): item is RecruiterCandidateSummary => item !== null);

      const shortlistRaw = Array.isArray(data.shortlisted_candidates)
        ? data.shortlisted_candidates
        : Array.isArray(data.shortlist)
        ? data.shortlist
        : [];
      const shortlisted = shortlistRaw
        .filter(isRecord)
        .map((item) => normalizeShortlistEntry(item, companyProfile.company_id))
        .filter((item): item is ShortlistEntry => item !== null);

      const guardSet = getCompanyGuardSet(companyProfile.company_id);
      guardSet.clear();
      shortlisted.forEach((entry) => guardSet.add(entry.candidate_id));

      const activityRaw = Array.isArray(data.discovery_activity)
        ? data.discovery_activity
        : Array.isArray(data.recent_activity)
        ? data.recent_activity
        : [];
      const discoveryActivity: DiscoveryActivityItem[] = activityRaw
        .filter(isRecord)
        .map((act, idx) => ({
          id: asString(act.id, `act-${idx + 1}`),
          action: asString(act.action ?? act.type, 'Discovery Update'),
          description: asString(act.description ?? act.message),
          candidate_id: asString(act.candidate_id) || undefined,
          candidate_name: asString(act.candidate_name) || undefined,
          timestamp: asString(
            act.timestamp ?? act.created_at,
            new Date().toISOString()
          ),
        }));

      const savedRaw = Array.isArray(data.saved_searches)
        ? data.saved_searches
        : [];
      const backendSaved: SavedCandidateSearch[] = savedRaw
        .filter(isRecord)
        .map((s, idx) => ({
          id: asString(s.id, `saved-${idx + 1}`),
          name: asString(s.name ?? s.title, `Saved Search #${idx + 1}`),
          query_string: asString(s.query_string ?? s.query),
          filters_summary: asString(
            s.filters_summary ?? s.summary,
            'Custom filter preset'
          ),
          created_at: asString(s.created_at, new Date().toISOString()),
        }));
      const localSaved = readLocalSavedSearches(companyProfile.company_id);
      const mergedSaved =
        backendSaved.length > 0 ? backendSaved : localSaved;

      const statsObj = isRecord(data.platform_statistics)
        ? data.platform_statistics
        : isRecord(data.statistics)
        ? data.statistics
        : {};
      const platformStatistics: PlatformStatisticsSummary = {
        total_verified_assessments: asNumber(
          statsObj.total_verified_assessments ??
            statsObj.verified_assessments_count,
          0
        ),
        average_assessment_score: asNumberOrNull(
          statsObj.average_assessment_score ?? statsObj.average_score
        ),
        average_coding_score: asNumberOrNull(statsObj.average_coding_score),
        average_ai_efficiency_score: asNumberOrNull(
          statsObj.average_ai_efficiency_score
        ),
        top_verified_skills: asStringArray(statsObj.top_verified_skills),
      };

      return {
        company_profile: companyProfile,
        total_available_candidates: asNumber(
          data.total_available_candidates ?? data.total_candidates,
          recentlyAdded.length
        ),
        total_shortlisted_candidates: asNumber(
          data.total_shortlisted_candidates ?? data.shortlisted_count,
          shortlisted.length
        ),
        recently_added_candidates: recentlyAdded,
        discovery_activity: discoveryActivity,
        saved_searches: mergedSaved,
        shortlisted_candidates: shortlisted,
        platform_statistics: platformStatistics,
      };
    };

    try {
      const response = await api.get<unknown>('/api/recruiter/dashboard');
      return parseOverview(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        try {
          const fallback = await api.get<unknown>('/api/company/dashboard');
          return parseOverview(fallback.data);
        } catch (fallbackErr) {
          if (
            axios.isAxiosError(fallbackErr) &&
            fallbackErr.response?.status === 404
          ) {
            const [profile, searchRes, shortlist] = await Promise.all([
              this.getCompanyProfile(),
              this.searchCandidates({
                page: 1,
                page_size: 4,
                sort_by: 'recently_updated',
              }),
              this.getShortlist(),
            ]);

            return {
              company_profile: profile,
              total_available_candidates: searchRes.total,
              total_shortlisted_candidates: shortlist.length,
              recently_added_candidates: searchRes.items,
              discovery_activity: [],
              saved_searches: readLocalSavedSearches(profile.company_id),
              shortlisted_candidates: shortlist,
              platform_statistics: {
                total_verified_assessments: 0,
                average_assessment_score: null,
                average_coding_score: null,
                average_ai_efficiency_score: null,
                top_verified_skills: [],
              },
            };
          }
          throw fallbackErr;
        }
      }
      throw error;
    }
  },

  /**
   * Module 2: Server-side candidate search, filtering, sorting, and pagination.
   * Never loads the entire candidate database into the browser.
   */
  async searchCandidates(
    query: CandidateSearchQuery = {}
  ): Promise<PaginatedCandidateSearchResponse> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.max(1, query.page_size ?? 12);
    const params = buildCandidateSearchParams({
      ...query,
      page,
      page_size: pageSize,
    });
    const querySuffix = `?${params.toString()}`;

    const parsePage = (payload: unknown): PaginatedCandidateSearchResponse => {
      const root = isRecord(payload) ? payload : {};
      const rawList = Array.isArray(root.items)
        ? root.items
        : Array.isArray(root.candidates)
        ? root.candidates
        : Array.isArray(root.results)
        ? root.results
        : Array.isArray(payload)
        ? payload
        : [];

      const items = rawList
        .map((item) => {
          try {
            return sanitizeCandidateForRecruiter(item);
          } catch {
            return null;
          }
        })
        .filter((item): item is RecruiterCandidateSummary => item !== null);

      const total = asNumber(
        root.total ?? root.total_count ?? root.count,
        items.length
      );
      const resolvedPage = asNumber(root.page, page);
      const resolvedPageSize = asNumber(root.page_size ?? root.limit, pageSize);
      const totalPages = asNumber(
        root.total_pages,
        total > 0 ? Math.ceil(total / Math.max(1, resolvedPageSize)) : 0
      );

      return {
        items,
        total,
        page: resolvedPage,
        page_size: resolvedPageSize,
        total_pages: totalPages,
      };
    };

    try {
      const response = await api.get<unknown>(
        `/api/recruiter/candidates${querySuffix}`
      );
      return parsePage(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        try {
          const fallback = await api.get<unknown>(
            `/api/candidates/search${querySuffix}`
          );
          return parsePage(fallback.data);
        } catch (fallbackErr) {
          if (
            axios.isAxiosError(fallbackErr) &&
            fallbackErr.response?.status === 404
          ) {
            return {
              items: [],
              total: 0,
              page,
              page_size: pageSize,
              total_pages: 0,
            };
          }
          throw fallbackErr;
        }
      }
      throw error;
    }
  },

  /**
   * Saves a recruiter search preset associated with the authenticated company.
   */
  async saveCandidateSearch(payload: {
    name: string;
    query_string: string;
    filters_summary: string;
  }): Promise<SavedCandidateSearch> {
    const companyAuth = getAuthenticatedCompanyFallback();
    try {
      const response = await api.post<unknown>(
        '/api/recruiter/saved-searches',
        payload
      );
      const raw = isRecord(response.data) ? response.data : {};
      const item = isRecord(raw.saved_search) ? raw.saved_search : raw;
      return {
        id: asString(item.id, `saved-${Date.now()}`),
        name: asString(item.name, payload.name),
        query_string: asString(item.query_string, payload.query_string),
        filters_summary: asString(
          item.filters_summary,
          payload.filters_summary
        ),
        created_at: asString(item.created_at, new Date().toISOString()),
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        const existing = readLocalSavedSearches(companyAuth.id);
        const created: SavedCandidateSearch = {
          id: `saved-${Date.now()}`,
          name: payload.name.trim(),
          query_string: payload.query_string,
          filters_summary: payload.filters_summary,
          created_at: new Date().toISOString(),
        };
        const updated = [created, ...existing].slice(0, 10);
        try {
          localStorage.setItem(
            getSavedSearchStorageKey(companyAuth.id),
            JSON.stringify(updated)
          );
        } catch {
          // Ignore storage quota errors
        }
        return created;
      }
      throw error;
    }
  },

  /**
   * Module 3: Retrieves detailed permitted candidate profile and verified analytics.
   * Uses the authenticated API client and strictly enforces candidate privacy permissions.
   */
  async getCandidateDetail(
    candidateId: string
  ): Promise<RecruiterCandidateSummary> {
    const encoded = encodeURIComponent(candidateId.trim());

    try {
      const response = await api.get<unknown>(
        `/api/recruiter/candidates/${encoded}`
      );
      return sanitizeCandidateForRecruiter(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new CandidateAccessDeniedError();
        }
        if (error.response?.status === 404) {
          try {
            const fallback = await api.get<unknown>(
              `/api/public/profile/${encoded}`
            );
            return sanitizeCandidateForRecruiter(fallback.data);
          } catch (fallbackErr) {
            if (
              axios.isAxiosError(fallbackErr) &&
              fallbackErr.response?.status === 403
            ) {
              throw new CandidateAccessDeniedError();
            }
            throw fallbackErr;
          }
        }
      }
      throw error;
    }
  },

  /**
   * Module 4: Retrieves shortlisted candidates for the authenticated company account.
   */
  async getShortlist(
    filter: ShortlistFilterQuery = {}
  ): Promise<ShortlistEntry[]> {
    const companyAuth = getAuthenticatedCompanyFallback();
    const params = new URLSearchParams();
    if (filter.q && filter.q.trim()) params.set('q', filter.q.trim());
    if (filter.skill && filter.skill.trim()) {
      params.set('skill', filter.skill.trim());
    }
    if (
      typeof filter.min_score === 'number' &&
      Number.isFinite(filter.min_score) &&
      filter.min_score > 0
    ) {
      params.set('min_score', String(filter.min_score));
    }
    if (filter.portfolio_only && filter.portfolio_only !== 'all') {
      params.set('portfolio_only', filter.portfolio_only);
    }
    if (filter.sort_by) params.set('sort_by', filter.sort_by);

    const suffix = params.toString() ? `?${params.toString()}` : '';

    const parseShortlist = (payload: unknown): ShortlistEntry[] => {
      const root = isRecord(payload) ? payload : {};
      const list = Array.isArray(root.shortlist)
        ? root.shortlist
        : Array.isArray(root.items)
        ? root.items
        : Array.isArray(root.candidates)
        ? root.candidates
        : Array.isArray(payload)
        ? payload
        : [];

      const entries = list
        .filter(isRecord)
        .map((item) => normalizeShortlistEntry(item, companyAuth.id))
        .filter((item): item is ShortlistEntry => item !== null);

      // Deduplicate by candidate_id on read as well
      const seen = new Set<string>();
      const uniqueEntries: ShortlistEntry[] = [];
      for (const entry of entries) {
        if (!seen.has(entry.candidate_id)) {
          seen.add(entry.candidate_id);
          uniqueEntries.push(entry);
        }
      }

      const guardSet = getCompanyGuardSet(companyAuth.id);
      guardSet.clear();
      uniqueEntries.forEach((e) => guardSet.add(e.candidate_id));

      return uniqueEntries;
    };

    try {
      const response = await api.get<unknown>(
        `/api/recruiter/shortlist${suffix}`
      );
      return parseShortlist(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        try {
          const fallback = await api.get<unknown>(
            `/api/company/shortlist${suffix}`
          );
          return parseShortlist(fallback.data);
        } catch (fallbackErr) {
          if (
            axios.isAxiosError(fallbackErr) &&
            fallbackErr.response?.status === 404
          ) {
            return [];
          }
          throw fallbackErr;
        }
      }
      throw error;
    }
  },

  /**
   * Module 4: Adds a candidate to the authenticated company's shortlist.
   * Prevents duplicate shortlist entries.
   */
  async addToShortlist(payload: {
    candidateId: string;
    privateNotes?: string;
    candidateSnapshot?: RecruiterCandidateSummary;
  }): Promise<ShortlistEntry> {
    const companyAuth = getAuthenticatedCompanyFallback();
    const cleanId = payload.candidateId.trim();
    const guardSet = getCompanyGuardSet(companyAuth.id);

    if (guardSet.has(cleanId)) {
      throw new DuplicateShortlistError();
    }

    const requestBody = {
      candidate_id: cleanId,
      private_notes: payload.privateNotes?.trim() ?? '',
      notes: payload.privateNotes?.trim() ?? '',
    };

    let response;
    try {
      response = await api.post<unknown>(
        '/api/recruiter/shortlist',
        requestBody
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 409) {
          guardSet.add(cleanId);
          throw new DuplicateShortlistError();
        }
        if (error.response?.status === 404) {
          response = await api.post<unknown>(
            '/api/company/shortlist',
            requestBody
          );
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    guardSet.add(cleanId);

    const root = isRecord(response?.data) ? response.data : {};
    const entryRaw = isRecord(root.entry)
      ? root.entry
      : isRecord(root.shortlist_entry)
      ? root.shortlist_entry
      : root;

    const normalized = normalizeShortlistEntry(
      {
        ...entryRaw,
        candidate_id: cleanId,
        candidate: entryRaw.candidate ?? payload.candidateSnapshot ?? {
          candidate_id: cleanId,
          display_name: 'Shortlisted Candidate',
        },
        private_notes:
          entryRaw.private_notes ??
          entryRaw.notes ??
          (payload.privateNotes?.trim() ?? ''),
      },
      companyAuth.id
    );

    if (!normalized) {
      throw new Error('Unable to normalize shortlist entry response.');
    }

    return normalized;
  },

  /**
   * Module 4: Removes a candidate from the authenticated company's shortlist.
   */
  async removeFromShortlist(candidateId: string): Promise<void> {
    const companyAuth = getAuthenticatedCompanyFallback();
    const cleanId = candidateId.trim();
    const encoded = encodeURIComponent(cleanId);

    try {
      await api.delete(`/api/recruiter/shortlist/${encoded}`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        await api.delete(`/api/company/shortlist/${encoded}`);
      } else {
        throw error;
      }
    }

    getCompanyGuardSet(companyAuth.id).delete(cleanId);
  },

  /**
   * Module 4: Updates private recruiter notes for a shortlisted candidate.
   * Notes remain strictly scoped to the authenticated company account.
   */
  async updateRecruiterNotes(
    candidateId: string,
    privateNotes: string
  ): Promise<{ candidate_id: string; private_notes: string; updated_at: string }> {
    const cleanId = candidateId.trim();
    const encoded = encodeURIComponent(cleanId);
    const body = {
      private_notes: privateNotes,
      notes: privateNotes,
    };

    let response;
    try {
      response = await api.patch<unknown>(
        `/api/recruiter/shortlist/${encoded}/notes`,
        body
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        try {
          response = await api.put<unknown>(
            `/api/recruiter/shortlist/${encoded}`,
            body
          );
        } catch (putErr) {
          if (axios.isAxiosError(putErr) && putErr.response?.status === 404) {
            response = await api.patch<unknown>(
              `/api/company/shortlist/${encoded}`,
              body
            );
          } else {
            throw putErr;
          }
        }
      } else {
        throw error;
      }
    }

    const raw = isRecord(response?.data) ? response.data : {};
    const entry = isRecord(raw.entry) ? raw.entry : raw;

    return {
      candidate_id: cleanId,
      private_notes:
        typeof entry.private_notes === 'string'
          ? entry.private_notes
          : typeof entry.notes === 'string'
          ? entry.notes
          : privateNotes,
      updated_at: asString(entry.updated_at, new Date().toISOString()),
    };
  },

  /**
   * Module 5: Retrieves side-by-side comparison metrics for up to 4 candidates.
   * Presents measurable evidence without ranking or declaring an objective winner.
   */
  async compareCandidates(
    candidateIds: string[]
  ): Promise<RecruiterCandidateSummary[]> {
    const uniqueIds = Array.from(
      new Set(candidateIds.map((id) => id.trim()).filter(Boolean))
    );

    if (uniqueIds.length === 0) {
      return [];
    }

    if (uniqueIds.length > MAX_COMPARISON_CANDIDATES) {
      throw new Error(
        `You can compare at most ${MAX_COMPARISON_CANDIDATES} candidates simultaneously.`
      );
    }

    const parseComparison = (payload: unknown): RecruiterCandidateSummary[] => {
      const root = isRecord(payload) ? payload : {};
      const list = Array.isArray(root.candidates)
        ? root.candidates
        : Array.isArray(root.comparison)
        ? root.comparison
        : Array.isArray(root.items)
        ? root.items
        : Array.isArray(payload)
        ? payload
        : [];

      return list
        .map((item) => {
          try {
            return sanitizeCandidateForRecruiter(item);
          } catch {
            return null;
          }
        })
        .filter((item): item is RecruiterCandidateSummary => item !== null)
        .slice(0, MAX_COMPARISON_CANDIDATES);
    };

    try {
      const response = await api.post<unknown>('/api/recruiter/compare', {
        candidate_ids: uniqueIds,
      });
      return parseComparison(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        try {
          const params = new URLSearchParams({
            candidate_ids: uniqueIds.join(','),
          });
          const getRes = await api.get<unknown>(
            `/api/recruiter/compare?${params.toString()}`
          );
          return parseComparison(getRes.data);
        } catch (getErr) {
          if (axios.isAxiosError(getErr) && getErr.response?.status === 404) {
            const profiles = await Promise.all(
              uniqueIds.map((id) => this.getCandidateDetail(id))
            );
            return profiles;
          }
          throw getErr;
        }
      }
      throw error;
    }
  },

  /**
   * Module 6: Retrieves authenticated company profile & settings.
   * Never exposes authentication credentials or JWT tokens.
   */
  async getCompanyProfile(): Promise<CompanyProfile> {
    try {
      const response = await api.get<unknown>('/api/recruiter/company/profile');
      return normalizeCompanyProfile(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        try {
          const fallback = await api.get<unknown>('/api/company/profile');
          return normalizeCompanyProfile(fallback.data);
        } catch (fallbackErr) {
          if (
            axios.isAxiosError(fallbackErr) &&
            fallbackErr.response?.status === 404
          ) {
            return normalizeCompanyProfile(getAuthenticatedCompanyFallback());
          }
          throw fallbackErr;
        }
      }
      throw error;
    }
  },

  /**
   * Module 6: Updates permitted company profile information.
   */
  async updateCompanyProfile(
    payload: CompanyProfileUpdatePayload
  ): Promise<CompanyProfile> {
    const body = {
      company_name: payload.company_name.trim(),
      name: payload.company_name.trim(),
      industry: payload.industry?.trim() ?? '',
      website_url: payload.website_url?.trim() ?? '',
      company_size: payload.company_size?.trim() ?? '',
      headquarters: payload.headquarters?.trim() ?? '',
      description: payload.description?.trim() ?? '',
      hiring_domains: payload.hiring_domains ?? [],
      target_roles: payload.target_roles ?? [],
      preferred_languages: payload.preferred_languages ?? [],
    };

    try {
      const response = await api.put<unknown>(
        '/api/recruiter/company/profile',
        body
      );
      return normalizeCompanyProfile(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        try {
          const patchRes = await api.patch<unknown>(
            '/api/recruiter/company/profile',
            body
          );
          return normalizeCompanyProfile(patchRes.data);
        } catch (patchErr) {
          if (
            axios.isAxiosError(patchErr) &&
            patchErr.response?.status === 404
          ) {
            const companyRes = await api.put<unknown>(
              '/api/company/profile',
              body
            );
            return normalizeCompanyProfile(companyRes.data);
          }
          throw patchErr;
        }
      }
      throw error;
    }
  },

  /**
   * Module 6: Updates company recruiter workspace & notification settings.
   */
  async updateCompanySettings(
    payload: CompanySettingsUpdatePayload
  ): Promise<CompanyProfile> {
    try {
      const response = await api.patch<unknown>(
        '/api/recruiter/company/settings',
        payload
      );
      return normalizeCompanyProfile(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        const fallback = await api.patch<unknown>(
          '/api/company/settings',
          payload
        );
        return normalizeCompanyProfile(fallback.data);
      }
      throw error;
    }
  },
};
