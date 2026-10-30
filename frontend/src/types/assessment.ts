export type QuestionDifficulty = 'Easy' | 'Medium' | 'Hard';

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

/**
 * Coding question contract aligned with tests/sandbox_planning/sample_question.json
 */
export interface CodingQuestion {
  question_id: string;
  title: string;
  difficulty: QuestionDifficulty;
  domain: string;
  description: string;
  input_format: string;
  output_format: string;
  constraints: QuestionConstraints;
  public_test_cases: PublicTestCase[];
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

/**
 * AI Efficiency Analysis aligned with docs/execution_module_plan.md (Section 5.2)
 */
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
}
