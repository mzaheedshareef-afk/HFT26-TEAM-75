import axios from 'axios';
import { api } from './api';
import {
  assessmentService,
  normalizeAssessmentDifficulty,
} from './assessmentService';
import type {
  AiInteractionSummary,
  AssessmentHistoryItem,
  DifficultyPerformanceMetric,
  ScoreTrendPoint,
  StudentAnalyticsOverview,
  TopicPerformanceMetric,
} from '../types/analytics';
import type {
  AiHintLevel,
  AssessmentCompletionStatus,
  AssessmentSummaryItem,
} from '../types/assessment';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Strictly reads ONLY an official AI efficiency score returned by the backend.
 * Never calculates, derives, or approximates the efficiency score in the frontend.
 */
function readBackendEfficiencyScore(
  raw: Record<string, unknown>
): number | null {
  if (
    typeof raw.ai_efficiency_score === 'number' &&
    Number.isFinite(raw.ai_efficiency_score)
  ) {
    return raw.ai_efficiency_score;
  }
  if (
    typeof raw.efficiency_score === 'number' &&
    Number.isFinite(raw.efficiency_score)
  ) {
    return raw.efficiency_score;
  }
  return null;
}

function normalizeCompletionStatus(raw: unknown): AssessmentCompletionStatus {
  if (typeof raw === 'string') {
    const lower = raw.trim().toLowerCase();
    if (
      lower === 'completed' ||
      lower === 'partially_completed' ||
      lower === 'expired' ||
      lower === 'in_progress'
    ) {
      return lower;
    }
    if (lower === 'ready' || lower === 'generating') {
      return 'in_progress';
    }
  }
  return 'completed';
}

function normalizeHintLevels(raw: unknown): AiHintLevel[] {
  if (!Array.isArray(raw)) return [];
  const levels = raw
    .map((v) => (typeof v === 'string' ? Number.parseInt(v, 10) : v))
    .filter((v): v is AiHintLevel => v === 1 || v === 2 || v === 3);
  return Array.from(new Set(levels)).sort((a, b) => a - b) as AiHintLevel[];
}

export function normalizeAssessmentHistoryItem(
  raw: Record<string, unknown>,
  index = 0
): AssessmentHistoryItem {
  const id =
    (typeof raw.assessment_id === 'string' && raw.assessment_id) ||
    (typeof raw.id === 'string' && raw.id) ||
    `assessment-${index + 1}`;

  const overallScore = readNumber(
    raw.overall_score ?? raw.final_score ?? raw.score,
    0
  );
  const codingScore = readNumber(
    raw.coding_score ?? raw.deterministic_score,
    overallScore
  );

  const durationSeconds =
    typeof raw.duration_seconds === 'number' && raw.duration_seconds >= 0
      ? raw.duration_seconds
      : typeof raw.time_taken_seconds === 'number' &&
        raw.time_taken_seconds >= 0
      ? raw.time_taken_seconds
      : typeof raw.duration_minutes === 'number' && raw.duration_minutes > 0
      ? raw.duration_minutes * 60
      : 0;

  const dateStr =
    (typeof raw.date === 'string' && raw.date) ||
    (typeof raw.completed_at === 'string' && raw.completed_at) ||
    (typeof raw.created_at === 'string' && raw.created_at) ||
    '';

  const topics = Array.isArray(raw.topics)
    ? raw.topics.filter((t): t is string => typeof t === 'string' && Boolean(t))
    : [];

  return {
    assessment_id: id,
    title:
      (typeof raw.title === 'string' && raw.title) ||
      (typeof raw.assessment_title === 'string' && raw.assessment_title) ||
      'Personalized Technical Assessment',
    date: dateStr,
    overall_score: overallScore,
    coding_score: codingScore,
    ai_efficiency_score: readBackendEfficiencyScore(raw),
    duration_seconds: durationSeconds,
    time_limit_seconds:
      typeof raw.time_limit_seconds === 'number'
        ? raw.time_limit_seconds
        : undefined,
    question_count: Math.max(
      1,
      readNumber(raw.question_count ?? raw.questions_count, 1)
    ),
    completion_status: normalizeCompletionStatus(
      raw.completion_status ?? raw.status
    ),
    difficulty: normalizeAssessmentDifficulty(raw.difficulty),
    topics,
    hints_used: readNumber(raw.hints_used ?? raw.total_hints_used, 0),
  };
}

