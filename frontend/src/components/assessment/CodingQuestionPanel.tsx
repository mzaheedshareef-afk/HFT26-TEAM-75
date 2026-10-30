import {
  CheckSquare,
  Cpu,
  FileCode2,
  HardDrive,
  Lock,
  Timer,
} from 'lucide-react';
import type {
  CodingQuestion,
  QuestionDifficulty,
} from '../../types/assessment';

interface CodingQuestionPanelProps {
  question: CodingQuestion | null;
  questionIndex?: number;
  totalQuestions?: number;
}

const difficultyStyles: Record<QuestionDifficulty, string> = {
  Easy: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Medium: 'border-amber-200 bg-amber-50 text-amber-800',
  Hard: 'border-red-200 bg-red-50 text-red-800',
};

export function CodingQuestionPanel({
  question,
  questionIndex = 0,
  totalQuestions = 1,
}: CodingQuestionPanelProps) {
  if (!question) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mb-3">
          <FileCode2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="text-base font-semibold text-slate-900">
          No Active Coding Problem Loaded
        </h2>
        <p className="mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">
          Start or resume an adaptive assessment session once the backend question generator and portfolio service are active.
        </p>
      </div>
    );
  }

  const { constraints } = question;
  const publicCount = question.public_test_cases.length;
  const hiddenCount = question.hidden_test_cases_count;
  const totalSuiteCount = question.total_test_cases_count;

  return (
    <article className="h-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
      {/* Header */}
      <div className="space-y-3 border-b border-slate-100 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs font-medium text-slate-500">
            Problem {questionIndex + 1} of {totalQuestions} &middot;{' '}
            {question.domain}
          </span>
          <span
            className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${
              difficultyStyles[question.difficulty]
            }`}
          >
            {question.difficulty}
          </span>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          {question.title}
        </h2>

        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 font-medium">
            <Timer className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span>Time Limit: {constraints.time_limit_ms} ms</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 font-medium">
            <HardDrive
              className="h-3.5 w-3.5 text-slate-500"
              aria-hidden="true"
            />
            <span>Memory Limit: {constraints.memory_limit_mb} MB</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 font-medium">
            <Cpu className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span>Isolated Sandbox</span>
          </span>
          {question.target_skill && question.target_skill !== question.domain && (
            <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-0.5 font-medium text-blue-800">
              {question.target_skill}
            </span>
          )}
        </div>
      </div>

      {/* Problem Description */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Problem Statement
        </h3>
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
          {question.description}
        </p>
      </section>

      {/* Input / Output Format */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Input Format
          </h3>
          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
            {question.input_format}
          </p>
        </section>

        <section className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Output Format
          </h3>
          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
            {question.output_format}
          </p>
        </section>
      </div>

      {/* Input / Output Examples */}
      {publicCount > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Input / Output Examples
          </h3>
          <div className="space-y-3">
            {question.public_test_cases.map((tc, idx) => (
              <div
                key={tc.test_case_id}
                className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-2.5"
              >
                <p className="text-xs font-semibold text-slate-800">
                  Example {idx + 1}
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-medium text-slate-500 mb-1">
                      Input (stdin)
                    </p>
                    <pre className="rounded border border-slate-200 bg-white p-2.5 font-mono text-xs text-slate-800 overflow-x-auto">
                      {tc.input}
                    </pre>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-500 mb-1">
                      Expected Output (stdout)
                    </p>
                    <pre className="rounded border border-slate-200 bg-white p-2.5 font-mono text-xs text-slate-800 overflow-x-auto">
                      {tc.expected_output}
                    </pre>
                  </div>
                </div>
                {tc.explanation && (
                  <p className="text-xs text-slate-600">
                    <span className="font-medium text-slate-700">
                      Explanation:
                    </span>{' '}
                    {tc.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Constraints */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Constraints
        </h3>
        <ul className="list-disc pl-5 space-y-1 text-xs font-mono text-slate-700">
          {constraints.min_array_length !== undefined &&
            constraints.max_array_length !== undefined && (
              <li>
                {constraints.min_array_length} &le; length &le;{' '}
                {constraints.max_array_length.toLocaleString()}
              </li>
            )}
          {constraints.min_value !== undefined &&
            constraints.max_value !== undefined && (
              <li>
                {constraints.min_value.toLocaleString()} &le; element value &le;{' '}
                {constraints.max_value.toLocaleString()}
              </li>
            )}
          <li>Execution Timeout: {constraints.time_limit_ms} ms</li>
          <li>Memory Ceiling: {constraints.memory_limit_mb} MB</li>
          {constraints.additional_notes?.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      {/* Test Case Information */}
      <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          Test Case Information
        </h3>
        <div className="grid gap-2.5 sm:grid-cols-2 text-xs text-slate-700">
          <div className="flex items-start gap-2 rounded-md border border-slate-200/80 bg-white p-2.5">
            <CheckSquare
              className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold text-slate-900">
                {publicCount} Public Sample {publicCount === 1 ? 'Case' : 'Cases'}
              </p>
              <p className="text-[11px] text-slate-500">
                Executed on Run Code with full stdout diff visibility.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-slate-200/80 bg-white p-2.5">
            <Lock
              className="h-4 w-4 shrink-0 text-slate-500 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold text-slate-900">
                {hiddenCount !== undefined
                  ? `${hiddenCount} Hidden Evaluation Cases`
                  : totalSuiteCount !== undefined
                  ? `${Math.max(0, totalSuiteCount - publicCount)} Hidden Evaluation Cases`
                  : 'Hidden Grading Suite'}
              </p>
              <p className="text-[11px] text-slate-500">
                Weighted edge &amp; boundary tests evaluated on Submit Answer.
              </p>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}
