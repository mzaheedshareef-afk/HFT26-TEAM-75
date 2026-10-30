import axios from 'axios';
import { api } from './api';
import type {
  ActiveAssessmentSession,
  AssessmentCompletionStatus,
  AssessmentDifficultyLabel,
  AssessmentGenerateRequest,
  AssessmentLifecycleStatus,
  AssessmentResultDetail,
  AssessmentSummaryItem,
  CodeRunResponse,
  CodingQuestion,
  ExecutionVerdict,
  PublicTestCase,
  QuestionDifficulty,
  QuestionPerformanceItem,
  ScoreSummary,
  SupportedLanguage,
  TestCaseRunResult,
} from '../types/assessment';

export const CORE_CODING_LANGUAGES: SupportedLanguage[] = [
  'python',
  'java',
  'cpp',
];

const DEFAULT_ALLOWED_LANGUAGES: SupportedLanguage[] = [
  'python',
  'java',
  'cpp',
  'typescript',
  'javascript',
];

const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  python: 'python',
  python3: 'python',
  py: 'python',
  java: 'java',
  cpp: 'cpp',
  'c++': 'cpp',
  cxx: 'cpp',
  typescript: 'typescript',
  ts: 'typescript',
  javascript: 'javascript',
  js: 'javascript',
  node: 'javascript',
};

export interface RunCodePayload {
  assessmentId?: string;
  questionId: string;
  language: SupportedLanguage;
  code: string;
}

export interface SubmitCodePayload {
  assessmentId?: string;
  questionId: string;
  language: SupportedLanguage;
  code: string;
  elapsedSeconds?: number;
  hintsUsed?: number;
}

export interface CompleteAssessmentPayload {
  assessmentId: string;
  elapsedSeconds?: number;
  totalHintsUsed?: number;
}

interface LatestScoreApiResponse {
  success: boolean;
  summary?: ScoreSummary | null;
}

export interface SubmitSolutionApiResponse {
  success: boolean;
  summary: ScoreSummary;
  run_results?: CodeRunResponse;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveLanguageAlias(raw: unknown): SupportedLanguage | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  return LANGUAGE_ALIASES[key] ?? null;
}

export function normalizeExecutionVerdict(
  raw: unknown,
  fallback: ExecutionVerdict = 'RTE'
): ExecutionVerdict {
  if (typeof raw === 'string') {
    const upper = raw.trim().toUpperCase();
    if (upper === 'AC' || upper === 'ACCEPTED' || upper === 'PASSED') {
      return 'AC';
    }
    if (upper === 'WA' || upper === 'WRONG_ANSWER' || upper === 'FAILED') {
      return 'WA';
    }
    if (
      upper === 'TLE' ||
      upper === 'TIMEOUT' ||
      upper === 'TIME_LIMIT_EXCEEDED'
    ) {
      return 'TLE';
    }
    if (upper === 'MLE' || upper === 'MEMORY_LIMIT_EXCEEDED') {
      return 'MLE';
    }
    if (
      upper === 'CE' ||
      upper === 'COMPILE_ERROR' ||
      upper === 'COMPILATION_ERROR' ||
      upper === 'SYNTAX_ERROR'
    ) {
      return 'CE';
    }
    if (upper === 'RTE' || upper === 'RUNTIME_ERROR' || upper === 'ERROR') {
      return 'RTE';
    }
    if (upper === 'SEC' || upper === 'SECURITY_VIOLATION') {
      return 'SEC';
    }
  }
  return fallback;
}

export function normalizeQuestionDifficulty(raw: unknown): QuestionDifficulty {
  if (typeof raw === 'string') {
    const lower = raw.trim().toLowerCase();
    if (lower === 'easy') return 'Easy';
    if (lower === 'hard') return 'Hard';
  }
  return 'Medium';
}

export function normalizeAssessmentDifficulty(
  raw: unknown
): AssessmentDifficultyLabel {
  if (typeof raw === 'string') {
    const lower = raw.trim().toLowerCase();
    if (lower === 'easy') return 'Easy';
    if (lower === 'medium') return 'Medium';
    if (lower === 'hard') return 'Hard';
    if (lower === 'adaptive') return 'Adaptive';
  }
  return 'Adaptive';
}

function normalizeLifecycleStatus(raw: unknown): AssessmentLifecycleStatus {
  if (typeof raw === 'string') {
    const lower = raw.trim().toLowerCase();
    if (
      lower === 'generating' ||
      lower === 'ready' ||
      lower === 'in_progress' ||
      lower === 'completed' ||
      lower === 'expired'
    ) {
      return lower;
    }
  }
  return 'ready';
}

/**
 * Normalizes allowed programming languages while ensuring Python, Java, and C++
 * are always supported in the coding workspace alongside any backend-specified languages.
 */
