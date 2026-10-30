export type PortfolioIngestionStatus =
  | 'not_uploaded'
  | 'pending'
  | 'analyzing'
  | 'ready'
  | 'failed';

export interface PortfolioRepositorySummary {
  name: string;
  url: string;
  primaryLanguage?: string;
}

export interface PortfolioProfile {
  id: string;
  githubUrl: string;
  resumeFileName?: string | null;
  projectArchiveName?: string | null;
  primaryLanguages: string[];
  frameworks: string[];
  status: PortfolioIngestionStatus;
  updatedAt?: string;
  repositories?: PortfolioRepositorySummary[];
  summaryNote?: string;
}

export interface PortfolioUploadInput {
  githubUrl: string;
  primaryLanguages: string[];
  frameworks: string[];
  portfolioNotes?: string;
  resumeFile?: File | null;
  projectArchiveFile?: File | null;
}

export interface PortfolioUploadResponse {
  success: boolean;
  portfolio?: PortfolioProfile;
  message?: string;
}
