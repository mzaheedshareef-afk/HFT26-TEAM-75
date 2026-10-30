import axios from 'axios';
import { api } from './api';
import type {
  CandidateEvaluationRecord,
  CompanyDashboardData,
  CompanyOverviewMetrics,
} from '../types/recruiter';

interface RecruiterCandidatesApiResponse {
  success: boolean;
  metrics?: CompanyOverviewMetrics;
  candidates?: CandidateEvaluationRecord[];
}

const EMPTY_METRICS: CompanyOverviewMetrics = {
  total_candidates: 0,
  evaluated_candidates: 0,
  in_progress_candidates: 0,
  average_overall_score: null,
};

export const recruiterService = {
  /**
   * Fetches candidate evaluations and overview metrics for the authenticated company.
   * Returns an empty dataset (never fake candidate rows) when 404 / no evaluations exist yet.
   */
  async getCandidateEvaluations(): Promise<CompanyDashboardData> {
    try {
      const response = await api.get<RecruiterCandidatesApiResponse>(
        '/api/recruiter/candidates'
      );
      const candidates = response.data?.candidates ?? [];
      const metrics = response.data?.metrics ?? {
        total_candidates: candidates.length,
        evaluated_candidates: candidates.filter(
          (c) => c.evaluation_status === 'evaluated'
        ).length,
        in_progress_candidates: candidates.filter(
          (c) => c.evaluation_status === 'in_progress'
        ).length,
        average_overall_score: null,
      };
      return { metrics, candidates };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return {
          metrics: EMPTY_METRICS,
          candidates: [],
        };
      }
      throw error;
    }
  },
};