function normalizeSupportedLanguages(
  rawAllowed: unknown,
  questions?: CodingQuestion[]
): SupportedLanguage[] {
  const ordered: SupportedLanguage[] = [];
  const addLang = (candidate: SupportedLanguage | null) => {
    if (candidate && !ordered.includes(candidate)) {
      ordered.push(candidate);
    }
  };

  if (Array.isArray(rawAllowed)) {
    for (const item of rawAllowed) {
      addLang(resolveLanguageAlias(item));
    }
  }

  if (questions && questions.length > 0) {
    for (const q of questions) {
      if (q.starter_code) {
        for (const key of Object.keys(q.starter_code)) {
          addLang(resolveLanguageAlias(key));
        }
      }
    }
  }

  // Always guarantee core coding workspace languages (Python, Java, C++)
  for (const coreLang of CORE_CODING_LANGUAGES) {
    addLang(coreLang);
  }

  return ordered.length > 0 ? ordered : [...DEFAULT_ALLOWED_LANGUAGES];
}

export function normalizeCodingQuestion(
  raw: Record<string, unknown>,
  index: number
): CodingQuestion {
  const questionId =
    (typeof raw.question_id === 'string' && raw.question_id) ||
    (typeof raw.id === 'string' && raw.id) ||
    `q-${index + 1}`;

  const rawConstraintsObj = isRecord(raw.constraints) ? raw.constraints : {};
  const rawConstraintsList = Array.isArray(raw.constraints)
    ? raw.constraints.filter((c): c is string => typeof c === 'string')
    : [];

  const timeLimitSeconds =
    typeof raw.time_limit_seconds === 'number'
      ? raw.time_limit_seconds
      : undefined;

  const timeLimitMs =
    typeof rawConstraintsObj.time_limit_ms === 'number'
      ? rawConstraintsObj.time_limit_ms
      : timeLimitSeconds !== undefined
      ? Math.round(timeLimitSeconds * 1000)
      : 2000;

  const memoryLimitMb =
    typeof rawConstraintsObj.memory_limit_mb === 'number'
      ? rawConstraintsObj.memory_limit_mb
      : typeof raw.memory_limit_mb === 'number'
      ? raw.memory_limit_mb
      : 256;

  const objNotes = Array.isArray(rawConstraintsObj.additional_notes)
    ? rawConstraintsObj.additional_notes.filter(
        (n): n is string => typeof n === 'string'
      )
    : [];

  // Preserve string-list constraints returned by Vasil's GeneratedQuestionSchema,
  // avoiding duplicate time/memory lines already rendered as primary constraint bullets.
  const combinedNotes = [...objNotes, ...rawConstraintsList].filter((note) => {
    const trimmed = note.trim();
    if (!trimmed) return false;
    if (/^(time\s*limit|memory(\s*limit)?)\s*:/i.test(trimmed)) {
      return false;
    }
    return true;
  });

  const rawTestCases = Array.isArray(raw.public_test_cases)
    ? raw.public_test_cases
    : Array.isArray(raw.sample_test_cases)
    ? raw.sample_test_cases
    : Array.isArray(raw.examples)
    ? raw.examples
    : [];

  const publicTestCases: PublicTestCase[] = rawTestCases
    .filter(isRecord)
    .map((tc, tcIndex) => ({
      test_case_id:
        (typeof tc.test_case_id === 'string' && tc.test_case_id) ||
        (typeof tc.id === 'string' && tc.id) ||
        `${questionId}-sample-${tcIndex + 1}`,
      input: typeof tc.input === 'string' ? tc.input : String(tc.input ?? ''),
      expected_output:
        typeof tc.expected_output === 'string'
          ? tc.expected_output
          : typeof tc.output === 'string'
          ? tc.output
          : String(tc.expected_output ?? ''),
      explanation:
        typeof tc.explanation === 'string' ? tc.explanation : undefined,
    }));

  const targetSkill =
    typeof raw.target_skill === 'string' ? raw.target_skill : undefined;
  const domain =
    (typeof raw.domain === 'string' && raw.domain) ||
    (typeof raw.category === 'string' && raw.category) ||
    (typeof raw.topic === 'string' && raw.topic) ||
    targetSkill ||
    'Algorithms & Systems';

  const starterCode: Partial<Record<SupportedLanguage, string>> = {};
  if (isRecord(raw.starter_code)) {
    for (const [langKey, snippet] of Object.entries(raw.starter_code)) {
      const normalizedLang = resolveLanguageAlias(langKey);
      if (normalizedLang && typeof snippet === 'string') {
        starterCode[normalizedLang] = snippet;
      }
    }
  }

  return {
    question_id: questionId,
    title:
      (typeof raw.title === 'string' && raw.title) ||
      `Coding Challenge ${index + 1}`,
    difficulty: normalizeQuestionDifficulty(raw.difficulty),
    domain,
    target_skill: targetSkill,
    description: typeof raw.description === 'string' ? raw.description : '',
    input_format:
      (typeof raw.input_format === 'string' && raw.input_format) ||
      'Read inputs from standard input (stdin) or function parameters as shown in the examples.',
    output_format:
      (typeof raw.output_format === 'string' && raw.output_format) ||
      'Write the exact result to standard output (stdout) matching the expected example output.',
    constraints: {
      min_array_length:
        typeof rawConstraintsObj.min_array_length === 'number'
          ? rawConstraintsObj.min_array_length
          : undefined,
      max_array_length:
        typeof rawConstraintsObj.max_array_length === 'number'
          ? rawConstraintsObj.max_array_length
          : undefined,
      min_value:
        typeof rawConstraintsObj.min_value === 'number'
          ? rawConstraintsObj.min_value
          : undefined,
      max_value:
        typeof rawConstraintsObj.max_value === 'number'
          ? rawConstraintsObj.max_value
          : undefined,
      time_limit_ms: timeLimitMs,
      memory_limit_mb: memoryLimitMb,
      additional_notes:
        combinedNotes.length > 0
          ? Array.from(new Set(combinedNotes))
          : undefined,
    },
    public_test_cases: publicTestCases,
    total_test_cases_count:
      typeof raw.total_test_cases_count === 'number'
        ? raw.total_test_cases_count
        : undefined,
    hidden_test_cases_count:
      typeof raw.hidden_test_cases_count === 'number'
        ? raw.hidden_test_cases_count
        : undefined,
    starter_code:
      Object.keys(starterCode).length > 0 ? starterCode : undefined,
  };
}

