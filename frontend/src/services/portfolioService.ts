import axios from 'axios';
import { api } from './api';
import type {
  PortfolioProfile,
  PortfolioUploadInput,
  PortfolioUploadResponse,
} from '../types/portfolio';

interface PortfolioStatusApiResponse {
  success: boolean;
  portfolio?: PortfolioProfile | null;
}

export const portfolioService = {
  /**
   * Fetches the authenticated candidate's current portfolio profile.
   * Returns null if no portfolio has been uploaded yet (404).
   */
  async getMyPortfolio(): Promise<PortfolioProfile | null> {
    try {
      const response = await api.get<PortfolioStatusApiResponse>(
        '/api/portfolio/me'
      );
      return response.data?.portfolio ?? null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Uploads portfolio metadata and optional resume / project archive files
   * via multipart/form-data to /api/portfolio/upload.
   */
  async uploadPortfolio(
    input: PortfolioUploadInput
  ): Promise<PortfolioUploadResponse> {
    const formData = new FormData();
    formData.append('github_url', input.githubUrl.trim());
    formData.append(
      'primary_languages',
      JSON.stringify(input.primaryLanguages)
    );
    formData.append('frameworks', JSON.stringify(input.frameworks));

    if (input.portfolioNotes?.trim()) {
      formData.append('notes', input.portfolioNotes.trim());
    }
    if (input.resumeFile) {
      formData.append('resume_file', input.resumeFile);
    }
    if (input.projectArchiveFile) {
      formData.append('project_archive', input.projectArchiveFile);
    }

    const response = await api.post<PortfolioUploadResponse>(
      '/api/portfolio/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  },
};
