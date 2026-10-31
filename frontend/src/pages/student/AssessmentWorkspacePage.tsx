import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Loader2,
  Play,
  RefreshCw,
  Send,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { AssessmentTimer } from '../../components/assessment/AssessmentTimer';
import { CodingQuestionPanel } from '../../components/assessment/CodingQuestionPanel';
import {
  CodeEditorPanel,
  DEFAULT_STARTER_CODE,
  LANGUAGE_LABELS,
} from '../../components/assessment/CodeEditorPanel';
import { AiHintPanel } from '../../components/assessment/AiHintPanel';
import {
  TestResultsPanel,
  VerdictBadge,
} from '../../components/assessment/TestResultsPanel';
import { ScoreSummaryCard } from '../../components/assessment/ScoreSummaryCard';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Button } from '../../components/ui/Button';
import { assessmentService } from '../../services/assessmentService';
import {
  assistantService,
  MAX_HINTS_PER_QUESTION,
} from '../../services/assistantService';
import { extractApiErrorMessage } from '../../services/api';
import type {
  ActiveAssessmentSession,
  AiHintItem,
  AiHintLevel,
  AssessmentResultDetail,
  CodeRunResponse,
  CodingQuestion,
  QuestionPerformanceItem,
  ScoreSummary,
  SupportedLanguage,
} from '../../types/assessment';

interface WorkspaceLocationState {
  session?: ActiveAssessmentSession;
}

function makeDraftKey(questionId: string, language: SupportedLanguage): string {
  return `${questionId}::${language}`;
}

function makeSubmissionSnapshot(
  language: SupportedLanguage,
  code: string
): string {
  return `${language}::${code}`;
}

function getDraftStorageKey(assessmentId: string): string {
  return `gatecode_coding_drafts_${assessmentId}`;
}

function readPersistedDrafts(assessmentId?: string): Record<string, string> {
  if (!assessmentId) return {};
  try {
    const raw = sessionStorage.getItem(getDraftStorageKey(assessmentId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      const clean: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') {
          clean[key] = value;
        }
      }
      return clean;
    }
  } catch {
    // Ignore storage read errors in restricted browser contexts
  }
  return {};
}

function writePersistedDrafts(
  assessmentId: string | undefined,
  drafts: Record<string, string>
): void {
  if (!assessmentId) return;
  try {
    sessionStorage.setItem(
      getDraftStorageKey(assessmentId),
      JSON.stringify(drafts)
    );
  } catch {
    // Ignore storage quota errors
  }
}

function resolveStarterCode(
  question: CodingQuestion | null,
  language: SupportedLanguage
): string {
  return question?.starter_code?.[language] ?? DEFAULT_STARTER_CODE[language];
}

