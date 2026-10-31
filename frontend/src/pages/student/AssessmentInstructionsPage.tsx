import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  Code2,
  Cpu,
  FileQuestion,
  HardDrive,
  Languages,
  ListChecks,
  ShieldCheck,
  Terminal,
  Timer,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { Button } from '../../components/ui/Button';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { assessmentService } from '../../services/assessmentService';
import { extractApiErrorMessage } from '../../services/api';
import type {
  ActiveAssessmentSession,
  SupportedLanguage,
} from '../../types/assessment';

const LANGUAGE_DISPLAY_NAMES: Record<SupportedLanguage, string> = {
  python: 'Python 3.12',
  typescript: 'TypeScript',
  javascript: 'JavaScript (Node.js)',
  java: 'Java 21',
  cpp: 'C++ 20',
};

const DEFAULT_LANGUAGES: SupportedLanguage[] = [
  'python',
  'java',
  'cpp',
  'typescript',
  'javascript',
];

const environmentSpecs = [
  {
    icon: Clock,
    label: 'Execution Timeout',
    value: '2,000 ms per test case',
    detail: 'Infinite loops or excessive complexity terminate with TLE.',
  },
  {
    icon: HardDrive,
    label: 'Memory Limit',
    value: '256 MB container cap',
    detail: 'Ephemeral read-only container with 32 MB /tmp scratchpad.',
  },
  {
    icon: ShieldCheck,
    label: 'Network Isolation',
    value: 'Strictly offline (--network none)',
    detail: 'Standard library algorithms only; external sockets are blocked.',
  },
  {
    icon: Cpu,
    label: 'Deterministic Multi-Format Grading',
    value: 'MCQ + MSQ + Code Sandbox',
    detail: 'Exact match evaluation on multiple choices plus weighted hidden test cases.',
  },
];

interface InstructionsLocationState {
  session?: ActiveAssessmentSession;
}