function mapSummaryToHistoryItem(
  item: AssessmentSummaryItem
): AssessmentHistoryItem {
  const overall = item.final_score ?? 0;
  return {
    assessment_id: item.id,
    title: item.title,
    date: item.completed_at ?? item.created_at ?? '',
    overall_score: overall,
    coding_score: item.coding_score ?? overall,
    ai_efficiency_score: item.ai_efficiency_score ?? null,
    duration_seconds: item.duration_minutes * 60,
    question_count: item.question_count,
    completion_status:
      item.status === 'completed'
        ? 'completed'
        : item.status === 'expired'
        ? 'expired'
        : 'in_progress',
    difficulty: item.difficulty,
    topics: item.topics,
    hints_used: 0,
  };
}

function buildEmptyAnalyticsOverview(
  assignedCount = 0
): StudentAnalyticsOverview {
  return {
    overall_score: 0,
    coding_score: 0,
    ai_efficiency_score: null,
    total_assessments_completed: 0,
    total_assessments_assigned: assignedCount,
    average_score: 0,
    highest_score: 0,
    completion_rate: 0,
    correct_test_cases: 0,
    failed_test_cases: 0,
    total_test_cases: 0,
    average_completion_time_seconds: 0,
    improvement_percentage: null,
    improvement_label: 'Awaiting baseline assessments',
    consistency_score: null,
    consistency_label: 'Awaiting baseline assessments',
    recent_history: [],
    score_trend: [],
    topic_performance: [],
    difficulty_performance: [],
    ai_interaction: {
      total_hint_requests: 0,
      hint_levels_used: [],
      used_or_viewed_hints: false,
      hints_viewed_count: 0,
      ai_assistance_usage_label: 'No assessments completed yet',
      coding_score: 0,
      ai_efficiency_score: null,
    },
  };
}

