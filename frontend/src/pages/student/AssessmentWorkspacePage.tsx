import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Play, RefreshCw, Send } from 'lucide-react';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { AssessmentTimer } from '../../components/assessment/AssessmentTimer';
import { CodingQuestionPanel } from '../../components/assessment/CodingQuestionPanel';
import {
  CodeEditorPanel,
  DEFAULT_STARTER_CODE,
} from '../../components/assessment/CodeEditorPanel';
import { TestResultsPanel } from '../../components/assessment/TestResultsPanel';
import { ScoreSummaryCard } from '../../components/assessment/ScoreSummaryCard';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Button } from '../../components/ui/Button';
import { assessmentService } from '../../services/assessmentService';
import { extractApiErrorMessage } from '../../services/api';
import type {
  ActiveAssessmentSession,
  CodeRunResponse,
  ScoreSummary,
  SupportedLanguage,
} from '../../types/assessment';

interface WorkspaceLocationState {
  session?: ActiveAssessmentSession;
}

export function AssessmentWorkspacePage() {
  const location = useLocation();
  const initialSession =
    (location.state as WorkspaceLocationState | null)?.session ?? null;

  const [session, setSession] = useState<ActiveAssessmentSession | null>(
    initialSession
  );
  const [isLoadingSession, setIsLoadingSession] = useState(!initialSession);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [language, setLanguage] = useState<SupportedLanguage>('python');
  const [code, setCode] = useState<string>(DEFAULT_STARTER_CODE.python);
  const [isTimeExpired, setIsTimeExpired] = useState(false);

  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runResponse, setRunResponse] = useState<CodeRunResponse | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary | null>(null);

  const activeQuestion = session?.questions?.[activeQuestionIdx] ?? null;

  const syncStarterForQuestion = useCallback(
    (
      nextSession: ActiveAssessmentSession | null,
      qIdx: number,
      lang: SupportedLanguage
    ) => {
      const q = nextSession?.questions?.[qIdx];
      const customStarter = q?.starter_code?.[lang];
      setCode(customStarter ?? DEFAULT_STARTER_CODE[lang]);
    },
    []
  );

  const fetchActiveSession = useCallback(async () => {
    setIsLoadingSession(true);
    setSessionNotice(null);
    try {
      const fetched = await assessmentService.getActiveSession();
      setSession(fetched);
      if (fetched) {
        const defaultLang = fetched.allowed_languages?.[0] ?? 'python';
        setLanguage(defaultLang);
        syncStarterForQuestion(fetched, 0, defaultLang);
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
  }, [syncStarterForQuestion]);

  useEffect(() => {
    if (!initialSession) {
      void fetchActiveSession();
    } else {
      const defaultLang = initialSession.allowed_languages?.[0] ?? 'python';
      setLanguage(defaultLang);
      syncStarterForQuestion(initialSession, 0, defaultLang);
    }
  }, [initialSession, fetchActiveSession, syncStarterForQuestion]);

  const handleLanguageChange = (nextLang: SupportedLanguage) => {
    setLanguage(nextLang);
    syncStarterForQuestion(session, activeQuestionIdx, nextLang);
  };

  const handleQuestionSwitch = (index: number) => {
    setActiveQuestionIdx(index);
    setRunResponse(null);
    setExecutionError(null);
    syncStarterForQuestion(session, index, language);
  };

  const handleResetStarter = () => {
    syncStarterForQuestion(session, activeQuestionIdx, language);
  };

  const handleRunPublicTests = async () => {
    if (!activeQuestion || !code.trim()) return;
    setIsRunningTests(true);
    setExecutionError(null);
    try {
      const result = await assessmentService.runPublicTests({
        assessmentId: session?.assessment_id,
        questionId: activeQuestion.question_id,
        language,
        code,
      });
      setRunResponse(result);
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
    if (!activeQuestion || !code.trim()) return;
    setIsSubmitting(true);
    setExecutionError(null);
    try {
      const response = await assessmentService.submitSolution({
        assessmentId: session?.assessment_id,
        questionId: activeQuestion.question_id,
        language,
        code,
      });
      if (response.run_results) {
        setRunResponse(response.run_results);
      }
      setScoreSummary(response.summary);
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

  const actionsDisabled =
    !activeQuestion ||
    isTimeExpired ||
    isRunningTests ||
    isSubmitting ||
    !code.trim();

  return (
    <DashboardShell role="student" fullBleed>
      <div className="flex flex-1 flex-col">
        {/* Workspace Control Bar */}
        <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/student/assessment/instructions"
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

              {session && session.questions.length > 1 && (
                <div
                  role="tablist"
                  aria-label="Assessment questions"
                  className="flex items-center gap-1 rounded-lg bg-slate-100 p-1"
                >
                  {session.questions.map((q, idx) => (
                    <button
                      key={q.question_id}
                      role="tab"
                      type="button"
                      aria-selected={idx === activeQuestionIdx}
                      onClick={() => handleQuestionSwitch(idx)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                        idx === activeQuestionIdx
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Q{idx + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <AssessmentTimer
                initialSeconds={
                  session?.remaining_seconds ??
                  session?.duration_seconds ??
                  2700
                }
                isRunning={Boolean(session && activeQuestion && !scoreSummary)}
                onExpire={() => setIsTimeExpired(true)}
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void fetchActiveSession()}
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
                Run Public Tests
              </Button>

              <Button
                type="button"
                variant="accent"
                size="sm"
                disabled={actionsDisabled}
                isLoading={isSubmitting}
                loadingText="Grading..."
                onClick={() => void handleSubmitSolution()}
                leftIcon={<Send className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Submit Solution
              </Button>
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
            {/* Left Column: Coding Problem Specification */}
            <div className="lg:col-span-5 lg:sticky lg:top-20">
              <CodingQuestionPanel
                question={activeQuestion}
                questionIndex={activeQuestionIdx}
                totalQuestions={session?.questions?.length ?? 0}
              />
            </div>

            {/* Right Column: Monaco Editor + Test Runner + Score Summary */}
            <div className="lg:col-span-7 space-y-5">
              <div className="h-[440px]">
                <CodeEditorPanel
                  language={language}
                  allowedLanguages={session?.allowed_languages}
                  code={code}
                  readOnly={isTimeExpired}
                  onLanguageChange={handleLanguageChange}
                  onCodeChange={setCode}
                  onResetStarterCode={handleResetStarter}
                />
              </div>

              <TestResultsPanel
                runResponse={runResponse}
                isRunning={isRunningTests || isSubmitting}
                errorMessage={executionError}
              />

              {scoreSummary && <ScoreSummaryCard summary={scoreSummary} />}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
