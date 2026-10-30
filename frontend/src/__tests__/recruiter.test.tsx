import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import { AuthProvider } from '../context/AuthContext';
import { AppRoutes } from '../App';
import { api } from '../services/api';
import { recruiterService } from '../services/recruiterService';

function createAxiosError(
  status: number,
  data: Record<string, unknown> = { detail: 'Not found' }
): AxiosError {
  const headers = new AxiosHeaders();
  const config = { headers };
  return new AxiosError(
    `Request failed with status code ${status}`,
    status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST',
    config,
    {},
    {
      data,
      status,
      statusText: 'Error',
      headers: {},
      config,
    }
  );
}

function seedCompanySession(
  companyId = 'comp_701',
  companyName = 'Nexus Cloud Labs',
  email = 'talent@nexuscloud.io',
  token = 'JWT_COMPANY_SECRET_999'
) {
  localStorage.setItem('gatecode_access_token', token);
  localStorage.setItem(
    'gatecode_auth_user',
    JSON.stringify({
      id: companyId,
      name: companyName,
      email,
      role: 'company',
    })
  );
}

function seedStudentSession() {
  localStorage.setItem('gatecode_access_token', 'JWT_STUDENT_TOKEN_101');
  localStorage.setItem(
    'gatecode_auth_user',
    JSON.stringify({
      id: 'stu_101',
      name: 'Student Kabir',
      email: 'kabir@university.edu',
      role: 'student',
    })
  );
}

function renderRecruiterRoute(initialEntry: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>
  );
}

