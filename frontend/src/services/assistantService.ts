import { api } from './api';
import type {
  AiHintItem,
  AiHintLevel,
  AiHintRequestPayload,
} from '../types/assessment';

export const MAX_HINTS_PER_QUESTION = 3;

export const HINT_TIER_DEFINITIONS: Record<
  AiHintLevel,
  { label: string; shortLabel: string; description: string }
> = {
  1: {
    label: 'Level 1 · Conceptual Intuition',
    shortLabel: 'Conceptual Hint',
    description:
      'High-level problem framing and key algorithmic observation without implementation details.',
  },
  2: {
    label: 'Level 2 · Data Structure & Strategy',
    shortLabel: 'Strategy Hint',
    description:
      'Recommended data structures, state invariants, and step-by-step decomposition.',
  },
  3: {
    label: 'Level 3 · Edge Cases & Complexity',
    shortLabel: 'Optimization Hint',
    description:
      'Boundary conditions, corner cases, and Big-O time/space optimization guidance.',
  },
};

const CODE_DECLARATION_PATTERN =
  /\b(def\s+\w+\s*\(|class\s+\w+[:\s{]|function\s+\w+\s*\(|public\s+static\s+void\s+main|int\s+main\s*\(|#include\s*<)/i;

/**
 * Client-side leak-prevention guardrail.
 * Ensures full code blocks or complete function implementations are never
 * automatically revealed to candidates even if an upstream LLM emits code fences.
 */
export function sanitizeGuardedHint(rawContent: string): {
  content: string;
  redacted: boolean;
} {
  let redacted = false;

  // Redact multi-line or implementation fenced code blocks
  const withoutSolutionFences = rawContent.replace(
    /```[\w+-]*\n([\s\S]*?)```/g,
    (fullMatch, codeBody: string) => {
      const nonEmptyLines = codeBody
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      if (
        nonEmptyLines.length >= 3 ||
        CODE_DECLARATION_PATTERN.test(codeBody)
      ) {
        redacted = true;
        return '[Full code block redacted by Guarded AI Tutor — hints provide conceptual guidance only.]';
      }
      return fullMatch;
    }
  );

  // Also check for unfenced raw solution dumps containing function definitions + return statements
  const lines = withoutSolutionFences.split('\n');
  const codeLikeLines = lines.filter(
    (line) =>
      CODE_DECLARATION_PATTERN.test(line) ||
      /^\s{2,}(return\s+|for\s+.+:|while\s+.+:|if\s+.+:)/.test(line)
  );

  if (!redacted && codeLikeLines.length >= 4) {
    redacted = true;
    const proseLines = lines.filter(
      (line) =>
        !CODE_DECLARATION_PATTERN.test(line) &&
        !/^\s{4,}\S/.test(line)
    );
    const cleanedProse = proseLines.join('\n').trim();
    return {
      content: cleanedProse
        ? `${cleanedProse}\n\n[Implementation lines redacted by Guarded AI Tutor — write the solution code yourself.]`
        : '[Full solution implementation redacted by Guarded AI Tutor — hints provide conceptual guidance only.]',
      redacted: true,
    };
  }

  return {
    content: withoutSolutionFences.trim(),
    redacted,
  };
}

interface RawHintEnvelope {
  success?: boolean;
  hint?:
    | string
    | {
        hint_id?: string;
        id?: string;
        question_id?: string;
        level?: number;
        hint_level?: number;
        category_label?: string;
        category?: string;
        content?: string;
        hint_text?: string;
        message?: string;
        created_at?: string;
      };
  hint_text?: string;
  content?: string;
  message?: string;
  level?: number;
  hint_level?: number;
  category?: string;
  created_at?: string;
}

export const assistantService = {
  /**
   * Requests a progressive, non-spoiling conceptual hint from the guarded AI tutor.
   * Connects strictly to the backend API and never fabricates fake AI responses.
   */
  async requestHint(payload: AiHintRequestPayload): Promise<AiHintItem> {
    const response = await api.post<RawHintEnvelope>('/api/assistant/hint', {
      assessment_id: payload.assessmentId,
      question_id: payload.questionId,
      question_title: payload.questionTitle,
      hint_level: payload.hintLevel,
      language: payload.language,
      current_code: payload.currentCode,
      previous_hints: payload.previousHints ?? [],
      allow_solution: false,
    });

    const data = response.data;
    const rawHintObj =
      typeof data?.hint === 'object' && data.hint !== null ? data.hint : null;

    const rawText =
      (typeof data?.hint === 'string' ? data.hint : undefined) ??
      rawHintObj?.content ??
      rawHintObj?.hint_text ??
      rawHintObj?.message ??
      data?.hint_text ??
      data?.content ??
      '';

    if (!rawText.trim()) {
      throw new Error(
        'The AI hint service returned an empty response. Please try again.'
      );
    }

    const rawLevel =
      rawHintObj?.level ??
      rawHintObj?.hint_level ??
      data?.hint_level ??
      data?.level ??
      payload.hintLevel;

    const normalizedLevel: AiHintLevel =
      rawLevel === 1 || rawLevel === 2 || rawLevel === 3
        ? rawLevel
        : payload.hintLevel;

    const { content, redacted } = sanitizeGuardedHint(rawText);

    return {
      hint_id:
        rawHintObj?.hint_id ??
        rawHintObj?.id ??
        `hint-${payload.questionId}-${normalizedLevel}-${Date.now()}`,
      question_id: rawHintObj?.question_id ?? payload.questionId,
      level: normalizedLevel,
      category_label:
        rawHintObj?.category_label ??
        rawHintObj?.category ??
        data?.category ??
        HINT_TIER_DEFINITIONS[normalizedLevel].label,
      content,
      redacted_solution_attempt: redacted,
      created_at:
        rawHintObj?.created_at ?? data?.created_at ?? new Date().toISOString(),
    };
  },
};

