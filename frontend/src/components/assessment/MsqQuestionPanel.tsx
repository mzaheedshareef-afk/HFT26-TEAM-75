import React from 'react';
import { HelpCircle, CheckSquare, Square, Sparkles } from 'lucide-react';
import type { CodingQuestion } from '../../types/assessment';

interface MsqQuestionPanelProps {
  question: CodingQuestion;
  selectedOptions?: string[];
  onToggleOption: (optionId: string) => void;
  isSaving?: boolean;
}

export function MsqQuestionPanel({
  question,
  selectedOptions = [],
  onToggleOption,
  isSaving = false,
}: MsqQuestionPanelProps) {
  const options = question.options || [];

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-white p-6 sm:p-8 space-y-6">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
            MSQ &middot; Multiple Select
          </span>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
            {question.topic || question.domain}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-md">
            {question.marks ?? 3} Marks
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
        <div className="text-slate-700 text-base leading-relaxed whitespace-pre-line bg-purple-50/30 p-4 rounded-xl border border-purple-100">
          {question.description}
        </div>
      </div>

      {/* Skill Context Badge */}
      {question.portfolio_skill_reference && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
          <span>
            Calibrated from your portfolio skill:{' '}
            <strong className="text-purple-900 font-medium">
              {question.portfolio_skill_reference}
            </strong>
          </span>
        </div>
      )}

      {/* Options List */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-purple-800">
            Select ALL options that apply (multiple correct answers):
          </p>
          <span className="text-xs text-slate-500">
            {selectedOptions.length} selected
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3" role="group" aria-label={question.title}>
          {options.map((opt) => {
            const isSelected = selectedOptions.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                onClick={() => onToggleOption(opt.id)}
                className={`flex items-start gap-3.5 p-4 rounded-xl text-left transition-all border cursor-pointer ${
                  isSelected
                    ? 'border-purple-600 bg-purple-50/70 shadow-xs ring-1 ring-purple-600'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 bg-white'
                }`}
              >
                <div className="mt-0.5 shrink-0 text-purple-600">
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 fill-purple-600 text-white" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-300" />
                  )}
                </div>
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 font-bold text-xs mt-0.5 transition-colors ${
                    isSelected
                      ? 'bg-purple-600 text-white'
                      : 'border border-slate-300 text-slate-600 bg-white'
                  }`}
                >
                  {opt.id}
                </div>
                <div className="flex-1 text-sm font-medium text-slate-900 leading-snug pt-0.5">
                  {opt.text}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Helper Note */}
      <div className="flex items-center gap-2 text-xs text-slate-400 pt-4 border-t border-slate-100">
        <HelpCircle className="w-4 h-4" />
        <span>You can select multiple options. Exact match scoring is applied upon final evaluation.</span>
      </div>
    </div>
  );
}

