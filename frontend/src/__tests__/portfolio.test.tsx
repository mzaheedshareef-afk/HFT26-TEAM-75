import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { PortfolioPage } from '../pages/student/PortfolioPage';
import { PortfolioUploadForm, validateGithubUrl } from '../components/portfolio/PortfolioUploadForm';
import { portfolioService } from '../services/portfolioService';
import type { PortfolioProfile } from '../types/portfolio';

// Mock dependencies
vi.mock('../services/portfolioService', () => ({
  portfolioService: {
    getMyPortfolio: vi.fn(),
    uploadPortfolio: vi.fn(),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', name: 'Test Candidate', email: 'test@candidate.com', role: 'student' },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }),
}));

describe('Portfolio Module Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PortfolioUploadForm validation', () => {
    it('validates github URL correctly', () => {
      expect(validateGithubUrl('')).toContain('required');
      expect(validateGithubUrl('invalid-url')).toContain('valid GitHub URL');
      expect(validateGithubUrl('https://gitlab.com/username')).toContain('valid GitHub URL');
      expect(validateGithubUrl('https://github.com/username')).toBeUndefined();
      expect(validateGithubUrl('https://github.com/username/repo-name')).toBeUndefined();
    });

    it('submits valid form data to onSubmit callback', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();

      render(
        <PortfolioUploadForm
          onSubmit={handleSubmit}
          initialGithubUrl="https://github.com/testcandidate"
          initialLanguages={['Python']}
          initialFrameworks={['FastAPI']}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Save & Analyze Portfolio/i });
      await user.click(submitButton);

      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          githubUrl: 'https://github.com/testcandidate',
          primaryLanguages: ['Python'],
          frameworks: ['FastAPI'],
        })
      );
    });
  });

  describe('PortfolioPage integration', () => {
    it('shows empty state when no portfolio exists initially', async () => {
      vi.mocked(portfolioService.getMyPortfolio).mockResolvedValueOnce(null);

      render(
        <MemoryRouter>
          <PortfolioPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/No portfolio record on file/i)).toBeInTheDocument();
        expect(screen.getByText(/Not Uploaded/i)).toBeInTheDocument();
      });
    });

    it('renders existing portfolio details when available', async () => {
      const mockProfile: PortfolioProfile = {
        id: 'port-123',
        githubUrl: 'https://github.com/testcandidate/awesome-repo',
        primaryLanguages: ['Python', 'TypeScript'],
        frameworks: ['FastAPI', 'React'],
        status: 'ready',
        updatedAt: '2026-10-31T01:00:00Z',
      };
      vi.mocked(portfolioService.getMyPortfolio).mockResolvedValueOnce(mockProfile);

      render(
        <MemoryRouter>
          <PortfolioPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Calibrated & Ready')).toBeInTheDocument();
        expect(screen.getByText('https://github.com/testcandidate/awesome-repo')).toBeInTheDocument();
        expect(screen.getAllByText('Python').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('TypeScript').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('handles portfolio upload and updates view on success', async () => {
      const user = userEvent.setup();
      vi.mocked(portfolioService.getMyPortfolio).mockResolvedValueOnce(null);

      const mockSavedProfile: PortfolioProfile = {
        id: 'port-999',
        githubUrl: 'https://github.com/uploaded/repo',
        primaryLanguages: ['Python'],
        frameworks: ['FastAPI'],
        status: 'ready',
        updatedAt: '2026-10-31T01:05:00Z',
      };
      vi.mocked(portfolioService.uploadPortfolio).mockResolvedValueOnce({
        success: true,
        portfolio: mockSavedProfile,
        message: 'Portfolio submitted successfully for adaptive assessment calibration.',
      });

      render(
        <MemoryRouter>
          <PortfolioPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/No portfolio record on file/i)).toBeInTheDocument();
      });

      const githubInput = screen.getByLabelText(/GitHub profile or repository URL/i);
      await user.type(githubInput, 'https://github.com/uploaded/repo');

      // Select Python checkbox
      const pythonCheckbox = screen.getByLabelText('Python');
      await user.click(pythonCheckbox);

      const submitBtn = screen.getByRole('button', { name: /Save & Analyze Portfolio/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(portfolioService.uploadPortfolio).toHaveBeenCalled();
        expect(
          screen.getByText(/Portfolio submitted successfully for adaptive assessment calibration/i)
        ).toBeInTheDocument();
      });
    });
  });
});