export function AssessmentInstructionsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { assessmentId } = useParams<{ assessmentId?: string }>();

  const stateSession =
    (location.state as InstructionsLocationState | null)?.session ?? null;

  const [previewSession, setPreviewSession] =
    useState<ActiveAssessmentSession | null>(stateSession);
  const [agreedIntegrity, setAgreedIntegrity] = useState(false);
  const [agreedEnvironment, setAgreedEnvironment] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAssessmentOverview() {
      if (
        stateSession &&
        (!assessmentId || stateSession.assessment_id === assessmentId)
      ) {
        setPreviewSession(stateSession);
        return;
      }

      try {
        const fetched = assessmentId
          ? await assessmentService.getAssessmentSessionById(assessmentId)
          : await assessmentService.getActiveSession();
        if (!cancelled && fetched) {
          setPreviewSession(fetched);
        }
      } catch {
        // Keep static briefing visible if offline
      }
    }

    void loadAssessmentOverview();
    return () => {
      cancelled = true;
    };
  }, [assessmentId, stateSession]);

  const canBegin = agreedIntegrity && agreedEnvironment;

  const durationMinutes = previewSession
    ? Math.max(1, Math.round(previewSession.duration_seconds / 60))
    : 60;
  const questionCount =
    previewSession && previewSession.questions.length > 0
      ? previewSession.questions.length
      : 6;

  const mcqCount = previewSession?.mcq_count ?? previewSession?.questions.filter((q) => q.question_type === 'mcq').length ?? 3;
  const msqCount = previewSession?.msq_count ?? previewSession?.questions.filter((q) => q.question_type === 'msq').length ?? 2;
  const codingCount = previewSession?.coding_count ?? previewSession?.questions.filter((q) => q.question_type === 'coding').length ?? 1;

  const allowedLanguages =
    previewSession && previewSession.allowed_languages.length > 0
      ? previewSession.allowed_languages
      : DEFAULT_LANGUAGES;

  const handleStartAssessment = async () => {
    if (!canBegin) return;
    setIsStarting(true);
    setStartError(null);

    const targetId = assessmentId ?? previewSession?.assessment_id;

    try {
      const session = await assessmentService.startAssessment(targetId);
      const workspacePath = session.assessment_id
        ? `/student/assessment/${encodeURIComponent(
            session.assessment_id
          )}/workspace`
        : '/student/assessment/workspace';

      navigate(workspacePath, {
        state: { session },
      });
    } catch (error) {
      setStartError(
        extractApiErrorMessage(
          error,
          'Unable to initialize a live assessment session. Verify your portfolio is uploaded and the backend assessment service is active.'
        )
      );
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <DashboardShell role="student">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
            <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Pre-Assessment Briefing</span>
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {previewSession?.title || 'Dynamic Multi-Format Technical Assessment'}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Review the assessment format, round breakdowns, allowed programming languages, timer mechanics, and rules before confirming start.
          </p>
        </div>

        {startError && (
          <AlertBanner
            variant="error"
            title="Unable to Start Live Session"
            message={startError}
            onDismiss={() => setStartError(null)}
          />
        )}

        {/* Assessment Overview Strip */}
        <section
          aria-label="Assessment overview metrics"
          className="grid gap-4 sm:grid-cols-3"
        >
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Clock className="h-4 w-4 text-blue-600" aria-hidden="true" />
              <span>Total Duration</span>
            </div>
            <p className="text-xl font-bold text-slate-900 tabular-nums">
              {durationMinutes} Minutes
            </p>
            <p className="text-xs text-slate-500">
              Continuous timed examination window
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <FileQuestion
                className="h-4 w-4 text-blue-600"
                aria-hidden="true"
              />
              <span>Assessment Rounds</span>
            </div>
            <p className="text-xl font-bold text-slate-900 tabular-nums">
              {questionCount}{' '}{questionCount === 1 ? 'Coding Question' : 'Coding Questions'}
            </p>
            <p className="text-xs text-slate-500">
              {mcqCount} MCQ + {msqCount} MSQ + {codingCount} Coding Challenge
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Languages
                className="h-4 w-4 text-blue-600"
                aria-hidden="true"
              />
              <span>Coding Round Languages</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allowedLanguages.map((lang) => (
                <span
                  key={lang}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-800"
                >
                  {LANGUAGE_DISPLAY_NAMES[lang] ?? lang}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* 3 Examination Rounds Breakdown */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 text-slate-900">
            <ListChecks className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold">Assessment Structure &amp; Scoring Matrix</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
                  Round 1: MCQ
                </span>
                <span className="text-xs font-semibold bg-blue-200/80 text-blue-900 px-2 py-0.5 rounded-full">
                  2 Marks / Q
                </span>
              </div>
              <p className="text-sm font-bold text-slate-900">
                Single Choice Questions ({mcqCount})
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Evaluates theoretical foundations and concept precision. Exactly one correct answer among 4 choices.
              </p>
            </div>

            <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-800">
                  Round 2: MSQ
                </span>
                <span className="text-xs font-semibold bg-purple-200/80 text-purple-900 px-2 py-0.5 rounded-full">
                  3 Marks / Q
                </span>
              </div>
              <p className="text-sm font-bold text-slate-900">
                Multiple Select Questions ({msqCount})
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Evaluates deep architectural and edge-case grasp. Select all matching options. Exact match scoring applies.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Round 3: Coding
                </span>
                <span className="text-xs font-semibold bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full">
                  10 Marks / Q
                </span>
              </div>
              <p className="text-sm font-bold text-slate-900">
                Coding Round ({codingCount})
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Full algorithmic implementation calibrated to your portfolio tech stack with isolated sandbox execution.
              </p>
            </div>
          </div>
        </section>

        {/* Timer Information Card */}
        <section className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-5 sm:p-6 space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Timer className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <h2>Timer Information &amp; Free Navigation</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            The {durationMinutes}-minute countdown begins when you confirm start. You may navigate freely back and forth across all {questionCount} questions in any order. Your chosen options and code drafts are auto-saved. Inputs lock when time expires.
          </p>
        </section>

        {/* Sandbox Environment Specifications */}
        <section className="grid gap-4 sm:grid-cols-2">
          {environmentSpecs.map((spec) => {
            const Icon = spec.icon;
            return (
              <div
                key={spec.label}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-800">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      {spec.label}
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {spec.value}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {spec.detail}
                </p>
              </div>
            );
          })}
        </section>

        {/* Assessment Rules & Start Confirmation */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="space-y-2.5">
            <h2 className="text-base font-semibold text-slate-900">
              Assessment Rules &amp; Evaluation Criteria
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 leading-relaxed">
              <li>
                <strong className="text-slate-800">Multi-Format Balance:</strong>{' '}
                Total score is the weighted composite of your MCQ, MSQ, and Coding Round achievements.
              </li>
              <li>
                <strong className="text-slate-800">Stdin / Stdout I/O:</strong>{' '}
                For the coding round, read inputs from standard input (<code className="font-mono text-xs">stdin</code>) and print exact answers to standard output (<code className="font-mono text-xs">stdout</code>).
              </li>
              <li>
                <strong className="text-slate-800">Guarded AI Progressive Hints:</strong>{' '}
                Up to 3 conceptual hints per coding challenge are available. The tutor never exposes full code.
              </li>
              <li>
                <strong className="text-slate-800">Confidentiality:</strong>{' '}
                Answer keys and explanations remain confidential until your final assessment submission is completed.
              </li>
            </ul>
          </div>

          {/* Start Confirmation Checkboxes */}
          <div className="border-t border-slate-100 pt-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Start Confirmation
            </p>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50/40">
              <input
                type="checkbox"
                checked={agreedEnvironment}
                onChange={(e) => setAgreedEnvironment(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-blue-600"
              />
              <span>
                I understand the {durationMinutes}-minute timer rules, multi-round format (MCQ, MSQ, Coding), and sandbox resource limits.
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50/40">
              <input
                type="checkbox"
                checked={agreedIntegrity}
                onChange={(e) => setAgreedIntegrity(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-blue-600"
              />
              <span>
                I confirm that all answers and code submitted will be my own original work completed during this active session.
              </span>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100 pt-5">
            <Link
              to={
                assessmentId
                  ? `/student/assessment/${encodeURIComponent(
                      assessmentId
                    )}/workspace`
                  : '/student/assessment/workspace'
              }
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <Code2 className="h-4 w-4" aria-hidden="true" />
              <span>Open Assessment Workspace</span>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/student/dashboard"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back to Dashboard
              </Link>
              <Button
                type="button"
                variant="primary"
                size="lg"
                disabled={!canBegin}
                isLoading={isStarting}
                loadingText="Initializing session..."
                onClick={() => void handleStartAssessment()}
                rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
              >
                Begin Timed Assessment
              </Button>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
