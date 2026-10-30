// TypeScript API Contracts for Student Analytics & Performance History Modules
// Unified between Zaheed's Frontend and Vasil's FastAPI Analytics Engine

import type {
  AiHintLevel,
  AssessmentCompletionStatus,
  AssessmentDifficultyLabel,
} from './assessment';

export interface TopicPerformanceMetric {
  topic: string;
  average_score: number;
  coding_score?: number;
  assessments_count: number;
  questions_solved?: number;
  accuracy_rate?: number;
}

export interface DifficultyPerformanceMetric {
  difficulty: AssessmentDifficultyLabel;
  average_score: number;
  pass_rate: number;
  attempts_count: number;
}

export interface ScoreTrendPoint {
  assessment_id: string;
  assessment_title: string;
  date: string;
  overall_score: number;
  coding_score: number;
  /**
   * Strictly populated ONLY when returned by the backend grading/analytics engine.
   * Never computed or estimated in the frontend.
   */
  ai_efficiency_score: number | null;
  completion_status: AssessmentCompletionStatus;
}

export interface AiInteractionSummary {
  total_hint_requests: number;
  hint_levels_used: AiHintLevel[];
  used_or_viewed_hints: boolean;
  hints_viewed_count: number;
  ai_assistance_usage_label: string;
  independent_questions_count?: number;
  assisted_questions_count?: number;
  coding_score: number;
  /**
   * Official AI efficiency score returned by the backend.
   * Null when the backend has not returned an efficiency score for this record.
   */
  ai_efficiency_score: number | null;
}

export interface AssessmentHistoryItem {
  assessment_id: string;
  title: string;
  date: string;
  overall_score: number;
  coding_score: number;
  /**
   * Official AI efficiency score returned by the backend.
   * Never calculated in the frontend.
   */
  ai_efficiency_score: number | null;
  duration_seconds: number;
  time_limit_seconds?: number;
  question_count: number;
  completion_status: AssessmentCompletionStatus;
  difficulty: AssessmentDifficultyLabel;
  topics: string[];
  hints_used: number;
}

export interface StudentAnalyticsOverview {
  overall_score: number;
  coding_score: number;
  /**
   * Official AI efficiency score returned by the backend.
   * Never calculated in the frontend.
   */
  ai_efficiency_score: number | null;
  total_assessments_completed: number;
  total_assessments_assigned: number;
  average_score: number;
  highest_score: number;
  completion_rate: number; // 0 - 100 percentage
  correct_test_cases: number;
  failed_test_cases: number;
  total_test_cases: number;
  average_completion_time_seconds: number;
  improvement_percentage: number | null;
  improvement_label: string;
  consistency_score: number | null;
  consistency_label: string;
  recent_history: AssessmentHistoryItem[];
  score_trend: ScoreTrendPoint[];
  topic_performance: TopicPerformanceMetric[];
  difficulty_performance: DifficultyPerformanceMetric[];
  ai_interaction: AiInteractionSummary;
}

