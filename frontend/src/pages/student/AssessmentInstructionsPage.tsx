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
  'typescript',
  'javascript',
  'java',
  'cpp',
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
    label: 'Dual Evaluation',
    value: 'Deterministic + AI Efficiency',
    detail: 'Weighted hidden test cases plus Big-O optimality & cleanliness.',
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
        // Keep static pre-assessment specifications visible if backend is offline before start
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
      : 3;
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
            {previewSession?.title || 'Adaptive Coding Assessment Instructions'}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Review the total duration, question count, allowed programming languages, timer mechanics, and assessment rules before confirming start.
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

        {/* Assessment Overview Strip: Total Duration, Number of Questions, Allowed Languages */}
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
              Continuous timed coding window
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <FileQuestion
                className="h-4 w-4 text-blue-600"
                aria-hidden="true"
              />
              <span>Number of Questions</span>
            </div>
            <p className="text-xl font-bold text-slate-900 tabular-nums">
              {questionCount}{' '}
              {questionCount === 1 ? 'Coding Question' : 'Coding Questions'}
            </p>
            <p className="text-xs text-slate-500">
              Portfolio-calibrated difficulty{previewSession?.difficulty ? ` (${previewSession.difficulty})` : ''}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Languages
                className="h-4 w-4 text-blue-600"
                aria-hidden="true"
              />
              <span>Allowed Programming Languages</span>
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

        {/* Timer Information Card */}
        <section className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-5 sm:p-6 space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Timer className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <h2>Timer Information</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            The {durationMinutes}-minute countdown timer begins immediately once you confirm and start the assessment. You may navigate freely across all {questionCount} questions while time remains. An amber alert triggers when 5 minutes remain, and code execution automatically locks when the timer reaches <span className="font-mono font-semibold">00:00</span>.
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
                <strong className="text-slate-800">Stdin / Stdout I/O:</strong>{' '}
                Read problem inputs from standard input (<code className="font-mono text-xs">stdin</code>) and print exact answers to standard output (<code className="font-mono text-xs">stdout</code>). Trailing whitespace and line endings are normalized automatically.
              </li>
              <li>
                <strong className="text-slate-800">Public vs. Hidden Tests:</strong>{' '}
                You can run public sample cases freely via <strong>Run Code</strong> to verify formatting. Final grading executes weighted hidden edge cases via <strong>Submit Answer</strong>.
              </li>
              <li>
                <strong className="text-slate-800">Guarded AI Hints:</strong>{' '}
                Up to 3 progressive conceptual hints are available per question. Hint usage is logged on your results report, and the AI tutor never reveals complete code solutions.
              </li>
              <li>
                <strong className="text-slate-800">Algorithmic Efficiency &amp; Integrity:</strong>{' '}
                All code must be authored independently during the active session. Static analysis and AI review evaluate Big-O time complexity, space complexity, and cleanliness.
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
                I understand the {durationMinutes}-minute timer rules, sandbox resource limits (2,000 ms timeout, 256 MB memory, offline execution), and stdin/stdout requirements.
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
                I confirm that all submitted code will be my own original work written during this assessment session.
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