const COMPILER_DIAGNOSTIC_PATTERN =
  /\b(SyntaxError:|IndentationError:|javac\b|g\+\+\b|clang\+\+\b|compilation terminated|cannot find symbol|expected ';')\b/i;

export function normalizeCodeRunResponse(
  raw: unknown,
  fallbackQuestionId: string
): CodeRunResponse {
  if (!isRecord(raw)) {
    throw new Error('Malformed execution response returned by server.');
  }

  const compileError =
    (typeof raw.compile_error === 'string' && raw.compile_error.trim()) ||
    (typeof raw.compilation_error === 'string' &&
      raw.compilation_error.trim()) ||
    (typeof raw.compile_output === 'string' && raw.compile_output.trim()) ||
    undefined;

  const topStdout =
    typeof raw.stdout === 'string'
      ? raw.stdout
      : typeof raw.standard_output === 'string'
      ? raw.standard_output
      : undefined;

  const topStderr =
    typeof raw.stderr === 'string'
      ? raw.stderr
      : typeof raw.standard_error === 'string'
      ? raw.standard_error
      : typeof raw.error_message === 'string'
      ? raw.error_message
      : undefined;

  const rawResults = Array.isArray(raw.results)
    ? raw.results
    : Array.isArray(raw.test_results)
    ? raw.test_results
    : [];

  const results: TestCaseRunResult[] = rawResults
    .filter(isRecord)
    .map((tc, idx) => {
      const actualOut =
        typeof tc.actual_output === 'string'
          ? tc.actual_output
          : typeof tc.stdout === 'string'
          ? tc.stdout
          : undefined;
      const errOut =
        (typeof tc.stderr === 'string' && tc.stderr) ||
        (typeof tc.error_message === 'string' && tc.error_message) ||
        undefined;
      const timedOut =
        tc.timed_out === true ||
        String(tc.verdict ?? '').toUpperCase() === 'TLE';

      const passed = Boolean(tc.passed);
      let verdict = normalizeExecutionVerdict(
        tc.verdict ?? tc.status,
        passed ? 'AC' : 'WA'
      );

      if (timedOut) {
        verdict = 'TLE';
      } else if (
        !passed &&
        verdict === 'RTE' &&
        errOut &&
        COMPILER_DIAGNOSTIC_PATTERN.test(errOut)
      ) {
        verdict = 'CE';
      }

      return {
        test_case_id:
          (typeof tc.test_case_id === 'string' && tc.test_case_id) ||
          `tc-${idx + 1}`,
        is_hidden: Boolean(tc.is_hidden),
        passed,
        verdict,
        execution_time_ms:
          typeof tc.execution_time_ms === 'number'
            ? tc.execution_time_ms
            : undefined,
        memory_used_mb:
          typeof tc.memory_used_mb === 'number'
            ? tc.memory_used_mb
            : undefined,
        input: typeof tc.input === 'string' ? tc.input : undefined,
        expected_output:
          typeof tc.expected_output === 'string'
            ? tc.expected_output
            : undefined,
        actual_output: actualOut,
        stdout: actualOut,
        stderr: errOut,
        error_message: errOut,
        timed_out: timedOut,
        weight: typeof tc.weight === 'number' ? tc.weight : undefined,
      };
    });

  const passedCount =
    typeof raw.passed_count === 'number'
      ? raw.passed_count
      : results.filter((r) => r.passed).length;

  const totalCount =
    typeof raw.total_count === 'number' ? raw.total_count : results.length;

  const anyTimedOut =
    raw.timed_out === true || results.some((r) => r.verdict === 'TLE');
  const anyCompileErr =
    Boolean(compileError) || results.some((r) => r.verdict === 'CE');

  let overallVerdict = normalizeExecutionVerdict(
    raw.overall_verdict ?? raw.verdict ?? raw.status,
    passedCount === totalCount && totalCount > 0 ? 'AC' : 'WA'
  );

  if (anyCompileErr) {
    overallVerdict = 'CE';
  } else if (anyTimedOut && overallVerdict !== 'AC') {
    overallVerdict = 'TLE';
  }

  const derivedCompileError =
    compileError ??
    (overallVerdict === 'CE'
      ? topStderr ?? results.find((r) => r.stderr)?.stderr
      : undefined);

  const memoryValues = results
    .map((r) => r.memory_used_mb)
    .filter((m): m is number => typeof m === 'number');

  const peakMemoryMb =
    typeof raw.memory_used_mb === 'number'
      ? raw.memory_used_mb
      : typeof raw.peak_memory_mb === 'number'
      ? raw.peak_memory_mb
      : memoryValues.length > 0
      ? Math.max(...memoryValues)
      : undefined;

  return {
    success: raw.success !== false,
    question_id:
      (typeof raw.question_id === 'string' && raw.question_id) ||
      fallbackQuestionId,
    overall_verdict: overallVerdict,
    passed_count: passedCount,
    total_count: totalCount,
    total_time_ms:
      typeof raw.total_time_ms === 'number'
        ? raw.total_time_ms
        : typeof raw.execution_time_ms === 'number'
        ? raw.execution_time_ms
        : undefined,
    memory_used_mb: peakMemoryMb,
    stdout: topStdout,
    stderr: topStderr,
    compile_error: derivedCompileError,
    timed_out: anyTimedOut,
    results,
  };
}

