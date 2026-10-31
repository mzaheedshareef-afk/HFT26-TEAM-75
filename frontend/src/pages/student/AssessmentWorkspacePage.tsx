import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  ListChecks,
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
import { McqQuestionPanel } from '../../components/assessment/McqQuestionPanel';
import { MsqQuestionPanel } from '../../components/assessment/MsqQuestionPanel';
import { AssessmentSubmitModal } from '../../components/assessment/AssessmentSubmitModal';
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
  CodeRunResponse,
  CodingQuestion,
  ScoreSummary,
  SupportedLanguage,
} from '../../types/assessment';

interface WorkspaceLocationState {
  session?: ActiveAssessmentSession;
}

interface CandidateAnswer {
  selected_option?: string;
  selected_options?: string[];
  source_code?: string;
  language?: string;
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

function getAnswersStorageKey(assessmentId: string): string {
  return `gatecode_candidate_answers_${assessmentId}`;
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
    // Ignore storage read errors
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

function readPersistedAnswers(assessmentId?: string): Record<string, CandidateAnswer> {
  if (!assessmentId) return {};
  try {
    const raw = sessionStorage.getItem(getAnswersStorageKey(assessmentId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, CandidateAnswer>;
    }
  } catch {
    // Ignore storage read errors
  }
  return {};
}

function writePersistedAnswers(
  assessmentId: string | undefined,
  answers: Record<string, CandidateAnswer>
): void {
  if (!assessmentId) return;
  try {
    sessionStorage.setItem(
      getAnswersStorageKey(assessmentId),
      JSON.stringify(answers)
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

  const [candidateAnswers, setCandidateAnswers] = useState<Record<string, CandidateAnswer>>(() => {
    const persisted = readPersistedAnswers(initialSession?.assessment_id ?? assessmentId);
    return { ...(initialSession?.saved_answers || {}), ...persisted };
  });

  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

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
  const activeQType = activeQuestion?.question_type || 'coding';

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

  const effectiveAssessmentId = session?.assessment_id ?? assessmentId;

  const isQuestionAnswered = useCallback((q: CodingQuestion): boolean => {
    const qid = q.question_id;
    const ans = candidateAnswers[qid];
    const type = q.question_type || 'coding';
    if (type === 'mcq') {
      return Boolean(ans?.selected_option);
    }
    if (type === 'msq') {
      return Boolean(ans?.selected_options && ans.selected_options.length > 0);
    }
    return Boolean(submissionsByQuestion[qid] || (ans?.source_code && ans.source_code.trim().length > 10));
  }, [candidateAnswers, submissionsByQuestion]);

  const answeredQuestionsCount = useMemo(() => {
    return questions.filter(isQuestionAnswered).length;
  }, [questions, isQuestionAnswered]);

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
        const persistedDrafts = readPersistedDrafts(fetched.assessment_id);
        if (Object.keys(persistedDrafts).length > 0) {
          setCodeDrafts((prev) => ({ ...persistedDrafts, ...prev }));
        }
        const persistedAnswers = readPersistedAnswers(fetched.assessment_id);
        setCandidateAnswers((prev) => ({
          ...(fetched.saved_answers || {}),
          ...persistedAnswers,
          ...prev,
        }));
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
        // Optional
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [session?.assessment_id, isLoadingSession, isAiAssistantDisabled]);

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

  const handleSelectMcqOption = async (questionId: string, optionId: string) => {
    if (isTimeExpired) return;
    const updated = {
      ...candidateAnswers,
      [questionId]: {
        ...candidateAnswers[questionId],
        selected_option: optionId,
      },
    };
    setCandidateAnswers(updated);
    writePersistedAnswers(effectiveAssessmentId, updated);

    if (effectiveAssessmentId) {
      setIsSavingAnswer(true);
      try {
        await assessmentService.saveAnswer({
          assessmentId: effectiveAssessmentId,
          questionId,
          selectedOption: optionId,
        });
      } catch {
        // Non-fatal
      } finally {
        setIsSavingAnswer(false);
      }
    }
  };

  const handleToggleMsqOption = async (questionId: string, optionId: string) => {
    if (isTimeExpired) return;
    const currentList = candidateAnswers[questionId]?.selected_options ?? [];
    const nextList = currentList.includes(optionId)
      ? currentList.filter((item) => item !== optionId)
      : [...currentList, optionId];

    const updated = {
      ...candidateAnswers,
      [questionId]: {
        ...candidateAnswers[questionId],
        selected_options: nextList,
      },
    };
    setCandidateAnswers(updated);
    writePersistedAnswers(effectiveAssessmentId, updated);

    if (effectiveAssessmentId) {
      setIsSavingAnswer(true);
      try {
        await assessmentService.saveAnswer({
          assessmentId: effectiveAssessmentId,
          questionId,
          selectedOptions: nextList,
        });
      } catch {
        // Non-fatal
      } finally {
        setIsSavingAnswer(false);
      }
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

    const updatedAnswers = {
      ...candidateAnswers,
      [activeQuestion.question_id]: {
        ...candidateAnswers[activeQuestion.question_id],
        source_code: nextCode,
        language,
      },
    };
    setCandidateAnswers(updatedAnswers);
    writePersistedAnswers(effectiveAssessmentId, updatedAnswers);
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
        setRunsByQuestion((prev) => ({
          ...prev,
          [targetQuestionId]: response.run_results!,
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
    } catch {
      navigate(resultsPath);
    } finally {
      setIsFinishing(false);
    }
  };

  const runDisabled =
    !activeQuestion ||
    activeQType !== 'coding' ||
    isTimeExpired ||
    isRunningTests ||
    isSubmitting ||
    !activeCode.trim();

  const submitDisabled =
    runDisabled || isDuplicateSubmission || activeQType !== 'coding';

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
        <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8 shadow-xs">
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

              <h1 className="text-sm font-semibold text-slate-900 truncate max-w-[200px] sm:max-w-xs">
                {session?.title || 'Dynamic Assessment Workspace'}
              </h1>

              {/* Question Navigation Tabs */}
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
                      const isAnswered = isQuestionAnswered(q);
                      const isActive = idx === activeQuestionIdx;
                      const qType = q.question_type || 'coding';
                      const typeLabel = qType === 'mcq' ? 'MCQ' : qType === 'msq' ? 'MSQ' : 'Code';

                      return (
                        <button
                          key={q.question_id}
                          role="tab"
                          type="button"
                          aria-selected={isActive}
                          onClick={() => handleQuestionSwitch(idx)}
                          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span>Q{idx + 1}</span>
                          <span
                            className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase ${
                              qType === 'mcq'
                                ? 'bg-blue-100 text-blue-800'
                                : qType === 'msq'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {typeLabel}
                          </span>
                          {isAnswered && (
                            <CheckCircle2
                              className="h-3 w-3 text-emerald-600 shrink-0"
                              aria-label="Answered"
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

            {/* Right Action Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {activeQType === 'coding' && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/70 px-2.5 py-1.5 text-xs font-semibold text-blue-800">
                  <Code2 className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                  <span>Selected: {LANGUAGE_LABELS[language]}</span>
                </span>
              )}

              <AssessmentTimer
                initialSeconds={
                  session?.remaining_seconds ??
                  session?.duration_seconds ??
                  3600
                }
                isRunning={Boolean(session && activeQuestion)}
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
                Sync
              </Button>

              {activeQType === 'coding' && (
                <>
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
                </>
              )}

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsSubmitModalOpen(true)}
                leftIcon={<BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Finish Assessment
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
              message="The allotted time for this assessment session has ended. All inputs and code execution are locked."
            />
          )}

          {activeQuestion && (
            <>
              {activeQType === 'mcq' ? (
                <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
                  <div className="lg:col-span-8 rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
                    <McqQuestionPanel
                      question={activeQuestion}
                      selectedOption={
                        candidateAnswers[activeQuestion.question_id]?.selected_option
                      }
                      onSelectOption={(optId: string) =>
                        handleSelectMcqOption(activeQuestion.question_id, optId)
                      }
                      isSaving={isSavingAnswer}
                    />
                  </div>

                  <div className="lg:col-span-4 space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <ListChecks className="w-4 h-4 text-blue-600" />
                          <span>Round 1: Multiple Choice</span>
                        </h3>
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                          {answeredQuestionsCount} of {questions.length} answered
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        Single correct answer questions grounded in your claimed portfolio skills. Select one option and navigate to the next question.
                      </p>

                      <div className="pt-2 flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={activeQuestionIdx === 0}
                          onClick={() => handleQuestionSwitch(activeQuestionIdx - 1)}
                          leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                        >
                          Previous
                        </Button>

                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={activeQuestionIdx >= questions.length - 1}
                          onClick={() => handleQuestionSwitch(activeQuestionIdx + 1)}
                          rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                        >
                          Next Question
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeQType === 'msq' ? (
                <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
                  <div className="lg:col-span-8 rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
                    <MsqQuestionPanel
                      question={activeQuestion}
                      selectedOptions={
                        candidateAnswers[activeQuestion.question_id]?.selected_options ?? []
                      }
                      onToggleOption={(optId: string) =>
                        handleToggleMsqOption(activeQuestion.question_id, optId)
                      }
                      isSaving={isSavingAnswer}
                    />
                  </div>

                  <div className="lg:col-span-4 space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <ListChecks className="w-4 h-4 text-purple-600" />
                          <span>Round 2: Multiple Select</span>
                        </h3>
                        <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                          {answeredQuestionsCount} of {questions.length} answered
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        Multiple correct answer questions. Select <strong>all</strong> matching choices. Exact match evaluation is applied upon submission.
                      </p>

                      <div className="pt-2 flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={activeQuestionIdx === 0}
                          onClick={() => handleQuestionSwitch(activeQuestionIdx - 1)}
                          leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                        >
                          Previous
                        </Button>

                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={activeQuestionIdx >= questions.length - 1}
                          onClick={() => handleQuestionSwitch(activeQuestionIdx + 1)}
                          rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                        >
                          Next Question
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
                  {/* Left Column: Coding Problem Specification + AI Hints */}
                  <div className="lg:col-span-5 space-y-5">
                    <CodingQuestionPanel
                      question={activeQuestion}
                      questionIndex={activeQuestionIdx}
                      totalQuestions={questions.length}
                      hintsUsedForQuestion={activeQuestionHints.length}
                      maxHintsPerQuestion={MAX_HINTS_PER_QUESTION}
                      onOpenAiHints={
                        isAiAssistantDisabled ? undefined : handleOpenAiHints
                      }
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
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2 font-medium text-slate-800 mb-1">
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
                              ? 'Current snapshot submitted'
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
              )}
            </>
          )}
        </div>
      </div>

      <AssessmentSubmitModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onConfirmSubmit={() => void handleFinishAndViewResults()}
        isSubmitting={isFinishing}
        questions={questions}
        answers={candidateAnswers}
        onNavigateToQuestion={(idx: number) => handleQuestionSwitch(idx)}
      />
    </DashboardShell>
  );
}
