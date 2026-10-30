// TypeScript API Contracts for Zaheed's Frontend
// Module: Personalized Assessment
// Aligned with Vasil's FastAPI Backend & Featherless AI Generator

export interface SampleTestCase {
  input: string;
  expected_output: string;
  explanation?: string;
}

export interface QuestionSummary {
  id: string;
  order_index: number;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  target_skill: string;
  starter_code: Record<string, string>; // e.g., { python: "def solve():\n    pass" }
  sample_test_cases: SampleTestCase[];
  time_limit_seconds: number;
  memory_limit_mb: number;
}

export interface AssessmentGenerateRequest {
  portfolio_id?: string;
  target_role?: string;
  difficulty_preference?: 'easy' | 'medium' | 'hard' | 'adaptive';
  question_count?: number; // default: 3, max: 5
}

export interface AssessmentDetail {
  id: string;
  user_id: string;
  portfolio_id?: string;
  title: string;
  target_role: string;
  difficulty: string;
  status: 'generating' | 'ready' | 'in_progress' | 'completed' | 'expired';
  total_time_limit_minutes: number;
  question_count: number;
  questions: QuestionSummary[];
  created_at: string;
  completed_at?: string;
}

export interface AssessmentResponse {
  success: boolean;
  assessment: AssessmentDetail;
}