export function normalizeScoreSummary(
  raw: Record<string, unknown>,
  runResults?: CodeRunResponse
): ScoreSummary {
  const passedTests =
    typeof raw.passed_tests === 'number'
      ? raw.passed_tests
      : typeof raw.passed_count === 'number'
      ? raw.passed_count
      : 0;

  const totalTests =
    typeof raw.total_tests === 'number'
      ? raw.total_tests
      : typeof raw.total_count === 'number'
      ? raw.total_count
      : passedTests;

  const failedTests =
    typeof raw.failed_tests === 'number'
      ? raw.failed_tests
      : Math.max(0, totalTests - passedTests);

  const executionTimeMs =
    typeof raw.execution_time_ms === 'number'
      ? raw.execution_time_ms
      : typeof raw.total_time_ms === 'number'
      ? raw.total_time_ms
      : runResults?.total_time_ms;

  const memoryUsedMb =
    typeof raw.memory_used_mb === 'number'
      ? raw.memory_used_mb
      : typeof raw.peak_memory_mb === 'number'
      ? raw.peak_memory_mb
      : runResults?.memory_used_mb;

  const rawEfficiency = isRecord(raw.efficiency) ? raw.efficiency : null;

  return {
    submission_id:
      (typeof raw.submission_id === 'string' && raw.submission_id) ||
      (typeof raw.id === 'string' && raw.id) ||
      'submission',
    assessment_id:
      typeof raw.assessment_id === 'string' ? raw.assessment_id : undefined,
    question_id:
      typeof raw.question_id === 'string' ? raw.question_id : undefined,
    question_title:
      typeof raw.question_title === 'string' ? raw.question_title : undefined,
    language: resolveLanguageAlias(raw.language) ?? undefined,
    deterministic_score:
      typeof raw.deterministic_score === 'number'
        ? raw.deterministic_score
        : typeof raw.overall_score === 'number'
        ? raw.overall_score
        : 0,
    overall_score:
      typeof raw.overall_score === 'number'
        ? raw.overall_score
        : typeof raw.deterministic_score === 'number'
        ? raw.deterministic_score
        : 0,
    passed_tests: passedTests,
    failed_tests: failedTests,
    total_tests: totalTests,
    execution_time_ms: executionTimeMs,
    memory_used_mb: memoryUsedMb,
    overall_verdict: normalizeExecutionVerdict(
      raw.overall_verdict ?? raw.verdict,
      passedTests === totalTests && totalTests > 0 ? 'AC' : 'WA'
    ),
    submitted_at:
      typeof raw.submitted_at === 'string' ? raw.submitted_at : undefined,
    efficiency: rawEfficiency
      ? {
          detected_time_complexity:
            typeof rawEfficiency.detected_time_complexity === 'string'
              ? rawEfficiency.detected_time_complexity
              : 'N/A',
          detected_space_complexity:
            typeof rawEfficiency.detected_space_complexity === 'string'
              ? rawEfficiency.detected_space_complexity
              : 'N/A',
          optimality_score:
            typeof rawEfficiency.optimality_score === 'number'
              ? rawEfficiency.optimality_score
              : 0,
          cleanliness_score:
            typeof rawEfficiency.cleanliness_score === 'number'
              ? rawEfficiency.cleanliness_score
              : 0,
          feedback:
            typeof rawEfficiency.feedback === 'string'
              ? rawEfficiency.feedback
              : '',
        }
      : null,
  };
}

