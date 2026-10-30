import type { ScoreSummary } from './assessment';
import type { PortfolioIngestionStatus } from './portfolio';

export const MAX_COMPARISON_CANDIDATES = 4;

export type CandidateEvaluationStatus =
  | 'awaiting_portfolio'
  | 'ready_for_assessment'
  | 'in_progress'
  | 'evaluated';

export interface CandidateEvaluationRecord {
  candidate_id: string;
  full_name: string;
  email: string;
  github_url?: string | null;
  primary_stack: string[];
  portfolio_status: PortfolioIngestionStatus;
  evaluation_status: CandidateEvaluationStatus;
  latest_score?: ScoreSummary | null;
  updated_at?: string;
}

export interface CompanyOverviewMetrics {
  total_candidates: number;
  evaluated_candidates: number;
  in_progress_candidates: number;
  average_overall_score: number | null;
}

export interface CompanyDashboardData {
  metrics: CompanyOverviewMetrics;
  candidates: CandidateEvaluationRecord[];
}

export type CandidateSortOption =
  | 'highest_assessment_score'
  | 'highest_coding_score'
  | 'highest_improvement'
  | 'most_consistent'
  | 'most_relevant_skills'
  | 'recently_updated';

export type CandidateImprovementTrend =
  | 'improving'
  | 'steady'
  | 'declining'
  | 'insufficient_data';

export interface CandidateProjectItem {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  repo_url?: string;
  demo_url?: string;
  highlights?: string[];
  domain?: string;
}

export interface CandidateTopicMetric {
  topic: string;
  average_score: number;
  assessments_count?: number;
  success_rate?: number;
}

export interface CandidateDifficultyMetric {
  difficulty: string;
  average_score: number;
  pass_rate?: number;
  attempts_count?: number;
}

export interface CandidateVerifiedAchievement {
  id: string;
  title: string;
  description: string;
  score?: number | null;
  verified_at?: string;
  skill_evidence?: string;
  level?: string;
}

export interface RecruiterCandidateSummary {
  candidate_id: string;
  share_id?: string;
  display_name: string;
  headline: string;
  summary: string;
  experience_level: string;
  years_of_experience?: number | null;
  domains: string[];
  programming_languages: string[];
  technical_skills: string[];
  frameworks: string[];
  projects: CandidateProjectItem[];
  portfolio_available: boolean;
  portfolio_github_url?: string;
  portfolio_linkedin_url?: string;
  portfolio_highlights: string[];
  // Verified platform assessment performance (strictly distinct from self-reported portfolio)
  assessments_completed: number;
  overall_score: number | null;
  highest_score: number | null;
  coding_score: number | null;
  // Strictly returned by backend — NEVER computed in frontend
  ai_efficiency_score: number | null;
  difficulty_level: string;
  consistency_score: number | null;
  consistency_label: string;
  improvement_delta: number | null;
  improvement_trend: CandidateImprovementTrend;
  improvement_label: string;
  topic_performance: CandidateTopicMetric[];
  difficulty_performance: CandidateDifficultyMetric[];
  verified_achievements: CandidateVerifiedAchievement[];
  updated_at: string;
  member_since?: string;
  is_shortlisted?: boolean;
}

export interface CandidateSearchQuery {
  q?: string;
  language?: string;
  skill?: string;
  framework?: string;
  domain?: string;
  project_experience?: string;
  min_score?: number;
  max_score?: number;
  min_coding_score?: number;
  min_ai_efficiency?: number;
  difficulty?: string;
  consistency?: string;
  improvement_trend?: string;
  portfolio_only?: 'all' | 'yes' | 'no';
  sort_by?: CandidateSortOption;
  page?: number;
  page_size?: number;
}

export interface PaginatedCandidateSearchResponse {
  items: RecruiterCandidateSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ShortlistEntry {
  shortlist_id: string;
  company_id: string;
  candidate_id: string;
  candidate: RecruiterCandidateSummary;
  private_notes: string;
  added_at: string;
  updated_at: string;
}

export interface ShortlistFilterQuery {
  q?: string;
  skill?: string;
  min_score?: number;
  portfolio_only?: 'all' | 'yes' | 'no';
  sort_by?:
    | 'recently_shortlisted'
    | 'highest_assessment_score'
    | 'highest_coding_score'
    | 'name_asc';
}

export interface SavedCandidateSearch {
  id: string;
  name: string;
  query_string: string;
  filters_summary: string;
  created_at: string;
}

export interface DiscoveryActivityItem {
  id: string;
  action: string;
  description: string;
  candidate_id?: string;
  candidate_name?: string;
  timestamp: string;
}

export interface PlatformStatisticsSummary {
  total_verified_assessments: number;
  average_assessment_score: number | null;
  average_coding_score: number | null;
  average_ai_efficiency_score: number | null;
  top_verified_skills: string[];
}

export interface CompanyNotificationPreferences {
  shortlist_alerts: boolean;
  weekly_talent_digest: boolean;
  assessment_completion_updates: boolean;
}

export interface CompanyProfile {
  company_id: string;
  company_name: string;
  official_email: string;
  industry: string;
  website_url: string;
  company_size: string;
  headquarters: string;
  description: string;
  hiring_domains: string[];
  target_roles: string[];
  preferred_languages: string[];
  default_discovery_view: 'cards' | 'table';
  notification_preferences: CompanyNotificationPreferences;
  created_at?: string;
  updated_at?: string;
}

export interface CompanyProfileUpdatePayload {
  company_name: string;
  industry?: string;
  website_url?: string;
  company_size?: string;
  headquarters?: string;
  description?: string;
  hiring_domains?: string[];
  target_roles?: string[];
  preferred_languages?: string[];
}

export interface CompanySettingsUpdatePayload {
  default_discovery_view: 'cards' | 'table';
  notification_preferences: CompanyNotificationPreferences;
}

export interface RecruiterDashboardOverview {
  company_profile: CompanyProfile;
  total_available_candidates: number;
  total_shortlisted_candidates: number;
  recently_added_candidates: RecruiterCandidateSummary[];
  discovery_activity: DiscoveryActivityItem[];
  saved_searches: SavedCandidateSearch[];
  shortlisted_candidates: ShortlistEntry[];
  platform_statistics: PlatformStatisticsSummary;
}
