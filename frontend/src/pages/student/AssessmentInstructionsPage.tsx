import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  Code2,
  Cpu,
  HardDrive,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { Button } from '../../components/ui/Button';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { assessmentService } from '../../services/assessmentService';
import { extractApiErrorMessage } from '../../services/api';

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

export function AssessmentInstructionsPage() {
  const navigate = useNavigate();
  const [agreedIntegrity, setAgreedIntegrity] = useState(false);
  const [agreedEnvironment, setAgreedEnvironment] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const canBegin = agreedIntegrity && agreedEnvironment;

  const handleStartAssessment = async () => {
    if (!canBegin) return;
    setIsStarting(true);
    setStartError(null);

    try {
      const session = await assessmentService.startAssessment();
      navigate('/student/assessment/workspace', {
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
            Adaptive Coding Assessment Instructions
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Review the execution constraints, grading rules, and workspace mechanics before launching your timed session.
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

        {/* Grading & Workflow Rules */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">
              How Your Submission Is Evaluated
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 leading-relaxed">
              <li>
                <strong className="text-slate-800">Stdin / Stdout I/O:</strong>{' '}
                Read problem inputs from standard input (`stdin`) and print exact answers to standard output (`stdout`). Trailing whitespace and line endings are normalized automatically.
              </li>
              <li>
                <strong className="text-slate-800">Public vs. Hidden Tests:</strong>{' '}
                You can run public sample cases freely to verify I/O formatting. Final grading runs weighted hidden edge cases that remain confidential.
              </li>
              <li>
                <strong className="text-slate-800">Algorithmic Efficiency:</strong>{' '}
                Beyond pass/fail correctness, AST static analysis and guarded AI review evaluate time complexity, space complexity, and code cleanliness.
              </li>
            </ul>
          </div>

          {/* Readiness Confirmations */}
          <div className="border-t border-slate-100 pt-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Readiness Confirmation
            </p>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50/40">
              <input
                type="checkbox"
                checked={agreedEnvironment}
                onChange={(e) => setAgreedEnvironment(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-blue-600"
              />
              <span>
                I understand the sandbox resource limits (2,000 ms timeout, 256 MB memory, no outbound network calls) and stdin/stdout format requirements.
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
              to="/student/assessment/workspace"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <Code2 className="h-4 w-4" aria-hidden="true" />
              <span>Open Assessment Workspace</span>
            </Link>

            <div className="flex items-center gap-3">
              <Link
                to="/student/portfolio"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Review Portfolio
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