function extractTopics(
  raw: Record<string, unknown>,
  questions: CodingQuestion[]
): string[] {
  const explicit = Array.isArray(raw.topics)
    ? raw.topics
    : Array.isArray(raw.calibrated_stack)
    ? raw.calibrated_stack
    : [];

  const cleanedExplicit = explicit.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0
  );
  if (cleanedExplicit.length > 0) {
    return Array.from(new Set(cleanedExplicit));
  }

  const derived = new Set<string>();
  for (const q of questions) {
    if (q.domain) derived.add(q.domain);
    if (q.target_skill) derived.add(q.target_skill);
  }
  if (
    derived.size === 0 &&
    typeof raw.target_role === 'string' &&
    raw.target_role.trim()
  ) {
    derived.add(raw.target_role.trim());
  }
  return Array.from(derived);
}

export function normalizeAssessmentSession(
  raw: Record<string, unknown>
): ActiveAssessmentSession {
  const assessmentId =
    (typeof raw.assessment_id === 'string' && raw.assessment_id) ||
    (typeof raw.id === 'string' && raw.id) ||
    'assessment-session';

  const rawQuestions = Array.isArray(raw.questions) ? raw.questions : [];
  const questions = rawQuestions
    .filter(isRecord)
    .map((q, index) => normalizeCodingQuestion(q, index));

  const durationSeconds =
    typeof raw.duration_seconds === 'number' && raw.duration_seconds > 0
      ? raw.duration_seconds
      : typeof raw.total_time_limit_minutes === 'number' &&
        raw.total_time_limit_minutes > 0
      ? raw.total_time_limit_minutes * 60
      : typeof raw.duration_minutes === 'number' && raw.duration_minutes > 0
      ? raw.duration_minutes * 60
      : 3600;

  const remainingSeconds =
    typeof raw.remaining_seconds === 'number' && raw.remaining_seconds >= 0
      ? raw.remaining_seconds
      : undefined;

  const questionAllowedLanguages =
    rawQuestions.length > 0 &&
    isRecord(rawQuestions[0]) &&
    Array.isArray(rawQuestions[0].allowed_languages)
      ? rawQuestions[0].allowed_languages
      : undefined;

  const allowedLanguages = normalizeSupportedLanguages(
    raw.allowed_languages ?? questionAllowedLanguages,
    questions
  );
  const topics = extractTopics(raw, questions);

  return {
    assessment_id: assessmentId,
    title:
      (typeof raw.title === 'string' && raw.title) ||
      'Personalized Technical Assessment',
    duration_seconds: durationSeconds,
    remaining_seconds: remainingSeconds,
    started_at:
      typeof raw.started_at === 'string' ? raw.started_at : undefined,
    allowed_languages: allowedLanguages,
    questions,
    calibrated_stack: Array.isArray(raw.calibrated_stack)
      ? raw.calibrated_stack.filter((s): s is string => typeof s === 'string')
      : topics,
    difficulty: normalizeAssessmentDifficulty(raw.difficulty),
    status: normalizeLifecycleStatus(raw.status),
    target_role:
      typeof raw.target_role === 'string' ? raw.target_role : undefined,
    topics,
  };
}

export function normalizeAssessmentSummary(
  raw: Record<string, unknown>
): AssessmentSummaryItem {
  const rawQuestions = Array.isArray(raw.questions)
    ? raw.questions
        .filter(isRecord)
        .map((q, idx) => normalizeCodingQuestion(q, idx))
    : [];

  const id =
    (typeof raw.id === 'string' && raw.id) ||
    (typeof raw.assessment_id === 'string' && raw.assessment_id) ||
    'assessment-item';

  const durationMinutes =
    typeof raw.duration_minutes === 'number' && raw.duration_minutes > 0
      ? raw.duration_minutes
      : typeof raw.total_time_limit_minutes === 'number' &&
        raw.total_time_limit_minutes > 0
      ? raw.total_time_limit_minutes
      : typeof raw.duration_seconds === 'number' && raw.duration_seconds > 0
      ? Math.max(1, Math.round(raw.duration_seconds / 60))
      : 60;

  const questionCount =
    typeof raw.question_count === 'number' && raw.question_count > 0
      ? raw.question_count
      : rawQuestions.length > 0
      ? rawQuestions.length
      : 3;

  const topics = extractTopics(raw, rawQuestions);

  return {
    id,
    title:
      (typeof raw.title === 'string' && raw.title) ||
      'Personalized Technical Assessment',
    difficulty: normalizeAssessmentDifficulty(raw.difficulty),
    duration_minutes: durationMinutes,
    question_count: questionCount,
    topics,
    target_role:
      typeof raw.target_role === 'string' ? raw.target_role : undefined,
    status: normalizeLifecycleStatus(raw.status),
    allowed_languages: normalizeSupportedLanguages(
      raw.allowed_languages,
      rawQuestions
    ),
    created_at:
      typeof raw.created_at === 'string' ? raw.created_at : undefined,
    completed_at:
      typeof raw.completed_at === 'string' ? raw.completed_at : undefined,
    final_score:
      typeof raw.final_score === 'number' ? raw.final_score : null,
  };
}

