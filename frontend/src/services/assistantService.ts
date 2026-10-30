import axios from 'axios';
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
    label: 'Hint 1 · Conceptual Direction',
    shortLabel: 'Conceptual Direction',
    description:
      'High-level problem framing and conceptual intuition without implementation details.',
  },
  2: {
    label: 'Hint 2 · Algorithm & Approach',
    shortLabel: 'Relevant Algorithm or Approach',
    description:
      'Recommended data structures, state invariants, and step-by-step algorithmic approach.',
  },
  3: {
    label: 'Hint 3 · Implementation Guidance',
    shortLabel: 'Detailed Implementation Guidance',
    description:
      'Detailed implementation guidance, boundary conditions, and Big-O complexity considerations.',
  },
};

const CODE_DECLARATION_PATTERN =
  /\b(def\s+\w+\s*\(|class\s+\w+[:\s{]|function\s+\w+\s*\(|public\s+static\s+void\s+main|int\s+main\s*\(|#include\s*<)/i;

const HIDDEN_TEST_LEAK_PATTERN =
  /\b(hidden\s+test\s+case\s*#?\d*\s*[:=]|reference_solution\s*[:=])/i;

/**
 * Client-side leak-prevention guardrail.
 * Ensures full code blocks, complete function implementations, or hidden test cases
 * are never automatically revealed to candidates even if an upstream LLM emits them.
 */
export function sanitizeGuardedHint(rawContent: string): {
  content: string;
  redacted: boolean;
} {
  let redacted = false;

  // Redact any accidental hidden test case or reference solution markers
  let workingText = rawContent;
  if (HIDDEN_TEST_LEAK_PATTERN.test(workingText)) {
    redacted = true;
    workingText = workingText
      .split('\n')
      .filter((line) => !HIDDEN_TEST_LEAK_PATTERN.test(line))
      .join('\n');
  }

  // Redact multi-line or implementation fenced code blocks
  const withoutSolutionFences = workingText.replace(
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

  // Also check for unfenced raw solution dumps containing function definitions + control statements
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
        !CODE_DECLARATION_PATTERN.test(line) && !/^\s{4,}\S/.test(line)
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

interface RawHintRecord {
  hint_id?: string;
  id?: string;
  assessment_id?: string;
  question_id?: string;
  question_title?: string;
  level?: number;
  hint_level?: number;
  category_label?: string;
  category?: string;
  content?: string;
  hint_text?: string;
  message?: string;
  created_at?: string;
  requested_at?: string;
}

interface RawHintEnvelope {
  success?: boolean;
  hint?: string | RawHintRecord;
  hint_text?: string;
  content?: string;
  message?: string;
  level?: number;
  hint_level?: number;
  category?: string;
  created_at?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeHintLevel(
  rawLevel: unknown,
  fallbackLevel: AiHintLevel = 1
): AiHintLevel {
  if (rawLevel === 1 || rawLevel === 2 || rawLevel === 3) {
    return rawLevel;
  }
  if (typeof rawLevel === 'string') {
    const parsed = Number.parseInt(rawLevel, 10);
    if (parsed === 1 || parsed === 2 || parsed === 3) {
      return parsed;
    }
  }
  return fallbackLevel;
}

function normalizeHintRecord(
  raw: RawHintRecord,
  fallbackQuestionId = 'question',
  fallbackLevel: AiHintLevel = 1,
  index = 0
): AiHintItem | null {
  const rawText = raw.content ?? raw.hint_text ?? raw.message ?? '';
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return null;
  }

  const level = normalizeHintLevel(
    raw.level ?? raw.hint_level,
    fallbackLevel
  );
  const { content, redacted } = sanitizeGuardedHint(rawText);
  const questionId =
    (typeof raw.question_id === 'string' && raw.question_id) ||
    fallbackQuestionId;

  return {
    hint_id:
      (typeof raw.hint_id === 'string' && raw.hint_id) ||
      (typeof raw.id === 'string' && raw.id) ||
      `hint-${questionId}-${level}-${index}`,
    assessment_id:
      typeof raw.assessment_id === 'string' ? raw.assessment_id : undefined,
    question_id: questionId,
    question_title:
      typeof raw.question_title === 'string' ? raw.question_title : undefined,
    level,
    category_label:
      (typeof raw.category_label === 'string' && raw.category_label) ||
      (typeof raw.category === 'string' && raw.category) ||
      HINT_TIER_DEFINITIONS[level].label,
    content,
    redacted_solution_attempt: redacted,
    created_at:
      (typeof raw.created_at === 'string' && raw.created_at) ||
      (typeof raw.requested_at === 'string' && raw.requested_at) ||
      new Date().toISOString(),
  };
}

export interface HintHistoryQuery {
  assessmentId?: string;
  questionId?: string;
  signal?: AbortSignal;
}

export const assistantService = {
  /**
   * Requests a progressive, non-spoiling conceptual hint from the guarded AI tutor.
   * Never sends hidden reference solutions and never fabricates fake AI responses.
   */
  async requestHint(payload: AiHintRequestPayload): Promise<AiHintItem> {
    const requestBody = {
      assessment_id: payload.assessmentId,
      question_id: payload.questionId,
      question_title: payload.questionTitle,
      hint_level: payload.hintLevel,
      language: payload.language,
      current_code: payload.currentCode,
      previous_hints: payload.previousHints ?? [],
      allow_solution: false,
    };

    let response;
    try {
      response = await api.post<RawHintEnvelope>(
        '/api/assistant/hint',
        requestBody
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        response = await api.post<RawHintEnvelope>(
          '/api/ai/hints',
          requestBody
        );
      } else {
        throw error;
      }
    }

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

    const normalizedLevel = normalizeHintLevel(
      rawHintObj?.level ??
        rawHintObj?.hint_level ??
        data?.hint_level ??
        data?.level,
      payload.hintLevel
    );

    const { content, redacted } = sanitizeGuardedHint(rawText);

    return {
      hint_id:
        rawHintObj?.hint_id ??
        rawHintObj?.id ??
        `hint-${payload.questionId}-${normalizedLevel}-${Date.now()}`,
      assessment_id: rawHintObj?.assessment_id ?? payload.assessmentId,
      question_id: rawHintObj?.question_id ?? payload.questionId,
      question_title:
        rawHintObj?.question_title ?? payload.questionTitle,
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

  /**
   * Retrieves previously requested AI hints for an assessment or question.
   * Returns an empty array cleanly if no history endpoint or hints exist (404).
   */
  async getHintHistory(query: HintHistoryQuery = {}): Promise<AiHintItem[]> {
    const searchParams = new URLSearchParams();
    if (query.assessmentId) {
      searchParams.set('assessment_id', query.assessmentId);
    }
    if (query.questionId) {
      searchParams.set('question_id', query.questionId);
    }
    const querySuffix = searchParams.toString()
      ? `?${searchParams.toString()}`
      : '';
    const requestConfig = query.signal ? { signal: query.signal } : undefined;

    const parsePayload = (payload: unknown): AiHintItem[] => {
      const list = Array.isArray(payload)
        ? payload
        : isRecord(payload) && Array.isArray(payload.hints)
        ? payload.hints
        : isRecord(payload) && Array.isArray(payload.history)
        ? payload.history
        : null;

      if (!list) return [];

      return list
        .filter(isRecord)
        .map((item, idx) =>
          normalizeHintRecord(
            item as RawHintRecord,
            query.questionId ?? 'question',
            1,
            idx
          )
        )
        .filter((item): item is AiHintItem => item !== null);
    };

    try {
      const response = requestConfig
        ? await api.get<unknown>(
            `/api/assistant/hints${querySuffix}`,
            requestConfig
          )
        : await api.get<unknown>(`/api/assistant/hints${querySuffix}`);
      return parsePayload(response?.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        try {
          const fallback = requestConfig
            ? await api.get<unknown>(
                `/api/assistant/history${querySuffix}`,
                requestConfig
              )
            : await api.get<unknown>(`/api/assistant/history${querySuffix}`);
          return parsePayload(fallback?.data);
        } catch (fallbackError) {
          if (
            axios.isAxiosError(fallbackError) &&
            fallbackError.response?.status === 404
          ) {
            return [];
          }
          throw fallbackError;
        }
      }
      throw error;
    }
  },
};
