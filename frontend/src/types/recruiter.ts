import type { ScoreSummary } from './assessment';
import type { PortfolioIngestionStatus } from './portfolio';

export type CandidateEvaluationStatus =
  | 'awaiting_portfolio'
  | 'ready_for_assessment'
  | 'in_progress'
  | 'evaluated';

export interface CandidateEvaluationRecord {
  candidate_id: string;
  full_name: string;
  email: string;
  github_url?: string | null;
  primary_stack: string[];
  portfolio_status: PortfolioIngestionStatus;
  evaluation_status: CandidateEvaluationStatus;
  latest_score?: ScoreSummary | null;
  updated_at?: string;
}

export interface CompanyOverviewMetrics {
  total_candidates: number;
  evaluated_candidates: number;
  in_progress_candidates: number;
  average_overall_score: number | null;
}

export interface CompanyDashboardData {
  metrics: CompanyOverviewMetrics;
  candidates: CandidateEvaluationRecord[];
}