const SAMPLE_CANDIDATES = [
  {
    candidate_id: 'cand-aarav',
    share_id: 'aarav-mehta-pub',
    display_name: 'Aarav Mehta',
    headline: 'Distributed Systems & Backend Engineer',
    summary:
      'Built high-throughput event pipelines and fault-tolerant storage services.',
    experience_level: '2 Years Experience',
    domains: ['Distributed Systems', 'Cloud Infrastructure'],
    programming_languages: ['Python', 'Go', 'C++'],
    technical_skills: ['Graph Algorithms', 'System Design', 'Concurrency'],
    frameworks: ['FastAPI', 'Docker', 'PostgreSQL'],
    projects: [
      {
        id: 'proj-raft',
        title: 'Raft Consensus KV Store',
        description: 'Replicated key-value store with log compaction.',
        technologies: ['Go', 'gRPC', 'Docker'],
        repo_url: 'https://github.com/aarav/raft-kv',
        domain: 'Distributed Systems',
      },
      {
        id: 'proj-stream',
        title: 'Async Telemetry Ingestion Engine',
        description: 'Backpressure-aware FastAPI + Redis Streams worker pool.',
        technologies: ['Python', 'FastAPI', 'Redis'],
        domain: 'Cloud Infrastructure',
      },
    ],
    portfolio_available: true,
    portfolio_github_url: 'https://github.com/aarav-mehta',
    portfolio_highlights: [
      'Open-source contributor to async Python tooling',
      'Designed sub-10ms caching layer for campus hackathon',
    ],
    assessments_completed: 6,
    overall_score: 92,
    highest_score: 97,
    coding_score: 94,
    ai_efficiency_score: 91,
    difficulty_level: 'Hard',
    consistency_score: 90,
    consistency_label: 'High',
    improvement_delta: 14.5,
    improvement_trend: 'improving',
    improvement_label: '+14.5%',
    topic_performance: [
      { topic: 'Graph Algorithms', average_score: 95, assessments_count: 3 },
      { topic: 'Dynamic Programming', average_score: 89, assessments_count: 3 },
    ],
    difficulty_performance: [
      { difficulty: 'Medium', average_score: 96, pass_rate: 96 },
      { difficulty: 'Hard', average_score: 88, pass_rate: 85 },
    ],
    verified_achievements: [
      {
        id: 'ach-1',
        title: 'Hard Graph Algorithms Distinction',
        description: 'Passed 100% of hidden sandbox edge cases under time limit.',
        score: 97,
        skill_evidence: 'Shortest paths & topological ordering',
      },
    ],
    updated_at: '2026-10-30T10:00:00Z',
  },
  {
    candidate_id: 'cand-diya',
    display_name: 'Diya Nair',
    headline: 'Full-Stack & Platform Engineer',
    summary: 'Focused on resilient TypeScript & Python web architectures.',
    experience_level: '1 Year Experience',
    domains: ['Web Systems', 'API Security'],
    programming_languages: ['TypeScript', 'Python'],
    technical_skills: ['Data Structures', 'SQL Optimization'],
    frameworks: ['React', 'FastAPI'],
    projects: [
      {
        id: 'proj-auth',
        title: 'Zero-Trust API Gateway',
        description: 'Rate-limited edge proxy with structured audit logs.',
        technologies: ['TypeScript', 'PostgreSQL'],
      },
    ],
    portfolio_available: true,
    portfolio_highlights: [],
    assessments_completed: 4,
    overall_score: 87,
    highest_score: 91,
    coding_score: 88,
    // Backend intentionally returns null to verify frontend NEVER computes AI efficiency client-side
    ai_efficiency_score: null,
    difficulty_level: 'Medium',
    consistency_score: 86,
    consistency_label: 'High',
    improvement_delta: 8.0,
    improvement_trend: 'improving',
    improvement_label: '+8.0%',
    topic_performance: [
      { topic: 'Data Structures', average_score: 88, assessments_count: 2 },
    ],
    difficulty_performance: [
      { difficulty: 'Medium', average_score: 87, pass_rate: 90 },
    ],
    verified_achievements: [],
    updated_at: '2026-10-29T12:00:00Z',
  },
  {
    candidate_id: 'cand-rohan',
    display_name: 'Rohan Kulkarni',
    headline: 'Systems & C++ Performance Engineer',
    summary: 'Low-latency memory allocators and lock-free queues.',
    experience_level: '3 Years Experience',
    domains: ['Systems Programming'],
    programming_languages: ['C++', 'Python'],
    technical_skills: ['Memory Management', 'Bit Manipulation'],
    frameworks: ['CMake', 'Docker'],
    projects: [],
    portfolio_available: false,
    portfolio_highlights: [],
    assessments_completed: 5,
    overall_score: 89,
    highest_score: 93,
    coding_score: 95,
    ai_efficiency_score: 88,
    difficulty_level: 'Hard',
    consistency_score: 84,
    consistency_label: 'Consistent',
    improvement_delta: 4.2,
    improvement_trend: 'steady',
    improvement_label: '+4.2%',
    topic_performance: [
      { topic: 'Graph Algorithms', average_score: 90, assessments_count: 2 },
    ],
    difficulty_performance: [
      { difficulty: 'Hard', average_score: 89, pass_rate: 86 },
    ],
    verified_achievements: [],
    updated_at: '2026-10-28T09:00:00Z',
  },
  {
    candidate_id: 'cand-sana',
    display_name: 'Sana Farooq',
    headline: 'Applied AI & Backend Engineer',
    summary: 'Evaluation harnesses and retrieval pipelines in Python.',
    experience_level: '2 Years Experience',
    domains: ['AI Infrastructure'],
    programming_languages: ['Python', 'Java'],
    technical_skills: ['Dynamic Programming', 'Search Trees'],
    frameworks: ['FastAPI', 'PyTorch'],
    projects: [
      {
        id: 'proj-eval',
        title: 'Deterministic Code Grader',
        description: 'Sandboxed container test runner.',
        technologies: ['Python', 'Docker'],
      },
    ],
    portfolio_available: true,
    portfolio_highlights: [],
    assessments_completed: 5,
    overall_score: 90,
    highest_score: 94,
    coding_score: 90,
    ai_efficiency_score: 93,
    difficulty_level: 'Hard',
    consistency_score: 91,
    consistency_label: 'High',
    improvement_delta: 11.0,
    improvement_trend: 'improving',
    improvement_label: '+11.0%',
    topic_performance: [
      { topic: 'Dynamic Programming', average_score: 92, assessments_count: 3 },
    ],
    difficulty_performance: [
      { difficulty: 'Hard', average_score: 90, pass_rate: 88 },
    ],
    verified_achievements: [],
    updated_at: '2026-10-27T15:00:00Z',
  },
  {
    candidate_id: 'cand-vikram',
    display_name: 'Vikram Rao',
    headline: 'Java Microservices Developer',
    summary: 'Event-driven billing services in Java.',
    experience_level: '1 Year Experience',
    domains: ['FinTech'],
    programming_languages: ['Java'],
    technical_skills: ['REST APIs'],
    frameworks: ['Spring Boot'],
    projects: [],
    portfolio_available: false,
    portfolio_highlights: [],
    assessments_completed: 2,
    overall_score: 79,
    highest_score: 82,
    coding_score: 80,
    ai_efficiency_score: 77,
    difficulty_level: 'Medium',
    consistency_score: 75,
    consistency_label: 'Consistent',
    improvement_delta: 2.0,
    improvement_trend: 'steady',
    improvement_label: '+2.0%',
    topic_performance: [],
    difficulty_performance: [],
    verified_achievements: [],
    updated_at: '2026-10-26T15:00:00Z',
  },
];

