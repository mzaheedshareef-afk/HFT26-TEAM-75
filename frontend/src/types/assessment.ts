// TypeScript API Contracts for Assessment Module
// Unified between Zaheed's Frontend and Vasil's FastAPI Backend & Execution Engine

export type QuestionDifficulty = 'Easy' | 'Medium' | 'Hard';

export type AssessmentDifficultyLabel = 'Easy' | 'Medium' | 'Hard' | 'Adaptive';

export type AssessmentLifecycleStatus =
  | 'generating'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'expired';

export type SupportedLanguage =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'java'
  | 'cpp';

/**
 * Execution status verdicts aligned with docs/execution_module_plan.md (Section 4.2):
 * - AC: Accepted
 * - WA: Wrong Answer
 * - TLE: Time Limit Exceeded
 * - MLE: Memory Limit Exceeded
 * - RTE: Runtime Error
 * - SEC: Security Violation
 */
export type ExecutionVerdict = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RTE' | 'SEC';

export interface QuestionConstraints {
  min_array_length?: number;
  max_array_length?: number;
  min_value?: number;
  max_value?: number;
  time_limit_ms: number;
  memory_limit_mb: number;
  additional_notes?: string[];
}

export interface PublicTestCase {
  test_case_id: string;
  input: string;
  expected_output: string;
  explanation?: string;
}

export interface CodingQuestion {
  question_id: string;
  title: string;
  difficulty: QuestionDifficulty;
  domain: string;
  target_skill?: string;
  description: string;
  input_format: string;
  output_format: string;
  constraints: QuestionConstraints;
  public_test_cases: PublicTestCase[];
  total_test_cases_count?: number;
  hidden_test_cases_count?: number;
  starter_code?: Partial<Record<SupportedLanguage, string>>;
}

export interface TestCaseRunResult {
  test_case_id: string;
  is_hidden?: boolean;
  passed: boolean;
  verdict: ExecutionVerdict;
  execution_time_ms?: number;
  memory_used_mb?: number;
  input?: string;
  expected_output?: string;
  actual_output?: string;
  error_message?: string;
  weight?: number;
}

export interface CodeRunResponse {
  success: boolean;
  question_id: string;
  overall_verdict: ExecutionVerdict;
  passed_count: number;
  total_count: number;
  total_time_ms?: number;
  results: TestCaseRunResult[];
}

export interface EfficiencyAnalysis {
  detected_time_complexity: string;
  detected_space_complexity: string;
  optimality_score: number;
  cleanliness_score: number;
  feedback: string;
}

export interface ScoreSummary {
  submission_id: string;
  assessment_id?: string;
  question_id?: string;
  question_title?: string;
  deterministic_score: number; // 0 - 100 weighted hidden/public test score
  overall_score: number; // 0 - 100 composite score
  passed_tests: number;
  total_tests: number;
  overall_verdict: ExecutionVerdict;
  submitted_at?: string;
  efficiency?: EfficiencyAnalysis | null;
}

export interface ActiveAssessmentSession {
  assessment_id: string;
  title: string;
  duration_seconds: number;
  remaining_seconds?: number;
  allowed_languages: SupportedLanguage[];
  questions: CodingQuestion[];
  calibrated_stack?: string[];
  difficulty?: AssessmentDifficultyLabel;
  status?: AssessmentLifecycleStatus;
  target_role?: string;
  topics?: string[];
}

export interface AssessmentSummaryItem {
  id: string;
  title: string;
  difficulty: AssessmentDifficultyLabel;
  duration_minutes: number;
  question_count: number;
  topics: string[];
  target_role?: string;
  status: AssessmentLifecycleStatus;
  allowed_languages: SupportedLanguage[];
  created_at?: string;
  completed_at?: string;
  final_score?: number | null;
}

export type AiHintLevel = 1 | 2 | 3;

export interface AiHintItem {
  hint_id: string;
  question_id: string;
  level: AiHintLevel;
  category_label: string;
  content: string;
  redacted_solution_attempt?: boolean;
  created_at: string;
}

export interface AiHintRequestPayload {
  assessmentId?: string;
  questionId: string;
  questionTitle?: string;
  hintLevel: AiHintLevel;
  language: SupportedLanguage;
  currentCode?: string;
  previousHints?: string[];
}

export interface AiHintResponse {
  success: boolean;
  hint: AiHintItem;
  hints_used_for_question?: number;
  max_hints_per_question?: number;
}

export type AssessmentCompletionStatus =
  | 'completed'
  | 'partially_completed'
  | 'expired'
  | 'in_progress';

export interface QuestionPerformanceItem {
  question_id: string;
  title: string;
  difficulty: QuestionDifficulty;
  verdict: ExecutionVerdict | 'PENDING';
  score: number;
  passed_tests: number;
  failed_tests: number;
  total_tests: number;
  time_taken_seconds?: number;
  hints_used: number;
  detected_time_complexity?: string;
}

export interface AssessmentResultDetail {
  assessment_id: string;
  assessment_title: string;
  completion_status: AssessmentCompletionStatus;
  final_score: number;
  deterministic_score?: number;
  correct_test_cases: number;
  failed_test_cases: number;
  total_test_cases: number;
  time_taken_seconds: number;
  time_limit_seconds?: number;
  total_hints_used: number;
  completed_at?: string;
  question_performance: QuestionPerformanceItem[];
}

export interface AssessmentGenerateRequest {
  portfolio_id?: string;
  target_role?: string;
  difficulty_preference?: 'easy' | 'medium' | 'hard' | 'adaptive';
  question_count?: number;
}

export interface AssessmentDetail {
  id: string;
  user_id: string;
  portfolio_id?: string;
  title: string;
  target_role: string;
  difficulty: string;
  status: AssessmentLifecycleStatus;
  total_time_limit_minutes: number;
  question_count: number;
  questions: CodingQuestion[];
  created_at: string;
  completed_at?: string;
}

export interface AssessmentResponse {
  success: boolean;
  assessment: AssessmentDetail;
}
