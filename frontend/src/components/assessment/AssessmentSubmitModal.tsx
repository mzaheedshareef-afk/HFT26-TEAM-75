import React from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import type { CodingQuestion } from '../../types/assessment';

interface AssessmentSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSubmit: () => void;
  isSubmitting: boolean;
  questions: CodingQuestion[];
  answers: Record<
    string,
    {
      selected_option?: string;
      selected_options?: string[];
      source_code?: string;
      language?: string;
    }
  >;
  onNavigateToQuestion: (index: number) => void;
}

export function AssessmentSubmitModal({
  isOpen,
  onClose,
  onConfirmSubmit,
  isSubmitting,
  questions,
  answers,
  onNavigateToQuestion,
}: AssessmentSubmitModalProps) {
  if (!isOpen) return null;

  const totalQuestions = questions.length;
  let answeredCount = 0;

  const questionStatuses = questions.map((q, idx) => {
    const qid = q.question_id;
    const ans = answers[qid];
    const qType = q.question_type || 'coding';
    let isAnswered = false;

    if (qType === 'mcq') {
      isAnswered = Boolean(ans?.selected_option);
    } else if (qType === 'msq') {
      isAnswered = Boolean(ans?.selected_options && ans.selected_options.length > 0);
    } else {
      isAnswered = Boolean(ans?.source_code && ans.source_code.trim().length > 10);
    }

    if (isAnswered) answeredCount++;

    return {
      index: idx,
      question: q,
      isAnswered,
      type: qType,
    };
  });

  const unansweredCount = totalQuestions - answeredCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <h3 className="text-lg font-bold text-slate-900">
              Submit Assessment
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {unansweredCount > 0 ? (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  You have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}!
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Are you sure you want to finish now? Unanswered questions will receive 0 marks.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold">All questions attempted!</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Great job. You are ready to submit your assessment for deterministic grading.
                </p>
              </div>
            </div>
          )}

          {/* Question Breakdown List */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              <span>Question Summary</span>
              <span>
                {answeredCount} of {totalQuestions} answered
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
              {questionStatuses.map(({ index, question, isAnswered, type }) => (
                <div
                  key={question.question_id}
                  onClick={() => {
                    onClose();
                    onNavigateToQuestion(index);
                  }}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-white text-xs cursor-pointer transition-colors border border-transparent hover:border-slate-200"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="font-mono font-bold text-slate-500 w-5">
                      Q{index + 1}
                    </span>
                    <span className="truncate text-slate-800 font-medium">
                      {question.title}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-200 text-slate-700">
                      {type}
                    </span>
                  </div>
                  <span
                    className={`font-semibold shrink-0 ${
                      isAnswered ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {isAnswered ? 'Answered' : 'Unanswered'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Review Questions
          </button>
          <button
            type="button"
            onClick={onConfirmSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-2"
          >
            {isSubmitting ? 'Evaluating...' : 'Confirm & Finish Assessment'}
          </button>
        </div>
      </div>
    </div>
  );
}