export function normalizeStudentAnalytics(
  raw: Record<string, unknown>
): StudentAnalyticsOverview {
  const payload = isRecord(raw.analytics)
    ? raw.analytics
    : isRecord(raw.data)
    ? raw.data
    : raw;

  const rawRecent = Array.isArray(payload.recent_history)
    ? payload.recent_history
    : Array.isArray(payload.assessment_history)
    ? payload.assessment_history
    : Array.isArray(payload.history)
    ? payload.history
    : [];

  const recentHistory = rawRecent
    .filter(isRecord)
    .map((item, idx) => normalizeAssessmentHistoryItem(item, idx));

  const rawTrend = Array.isArray(payload.score_trend)
    ? payload.score_trend
    : [];

  const scoreTrend: ScoreTrendPoint[] =
    rawTrend.length > 0
      ? rawTrend.filter(isRecord).map((pt, idx) => {
          const overall = readNumber(
            pt.overall_score ?? pt.final_score ?? pt.score,
            0
          );
          return {
            assessment_id:
              (typeof pt.assessment_id === 'string' && pt.assessment_id) ||
              `trend-${idx + 1}`,
            assessment_title:
              (typeof pt.assessment_title === 'string' &&
                pt.assessment_title) ||
              (typeof pt.title === 'string' && pt.title) ||
              `Assessment ${idx + 1}`,
            date:
              (typeof pt.date === 'string' && pt.date) ||
              (typeof pt.completed_at === 'string' && pt.completed_at) ||
              '',
            overall_score: overall,
            coding_score: readNumber(
              pt.coding_score ?? pt.deterministic_score,
              overall
            ),
            ai_efficiency_score: readBackendEfficiencyScore(pt),
            completion_status: normalizeCompletionStatus(
              pt.completion_status ?? pt.status
            ),
          };
        })
      : [...recentHistory]
          .reverse()
          .map((item) => ({
            assessment_id: item.assessment_id,
            assessment_title: item.title,
            date: item.date,
            overall_score: item.overall_score,
            coding_score: item.coding_score,
            ai_efficiency_score: item.ai_efficiency_score,
            completion_status: item.completion_status,
          }));

  const rawTopics = Array.isArray(payload.topic_performance)
    ? payload.topic_performance
    : [];

  const topicPerformance: TopicPerformanceMetric[] = rawTopics
    .filter(isRecord)
    .map((tp) => ({
      topic:
        (typeof tp.topic === 'string' && tp.topic) ||
        (typeof tp.domain === 'string' && tp.domain) ||
        'Algorithms',
      average_score: readNumber(tp.average_score ?? tp.score, 0),
      coding_score:
        typeof tp.coding_score === 'number' ? tp.coding_score : undefined,
      assessments_count: Math.max(
        1,
        readNumber(tp.assessments_count ?? tp.attempts_count ?? tp.count, 1)
      ),
      questions_solved:
        typeof tp.questions_solved === 'number'
          ? tp.questions_solved
          : undefined,
      accuracy_rate:
        typeof tp.accuracy_rate === 'number' ? tp.accuracy_rate : undefined,
    }));

  const rawDifficulties = Array.isArray(payload.difficulty_performance)
    ? payload.difficulty_performance
    : [];

  const difficultyPerformance: DifficultyPerformanceMetric[] = rawDifficulties
    .filter(isRecord)
    .map((dp) => ({
      difficulty: normalizeAssessmentDifficulty(dp.difficulty),
      average_score: readNumber(dp.average_score ?? dp.score, 0),
      pass_rate: readNumber(dp.pass_rate ?? dp.completion_rate, 0),
      attempts_count: Math.max(
        0,
        readNumber(dp.attempts_count ?? dp.assessments_count ?? dp.count, 1)
      ),
    }));

  const completedCount = readNumber(
    payload.total_assessments_completed ?? payload.assessments_completed,
    recentHistory.filter((h) => h.completion_status === 'completed').length
  );

  if (completedCount === 0 && recentHistory.length === 0) {
    return buildEmptyAnalyticsOverview(
      readNumber(payload.total_assessments_assigned, 0)
    );
  }

  const overallScore = readNumber(
    payload.overall_score ?? payload.average_score,
    0
  );
  const codingScore = readNumber(
    payload.coding_score ?? payload.deterministic_score,
    overallScore
  );

  const backendEfficiency = readBackendEfficiencyScore(payload);
  const rawAi = isRecord(payload.ai_interaction)
    ? payload.ai_interaction
    : null;
  const aiEfficiencyFromNested = rawAi
    ? readBackendEfficiencyScore(rawAi)
    : null;
  const officialAiEfficiency = backendEfficiency ?? aiEfficiencyFromNested;

  const totalHintRequests = rawAi
    ? readNumber(
        rawAi.total_hint_requests ?? rawAi.total_hints_used,
        readNumber(payload.total_hints_used, 0)
      )
    : readNumber(
        payload.total_hints_used,
        recentHistory.reduce((sum, h) => sum + h.hints_used, 0)
      );

  const hintLevelsUsed = rawAi
    ? normalizeHintLevels(rawAi.hint_levels_used)
    : normalizeHintLevels(payload.hint_levels_used);

  const usedOrViewedHints =
    typeof rawAi?.used_or_viewed_hints === 'boolean'
      ? rawAi.used_or_viewed_hints
      : typeof rawAi?.hints_viewed === 'boolean'
      ? rawAi.hints_viewed
      : totalHintRequests > 0;

  const hintsViewedCount = rawAi
    ? readNumber(rawAi.hints_viewed_count, totalHintRequests)
    : totalHintRequests;

  const aiAssistanceUsageLabel =
    (typeof rawAi?.ai_assistance_usage_label === 'string' &&
      rawAi.ai_assistance_usage_label) ||
    (typeof rawAi?.assistance_usage === 'string' && rawAi.assistance_usage) ||
    (totalHintRequests === 0
      ? 'Independent solving (0 AI hints requested)'
      : `${totalHintRequests} guarded AI ${
          totalHintRequests === 1 ? 'hint' : 'hints'
        } requested across sessions`);

  const aiInteraction: AiInteractionSummary = {
    total_hint_requests: totalHintRequests,
    hint_levels_used: hintLevelsUsed,
    used_or_viewed_hints: usedOrViewedHints,
    hints_viewed_count: hintsViewedCount,
    ai_assistance_usage_label: aiAssistanceUsageLabel,
    independent_questions_count:
      typeof rawAi?.independent_questions_count === 'number'
        ? rawAi.independent_questions_count
        : undefined,
    assisted_questions_count:
      typeof rawAi?.assisted_questions_count === 'number'
        ? rawAi.assisted_questions_count
        : undefined,
    coding_score: rawAi
      ? readNumber(rawAi.coding_score, codingScore)
      : codingScore,
    ai_efficiency_score: officialAiEfficiency,
  };

  const improvementObj = isRecord(payload.improvement)
    ? payload.improvement
    : null;
  const improvementPct =
    typeof payload.improvement_percentage === 'number'
      ? payload.improvement_percentage
      : typeof payload.performance_improvement === 'number'
      ? payload.performance_improvement
      : improvementObj && typeof improvementObj.delta_percentage === 'number'
      ? improvementObj.delta_percentage
      : null;

  const improvementLabel =
    (typeof payload.improvement_label === 'string' &&
      payload.improvement_label) ||
    (improvementObj &&
      typeof improvementObj.label === 'string' &&
      improvementObj.label) ||
    (improvementPct !== null
      ? `${improvementPct >= 0 ? '+' : ''}${improvementPct.toFixed(
          1
        )}% score trajectory`
      : 'Single-session baseline recorded');

  const consistencyObj = isRecord(payload.consistency)
    ? payload.consistency
    : null;
  const consistencyScore =
    typeof payload.consistency_score === 'number'
      ? payload.consistency_score
      : consistencyObj && typeof consistencyObj.score === 'number'
      ? consistencyObj.score
      : null;

  const consistencyLabel =
    (typeof payload.consistency_label === 'string' &&
      payload.consistency_label) ||
    (consistencyObj &&
      typeof consistencyObj.label === 'string' &&
      consistencyObj.label) ||
    (consistencyScore !== null
      ? `${Math.round(consistencyScore)} / 100 stability index`
      : 'Baseline consistency');

  const correctCases = readNumber(payload.correct_test_cases, 0);
  const failedCases = readNumber(payload.failed_test_cases, 0);
  const totalCases = readNumber(
    payload.total_test_cases,
    correctCases + failedCases
  );

  return {
    overall_score: overallScore,
    coding_score: codingScore,
    ai_efficiency_score: officialAiEfficiency,
    total_assessments_completed: completedCount,
    total_assessments_assigned: Math.max(
      completedCount,
      readNumber(payload.total_assessments_assigned, recentHistory.length)
    ),
    average_score: readNumber(payload.average_score, overallScore),
    highest_score: readNumber(payload.highest_score, overallScore),
    completion_rate: readNumber(payload.completion_rate, 0),
    correct_test_cases: correctCases,
    failed_test_cases: failedCases,
    total_test_cases: totalCases,
    average_completion_time_seconds: readNumber(
      payload.average_completion_time_seconds ??
        payload.avg_completion_time_seconds,
      0
    ),
    improvement_percentage: improvementPct,
    improvement_label: improvementLabel,
    consistency_score: consistencyScore,
    consistency_label: consistencyLabel,
    recent_history: recentHistory,
    score_trend: scoreTrend,
    topic_performance: topicPerformance,
    difficulty_performance: difficultyPerformance,
    ai_interaction: aiInteraction,
  };
}