export function AssessmentWorkspacePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { assessmentId } = useParams<{ assessmentId?: string }>();

  const initialSession =
    (location.state as WorkspaceLocationState | null)?.session ?? null;

  const [session, setSession] = useState<ActiveAssessmentSession | null>(
    initialSession
  );
  const [isLoadingSession, setIsLoadingSession] = useState(!initialSession);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [language, setLanguage] = useState<SupportedLanguage>(
    initialSession?.allowed_languages?.[0] ?? 'python'
  );
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>(() =>
    readPersistedDrafts(initialSession?.assessment_id ?? assessmentId)
  );
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    initialSession?.remaining_seconds ??
      initialSession?.duration_seconds ??
      3600
  );
  const [isTimeExpired, setIsTimeExpired] = useState(false);

  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Synchronous mutex preventing rapid double-click duplicate POSTs before React re-renders
  const submittingLockRef = useRef(false);
  const hintPanelRef = useRef<HTMLElement | null>(null);

  const [runsByQuestion, setRunsByQuestion] = useState<
    Record<string, CodeRunResponse>
  >({});
  const [submissionsByQuestion, setSubmissionsByQuestion] = useState<
    Record<string, ScoreSummary>
  >({});
  const [submittedSnapshotsByQuestion, setSubmittedSnapshotsByQuestion] =
    useState<Record<string, string>>({});
  const [hintsByQuestion, setHintsByQuestion] = useState<
    Record<string, AiHintItem[]>
  >({});

  const isAiAssistantDisabled = useMemo(() => {
    const diff = (session?.difficulty || '').toLowerCase();
    return diff === 'easy' || diff === 'novice';
  }, [session?.difficulty]);

  const questions = session?.questions ?? [];
  const activeQuestion = questions[activeQuestionIdx] ?? null;

  const activeStarterCode = useMemo(
    () => resolveStarterCode(activeQuestion, language),
    [activeQuestion, language]
  );

  const activeCode = useMemo(() => {
    if (!activeQuestion) {
      return DEFAULT_STARTER_CODE[language];
    }
    const key = makeDraftKey(activeQuestion.question_id, language);
    return codeDrafts[key] ?? activeStarterCode;
  }, [activeQuestion, activeStarterCode, codeDrafts, language]);

  const hasBackendStarter = Boolean(activeQuestion?.starter_code?.[language]);
  const isModifiedFromStarter = activeCode !== activeStarterCode;

  const activeRunResponse = activeQuestion
    ? runsByQuestion[activeQuestion.question_id] ?? null
    : null;
  const activeScoreSummary = activeQuestion
    ? submissionsByQuestion[activeQuestion.question_id] ?? null
    : null;
  const activeQuestionHints = activeQuestion
    ? hintsByQuestion[activeQuestion.question_id] ?? []
    : [];

  const sessionHintHistory = useMemo(() => {
    const titleById = new Map<string, string>();
    for (const q of questions) {
      titleById.set(q.question_id, q.title);
    }
    const allHints = Object.values(hintsByQuestion)
      .flat()
      .map((hint) => ({
        ...hint,
        question_title:
          hint.question_title ?? titleById.get(hint.question_id),
      }));

    return allHints.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [hintsByQuestion, questions]);

  const currentSnapshot = makeSubmissionSnapshot(language, activeCode);
  const isDuplicateSubmission = Boolean(
    activeQuestion &&
      submittedSnapshotsByQuestion[activeQuestion.question_id] ===
        currentSnapshot
  );

  const totalSessionHintsUsed = useMemo(
    () =>
      Object.values(hintsByQuestion).reduce(
        (sum, list) => sum + list.length,
        0
      ),
    [hintsByQuestion]
  );

  const submittedQuestionCount = Object.keys(submissionsByQuestion).length;
  const allQuestionsSubmitted =
    questions.length > 0 && submittedQuestionCount >= questions.length;

  const totalDurationSeconds = session?.duration_seconds ?? 3600;
  const elapsedSeconds = Math.max(0, totalDurationSeconds - remainingSeconds);

  const fetchSession = useCallback(async () => {
    setIsLoadingSession(true);
    setSessionNotice(null);
    try {
      const fetched = assessmentId
        ? await assessmentService.getAssessmentSessionById(assessmentId)
        : await assessmentService.getActiveSession();
      setSession(fetched);
      if (fetched) {
        const persisted = readPersistedDrafts(fetched.assessment_id);
        if (Object.keys(persisted).length > 0) {
          setCodeDrafts((prev) => ({ ...persisted, ...prev }));
        }
        const defaultLang = fetched.allowed_languages?.[0] ?? 'python';
        setLanguage(defaultLang);
        setActiveQuestionIdx(0);
        setRemainingSeconds(
          fetched.remaining_seconds ?? fetched.duration_seconds ?? 3600
        );
      }
    } catch (error) {
      setSessionNotice(
        extractApiErrorMessage(
          error,
          'Assessment session service is currently unreachable.'
        )
      );
    } finally {
      setIsLoadingSession(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    if (
      !initialSession ||
      (assessmentId && initialSession.assessment_id !== assessmentId)
    ) {
      void fetchSession();
    }
  }, [assessmentId, initialSession, fetchSession]);

  // Hydrate previously requested AI hints for the loaded assessment session
  useEffect(() => {
    const loadedAssessmentId = session?.assessment_id;
    if (!loadedAssessmentId || isLoadingSession || isAiAssistantDisabled) return;

    const abortController = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const history = await assistantService.getHintHistory({
          assessmentId: loadedAssessmentId,
          signal: abortController.signal,
        });
        if (cancelled || history.length === 0) return;

        setHintsByQuestion((prev) => {
          const next = { ...prev };
          for (const hint of history) {
            const existing = next[hint.question_id] ?? [];
            const alreadyPresent = existing.some(
              (item) =>
                item.hint_id === hint.hint_id || item.level === hint.level
            );
            if (!alreadyPresent) {
              next[hint.question_id] = [...existing, hint].sort(
                (a, b) => a.level - b.level
              );
            }
          }
          return next;
        });
      } catch {
        // Optional hint history hydration fails silently if assistant history route is offline
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [session?.assessment_id, isLoadingSession]);

  const effectiveAssessmentId = session?.assessment_id ?? assessmentId;

  const handleOpenAiHints = () => {
    if (hintPanelRef.current) {
      if (typeof hintPanelRef.current.scrollIntoView === 'function') {
        hintPanelRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
      hintPanelRef.current.focus();
    }
  };

  const handleCodeChange = (nextCode: string) => {
    if (!activeQuestion) return;
    const key = makeDraftKey(activeQuestion.question_id, language);
    setCodeDrafts((prev) => {
      const updated = {
        ...prev,
        [key]: nextCode,
      };
      writePersistedDrafts(effectiveAssessmentId, updated);
      return updated;
    });
  };

  const handleLanguageChange = (nextLang: SupportedLanguage) => {
    setLanguage(nextLang);
    setExecutionError(null);
    setSubmissionError(null);
  };

  const handleQuestionSwitch = (index: number) => {
    if (index < 0 || index >= questions.length) return;
    setActiveQuestionIdx(index);
    setExecutionError(null);
    setSubmissionError(null);
  };

  const handleResetStarter = () => {
    if (!activeQuestion) return;
    const key = makeDraftKey(activeQuestion.question_id, language);
    const starter = resolveStarterCode(activeQuestion, language);
    setCodeDrafts((prev) => {
      const updated = {
        ...prev,
        [key]: starter,
      };
      writePersistedDrafts(effectiveAssessmentId, updated);
      return updated;
    });
  };

  const handleHintReceived = (hint: AiHintItem) => {
    if (!activeQuestion) return;
    const qId = activeQuestion.question_id;
    const enrichedHint: AiHintItem = {
      ...hint,
      question_title: hint.question_title ?? activeQuestion.title,
    };
    setHintsByQuestion((prev) => ({
      ...prev,
      [qId]: [...(prev[qId] ?? []), enrichedHint],
    }));
  };

  const handleRunPublicTests = async () => {
    if (
      !activeQuestion ||
      !activeCode.trim() ||
      isTimeExpired ||
      isRunningTests ||
      isSubmitting
    ) {
      return;
    }

    const targetQuestionId = activeQuestion.question_id;
    setIsRunningTests(true);
    setExecutionError(null);

    try {
      const result = await assessmentService.runPublicTests({
        assessmentId: session?.assessment_id,
        questionId: targetQuestionId,
        language,
        code: activeCode,
      });
      setRunsByQuestion((prev) => ({
        ...prev,
        [targetQuestionId]: result,
      }));
    } catch (error) {
      setExecutionError(
        extractApiErrorMessage(
          error,
          'Unable to execute public tests. Ensure the sandbox execution endpoint is running.'
        )
      );
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleSubmitSolution = async () => {
    if (
      submittingLockRef.current ||
      !activeQuestion ||
      !activeCode.trim() ||
      isTimeExpired ||
      isRunningTests ||
      isSubmitting ||
      isDuplicateSubmission
    ) {
      return;
    }

    const targetQuestionId = activeQuestion.question_id;
    const snapshotBeingSubmitted = makeSubmissionSnapshot(language, activeCode);

    submittingLockRef.current = true;
    setIsSubmitting(true);
    setSubmissionError(null);
    setExecutionError(null);

    try {
      const response = await assessmentService.submitSolution({
        assessmentId: session?.assessment_id,
        questionId: targetQuestionId,
        language,
        code: activeCode,
        elapsedSeconds,
        hintsUsed: activeQuestionHints.length,
      });

      if (response.run_results) {
        const runData = response.run_results;
        setRunsByQuestion((prev) => ({
          ...prev,
          [targetQuestionId]: runData,
        }));
      }

      setSubmissionsByQuestion((prev) => ({
        ...prev,
        [targetQuestionId]: response.summary,
      }));

      setSubmittedSnapshotsByQuestion((prev) => ({
        ...prev,
        [targetQuestionId]: snapshotBeingSubmitted,
      }));
    } catch (error) {
      setSubmissionError(
        extractApiErrorMessage(
          error,
          'Unable to submit solution for grading. Check your network connection and verify the submissions service is active.'
        )
      );
    } finally {
      submittingLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  /**
   * Builds a strictly real result summary from actual backend-graded submissions
   * when navigating to the results page if a separate /complete endpoint returns 404.
   * Never fabricates execution times, memory metrics, or AI efficiency scores.
   */
  const buildVerifiedSessionResult = (): AssessmentResultDetail | null => {
    if (!session || submittedQuestionCount === 0) return null;

    const allLevelsSet = new Set<AiHintLevel>();

    const questionPerformance: QuestionPerformanceItem[] =
      session.questions.map((q) => {
        const sub = submissionsByQuestion[q.question_id];
        const run = runsByQuestion[q.question_id];
        const qHintList = hintsByQuestion[q.question_id] ?? [];
        const qLevels = Array.from(
          new Set(qHintList.map((h) => h.level))
        ).sort((a, b) => a - b) as AiHintLevel[];

        for (const lvl of qLevels) {
          allLevelsSet.add(lvl);
        }

        if (!sub) {
          const publicTotal = q.public_test_cases.length;
          return {
            question_id: q.question_id,
            title: q.title,
            difficulty: q.difficulty,
            verdict: 'PENDING',
            score: 0,
            passed_tests: 0,
            failed_tests: publicTotal,
            total_tests: publicTotal,
            hints_used: qHintList.length,
            hint_levels_used: qLevels.length > 0 ? qLevels : undefined,
          };
        }

        const failed =
          sub.failed_tests ?? Math.max(0, sub.total_tests - sub.passed_tests);

        return {
          question_id: q.question_id,
          title: q.title,
          difficulty: q.difficulty,
          verdict: sub.overall_verdict,
          score: sub.overall_score,
          passed_tests: sub.passed_tests,
          failed_tests: failed,
          total_tests: sub.total_tests,
          execution_time_ms: sub.execution_time_ms ?? run?.total_time_ms,
          memory_used_mb: sub.memory_used_mb ?? run?.memory_used_mb,
          hints_used: qHintList.length,
          hint_levels_used: qLevels.length > 0 ? qLevels : undefined,
          detected_time_complexity: sub.efficiency?.detected_time_complexity,
        };
      });

    const totalCorrect = questionPerformance.reduce(
      (sum, item) => sum + item.passed_tests,
      0
    );
    const totalFailed = questionPerformance.reduce(
      (sum, item) => sum + item.failed_tests,
      0
    );
    const totalCases = questionPerformance.reduce(
      (sum, item) => sum + item.total_tests,
      0
    );
    const avgScore =
      questionPerformance.reduce((sum, item) => sum + item.score, 0) /
      Math.max(1, session.questions.length);

    const submittedList = Object.values(submissionsByQuestion);
    const avgDeterministic =
      submittedList.reduce((sum, item) => sum + item.deterministic_score, 0) /
      Math.max(1, session.questions.length);

    // Only pass through backend AI efficiency score if explicitly returned on submission summaries
    const backendEfficiencyValues = submittedList
      .map((item) => item.ai_efficiency_score)
      .filter((val): val is number => typeof val === 'number');
    const passthroughBackendEfficiency =
      backendEfficiencyValues.length === 1
        ? backendEfficiencyValues[0]
        : null;

    const execTimes = questionPerformance
      .map((item) => item.execution_time_ms)
      .filter((ms): ms is number => typeof ms === 'number');
    const memUsages = questionPerformance
      .map((item) => item.memory_used_mb)
      .filter((mb): mb is number => typeof mb === 'number');

    const sortedAllLevels = Array.from(allLevelsSet).sort(
      (a, b) => a - b
    ) as AiHintLevel[];

    return {
      assessment_id: session.assessment_id,
      assessment_title: session.title,
      completion_status: isTimeExpired
        ? 'expired'
        : allQuestionsSubmitted
        ? 'completed'
        : 'partially_completed',
      final_score: avgScore,
      deterministic_score: avgDeterministic,
      coding_score: avgDeterministic,
      ai_efficiency_score: passthroughBackendEfficiency,
      correct_test_cases: totalCorrect,
      failed_test_cases: totalFailed,
      total_test_cases: totalCases,
      time_taken_seconds: elapsedSeconds,
      time_limit_seconds: session.duration_seconds,
      total_execution_time_ms:
        execTimes.length > 0
          ? execTimes.reduce((acc, ms) => acc + ms, 0)
          : undefined,
      peak_memory_mb:
        memUsages.length > 0 ? Math.max(...memUsages) : undefined,
      total_hints_used: totalSessionHintsUsed,
      hint_levels_used:
        sortedAllLevels.length > 0 ? sortedAllLevels : undefined,
      hints_viewed: totalSessionHintsUsed > 0,
      completed_at: new Date().toISOString(),
      question_performance: questionPerformance,
    };
  };

  const handleFinishAndViewResults = async () => {
    const targetId = session?.assessment_id ?? assessmentId;
    const resultsPath = targetId
      ? `/student/assessment/${encodeURIComponent(targetId)}/results`
      : '/student/assessment/results';

    if (!targetId) {
      navigate(resultsPath);
      return;
    }

    setIsFinishing(true);
    try {
      const apiResult = await assessmentService.completeAssessment({
        assessmentId: targetId,
        elapsedSeconds,
        totalHintsUsed: totalSessionHintsUsed,
      });
      navigate(resultsPath, { state: { result: apiResult } });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        const verifiedResult = buildVerifiedSessionResult();
        navigate(resultsPath, {
          state: verifiedResult ? { result: verifiedResult } : undefined,
        });
        return;
      }

      const verifiedResult = buildVerifiedSessionResult();
      if (verifiedResult) {
        navigate(resultsPath, { state: { result: verifiedResult } });
      } else {
        navigate(resultsPath);
      }
    } finally {
      setIsFinishing(false);
    }
  };

  const runDisabled =
    !activeQuestion ||
    isTimeExpired ||
    isRunningTests ||
    isSubmitting ||
    !activeCode.trim();

  const submitDisabled = runDisabled || isDuplicateSubmission;

  const instructionsPath =
    session?.assessment_id || assessmentId
      ? `/student/assessment/${encodeURIComponent(
          session?.assessment_id ?? assessmentId ?? ''
        )}/instructions`
      : '/student/assessment/instructions';

  return (
    <DashboardShell role="student" fullBleed>
      <div className="flex flex-1 flex-col">
        {/* Workspace Control Bar */}
        <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={instructionsPath}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Instructions</span>
              </Link>

              <span className="text-slate-300" aria-hidden="true">
                |
              </span>

              <h1 className="text-sm font-semibold text-slate-900">
                {session?.title || 'Adaptive Assessment Workspace'}
              </h1>

              {questions.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Previous question"
                    disabled={activeQuestionIdx === 0}
                    onClick={() => handleQuestionSwitch(activeQuestionIdx - 1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>

                  <div
                    role="tablist"
                    aria-label="Assessment questions"
                    className="flex items-center gap-1 rounded-lg bg-slate-100 p-1"
                  >
                    {questions.map((q, idx) => {
                      const isSubmitted = Boolean(
                        submissionsByQuestion[q.question_id]
                      );
                      const isActive = idx === activeQuestionIdx;

                      return (
                        <button
                          key={q.question_id}
                          role="tab"
                          type="button"
                          aria-selected={isActive}
                          onClick={() => handleQuestionSwitch(idx)}
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                            isActive
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span>Q{idx + 1}</span>
                          {isSubmitted && (
                            <CheckCircle2
                              className="h-3 w-3 text-emerald-600"
                              aria-label="Submitted"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    aria-label="Next question"
                    disabled={activeQuestionIdx >= questions.length - 1}
                    onClick={() => handleQuestionSwitch(activeQuestionIdx + 1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/70 px-2.5 py-1.5 text-xs font-semibold text-blue-800">
                <Code2 className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                <span>Selected: {LANGUAGE_LABELS[language]}</span>
              </span>

              <AssessmentTimer
                initialSeconds={
                  session?.remaining_seconds ??
                  session?.duration_seconds ??
                  3600
                }
                isRunning={Boolean(
                  session && activeQuestion && !allQuestionsSubmitted
                )}
                onTick={(nextRemaining) => setRemainingSeconds(nextRemaining)}
                onExpire={() => setIsTimeExpired(true)}
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void fetchSession()}
                disabled={isLoadingSession}
                leftIcon={
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${
                      isLoadingSession ? 'animate-spin' : ''
                    }`}
                  />
                }
              >
                Sync Session
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={runDisabled}
                isLoading={isRunningTests}
                loadingText="Running..."
                onClick={() => void handleRunPublicTests()}
                leftIcon={<Play className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Run Code
              </Button>

              <Button
                type="button"
                variant="accent"
                size="sm"
                disabled={submitDisabled}
                isLoading={isSubmitting}
                loadingText="Submitting..."
                title={
                  isDuplicateSubmission
                    ? 'This exact solution has already been submitted. Modify code or switch language to resubmit.'
                    : 'Submit final solution for deterministic grading'
                }
                onClick={() => void handleSubmitSolution()}
                leftIcon={
                  isDuplicateSubmission ? (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  )
                }
              >
                {isDuplicateSubmission
                  ? 'Solution Submitted'
                  : 'Submit Solution'}
              </Button>

              {(submittedQuestionCount > 0 || isTimeExpired) && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={isFinishing}
                  loadingText="Loading Results..."
                  onClick={() => void handleFinishAndViewResults()}
                  leftIcon={
                    <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                  }
                >
                  View Results
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Workspace Content */}
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 lg:px-8 space-y-4">
          {sessionNotice && (
            <AlertBanner
              variant="info"
              title="Assessment Service Notice"
              message={sessionNotice}
              onDismiss={() => setSessionNotice(null)}
            />
          )}

          {isTimeExpired && (
            <AlertBanner
              variant="error"
              title="Assessment Time Expired"
              message="The allotted time for this assessment session has ended. Further code execution is locked."
            />
          )}

          <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
            {/* Left Column: Coding Problem Specification + AI Hints */}
            <div className="lg:col-span-5 space-y-5">
              <CodingQuestionPanel
                question={activeQuestion}
                questionIndex={activeQuestionIdx}
                totalQuestions={questions.length}
                hintsUsedForQuestion={activeQuestionHints.length}
                maxHintsPerQuestion={MAX_HINTS_PER_QUESTION}
                onOpenAiHints={isAiAssistantDisabled ? undefined : handleOpenAiHints}
              />

              {!isAiAssistantDisabled ? (
                <AiHintPanel
                  panelRef={hintPanelRef}
                  assessmentId={session?.assessment_id}
                  questionId={activeQuestion?.question_id ?? null}
                  questionTitle={activeQuestion?.title}
                  language={language}
                  currentCode={activeCode}
                  hintsForQuestion={activeQuestionHints}
                  sessionHintHistory={sessionHintHistory}
                  totalSessionHintsUsed={totalSessionHintsUsed}
                  disabled={isTimeExpired}
                  onHintReceived={handleHintReceived}
                />
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 text-sm text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200 mb-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                    AI Assistant Disabled
                  </div>
                  AI assistance is strictly disabled for Novice/Easy tier assessments to evaluate independent core coding competency.
                </div>
              )}
            </div>

            {/* Right Column: Monaco Editor + Submission Status + Test Runner + Score Summary */}
            <div className="lg:col-span-7 space-y-5">
              <div className="h-[450px]">
                <CodeEditorPanel
                  language={language}
                  allowedLanguages={session?.allowed_languages}
                  code={activeCode}
                  hasBackendStarter={hasBackendStarter}
                  isModifiedFromStarter={isModifiedFromStarter}
                  readOnly={isTimeExpired}
                  onLanguageChange={handleLanguageChange}
                  onCodeChange={handleCodeChange}
                  onResetStarterCode={handleResetStarter}
                />
              </div>

              {/* Submission Status & Network Error Feedback */}
              {submissionError && (
                <AlertBanner
                  variant="error"
                  title="Submission Failed"
                  message={submissionError}
                  onDismiss={() => setSubmissionError(null)}
                />
              )}

              {isSubmitting && (
                <div
                  role="status"
                  className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs font-medium text-blue-900"
                >
                  <Loader2
                    className="h-4 w-4 animate-spin text-blue-600"
                    aria-hidden="true"
                  />
                  <span>
                    Submission Status: Grading final solution against deterministic test suites...
                  </span>
                </div>
              )}

              {!isSubmitting && activeScoreSummary && (
                <div
                  role="status"
                  className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2 text-emerald-950">
                    <CheckCircle2
                      className="h-4 w-4 shrink-0 text-emerald-600"
                      aria-hidden="true"
                    />
                    <span className="font-semibold">
                      Submission Status: Graded (
                      {Math.round(activeScoreSummary.overall_score)} / 100)
                    </span>
                    <span className="text-emerald-800">
                      &middot;{' '}
                      {isDuplicateSubmission
                        ? 'Current snapshot submitted (edit code to resubmit)'
                        : 'Draft modified since last submission'}
                    </span>
                  </div>
                  <VerdictBadge verdict={activeScoreSummary.overall_verdict} />
                </div>
              )}

              <TestResultsPanel
                runResponse={activeRunResponse}
                isRunning={isRunningTests || isSubmitting}
                runningLabel={
                  isSubmitting
                    ? 'Submitting and grading final solution against test suites...'
                    : 'Executing code against public test cases in isolated sandbox...'
                }
                errorMessage={executionError}
              />

              {activeScoreSummary && (
                <ScoreSummaryCard summary={activeScoreSummary} />
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
