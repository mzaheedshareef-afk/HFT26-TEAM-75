import { HelpCircle, CheckCircle, Sparkles } from 'lucide-react';
import type { CodingQuestion } from '../../types/assessment';

interface McqQuestionPanelProps {
  question: CodingQuestion;
  selectedOption?: string;
  onSelectOption: (optionId: string) => void;
  isSaving?: boolean;
}

export function McqQuestionPanel({
  question,
  selectedOption,
  onSelectOption,
  isSaving = false,
}: McqQuestionPanelProps) {
  const options = question.options || [];

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-white p-6 sm:p-8 space-y-6">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            MCQ &middot; Single Choice
          </span>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
            {question.topic || question.target_skill || question.domain}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
            {question.marks ?? 2} Marks
          </span>
          {isSaving && (
            <span className="text-xs text-slate-400 animate-pulse">
              Saving...
            </span>
          )}
        </div>
      </div>

      {/* Question Text */}
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          {question.title}
        </h2>
        <div className="text-slate-700 text-base leading-relaxed whitespace-pre-line bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
          {question.description}
        </div>
      </div>

      {/* Skill Context Badge */}
      {question.portfolio_skill_reference && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            Calibrated from your portfolio skill:{' '}
            <strong className="text-blue-900 font-medium">
              {question.portfolio_skill_reference}
            </strong>
          </span>
        </div>
      )}

      {/* Options List */}
      <div className="space-y-3 pt-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Select exactly one correct answer:
        </p>
        <div className="grid grid-cols-1 gap-3" role="radiogroup" aria-label={question.title}>
          {options.map((opt) => {
            const isSelected = selectedOption === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelectOption(opt.id)}
                className={`flex items-start gap-3.5 p-4 rounded-xl text-left transition-all border cursor-pointer ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-600'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 bg-white'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs mt-0.5 transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'border-2 border-slate-300 text-slate-600 bg-white'
                  }`}
                >
                  {opt.id}
                </div>
                <div className="flex-1 text-sm font-medium text-slate-900 leading-snug pt-0.5">
                  {opt.text}
                </div>
                {isSelected && (
                  <CheckCircle className="w-5 h-5 text-blue-600 shrink-0 ml-auto" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Helper Note */}
      <div className="flex items-center gap-2 text-xs text-slate-400 pt-4 border-t border-slate-100">
        <HelpCircle className="w-4 h-4" />
        <span>Your selection is automatically saved as you navigate between questions.</span>
      </div>
    </div>
  );
}