export const analyticsService = {
  /**
   * Retrieves the candidate's comprehensive analytics dashboard payload.
   * Never invents fake metrics and never computes official AI efficiency scores in the frontend.
   */
  async getStudentAnalytics(): Promise<StudentAnalyticsOverview> {
    try {
      const response = await api.get<unknown>('/api/analytics/student');
      if (isRecord(response.data)) {
        return normalizeStudentAnalytics(response.data);
      }
      return buildEmptyAnalyticsOverview();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        try {
          const fallbackResp = await api.get<unknown>('/api/analytics/me');
          if (isRecord(fallbackResp.data)) {
            return normalizeStudentAnalytics(fallbackResp.data);
          }
        } catch (secondError) {
          if (
            !axios.isAxiosError(secondError) ||
            secondError.response?.status !== 404
          ) {
            throw secondError;
          }
        }

        // Compose strictly from real existing assessment records if analytics route is not yet mounted
        const summaries = await assessmentService.listAvailableAssessments();
        const completedSummaries = summaries.filter(
          (item) => item.status === 'completed' && item.final_score !== null
        );
        if (completedSummaries.length === 0) {
          return buildEmptyAnalyticsOverview(summaries.length);
        }

        const historyItems = completedSummaries.map(mapSummaryToHistoryItem);
        const scores = historyItems.map((h) => h.overall_score);
        const avg =
          scores.reduce((acc, s) => acc + s, 0) /
          Math.max(1, historyItems.length);
        const highest = Math.max(...scores);
        const completionRate =
          summaries.length > 0
            ? Math.round((completedSummaries.length / summaries.length) * 100)
            : 100;

        // Only pass through backend efficiency score if present on summary records; never calculate!
        const backendEffScores = historyItems
          .map((h) => h.ai_efficiency_score)
          .filter((s): s is number => typeof s === 'number');
        const latestBackendEff =
          backendEffScores.length > 0
            ? backendEffScores[backendEffScores.length - 1]
            : null;

        return {
          ...buildEmptyAnalyticsOverview(summaries.length),
          overall_score: avg,
          coding_score: avg,
          ai_efficiency_score: latestBackendEff,
          total_assessments_completed: completedSummaries.length,
          average_score: avg,
          highest_score: highest,
          completion_rate: completionRate,
          recent_history: historyItems,
          score_trend: [...historyItems].reverse().map((h) => ({
            assessment_id: h.assessment_id,
            assessment_title: h.title,
            date: h.date,
            overall_score: h.overall_score,
            coding_score: h.coding_score,
            ai_efficiency_score: h.ai_efficiency_score,
            completion_status: h.completion_status,
          })),
          ai_interaction: {
            total_hint_requests: 0,
            hint_levels_used: [],
            used_or_viewed_hints: false,
            hints_viewed_count: 0,
            ai_assistance_usage_label: 'Synced from assessment summaries',
            coding_score: avg,
            ai_efficiency_score: latestBackendEff,
          },
        };
      }
      throw error;
    }
  },

  /**
   * Retrieves the student's full assessment performance history list.
   */
  async getAssessmentHistory(): Promise<AssessmentHistoryItem[]> {
    const extractList = (payload: unknown): AssessmentHistoryItem[] | null => {
      if (Array.isArray(payload)) {
        return payload
          .filter(isRecord)
          .map((item, idx) => normalizeAssessmentHistoryItem(item, idx));
      }
      if (isRecord(payload)) {
        const list =
          (Array.isArray(payload.history) && payload.history) ||
          (Array.isArray(payload.assessments) && payload.assessments) ||
          (Array.isArray(payload.items) && payload.items) ||
          null;
        if (list) {
          return list
            .filter(isRecord)
            .map((item, idx) => normalizeAssessmentHistoryItem(item, idx));
        }
      }
      return null;
    };

    try {
      const response = await api.get<unknown>('/api/analytics/history');
      return extractList(response.data) ?? [];
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        try {
          const fallback = await api.get<unknown>('/api/assessment/history');
          return extractList(fallback.data) ?? [];
        } catch (secondError) {
          if (
            axios.isAxiosError(secondError) &&
            secondError.response?.status === 404
          ) {
            const summaries =
              await assessmentService.listAvailableAssessments();
            return summaries.map(mapSummaryToHistoryItem);
          }
          throw secondError;
        }
      }
      throw error;
    }
  },
};