describe('GateCode Company Recruiter Dashboard & Candidate Discovery Frontend', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    recruiterService.resetClientGuards();
  });

  it('Scenario 1 & 2: authenticates company login and renders complete Recruiter Dashboard with all 6 sidebar links', async () => {
    const user = userEvent.setup();

    vi.spyOn(api, 'post').mockImplementation(async (url) => {
      if (url === '/api/auth/company/login') {
        return {
          data: {
            success: true,
            access_token: 'JWT_COMPANY_NEXUS',
            token_type: 'bearer',
            user: {
              id: 'comp_701',
              name: 'Nexus Cloud Labs',
              email: 'talent@nexuscloud.io',
              role: 'company',
            },
          },
        };
      }
      throw createAxiosError(404);
    });

    vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (url === '/api/recruiter/dashboard') {
        return {
          data: {
            company_profile: {
              company_id: 'comp_701',
              company_name: 'Nexus Cloud Labs',
              official_email: 'talent@nexuscloud.io',
              industry: 'Cloud Infrastructure & Developer Tools',
              headquarters: 'Hyderabad, India',
              company_size: '51–200 employees',
              website_url: 'https://nexuscloud.io',
              description:
                'Building next-generation distributed storage and observability engines.',
              hiring_domains: ['Distributed Systems', 'Cloud Infrastructure'],
              preferred_languages: ['Go', 'Python', 'C++'],
            },
            total_available_candidates: 48,
            total_shortlisted_candidates: 1,
            recently_added_candidates: [SAMPLE_CANDIDATES[0], SAMPLE_CANDIDATES[1]],
            discovery_activity: [
              {
                id: 'act-1',
                action: 'Candidate Shortlisted',
                description: 'Shortlisted Aarav Mehta for Systems SDE loop',
                timestamp: '2026-10-30T11:00:00Z',
              },
            ],
            saved_searches: [
              {
                id: 'saved-1',
                name: 'Search: Go, Distributed Systems',
                query_string: 'language=Go&domain=Distributed+Systems',
                filters_summary: 'Go · Distributed Systems · Score >= 85',
                created_at: '2026-10-30T09:30:00Z',
              },
            ],
            shortlisted_candidates: [
              {
                shortlist_id: 'sl-1',
                company_id: 'comp_701',
                candidate_id: 'cand-aarav',
                candidate: SAMPLE_CANDIDATES[0],
                private_notes: 'Strong Raft consensus architecture and 94 coding score.',
                added_at: '2026-10-30T10:30:00Z',
                updated_at: '2026-10-30T10:30:00Z',
              },
            ],
            platform_statistics: {
              total_verified_assessments: 312,
              average_assessment_score: 84,
              average_coding_score: 86,
              average_ai_efficiency_score: 89,
              top_verified_skills: ['Graph Algorithms', 'System Design', 'Concurrency'],
            },
          },
        };
      }
      throw createAxiosError(404);
    });

    renderRecruiterRoute('/company/login');

    await user.type(
      screen.getByLabelText(/official email/i),
      'talent@nexuscloud.io'
    );
    await user.type(screen.getByLabelText(/^password$/i), 'NexusPass2026!');
    await user.click(
      screen.getByRole('button', { name: /sign in to company portal/i })
    );

    expect(
      await screen.findByRole('heading', { name: /welcome, nexus cloud labs/i })
    ).toBeInTheDocument();

    // Verify all 6 required sidebar navigation links exist
    const desktopNav = screen.getByRole('navigation', {
      name: /primary recruiter navigation/i,
    });
    expect(within(desktopNav).getByRole('link', { name: /dashboard/i })).toHaveAttribute(
      'href',
      '/company/dashboard'
    );
    expect(
      within(desktopNav).getByRole('link', { name: /find candidates/i })
    ).toHaveAttribute('href', '/company/candidates');
    expect(
      within(desktopNav).getByRole('link', { name: /shortlisted candidates/i })
    ).toHaveAttribute('href', '/company/shortlist');
    expect(
      within(desktopNav).getByRole('link', { name: /candidate comparison/i })
    ).toHaveAttribute('href', '/company/compare');
    expect(
      within(desktopNav).getByRole('link', { name: /company profile/i })
    ).toHaveAttribute('href', '/company/profile');
    expect(
      within(desktopNav).getByRole('link', { name: /account settings/i })
    ).toHaveAttribute('href', '/company/settings');

    // Verify KPI metrics, company profile, saved searches, activity, recently added & shortlisted sections
    const kpiRegion = await screen.findByLabelText(
      /recruiter overview and platform statistics/i
    );
    expect(within(kpiRegion).getByText('48')).toBeInTheDocument();
    expect(within(kpiRegion).getByText('312')).toBeInTheDocument();
    expect(within(kpiRegion).getByText(/avg score: 84%/i)).toBeInTheDocument();

    expect(
      screen.getByText(/building next-generation distributed storage/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText('Search: Go, Distributed Systems')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Shortlisted Aarav Mehta for Systems SDE loop')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Strong Raft consensus architecture and 94 coding score.')
    ).toBeInTheDocument();
  });

  it('Scenario 3, 4, 5 & 13: performs server-side candidate search, 12-criteria filtering, 6-option sorting, pagination, and handles empty search results', async () => {
    const user = userEvent.setup();
    seedCompanySession();

    const requestedUrls: string[] = [];

    vi.spyOn(api, 'get').mockImplementation(async (url) => {
      requestedUrls.push(url);
      if (url.startsWith('/api/recruiter/shortlist')) {
        return { data: { shortlist: [] } };
      }
      if (url.startsWith('/api/recruiter/candidates')) {
        if (url.includes('q=QuantumCobolZeroMatch')) {
          return {
            data: {
              items: [],
              total: 0,
              page: 1,
              page_size: 12,
              total_pages: 0,
            },
          };
        }
        return {
          data: {
            items: [SAMPLE_CANDIDATES[0], SAMPLE_CANDIDATES[1]],
            total: 18,
            page: url.includes('page=2') ? 2 : 1,
            page_size: 12,
            total_pages: 2,
          },
        };
      }
      throw createAxiosError(404);
    });

    const postSpy = vi.spyOn(api, 'post').mockImplementation(async (url, body) => {
      if (url === '/api/recruiter/saved-searches') {
        return {
          data: {
            id: 'saved-99',
            ...(body as Record<string, unknown>),
          },
        };
      }
      throw createAxiosError(404);
    });

    renderRecruiterRoute('/company/candidates');

    // Candidate cards render with verified metrics; Diya's null AI efficiency renders 'Pending' (never client-calculated)
    const aaravCard = await screen.findByRole('article', {
      name: /candidate card for aarav mehta/i,
    });
    expect(within(aaravCard).getByText('92 / 100')).toBeInTheDocument();
    expect(within(aaravCard).getByText('94 / 100')).toBeInTheDocument();
    expect(within(aaravCard).getByText('91 / 100')).toBeInTheDocument();
    expect(within(aaravCard).getByText(/raft consensus kv store/i)).toBeInTheDocument();

    const diyaCard = screen.getByRole('article', {
      name: /candidate card for diya nair/i,
    });
    expect(within(diyaCard).getByText('Pending')).toBeInTheDocument();

    // Populate search + filter fields
    await user.type(
      screen.getByLabelText(/search candidates/i),
      'Distributed'
    );
    await user.type(
      screen.getByLabelText(/programming language/i),
      'Python'
    );
    await user.type(
      screen.getByLabelText(/technical skills/i),
      'Graph Algorithms'
    );
    await user.type(screen.getByLabelText(/frameworks/i), 'FastAPI');
    await user.type(
      screen.getByLabelText(/domain knowledge/i),
      'Distributed Systems'
    );
    await user.selectOptions(
      screen.getByLabelText(/project experience/i),
      '2+'
    );
    await user.type(
      screen.getByLabelText(/minimum assessment score/i),
      '85'
    );
    await user.type(
      screen.getByLabelText(/maximum assessment score/i),
      '99'
    );
    await user.type(screen.getByLabelText(/min coding score/i), '88');
    await user.type(screen.getByLabelText(/min ai efficiency score/i), '85');
    await user.selectOptions(screen.getByLabelText(/difficulty level/i), 'hard');
    await user.selectOptions(
      screen.getByLabelText(/performance consistency/i),
      'high'
    );
    await user.selectOptions(
      screen.getByLabelText(/improvement trend/i),
      'improving'
    );
    await user.click(screen.getByRole('radio', { name: /with portfolio/i }));

    await user.click(screen.getByRole('button', { name: /apply filters/i }));

    await waitFor(() => {
      const latestSearchCall = [...requestedUrls]
        .reverse()
        .find((u) => u.startsWith('/api/recruiter/candidates?'));
      expect(latestSearchCall).toBeDefined();
      expect(latestSearchCall).toContain('q=Distributed');
      expect(latestSearchCall).toContain('language=Python');
      expect(latestSearchCall).toContain('skill=Graph+Algorithms');
      expect(latestSearchCall).toContain('framework=FastAPI');
      expect(latestSearchCall).toContain('domain=Distributed+Systems');
      expect(latestSearchCall).toContain('project_experience=2%2B');
      expect(latestSearchCall).toContain('min_score=85');
      expect(latestSearchCall).toContain('max_score=99');
      expect(latestSearchCall).toContain('min_coding_score=88');
      expect(latestSearchCall).toContain('min_ai_efficiency=85');
      expect(latestSearchCall).toContain('difficulty=hard');
      expect(latestSearchCall).toContain('consistency=high');
      expect(latestSearchCall).toContain('improvement_trend=improving');
      expect(latestSearchCall).toContain('portfolio_only=yes');
    });

    // Save Search preset
    await user.click(screen.getByRole('button', { name: /save search/i }));
    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        '/api/recruiter/saved-searches',
        expect.objectContaining({
          query_string: expect.stringContaining('q=Distributed'),
        })
      );
    });

    // Candidate Sorting + Server-side Pagination
    await user.selectOptions(
      screen.getByLabelText(/sort candidates by/i),
      'highest_coding_score'
    );
    await waitFor(() => {
      expect(
        requestedUrls.some((u) => u.includes('sort_by=highest_coding_score'))
      ).toBe(true);
    });

    await user.click(screen.getByRole('button', { name: /next page/i }));
    await waitFor(() => {
      expect(requestedUrls.some((u) => u.includes('page=2'))).toBe(true);
    });

    // Empty Search Results (Scenario 13) + Reset All Filters
    const searchInput = screen.getByLabelText(/search candidates/i);
    await user.clear(searchInput);
    await user.type(searchInput, 'QuantumCobolZeroMatch');
    await user.click(screen.getByRole('button', { name: /apply filters/i }));

    expect(
      await screen.findByRole('heading', {
        name: /no matching candidates found/i,
      })
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /reset all filters/i })
    );
    expect(
      await screen.findByRole('article', {
        name: /candidate card for aarav mehta/i,
      })
    ).toBeInTheDocument();
  });

  it('Scenario 6: renders Candidate Profile Details distinguishing Verified vs Self-Reported data, strips private leaks, and blocks private profiles', async () => {
    seedCompanySession();

    vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (url === '/api/recruiter/shortlist') {
        return { data: { shortlist: [] } };
      }
      if (url === '/api/recruiter/candidates/cand-aarav') {
        return {
          data: {
            ...SAMPLE_CANDIDATES[0],
            // Accidental backend leak fields that MUST never appear in recruiter DOM
            email: 'aarav.private.personal@gmail.com',
            raw_code: 'def secret_student_solution(): pass',
            summary:
              'Distributed systems builder eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
          },
        };
      }
      if (url === '/api/recruiter/candidates/cand-private') {
        return {
          data: {
            candidate_id: 'cand-private',
            display_name: 'Hidden Student',
            visibility: 'private',
          },
        };
      }
      throw createAxiosError(404);
    });

    const { unmount } = renderRecruiterRoute('/company/candidates/cand-aarav');

    expect(
      await screen.findByRole('heading', { name: 'Aarav Mehta' })
    ).toBeInTheDocument();

    // Provenance distinction between Verified Platform Results and Self-Reported Information
    expect(
      screen.getByText(/verified platform results: docker-graded scores/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/self-reported portfolio information/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /verified assessment performance/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Hard Graph Algorithms Distinction')
    ).toBeInTheDocument();
    expect(screen.getByText('Raft Consensus KV Store')).toBeInTheDocument();

    // Ensure private student email, raw code, and leaked JWT are stripped
    expect(
      screen.queryByText(/aarav\.private\.personal@gmail\.com/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/secret_student_solution/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/eyJhbGciOiJIUzI1NiIs/i)).not.toBeInTheDocument();

    unmount();

    // Verify private student profile is blocked
    renderRecruiterRoute('/company/candidates/cand-private');
    expect(
      await screen.findByRole('heading', {
        name: /candidate profile not permitted for recruiter viewing/i,
      })
    ).toBeInTheDocument();
    expect(screen.queryByText('Hidden Student')).not.toBeInTheDocument();
  });

  it('Scenario 7: compares up to 4 candidates side by side with neutral evidence and enforces the 4-candidate limit', async () => {
    const user = userEvent.setup();
    seedCompanySession();

    vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (url.startsWith('/api/recruiter/shortlist')) {
        return { data: { shortlist: [] } };
      }
      if (url.startsWith('/api/recruiter/candidates')) {
        return {
          data: {
            items: SAMPLE_CANDIDATES,
            total: 5,
            page: 1,
            page_size: 12,
            total_pages: 1,
          },
        };
      }
      throw createAxiosError(404);
    });

    vi.spyOn(api, 'post').mockImplementation(async (url, body) => {
      if (url === '/api/recruiter/compare') {
        const ids = (body as { candidate_ids: string[] }).candidate_ids;
        return {
          data: {
            candidates: SAMPLE_CANDIDATES.filter((c) =>
              ids.includes(c.candidate_id)
            ),
          },
        };
      }
      throw createAxiosError(404);
    });

    // First verify 4-candidate maximum enforcement on Candidate Discovery
    const { unmount } = renderRecruiterRoute('/company/candidates');
    await screen.findByRole('article', {
      name: /candidate card for aarav mehta/i,
    });

    await user.click(
      screen.getByRole('button', { name: /add aarav mehta to comparison/i })
    );
    await user.click(
      screen.getByRole('button', { name: /add diya nair to comparison/i })
    );
    await user.click(
      screen.getByRole('button', { name: /add rohan kulkarni to comparison/i })
    );
    await user.click(
      screen.getByRole('button', { name: /add sana farooq to comparison/i })
    );

    expect(
      screen.getByRole('link', { name: /open comparison \(4\/4\)/i })
    ).toBeInTheDocument();

    // Attempting to add a 5th candidate displays limit notice and keeps tray at 4/4
    await user.click(
      screen.getByRole('button', { name: /add vikram rao to comparison/i })
    );
    expect(
      await screen.findByText(/comparison supports up to 4 candidates at once/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open comparison \(4\/4\)/i })
    ).toBeInTheDocument();

    unmount();

    // Render Comparison Dashboard with all 4 selected candidates
    renderRecruiterRoute(
      '/company/compare?ids=cand-aarav,cand-diya,cand-rohan,cand-sana'
    );

    expect(
      await screen.findByRole('heading', {
        name: /structured side-by-side comparison matrix/i,
      })
    ).toBeInTheDocument();

    // Verify neutral evidence-based notice (never declares an objective winner)
    expect(
      screen.getByText(
        /the platform does not rank or declare one candidate objectively better/i
      )
    ).toBeInTheDocument();

    // Verify charts and all 11 comparison rows exist
    expect(
      screen.getByRole('img', {
        name: /multi-candidate verified score comparison chart/i,
      })
    ).toBeInTheDocument();

    const matrix = screen.getByRole('table', {
      name: /side-by-side candidate comparison table/i,
    });
    expect(
      within(matrix).getByRole('rowheader', {
        name: /assessment scores \(verified\)/i,
      })
    ).toBeInTheDocument();
    expect(
      within(matrix).getByRole('rowheader', {
        name: /coding scores \(verified\)/i,
      })
    ).toBeInTheDocument();
    expect(
      within(matrix).getByRole('rowheader', { name: /ai efficiency score/i })
    ).toBeInTheDocument();
    expect(
      within(matrix).getByRole('rowheader', {
        name: /performance consistency/i,
      })
    ).toBeInTheDocument();
    expect(
      within(matrix).getByRole('rowheader', { name: /improvement trend/i })
    ).toBeInTheDocument();
    expect(
      within(matrix).getByRole('rowheader', { name: /topic-wise performance/i })
    ).toBeInTheDocument();
    expect(
      within(matrix).getByRole('rowheader', {
        name: /difficulty-wise performance/i,
      })
    ).toBeInTheDocument();
    expect(
      within(matrix).getByRole('rowheader', { name: /programming languages/i })
    ).toBeInTheDocument();
    expect(
      within(matrix).getByRole('rowheader', { name: /technical skills/i })
    ).toBeInTheDocument();
    expect(
      within(matrix).getByRole('rowheader', { name: /frameworks & tooling/i })
    ).toBeInTheDocument();
    expect(
      within(matrix).getByRole('rowheader', {
        name: /project experience \(self-reported\)/i,
      })
    ).toBeInTheDocument();
  });

  it('Scenario 8, 9 & 10: adds candidate to shortlist (preventing duplicates), updates private recruiter notes, and removes from shortlist', async () => {
    const user = userEvent.setup();
    seedCompanySession();

    const shortlistStore = [
      {
        shortlist_id: 'sl-diya',
        company_id: 'comp_701',
        candidate_id: 'cand-diya',
        candidate: SAMPLE_CANDIDATES[1],
        private_notes: 'Initial frontend + API screen note.',
        added_at: '2026-10-29T10:00:00Z',
        updated_at: '2026-10-29T10:00:00Z',
      },
    ];

    vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (url.startsWith('/api/recruiter/shortlist')) {
        return { data: { shortlist: shortlistStore } };
      }
      if (url.startsWith('/api/recruiter/candidates')) {
        return {
          data: {
            items: [SAMPLE_CANDIDATES[0], SAMPLE_CANDIDATES[1]],
            total: 2,
            page: 1,
            page_size: 12,
            total_pages: 1,
          },
        };
      }
      throw createAxiosError(404);
    });

    const postSpy = vi
      .spyOn(api, 'post')
      .mockImplementation(async (url, body) => {
        if (url === '/api/recruiter/shortlist') {
          const payload = body as { candidate_id: string; private_notes: string };
          const created = {
            shortlist_id: `sl-${payload.candidate_id}`,
            company_id: 'comp_701',
            candidate_id: payload.candidate_id,
            candidate: SAMPLE_CANDIDATES[0],
            private_notes: payload.private_notes,
            added_at: '2026-10-31T01:00:00Z',
            updated_at: '2026-10-31T01:00:00Z',
          };
          shortlistStore.unshift(created);
          return { data: { entry: created } };
        }
        throw createAxiosError(404);
      });

    const patchSpy = vi
      .spyOn(api, 'patch')
      .mockImplementation(async (url, body) => {
        if (url === '/api/recruiter/shortlist/cand-aarav/notes') {
          const notes = (body as { private_notes: string }).private_notes;
          shortlistStore[0].private_notes = notes;
          return {
            data: {
              candidate_id: 'cand-aarav',
              private_notes: notes,
              updated_at: '2026-10-31T02:00:00Z',
            },
          };
        }
        throw createAxiosError(404);
      });

    const deleteSpy = vi
      .spyOn(api, 'delete')
      .mockImplementation(async (url) => {
        if (url === '/api/recruiter/shortlist/cand-diya') {
          const idx = shortlistStore.findIndex(
            (i) => i.candidate_id === 'cand-diya'
          );
          if (idx >= 0) shortlistStore.splice(idx, 1);
          return { data: { success: true } };
        }
        throw createAxiosError(404);
      });

    const { unmount } = renderRecruiterRoute('/company/candidates');

    // Scenario 8: Add Aarav Mehta to shortlist
    const shortlistAaravBtn = await screen.findByRole('button', {
      name: /shortlist aarav mehta/i,
    });
    await user.click(shortlistAaravBtn);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        '/api/recruiter/shortlist',
        expect.objectContaining({ candidate_id: 'cand-aarav' })
      );
    });
    expect(
      await screen.findByRole('button', {
        name: /remove aarav mehta from shortlist/i,
      })
    ).toBeInTheDocument();

    // Direct duplicate shortlist call is blocked client-side without duplicate POST
    await expect(
      recruiterService.addToShortlist({ candidateId: 'cand-aarav' })
    ).rejects.toThrow(/already in your company shortlist/i);
    expect(postSpy).toHaveBeenCalledTimes(1);

    unmount();

    // Visit Shortlisted Candidates page for Scenario 10 (Notes) & Scenario 9 (Remove)
    renderRecruiterRoute('/company/shortlist');

    const aaravNoteField = await screen.findByLabelText(
      /private recruiter notes for aarav mehta/i
    );
    await user.clear(aaravNoteField);
    await user.type(
      aaravNoteField,
      'Confidential: Advance directly to distributed systems architecture interview.'
    );
    await user.click(
      screen.getByRole('button', { name: /save notes for aarav mehta/i })
    );

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith(
        '/api/recruiter/shortlist/cand-aarav/notes',
        expect.objectContaining({
          private_notes:
            'Confidential: Advance directly to distributed systems architecture interview.',
        })
      );
    });
    expect(
      await screen.findByText(/private recruiter notes updated/i)
    ).toBeInTheDocument();

    // Scenario 9: Remove Diya Nair from shortlist
    await user.click(
      screen.getByRole('button', { name: /remove diya nair from shortlist/i })
    );

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith(
        '/api/recruiter/shortlist/cand-diya'
      );
    });
    expect(
      await screen.findByText(/removed diya nair from your company shortlist/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('article', {
        name: /shortlisted candidate diya nair/i,
      })
    ).not.toBeInTheDocument();
  });

  it('Scenario 11: validates and updates Company Profile, updates Account Settings without exposing credentials, and logs out cleanly', async () => {
    const user = userEvent.setup();
    seedCompanySession(
      'comp_701',
      'Nexus Cloud Labs',
      'talent@nexuscloud.io',
      'JWT_SUPER_SECRET_NEVER_EXPOSE'
    );

    vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (url === '/api/recruiter/company/profile') {
        return {
          data: {
            company_id: 'comp_701',
            company_name: 'Nexus Cloud Labs',
            official_email: 'talent@nexuscloud.io',
            industry: 'Cloud Infrastructure',
            company_size: '51–200 employees',
            headquarters: 'Hyderabad',
            website_url: 'https://nexuscloud.io',
            description: 'Cloud infrastructure team.',
            hiring_domains: ['Distributed Systems'],
            target_roles: ['Systems Engineer'],
            preferred_languages: ['Go', 'Python'],
            default_discovery_view: 'cards',
            notification_preferences: {
              shortlist_alerts: true,
              weekly_talent_digest: true,
              assessment_completion_updates: true,
            },
          },
        };
      }
      throw createAxiosError(404);
    });

    const putSpy = vi.spyOn(api, 'put').mockImplementation(async (url, body) => {
      if (url === '/api/recruiter/company/profile') {
        return {
          data: {
            company_id: 'comp_701',
            official_email: 'talent@nexuscloud.io',
            ...(body as Record<string, unknown>),
          },
        };
      }
      throw createAxiosError(404);
    });

    const patchSpy = vi
      .spyOn(api, 'patch')
      .mockImplementation(async (url, body) => {
        if (url === '/api/recruiter/company/settings') {
          return {
            data: {
              company_id: 'comp_701',
              company_name: 'Nexus Cloud Systems',
              official_email: 'talent@nexuscloud.io',
              ...(body as Record<string, unknown>),
            },
          };
        }
        throw createAxiosError(404);
      });

    const { unmount } = renderRecruiterRoute('/company/profile');

    const nameInput = await screen.findByLabelText(/company name/i);
    const websiteInput = screen.getByLabelText(/official website url/i);

    // Deferred blur validation & immediate reset on input
    await user.clear(websiteInput);
    await user.type(websiteInput, 'not-a-valid-url');
    expect(
      screen.queryByText(/please enter a valid http/i)
    ).not.toBeInTheDocument();
    await user.tab();
    expect(
      screen.getByText(/please enter a valid http/i)
    ).toBeInTheDocument();

    await user.clear(websiteInput);
    await user.type(websiteInput, 'https://engineering.nexuscloud.io');
    expect(
      screen.queryByText(/please enter a valid http/i)
    ).not.toBeInTheDocument();

    await user.clear(nameInput);
    await user.type(nameInput, 'Nexus Cloud Systems');
    await user.click(
      screen.getByRole('button', { name: /save company profile/i })
    );

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        '/api/recruiter/company/profile',
        expect.objectContaining({
          company_name: 'Nexus Cloud Systems',
          website_url: 'https://engineering.nexuscloud.io',
        })
      );
    });
    expect(
      await screen.findByText(/company profile updated successfully/i)
    ).toBeInTheDocument();

    unmount();

    // Account Settings: verify credentials are NEVER exposed, save settings, and log out
    renderRecruiterRoute('/company/settings');

    expect(
      await screen.findByText('talent@nexuscloud.io')
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/JWT_SUPER_SECRET_NEVER_EXPOSE/)
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('radio', { name: /structured comparison table/i })
    );
    await user.click(
      screen.getByRole('button', { name: /save workspace settings/i })
    );

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith(
        '/api/recruiter/company/settings',
        expect.objectContaining({
          default_discovery_view: 'table',
        })
      );
    });
    expect(
      await screen.findByText(/company recruiter settings saved successfully/i)
    ).toBeInTheDocument();

    // Log out clears company session and redirects to company login page
    await user.click(
      screen.getByRole('button', { name: /log out of company account/i })
    );
    expect(localStorage.getItem('gatecode_access_token')).toBeNull();
    expect(
      await screen.findByRole('heading', {
        name: /sign in to company portal/i,
      })
    ).toBeInTheDocument();
  });

  it('Scenario 12: blocks unauthorized student users and unauthenticated visitors from all company recruiter routes', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(createAxiosError(404));

    const protectedCompanyRoutes = [
      '/company/dashboard',
      '/company/candidates',
      '/company/candidates/cand-aarav',
      '/company/shortlist',
      '/company/compare',
      '/company/profile',
      '/company/settings',
    ];

    // 1. Authenticated student is redirected to /student/dashboard on every company route
    seedStudentSession();
    for (const route of protectedCompanyRoutes) {
      const { unmount } = renderRecruiterRoute(route);
      expect(
        await screen.findByRole('heading', { name: /welcome, student kabir/i })
      ).toBeInTheDocument();
      expect(screen.queryByText(/company portal/i)).not.toBeInTheDocument();
      unmount();
    }

    // 2. Unauthenticated visitor is redirected to /company/login
    localStorage.clear();
    renderRecruiterRoute('/company/candidates');
    expect(
      await screen.findByRole('heading', {
        name: /sign in to company portal/i,
      })
    ).toBeInTheDocument();
  });

  it('Scenario 14: supports mobile recruiter navigation drawer toggle and keyboard-scrollable responsive table layout', async () => {
    const user = userEvent.setup();
    seedCompanySession();

    vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (url.startsWith('/api/recruiter/shortlist')) {
        return { data: { shortlist: [] } };
      }
      if (url.startsWith('/api/recruiter/candidates')) {
        return {
          data: {
            items: [SAMPLE_CANDIDATES[0]],
            total: 1,
            page: 1,
            page_size: 12,
            total_pages: 1,
          },
        };
      }
      throw createAxiosError(404);
    });

    renderRecruiterRoute('/company/candidates');

    await screen.findByRole('article', {
      name: /candidate card for aarav mehta/i,
    });

    // Mobile quick navigation strip is accessible
    expect(
      screen.getByRole('navigation', { name: /mobile recruiter navigation/i })
    ).toBeInTheDocument();

    // Mobile expandable sidebar button toggles aria-expanded and reveals drawer navigation
    const openMenuBtn = screen.getByRole('button', {
      name: /open recruiter sidebar/i,
    });
    expect(openMenuBtn).toHaveAttribute('aria-expanded', 'false');

    await user.click(openMenuBtn);

    const closeMenuBtn = screen.getByRole('button', {
      name: /close recruiter sidebar/i,
    });
    expect(closeMenuBtn).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('navigation', {
        name: /mobile recruiter drawer navigation/i,
      })
    ).toBeInTheDocument();

    // Switch Candidate Discovery from Cards to responsive Table layout
    await user.click(screen.getByRole('button', { name: /^table$/i }));

    const tableScrollRegion = screen.getByRole('region', {
      name: /candidate discovery results table/i,
    });
    expect(tableScrollRegion).toHaveAttribute('tabindex', '0');
    expect(
      within(tableScrollRegion).getByRole('rowheader', {
        name: /aarav mehta/i,
      })
    ).toBeInTheDocument();
  });
});

