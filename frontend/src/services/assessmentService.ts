import axios from 'axios';
import { api } from './api';
import type {
  ActiveAssessmentSession,
  CodeRunResponse,
  ScoreSummary,
  SupportedLanguage,
} from '../types/assessment';

export interface RunCodePayload {
  assessmentId?: string;
  questionId: string;
  language: SupportedLanguage;
  code: string;
}

export interface SubmitCodePayload {
  assessmentId?: string;
  questionId: string;
  language: SupportedLanguage;
  code: string;
  elapsedSeconds?: number;
}

interface ActiveSessionApiResponse {
  success: boolean;
  session?: ActiveAssessmentSession | null;
}

interface LatestScoreApiResponse {
  success: boolean;
  summary?: ScoreSummary | null;
}

interface SubmitSolutionApiResponse {
  success: boolean;
  summary: ScoreSummary;
  run_results?: CodeRunResponse;
}

export const assessmentService = {
  /**
   * Fetches the active portfolio-calibrated coding assessment session.
   * Returns null if no active assessment session has been generated yet (404).
   */
  async getActiveSession(): Promise<ActiveAssessmentSession | null> {
    try {
      const response = await api.get<ActiveSessionApiResponse>(
        '/api/assessment/active'
      );
      return response.data?.session ?? null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Starts or generates a new adaptive assessment session from the candidate's portfolio.
   */
  async startAssessment(): Promise<ActiveAssessmentSession> {
    const response = await api.post<{
      success: boolean;
      session: ActiveAssessmentSession;
    }>('/api/assessment/start');

    if (!response.data?.session) {
      throw new Error('Assessment session could not be initialized.');
    }
    return response.data.session;
  },

  /**
   * Executes candidate code against public test cases in the Docker sandbox.
   */
  async runPublicTests(payload: RunCodePayload): Promise<CodeRunResponse> {
    const response = await api.post<CodeRunResponse>('/api/assessment/run', {
      assessment_id: payload.assessmentId,
      question_id: payload.questionId,
      language: payload.language,
      code: payload.code,
    });
    return response.data;
  },

  /**
   * Submits candidate code for full deterministic hidden-test grading and AI efficiency analysis.
   */
  async submitSolution(
    payload: SubmitCodePayload
  ): Promise<SubmitSolutionApiResponse> {
    const response = await api.post<SubmitSolutionApiResponse>(
      '/api/submissions',
      {
        assessment_id: payload.assessmentId,
        question_id: payload.questionId,
        language: payload.language,
        code: payload.code,
        elapsed_seconds: payload.elapsedSeconds,
      }
    );
    return response.data;
  },

  /**
   * Retrieves the candidate's most recent graded submission summary.
   * Returns null if no graded submissions exist yet (404).
   */
  async getLatestScoreSummary(): Promise<ScoreSummary | null> {
    try {
      const response = await api.get<LatestScoreApiResponse>(
        '/api/submissions/latest'
      );
      return response.data?.summary ?? null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },
};

