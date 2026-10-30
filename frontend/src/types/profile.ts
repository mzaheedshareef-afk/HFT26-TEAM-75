// TypeScript API Contracts for Student Profile & Public Profile Sharing
// Enforces strict separation between private authenticated profile management
// and public-safe shareable candidate profile data.

export type ProfileVisibility = 'private' | 'public' | 'shareable_link';

export interface ProfileProjectSummary {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  repo_url?: string;
  live_url?: string;
}

export interface ProfilePortfolioSummary {
  github_url?: string;
  linkedin_url?: string;
  experience_level?: string;
  primary_focus?: string;
  repositories_count?: number;
  calibrated_tracks: string[];
}

export interface ProfileAssessmentPerformance {
  total_assessments_completed: number;
  average_score: number | null;
  highest_score: number | null;
  coding_score: number | null;
  /**
   * Official backend-computed AI efficiency score. Never calculated in frontend.
   */
  ai_efficiency_score: number | null;
  completion_rate: number | null;
}

export interface VerifiedAchievementItem {
  id: string;
  title: string;
  description: string;
  category: 'assessment' | 'consistency' | 'efficiency' | 'portfolio';
  earned_at?: string;
}

export interface ProfileConsistencyMetric {
  score: number | null;
  label: string;
  summary?: string;
}

export interface ProfileImprovementMetric {
  delta_percentage: number | null;
  label: string;
  summary?: string;
}

/**
 * Authenticated candidate's editable profile settings & visibility controls.
 */
export interface StudentProfileSettings {
  profile_id: string;
  display_name: string;
  headline: string;
  summary: string;
  skills: string[];
  technologies: string[];
  projects: ProfileProjectSummary[];
  portfolio_info: ProfilePortfolioSummary;
  assessment_performance: ProfileAssessmentPerformance;
  verified_achievements: VerifiedAchievementItem[];
  consistency: ProfileConsistencyMetric;
  improvement: ProfileImprovementMetric;
  visibility: ProfileVisibility;
  is_sharing_enabled: boolean;
  share_slug: string | null;
  share_url: string | null;
  updated_at?: string;
}

/**
 * Strictly public-safe student profile representation.
 * Explicitly excludes email, user_id, auth tokens, and any private account metadata.
 */
export interface PublicStudentProfile {
  share_slug: string;
  display_name: string;
  headline: string;
  summary: string;
  skills: string[];
  technologies: string[];
  projects: ProfileProjectSummary[];
  portfolio_info: ProfilePortfolioSummary;
  assessment_performance: ProfileAssessmentPerformance;
  verified_achievements: VerifiedAchievementItem[];
  consistency: ProfileConsistencyMetric;
  improvement: ProfileImprovementMetric;
  visibility: Exclude<ProfileVisibility, 'private'>;
}

export interface UpdateStudentProfilePayload {
  display_name: string;
  headline?: string;
  summary: string;
  skills: string[];
  technologies: string[];
  projects: ProfileProjectSummary[];
  github_url?: string;
  linkedin_url?: string;
}

export interface UpdateProfileVisibilityPayload {
  visibility: ProfileVisibility;
  is_sharing_enabled: boolean;
}

