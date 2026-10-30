import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileWarning,
  HardDrive,
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
  runningLabel?: string;
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
  CE: {
    label: 'CE · Compilation Error',
    className: 'border-orange-200 bg-orange-50 text-orange-900',
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
      {verdict === 'CE' && (
        <FileWarning className="h-3.5 w-3.5" aria-hidden="true" />
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
  runningLabel = 'Executing code in isolated Docker sandbox...',
  errorMessage = null,
}: TestResultsPanelProps) {
  const hasTimeout =
    runResponse?.overall_verdict === 'TLE' ||
    runResponse?.timed_out === true ||
    runResponse?.results.some((r) => r.verdict === 'TLE' || r.timed_out);

  const compileErrorText =
    runResponse?.compile_error ||
    (runResponse?.overall_verdict === 'CE'
      ? runResponse.stderr ||
        runResponse.results.find((r) => r.stderr || r.error_message)?.stderr ||
        runResponse.results.find((r) => r.stderr || r.error_message)
          ?.error_message
      : undefined);

  const showTopLevelStdout =
    Boolean(runResponse?.stdout) && (runResponse?.results.length ?? 0) === 0;
  const showTopLevelStderr =
    Boolean(runResponse?.stderr) &&
    !compileErrorText &&
    !runResponse?.results.some(
      (r) => (r.stderr ?? r.error_message) === runResponse.stderr
    );

  return (
    <section
      aria-label="Test execution results"
      className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <TerminalSquare
            className="h-4 w-4 text-slate-500"
            aria-hidden="true"
          />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Execution Console &amp; Test Results
          </h3>
        </div>

        {runResponse && !isRunning && (
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="font-medium text-slate-700 tabular-nums">
              Passed {runResponse.passed_count} / {runResponse.total_count}
            </span>

            {runResponse.total_time_ms !== undefined && (
              <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-600 tabular-nums">
                <Clock className="h-3 w-3 text-slate-400" aria-hidden="true" />
                <span>{runResponse.total_time_ms} ms</span>
              </span>
            )}

            {runResponse.memory_used_mb !== undefined && (
              <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-600 tabular-nums">
                <HardDrive
                  className="h-3 w-3 text-slate-400"
                  aria-hidden="true"
                />
                <span>{runResponse.memory_used_mb.toFixed(1)} MB</span>
              </span>
            )}

            <VerdictBadge verdict={runResponse.overall_verdict} />
          </div>
        )}
      </div>

      <div className="p-4 space-y-3.5">
        {isRunning ? (
          <div className="flex items-center justify-center gap-2.5 py-8 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span>{runningLabel}</span>
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
            No execution output yet. Click{' '}
            <span className="font-semibold text-slate-700">Run Code</span> to
            test against public cases or{' '}
            <span className="font-semibold text-slate-700">
              Submit Solution
            </span>{' '}
            for final grading.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Compilation / Syntax Error Diagnostic */}
            {(runResponse.overall_verdict === 'CE' || compileErrorText) && (
              <div
                role="alert"
                className="rounded-lg border border-orange-200 bg-orange-50/70 p-3.5 space-y-2"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-orange-900">
                  <FileWarning
                    className="h-4 w-4 shrink-0 text-orange-600"
                    aria-hidden="true"
                  />
                  <span>Compilation / Syntax Error</span>
                </div>
                {compileErrorText && (
                  <pre className="rounded border border-orange-200 bg-white px-3 py-2 font-mono text-xs text-orange-950 overflow-x-auto whitespace-pre-wrap">
                    {compileErrorText}
                  </pre>
                )}
              </div>
            )}

            {/* Execution Timeout Diagnostic */}
            {hasTimeout && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50/80 p-3.5 text-xs text-amber-950"
              >
                <AlertTriangle
                  className="h-4 w-4 shrink-0 text-amber-600 mt-0.5"
                  aria-hidden="true"
                />
                <div className="space-y-0.5">
                  <p className="font-semibold">
                    Execution Timed Out (Time Limit Exceeded)
                  </p>
                  <p className="text-amber-900 leading-relaxed">
                    Your solution exceeded the sandbox wall-clock timeout limit. Check for infinite loops or reduce algorithmic time complexity.
                  </p>
                </div>
              </div>
            )}

            {/* Top-Level Standard Output / Error Streams */}
            {showTopLevelStdout && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Standard Output (stdout)
                </p>
                <pre className="rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800 overflow-x-auto whitespace-pre-wrap">
                  {runResponse.stdout}
                </pre>
              </div>
            )}

            {showTopLevelStderr && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700 mb-1">
                  Standard Error (stderr)
                </p>
                <pre className="rounded border border-red-200 bg-red-50/60 px-3 py-2 font-mono text-xs text-red-900 overflow-x-auto whitespace-pre-wrap">
                  {runResponse.stderr}
                </pre>
              </div>
            )}

            {/* Per-Test Case Disclosures (searchable via native Find-in-Page using <details>) */}
            {runResponse.results.map((tc, index) => {
              const stdoutText = tc.stdout ?? tc.actual_output;
              const stderrText = tc.stderr ?? tc.error_message;
              const shouldStartOpen = index === 0 || !tc.passed;

              return (
                <details
                  key={tc.test_case_id}
                  open={shouldStartOpen}
                  className="group rounded-lg border border-slate-200 bg-slate-50/50 overflow-hidden"
                >
                  <summary className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 cursor-pointer select-none hover:bg-slate-100/70">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-800">
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

                      {tc.memory_used_mb !== undefined && (
                        <span className="font-mono font-normal text-slate-500">
                          &middot; {tc.memory_used_mb.toFixed(1)} MB
                        </span>
                      )}
                    </div>

                    <VerdictBadge verdict={tc.verdict} />
                  </summary>

                  <div className="border-t border-slate-200/80 bg-white p-3.5 space-y-2.5">
                    {/* Never disclose hidden test inputs or expected outputs */}
                    {!tc.is_hidden && (
                      <>
                        {tc.input !== undefined && tc.input !== '' && (
                          <div>
                            <p className="text-[11px] font-medium text-slate-500 mb-0.5">
                              Input (stdin)
                            </p>
                            <pre className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-800 overflow-x-auto">
                              {tc.input}
                            </pre>
                          </div>
                        )}

                        {(tc.expected_output !== undefined ||
                          stdoutText !== undefined) && (
                          <div className="grid gap-2.5 sm:grid-cols-2">
                            {stdoutText !== undefined && (
                              <div>
                                <p className="text-[11px] font-medium text-slate-500 mb-0.5">
                                  Standard Output (stdout)
                                </p>
                                <pre className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-800 overflow-x-auto">
                                  {stdoutText || '(empty stdout)'}
                                </pre>
                              </div>
                            )}

                            {tc.expected_output !== undefined && (
                              <div>
                                <p className="text-[11px] font-medium text-slate-500 mb-0.5">
                                  Expected Output
                                </p>
                                <pre className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-800 overflow-x-auto">
                                  {tc.expected_output}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {stderrText && (
                      <div>
                        <p className="text-[11px] font-medium text-red-700 mb-0.5">
                          Standard Error (stderr)
                        </p>
                        <pre className="rounded border border-red-200 bg-red-50/60 px-2.5 py-1.5 font-mono text-xs text-red-800 overflow-x-auto whitespace-pre-wrap">
                          {stderrText}
                        </pre>
                      </div>
                    )}

                    {tc.is_hidden && !stderrText && (
                      <p className="text-xs text-slate-500">
                        Hidden test case inputs and expected outputs are confidential.
                      </p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
