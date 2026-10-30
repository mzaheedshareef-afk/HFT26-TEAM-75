import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
} from '../../components/assessment/CodeEditorPanel';
import { AiHintPanel } from '../../components/assessment/AiHintPanel';
import { TestResultsPanel } from '../../components/assessment/TestResultsPanel';
import { ScoreSummaryCard } from '../../components/assessment/ScoreSummaryCard';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Button } from '../../components/ui/Button';
import { assessmentService } from '../../services/assessmentService';
import { extractApiErrorMessage } from '../../services/api';
import type {
  ActiveAssessmentSession,
  AiHintItem,
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
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({});
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

  const [runsByQuestion, setRunsByQuestion] = useState<
    Record<string, CodeRunResponse>
  >({});
  const [submissionsByQuestion, setSubmissionsByQuestion] = useState<
    Record<string, ScoreSummary>
  >({});
  const [hintsByQuestion, setHintsByQuestion] = useState<
    Record<string, AiHintItem[]>
  >({});

  const questions = session?.questions ?? [];
  const activeQuestion = questions[activeQuestionIdx] ?? null;

  const activeCode = useMemo(() => {
    if (!activeQuestion) {
      return DEFAULT_STARTER_CODE[language];
    }
    const key = makeDraftKey(activeQuestion.question_id, language);
    return codeDrafts[key] ?? resolveStarterCode(activeQuestion, language);
  }, [activeQuestion, codeDrafts, language]);

  const activeRunResponse = activeQuestion
    ? runsByQuestion[activeQuestion.question_id] ?? null
    : null;
  const activeScoreSummary = activeQuestion
    ? submissionsByQuestion[activeQuestion.question_id] ?? null
    : null;
  const activeQuestionHints = activeQuestion
    ? hintsByQuestion[activeQuestion.question_id] ?? []
    : [];

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

  const handleCodeChange = (nextCode: string) => {
    if (!activeQuestion) return;
    const key = makeDraftKey(activeQuestion.question_id, language);
    setCodeDrafts((prev) => ({
      ...prev,
      [key]: nextCode,
    }));
  };

  const handleLanguageChange = (nextLang: SupportedLanguage) => {
    setLanguage(nextLang);
  };

  const handleQuestionSwitch = (index: number) => {
    if (index < 0 || index >= questions.length) return;
    setActiveQuestionIdx(index);
    setExecutionError(null);
  };

  const handleResetStarter = () => {
    if (!activeQuestion) return;
    const key = makeDraftKey(activeQuestion.question_id, language);
    setCodeDrafts((prev) => ({
      ...prev,
      [key]: resolveStarterCode(activeQuestion, language),
    }));
  };

  const handleHintReceived = (hint: AiHintItem) => {
    if (!activeQuestion) return;
    const qId = activeQuestion.question_id;
    setHintsByQuestion((prev) => ({
      ...prev,
      [qId]: [...(prev[qId] ?? []), hint],
    }));
  };

  const handleRunPublicTests = async () => {
    if (!activeQuestion || !activeCode.trim()) return;
    setIsRunningTests(true);
    setExecutionError(null);
    try {
      const result = await assessmentService.runPublicTests({
        assessmentId: session?.assessment_id,
        questionId: activeQuestion.question_id,
        language,
        code: activeCode,
      });
      setRunsByQuestion((prev) => ({
        ...prev,
        [activeQuestion.question_id]: result,
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
    if (!activeQuestion || !activeCode.trim()) return;
    setIsSubmitting(true);
    setExecutionError(null);
    try {
      const response = await assessmentService.submitSolution({
        assessmentId: session?.assessment_id,
        questionId: activeQuestion.question_id,
        language,
        code: activeCode,
        elapsedSeconds,
        hintsUsed: activeQuestionHints.length,
      });
      if (response.run_results) {
        const runData = response.run_results;
        setRunsByQuestion((prev) => ({
          ...prev,
          [activeQuestion.question_id]: runData,
        }));
      }
      setSubmissionsByQuestion((prev) => ({
        ...prev,
        [activeQuestion.question_id]: response.summary,
      }));
    } catch (error) {
      setExecutionError(
        extractApiErrorMessage(
          error,
          'Unable to submit solution for grading. Ensure the submissions service is active.'
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Builds a strictly real result summary from actual backend-graded submissions
   * when navigating to the results page if a separate /complete endpoint returns 404.
   */
  const buildVerifiedSessionResult = (): AssessmentResultDetail | null => {
    if (!session || submittedQuestionCount === 0) return null;

    const questionPerformance: QuestionPerformanceItem[] =
      session.questions.map((q) => {
        const sub = submissionsByQuestion[q.question_id];
        const qHints = hintsByQuestion[q.question_id]?.length ?? 0;

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
            hints_used: qHints,
          };
        }

        const failed = Math.max(0, sub.total_tests - sub.passed_tests);
        return {
          question_id: q.question_id,
          title: q.title,
          difficulty: q.difficulty,
          verdict: sub.overall_verdict,
          score: sub.overall_score,
          passed_tests: sub.passed_tests,
          failed_tests: failed,
          total_tests: sub.total_tests,
          hints_used: qHints,
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
      correct_test_cases: totalCorrect,
      failed_test_cases: totalFailed,
      total_test_cases: totalCases,
      time_taken_seconds: elapsedSeconds,
      time_limit_seconds: session.duration_seconds,
      total_hints_used: totalSessionHintsUsed,
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

  const actionsDisabled =
    !activeQuestion ||
    isTimeExpired ||
    isRunningTests ||
    isSubmitting ||
    !activeCode.trim();

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
                disabled={actionsDisabled}
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
                disabled={actionsDisabled}
                isLoading={isSubmitting}
                loadingText="Submitting..."
                onClick={() => void handleSubmitSolution()}
                leftIcon={<Send className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Submit Answer
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
              />

              <AiHintPanel
                assessmentId={session?.assessment_id}
                questionId={activeQuestion?.question_id ?? null}
                questionTitle={activeQuestion?.title}
                language={language}
                currentCode={activeCode}
                hintsForQuestion={activeQuestionHints}
                totalSessionHintsUsed={totalSessionHintsUsed}
                disabled={isTimeExpired}
                onHintReceived={handleHintReceived}
              />
            </div>

            {/* Right Column: Monaco Editor + Test Runner + Score Summary */}
            <div className="lg:col-span-7 space-y-5">
              <div className="h-[440px]">
                <CodeEditorPanel
                  language={language}
                  allowedLanguages={session?.allowed_languages}
                  code={activeCode}
                  readOnly={isTimeExpired}
                  onLanguageChange={handleLanguageChange}
                  onCodeChange={handleCodeChange}
                  onResetStarterCode={handleResetStarter}
                />
              </div>

              <TestResultsPanel
                runResponse={activeRunResponse}
                isRunning={isRunningTests || isSubmitting}
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