export function normalizeAssessmentResult(
  raw: Record<string, unknown>
): AssessmentResultDetail {
  const rawStatus =
    typeof raw.completion_status === 'string'
      ? raw.completion_status
      : typeof raw.status === 'string'
      ? raw.status
      : 'completed';

  const completionStatus: AssessmentCompletionStatus =
    rawStatus === 'completed' ||
    rawStatus === 'partially_completed' ||
    rawStatus === 'expired' ||
    rawStatus === 'in_progress'
      ? rawStatus
      : 'completed';

  const rawQuestions = Array.isArray(raw.question_performance)
    ? raw.question_performance
    : Array.isArray(raw.questions)
    ? raw.questions
    : [];

  const questionPerformance: QuestionPerformanceItem[] = rawQuestions
    .filter(isRecord)
    .map((item, idx) => {
      const passed =
        typeof item.passed_tests === 'number'
          ? item.passed_tests
          : typeof item.passed_count === 'number'
          ? item.passed_count
          : 0;
      const total =
        typeof item.total_tests === 'number'
          ? item.total_tests
          : typeof item.total_count === 'number'
          ? item.total_count
          : passed;
      const failed =
        typeof item.failed_tests === 'number'
          ? item.failed_tests
          : Math.max(0, total - passed);
      const rawVerdictStr =
        typeof item.verdict === 'string'
          ? item.verdict.trim().toUpperCase()
          : 'PENDING';
      const verdict: ExecutionVerdict | 'PENDING' =
        rawVerdictStr === 'PENDING' || rawVerdictStr === 'NOT_SUBMITTED'
          ? 'PENDING'
          : normalizeExecutionVerdict(rawVerdictStr, 'RTE');

      return {
        question_id:
          (typeof item.question_id === 'string' && item.question_id) ||
          (typeof item.id === 'string' && item.id) ||
          `q-${idx + 1}`,
        title:
          (typeof item.title === 'string' && item.title) ||
          `Question ${idx + 1}`,
        difficulty: normalizeQuestionDifficulty(item.difficulty),
        verdict,
        score:
          typeof item.score === 'number'
            ? item.score
            : typeof item.overall_score === 'number'
            ? item.overall_score
            : 0,
        passed_tests: passed,
        failed_tests: failed,
        total_tests: total,
        time_taken_seconds:
          typeof item.time_taken_seconds === 'number'
            ? item.time_taken_seconds
            : undefined,
        execution_time_ms:
          typeof item.execution_time_ms === 'number'
            ? item.execution_time_ms
            : undefined,
        memory_used_mb:
          typeof item.memory_used_mb === 'number'
            ? item.memory_used_mb
            : undefined,
        hints_used: typeof item.hints_used === 'number' ? item.hints_used : 0,
        detected_time_complexity:
          typeof item.detected_time_complexity === 'string'
            ? item.detected_time_complexity
            : undefined,
      };
    });

  const derivedPassed = questionPerformance.reduce(
    (acc, q) => acc + q.passed_tests,
    0
  );
  const derivedFailed = questionPerformance.reduce(
    (acc, q) => acc + q.failed_tests,
    0
  );
  const derivedTotal = questionPerformance.reduce(
    (acc, q) => acc + q.total_tests,
    0
  );
  const derivedHints = questionPerformance.reduce(
    (acc, q) => acc + q.hints_used,
    0
  );

  const execTimes = questionPerformance
    .map((q) => q.execution_time_ms)
    .filter((v): v is number => typeof v === 'number');

  const memValues = questionPerformance
    .map((q) => q.memory_used_mb)
    .filter((v): v is number => typeof v === 'number');

  const correctTestCases =
    typeof raw.correct_test_cases === 'number'
      ? raw.correct_test_cases
      : typeof raw.passed_tests === 'number'
      ? raw.passed_tests
      : derivedPassed;

  const totalTestCases =
    typeof raw.total_test_cases === 'number'
      ? raw.total_test_cases
      : typeof raw.total_tests === 'number'
      ? raw.total_tests
      : Math.max(correctTestCases, derivedTotal);

  const failedTestCases =
    typeof raw.failed_test_cases === 'number'
      ? raw.failed_test_cases
      : Math.max(0, totalTestCases - correctTestCases, derivedFailed);

  const totalExecutionTimeMs =
    typeof raw.total_execution_time_ms === 'number'
      ? raw.total_execution_time_ms
      : typeof raw.execution_time_ms === 'number'
      ? raw.execution_time_ms
      : execTimes.length > 0
      ? execTimes.reduce((a, b) => a + b, 0)
      : undefined;

  const peakMemoryMb =
    typeof raw.peak_memory_mb === 'number'
      ? raw.peak_memory_mb
      : typeof raw.memory_used_mb === 'number'
      ? raw.memory_used_mb
      : memValues.length > 0
      ? Math.max(...memValues)
      : undefined;

  return {
    assessment_id:
      (typeof raw.assessment_id === 'string' && raw.assessment_id) ||
      (typeof raw.id === 'string' && raw.id) ||
      'assessment-result',
    assessment_title:
      (typeof raw.assessment_title === 'string' && raw.assessment_title) ||
      (typeof raw.title === 'string' && raw.title) ||
      'Personalized Technical Assessment',
    completion_status: completionStatus,
    final_score:
      typeof raw.final_score === 'number'
        ? raw.final_score
        : typeof raw.overall_score === 'number'
        ? raw.overall_score
        : 0,
    deterministic_score:
      typeof raw.deterministic_score === 'number'
        ? raw.deterministic_score
        : undefined,
    correct_test_cases: correctTestCases,
    failed_test_cases: failedTestCases,
    total_test_cases: totalTestCases,
    time_taken_seconds:
      typeof raw.time_taken_seconds === 'number'
        ? raw.time_taken_seconds
        : typeof raw.elapsed_seconds === 'number'
        ? raw.elapsed_seconds
        : 0,
    time_limit_seconds:
      typeof raw.time_limit_seconds === 'number'
        ? raw.time_limit_seconds
        : undefined,
    total_execution_time_ms: totalExecutionTimeMs,
    peak_memory_mb: peakMemoryMb,
    total_hints_used:
      typeof raw.total_hints_used === 'number'
        ? raw.total_hints_used
        : derivedHints,
    completed_at:
      typeof raw.completed_at === 'string' ? raw.completed_at : undefined,
    question_performance: questionPerformance,
  };
}

