// TypeScript API Contracts for Portfolio Module
// Unified between Zaheed's Frontend and Vasil's FastAPI Backend

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
  stars?: number;
  description?: string;
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
  experience_level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  recommended_tracks?: string[];
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
  error?: {
    code: string;
    message: string;
  };
}

export interface SkillItem {
  name: string;
  category: 'language' | 'framework' | 'database' | 'tool' | 'concept';
  proficiency?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  years_of_experience?: number;
}

export interface ProjectItem {
  title: string;
  description: string;
  tech_stack: string[];
  repo_url?: string;
  live_url?: string;
  highlights?: string[];
}

export interface ExperienceItem {
  company: string;
  role: string;
  start_date: string;
  end_date?: string;
  current?: boolean;
  description?: string;
}

export interface EducationItem {
  institution: string;
  degree: string;
  field_of_study: string;
  graduation_year?: number;
}

export interface PortfolioUploadPayload {
  headline?: string;
  bio?: string;
  github_username?: string;
  linkedin_url?: string;
  skills: SkillItem[];
  projects: ProjectItem[];
  experience?: ExperienceItem[];
  education?: EducationItem[];
  certifications?: string[];
}

export interface ParsedSkillVector {
  languages: string[];
  frameworks: string[];
  databases: string[];
  tools: string[];
  primary_focus: string;
}

export interface PortfolioDetail {
  id: string;
  user_id: string;
  headline?: string;
  bio?: string;
  github_username?: string;
  linkedin_url?: string;
  experience_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  skill_vector: ParsedSkillVector;
  projects: ProjectItem[];
  recommended_tracks: string[];
  created_at: string;
  updated_at: string;
}

export interface PortfolioResponse {
  success: boolean;
  portfolio: PortfolioProfile;
}
