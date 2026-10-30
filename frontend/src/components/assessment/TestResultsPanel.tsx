import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  ShieldAlert,
  TerminalSquare,
  XCircle,
} from 'lucide-react';
import type {
  CodeRunResponse,
  ExecutionVerdict,
} from '../../types/assessment';

interface TestResultsPanelProps {
  runResponse: CodeRunResponse | null;
  isRunning?: boolean;
  errorMessage?: string | null;
}

const verdictMeta: Record<
  ExecutionVerdict,
  { label: string; className: string }
> = {
  AC: {
    label: 'AC · Accepted',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  WA: {
    label: 'WA · Wrong Answer',
    className: 'border-red-200 bg-red-50 text-red-800',
  },
  TLE: {
    label: 'TLE · Time Limit Exceeded',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  MLE: {
    label: 'MLE · Memory Limit Exceeded',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  RTE: {
    label: 'RTE · Runtime Error',
    className: 'border-red-200 bg-red-50 text-red-800',
  },
  SEC: {
    label: 'SEC · Security Policy Blocked',
    className: 'border-purple-200 bg-purple-50 text-purple-900',
  },
};

export function VerdictBadge({ verdict }: { verdict: ExecutionVerdict }) {
  const meta = verdictMeta[verdict] ?? verdictMeta.RTE;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${meta.className}`}
    >
      {verdict === 'AC' && (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {(verdict === 'WA' || verdict === 'RTE') && (
        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {(verdict === 'TLE' || verdict === 'MLE') && (
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {verdict === 'SEC' && (
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span>{meta.label}</span>
    </span>
  );
}

export function TestResultsPanel({
  runResponse,
  isRunning = false,
  errorMessage = null,
}: TestResultsPanelProps) {
  return (
    <section
      aria-label="Test execution results"
      className="rounded-xl border border-slate-200 bg-white overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <TerminalSquare
            className="h-4 w-4 text-slate-500"
            aria-hidden="true"
          />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Sandbox Test Runner
          </h3>
        </div>

        {runResponse && !isRunning && (
          <div className="flex items-center gap-3 text-xs">
            <span className="font-medium text-slate-700">
              Passed {runResponse.passed_count} / {runResponse.total_count}
            </span>
            <VerdictBadge verdict={runResponse.overall_verdict} />
          </div>
        )}
      </div>

      <div className="p-4">
        {isRunning ? (
          <div className="flex items-center justify-center gap-2.5 py-8 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span>Executing code in isolated Docker sandbox...</span>
          </div>
        ) : errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50/70 p-3.5 text-xs text-red-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        ) : !runResponse ? (
          <p className="py-6 text-center text-xs text-slate-500">
            No test execution results yet. Click{' '}
            <span className="font-semibold text-slate-700">Run Public Tests</span>{' '}
            or <span className="font-semibold text-slate-700">Submit Solution</span>{' '}
            to evaluate your code against the sandbox.
          </p>
        ) : (
          <div className="space-y-3">
            {runResponse.results.map((tc, index) => (
              <div
                key={tc.test_case_id}
                className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                    {tc.is_hidden ? (
                      <>
                        <Lock
                          className="h-3.5 w-3.5 text-slate-400"
                          aria-hidden="true"
                        />
                        <span>Hidden Test Case #{index + 1}</span>
                      </>
                    ) : (
                      <span>Public Test Case #{index + 1}</span>
                    )}
                    {tc.execution_time_ms !== undefined && (
                      <span className="font-mono font-normal text-slate-500">
                        ({tc.execution_time_ms} ms)
                      </span>
                    )}
                  </div>

                  <VerdictBadge verdict={tc.verdict} />
                </div>

                {/* Never disclose hidden test inputs or expected outputs */}
                {!tc.is_hidden && (tc.expected_output !== undefined || tc.actual_output !== undefined) && (
                  <div className="grid gap-2 sm:grid-cols-2 pt-1">
                    {tc.expected_output !== undefined && (
                      <div>
                        <p className="text-[11px] font-medium text-slate-500 mb-0.5">
                          Expected
                        </p>
                        <pre className="rounded border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 overflow-x-auto">
                          {tc.expected_output}
                        </pre>
                      </div>
                    )}
                    {tc.actual_output !== undefined && (
                      <div>
                        <p className="text-[11px] font-medium text-slate-500 mb-0.5">
                          Your Output
                        </p>
                        <pre className="rounded border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 overflow-x-auto">
                          {tc.actual_output || '(empty stdout)'}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {tc.error_message && (
                  <pre className="rounded border border-red-200 bg-red-50/60 px-2.5 py-1.5 font-mono text-xs text-red-800 overflow-x-auto">
                    {tc.error_message}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