export const assessmentService = {
  /**
   * Lists personalized assessments available to the authenticated candidate.
   * Returns an empty array if no assessments have been generated yet (404).
   */
  async listAvailableAssessments(): Promise<AssessmentSummaryItem[]> {
    try {
      const response = await api.get<unknown>('/api/assessment');
      const payload = response.data;

      if (Array.isArray(payload)) {
        return payload.filter(isRecord).map(normalizeAssessmentSummary);
      }

      if (isRecord(payload)) {
        const list =
          (Array.isArray(payload.assessments) && payload.assessments) ||
          (Array.isArray(payload.items) && payload.items) ||
          (Array.isArray(payload.data) && payload.data) ||
          null;

        if (list) {
          return list.filter(isRecord).map(normalizeAssessmentSummary);
        }

        if (isRecord(payload.assessment)) {
          return [normalizeAssessmentSummary(payload.assessment)];
        }
        if (isRecord(payload.session)) {
          return [normalizeAssessmentSummary(payload.session)];
        }
      }

      return [];
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  },

  /**
   * Generates a personalized assessment calibrated to the candidate's portfolio
   * via Vasil's POST /api/assessment/generate contract.
   */
  async generatePersonalizedAssessment(
    payload: AssessmentGenerateRequest = {}
  ): Promise<ActiveAssessmentSession> {
    const response = await api.post<unknown>('/api/assessment/generate', {
      portfolio_id: payload.portfolio_id,
      target_role: payload.target_role ?? 'Software Engineer',
      difficulty_preference: payload.difficulty_preference ?? 'adaptive',
      question_count: payload.question_count ?? 3,
    });

    const data = response.data;
    const rawAssessment =
      (isRecord(data) && isRecord(data.assessment) && data.assessment) ||
      (isRecord(data) && isRecord(data.session) && data.session) ||
      (isRecord(data) ? data : null);

    if (!rawAssessment) {
      throw new Error('Personalized assessment could not be generated.');
    }

    return normalizeAssessmentSession(rawAssessment);
  },

  /**
   * Retrieves a specific assessment session by ID (GET /api/assessment/{assessment_id}).
   * Returns null on 404.
   */
  async getAssessmentSessionById(
    assessmentId: string
  ): Promise<ActiveAssessmentSession | null> {
    try {
      const response = await api.get<unknown>(
        `/api/assessment/${encodeURIComponent(assessmentId)}`
      );
      const data = response.data;
      const rawAssessment =
        (isRecord(data) && isRecord(data.assessment) && data.assessment) ||
        (isRecord(data) && isRecord(data.session) && data.session) ||
        (isRecord(data) ? data : null);

      return rawAssessment ? normalizeAssessmentSession(rawAssessment) : null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Fetches the active portfolio-calibrated coding assessment session.
   * Returns null if no active assessment session has been generated yet (404).
   */
  async getActiveSession(): Promise<ActiveAssessmentSession | null> {
    try {
      const response = await api.get<unknown>('/api/assessment/active');
      const data = response.data;
      const rawSession =
        (isRecord(data) && isRecord(data.session) && data.session) ||
        (isRecord(data) && isRecord(data.assessment) && data.assessment) ||
        null;

      return rawSession ? normalizeAssessmentSession(rawSession) : null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Starts or initializes an assessment session.
   * Supports POST /api/assessment/{id}/start (falling back to GET /api/assessment/{id}
   * on 404) and POST /api/assessment/start.
   */
  async startAssessment(
    assessmentId?: string
  ): Promise<ActiveAssessmentSession> {
    if (assessmentId) {
      try {
        const response = await api.post<unknown>(
          `/api/assessment/${encodeURIComponent(assessmentId)}/start`
        );
        const data = response.data;
        const rawSession =
          (isRecord(data) && isRecord(data.session) && data.session) ||
          (isRecord(data) && isRecord(data.assessment) && data.assessment) ||
          (isRecord(data) ? data : null);
        if (rawSession) {
          return normalizeAssessmentSession(rawSession);
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          const existing = await this.getAssessmentSessionById(assessmentId);
          if (existing) {
            return existing;
          }
        }
        throw error;
      }
    }

    const response = await api.post<unknown>('/api/assessment/start');
    const data = response.data;
    const rawSession =
      (isRecord(data) && isRecord(data.session) && data.session) ||
      (isRecord(data) && isRecord(data.assessment) && data.assessment) ||
      null;

    if (!rawSession) {
      throw new Error('Assessment session could not be initialized.');
    }
    return normalizeAssessmentSession(rawSession);
  },

  /**
   * Executes candidate code against public test cases in the backend sandbox.
   * Never fabricates fake execution results on error.
   */
  async runPublicTests(payload: RunCodePayload): Promise<CodeRunResponse> {
    const response = await api.post<unknown>('/api/assessment/run', {
      assessment_id: payload.assessmentId,
      question_id: payload.questionId,
      language: payload.language,
      code: payload.code,
    });
    return normalizeCodeRunResponse(response.data, payload.questionId);
  },

  /**
   * Submits candidate code for full deterministic hidden-test grading and AI efficiency analysis.
   * Never fabricates fake submission scores on error.
   */
  async submitSolution(
    payload: SubmitCodePayload
  ): Promise<SubmitSolutionApiResponse> {
    const response = await api.post<unknown>('/api/submissions', {
      assessment_id: payload.assessmentId,
      question_id: payload.questionId,
      language: payload.language,
      code: payload.code,
      elapsed_seconds: payload.elapsedSeconds,
      hints_used: payload.hintsUsed,
    });

    const data = response.data;
    if (!isRecord(data)) {
      throw new Error('Malformed submission grading response returned by server.');
    }

    const normalizedRunResults = isRecord(data.run_results)
      ? normalizeCodeRunResponse(data.run_results, payload.questionId)
      : undefined;

    const rawSummary = isRecord(data.summary) ? data.summary : data;
    const normalizedSummary = normalizeScoreSummary(
      rawSummary,
      normalizedRunResults
    );

    return {
      success: data.success !== false,
      summary: normalizedSummary,
      run_results: normalizedRunResults,
    };
  },

  /**
   * Finalizes an assessment session and retrieves the comprehensive results report.
   */
  async completeAssessment(
    payload: CompleteAssessmentPayload
  ): Promise<AssessmentResultDetail> {
    const response = await api.post<unknown>(
      `/api/assessment/${encodeURIComponent(payload.assessmentId)}/complete`,
      {
        elapsed_seconds: payload.elapsedSeconds,
        total_hints_used: payload.totalHintsUsed,
      }
    );
    const data = response.data;
    const rawResult =
      (isRecord(data) && isRecord(data.results) && data.results) ||
      (isRecord(data) && isRecord(data.result) && data.result) ||
      (isRecord(data) ? data : null);

    if (!rawResult) {
      throw new Error('Assessment completion report could not be loaded.');
    }
    return normalizeAssessmentResult(rawResult);
  },

  /**
   * Retrieves the detailed final results report for a completed assessment.
   * Returns null if no completed assessment report exists yet (404).
   */
  async getAssessmentResults(
    assessmentId?: string
  ): Promise<AssessmentResultDetail | null> {
    try {
      const endpoint = assessmentId
        ? `/api/assessment/${encodeURIComponent(assessmentId)}/results`
        : '/api/assessment/results/latest';
      const response = await api.get<unknown>(endpoint);
      const data = response.data;
      const rawResult =
        (isRecord(data) && isRecord(data.results) && data.results) ||
        (isRecord(data) && isRecord(data.result) && data.result) ||
        (isRecord(data) ? data : null);

      return rawResult ? normalizeAssessmentResult(rawResult) : null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Retrieves the candidate's most recent graded submission summary.
   * Returns null if no graded submissions exist yet (404).
   */
  async getLatestScoreSummary(): Promise<ScoreSummary | null> {
    try {
      const response = await api.get<LatestScoreApiResponse>(
        '/api/submissions/latest'
      );
      if (!response.data?.summary) return null;
      return normalizeScoreSummary(
        response.data.summary as unknown as Record<string, unknown>
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },
};
