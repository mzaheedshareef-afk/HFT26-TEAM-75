import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import { AuthProvider } from '../context/AuthContext';
import { AppRoutes } from '../App';
import { api } from '../services/api';

function seedAuthenticatedStudent() {
  localStorage.setItem('gatecode_access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdHVkZW50XzEwMSJ9.SECRET_SIGNATURE');
  localStorage.setItem(
    'gatecode_auth_user',
    JSON.stringify({
      id: 'student_101',
      name: 'Zaheed Shareef',
      email: 'zaheed.private@cbit.ac.in',
      role: 'student',
    })
  );
}

function renderAtRoute(initialRoute: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>
  );
}

function createAxiosError(
  status?: number,
  data?: Record<string, unknown>
): AxiosError {
  const headers = new AxiosHeaders();
  const config = { headers };

  if (status === undefined) {
    return new AxiosError('Network Error', 'ERR_NETWORK', config);
  }

  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST',
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

const workspaceAssessmentFixture = {
  id: 'assess-ai-75',
  user_id: 'student_101',
  title: 'Distributed Systems & Graph Optimization Assessment',
  target_role: 'Systems Engineer',
  difficulty: 'hard',
  status: 'in_progress',
  total_time_limit_minutes: 60,
  question_count: 2,
  allowed_languages: ['python', 'java', 'cpp'],
  questions: [
    {
      id: 'q-dijkstra',
      title: 'Latency-Aware Multi-Hop Routing',
      description:
        'Compute minimum end-to-end packet latency across weighted microservice edges.',
      difficulty: 'hard',
      category: 'Graph Algorithms',
      target_skill: 'Shortest Paths',
      starter_code: {
        python: 'def min_latency(n, edges):\n    # write code\n    return -1\n',
      },
      sample_test_cases: [
        {
          input: '3\n0 1 4\n1 2 5',
          expected_output: '9',
        },
      ],
      total_test_cases_count: 8,
      hidden_test_cases_count: 7,
      time_limit_seconds: 2.0,
      memory_limit_mb: 256,
    },
    {
      id: 'q-lru-cache',
      title: 'Thread-Safe Segmented LRU Cache',
      description:
        'Design an O(1) get/put LRU eviction structure for high-throughput RPC metadata.',
      difficulty: 'medium',
      category: 'Data Structures',
      starter_code: {
        python: 'class SegmentedLRU:\n    pass\n',
      },
      sample_test_cases: [
        {
          input: 'PUT a 1\nGET a',
          expected_output: '1',
        },
      ],
      time_limit_seconds: 1.5,
      memory_limit_mb: 256,
    },
  ],
};

const fullAnalyticsFixture = {
  success: true,
  analytics: {
    overall_score: 87,
    coding_score: 91,
    ai_efficiency_score: 84,
    total_assessments_completed: 4,
    total_assessments_assigned: 5,
    average_score: 85,
    highest_score: 96,
    completion_rate: 80,
    correct_test_cases: 41,
    failed_test_cases: 4,
    total_test_cases: 45,
    average_completion_time_seconds: 1650, // 27m 30s
    improvement_percentage: 14.5,
    improvement_label: 'Strong upward trajectory across 4 sessions',
    consistency_score: 89,
    consistency_label: 'High cross-assessment stability',
    ai_interaction: {
      total_hint_requests: 3,
      hint_levels_used: [1, 2],
      used_or_viewed_hints: true,
      hints_viewed_count: 3,
      ai_assistance_usage_label: 'Selective conceptual & algorithmic hints',
      coding_score: 91,
      ai_efficiency_score: 84,
    },
    score_trend: [
      {
        assessment_id: 'a-1',
        assessment_title: 'Foundations & Arrays',
        date: '2026-10-10T10:00:00Z',
        overall_score: 76,
        coding_score: 78,
        ai_efficiency_score: 72,
        completion_status: 'completed',
      },
      {
        assessment_id: 'a-2',
        assessment_title: 'Async Python Services',
        date: '2026-10-20T10:00:00Z',
        overall_score: 88,
        coding_score: 91,
        ai_efficiency_score: 84,
        completion_status: 'completed',
      },
      {
        assessment_id: 'a-3',
        assessment_title: 'Distributed Graph Systems',
        date: '2026-10-29T10:00:00Z',
        overall_score: 96,
        coding_score: 98,
        ai_efficiency_score: null,
        completion_status: 'completed',
      },
    ],
    topic_performance: [
      {
        topic: 'Graph Algorithms',
        average_score: 92,
        assessments_count: 2,
      },
      {
        topic: 'Concurrency & Async Systems',
        average_score: 86,
        assessments_count: 3,
      },
    ],
    difficulty_performance: [
      {
        difficulty: 'Easy',
        average_score: 95,
        pass_rate: 100,
        attempts_count: 2,
      },
      {
        difficulty: 'Medium',
        average_score: 87,
        pass_rate: 85,
        attempts_count: 3,
      },
      {
        difficulty: 'Hard',
        average_score: 79,
        pass_rate: 70,
        attempts_count: 2,
      },
    ],
    recent_history: [
      {
        assessment_id: 'a-3',
        title: 'Distributed Graph Systems',
        date: '2026-10-29T10:00:00Z',
        overall_score: 96,
        coding_score: 98,
        ai_efficiency_score: 93,
        duration_seconds: 1520,
        question_count: 3,
        completion_status: 'completed',
        difficulty: 'Hard',
        topics: ['Graph Algorithms', 'Distributed Systems'],
        hints_used: 1,
      },
      {
        assessment_id: 'a-2',
        title: 'Async Python Services',
        date: '2026-10-20T10:00:00Z',
        overall_score: 88,
        coding_score: 91,
        ai_efficiency_score: 84,
        duration_seconds: 1780,
        question_count: 2,
        completion_status: 'partially_completed',
        difficulty: 'Medium',
        topics: ['FastAPI', 'Asyncio'],
        hints_used: 2,
      },
    ],
  },
};

const studentProfileFixture = {
  success: true,
  profile: {
    profile_id: 'prof-75',
    display_name: 'Zaheed Shareef',
    headline: 'Backend & Distributed Systems Engineer',
    summary:
      'Building adaptive technical evaluation systems, Docker sandboxes, and resilient FastAPI microservices.',
    skills: ['Python', 'TypeScript', 'Distributed Systems'],
    technologies: ['FastAPI', 'React', 'Docker', 'PostgreSQL'],
    projects: [
      {
        id: 'proj-gatecode',
        title: 'GateCode Adaptive Sandbox',
        description:
          'Isolated container execution and portfolio-calibrated coding assessments.',
        technologies: ['Python', 'FastAPI', 'Docker'],
        repo_url: 'https://github.com/mzaheedshareef-afk/HFT26-TEAM-75',
      },
    ],
    portfolio_info: {
      github_url: 'https://github.com/mzaheedshareef-afk',
      linkedin_url: 'https://linkedin.com/in/zaheed-shareef',
      experience_level: 'advanced',
      calibrated_tracks: ['Backend Engineering', 'Distributed Systems'],
    },
    assessment_performance: {
      total_assessments_completed: 4,
      average_score: 85,
      highest_score: 96,
      coding_score: 91,
      ai_efficiency_score: 84,
      completion_rate: 80,
    },
    verified_achievements: [
      {
        id: 'ach-1',
        title: '95+ Distinction in Graph Algorithms',
        description: 'Solved weighted multi-hop routing with optimal O(E log V) complexity.',
        category: 'assessment',
      },
    ],
    consistency: {
      score: 89,
      label: 'High Stability',
      summary: 'Low variance across 4 timed technical assessments.',
    },
    improvement: {
      delta_percentage: 14.5,
      label: 'Accelerating Mastery',
      summary: '+14.5% composite score gain over baseline session.',
    },
    visibility: 'private',
    is_sharing_enabled: false,
    share_slug: null,
    share_url: null,
  },
};

describe('AI Intelligence, Analytics & Student Profile Frontend Modules', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('1. opens per-question AI hint panel and requests hints without leaving the coding workspace while continuing to code', async () => {
    const user = userEvent.setup();
    seedAuthenticatedStudent();

    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/assessment/assess-ai-75') {
        return {
          data: {
            success: true,
            assessment: workspaceAssessmentFixture,
          },
        };
      }
      if (url.startsWith('/api/assistant/hints')) {
        return { data: { hints: [] } };
      }
      throw createAxiosError(404);
    });

    const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
      data: {
        success: true,
        hint: {
          hint_id: 'h-tier-1',
          question_id: 'q-dijkstra',
          level: 1,
          category_label: 'Hint 1 · Conceptual Direction',
          content:
            'Model each microservice as a graph vertex and each RPC hop latency as a non-negative directed edge weight.',
          created_at: '2026-10-31T02:00:00Z',
        },
      },
    });

    renderAtRoute('/student/assessment/assess-ai-75/workspace');

    expect(
      await screen.findByRole('heading', {
        name: /Latency-Aware Multi-Hop Routing/i,
      })
    ).toBeInTheDocument();

    // Per-question AI Hint button is present in the coding question header
    const questionHintBtn = screen.getByRole('button', {
      name: /Open AI Hint Assistant for Latency-Aware Multi-Hop Routing/i,
    });
    expect(questionHintBtn).toHaveTextContent('AI Hint (0/3)');
    await user.click(questionHintBtn);

    // Request Hint 1 (Conceptual Direction)
    await user.click(
      screen.getByRole('button', { name: /Request Hint \(Tier 1\)/i })
    );

    expect(
      await screen.findByText(/Model each microservice as a graph vertex/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Requested Hint 1:/i)).toBeInTheDocument();
    expect(screen.getByText('Hints Used: 1 / 3')).toBeInTheDocument();
    expect(questionHintBtn).toHaveTextContent('AI Hint (1/3)');

    // Student continues coding seamlessly while viewing hints
    const editor = screen.getByLabelText(/solution code editor/i);
    await user.click(editor);
    await user.paste('\n# implementing min-heap');
    expect((editor as HTMLTextAreaElement).value).toContain(
      '# implementing min-heap'
    );

    expect(postSpy).toHaveBeenCalledWith(
      '/api/assistant/hint',
      expect.objectContaining({
        assessment_id: 'assess-ai-75',
        question_id: 'q-dijkstra',
        hint_level: 1,
        allow_solution: false,
      })
    );
  });

  it('2. displays progressive Hint 1, Hint 2, and Hint 3 levels, redacts leaked solution code, and handles AI service failures gracefully', async () => {
    const user = userEvent.setup();
    seedAuthenticatedStudent();

    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/assessment/assess-ai-75') {
        return {
          data: {
            success: true,
            assessment: workspaceAssessmentFixture,
          },
        };
      }
      if (url.startsWith('/api/assistant/hints')) {
        return {
          data: {
            success: true,
            hints: [
              {
                hint_id: 'h-tier-1',
                question_id: 'q-dijkstra',
                level: 1,
                category_label: 'Hint 1 · Conceptual Direction',
                content:
                  'Model each microservice as a graph vertex and each RPC hop latency as a non-negative directed edge weight.',
                created_at: '2026-10-31T02:00:00Z',
              },
            ],
          },
        };
      }
      throw createAxiosError(404);
    });

    vi.spyOn(api, 'post')
      // Transient AI 503 failure before Hint 2 succeeds
      .mockRejectedValueOnce(
        createAxiosError(503, {
          detail: 'Featherless AI hint service temporarily overloaded. Please retry.',
        })
      )
      // Hint 2: Relevant algorithm or approach
      .mockResolvedValueOnce({
        data: {
          success: true,
          hint: {
            hint_id: 'h-tier-2',
            question_id: 'q-dijkstra',
            level: 2,
            category_label: 'Hint 2 · Algorithm & Approach',
            content:
              'Use Dijkstra shortest-path relaxation with a min-heap priority queue keyed by cumulative latency.',
            created_at: '2026-10-31T02:02:00Z',
          },
        },
      })
      // Hint 3: Detailed implementation guidance (containing an accidental solution block that must be redacted!)
      .mockResolvedValueOnce({
        data: {
          success: true,
          hint: {
            hint_id: 'h-tier-3',
            question_id: 'q-dijkstra',
            level: 3,
            category_label: 'Hint 3 · Implementation Guidance',
            content:
              'Initialize dist[source] = 0 and skip stale heap entries where popped_cost > dist[u].\n```python\ndef min_latency(n, edges):\n    import heapq\n    pq = [(0, 0)]\n    return 0\n```',
            created_at: '2026-10-31T02:04:00Z',
          },
        },
      });

    renderAtRoute('/student/assessment/assess-ai-75/workspace');

    expect(
      await screen.findByText(/Model each microservice as a graph vertex/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Hints Used: 1 / 3')).toBeInTheDocument();

    // Attempt Hint 2 when AI service fails with 503 -> graceful error, no hint consumed
    await user.click(
      screen.getByRole('button', { name: /Request Hint \(Tier 2\)/i })
    );
    expect(
      await screen.findByText(/Featherless AI hint service temporarily overloaded/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Hints Used: 1 / 3')).toBeInTheDocument();

    // Retry Hint 2 -> succeeds
    await user.click(
      screen.getByRole('button', { name: /Request Hint \(Tier 2\)/i })
    );
    expect(
      await screen.findByText(/Use Dijkstra shortest-path relaxation/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Hints Used: 2 / 3')).toBeInTheDocument();

    // Request Hint 3 -> succeeds & enforces non-spoiler solution redaction guardrail
    await user.click(
      screen.getByRole('button', { name: /Request Hint \(Tier 3\)/i })
    );
    expect(
      await screen.findByText(/skip stale heap entries/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Solution Guardrail Applied/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/pq = \[\(0, 0\)\]/i)).not.toBeInTheDocument();
    expect(screen.getByText('Hints Used: 3 / 3')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /All Hints Used/i })
    ).toBeDisabled();
  });

  it('3. loads persisted hint history from backend and displays chronological Hint Request History log', async () => {
    const user = userEvent.setup();
    seedAuthenticatedStudent();

    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/assessment/assess-ai-75') {
        return {
          data: {
            success: true,
            assessment: workspaceAssessmentFixture,
          },
        };
      }
      if (url.startsWith('/api/assistant/hints')) {
        return {
          data: {
            success: true,
            hints: [
              {
                hint_id: 'persisted-h1',
                assessment_id: 'assess-ai-75',
                question_id: 'q-dijkstra',
                level: 1,
                category_label: 'Hint 1 · Conceptual Direction',
                content: 'Persisted conceptual direction for shortest-path routing.',
                created_at: '2026-10-31T01:15:00Z',
              },
              {
                hint_id: 'persisted-q2-h1',
                assessment_id: 'assess-ai-75',
                question_id: 'q-lru-cache',
                level: 1,
                category_label: 'Hint 1 · Conceptual Direction',
                content: 'Combine a doubly linked list with a hash map index.',
                created_at: '2026-10-31T01:20:00Z',
              },
            ],
          },
        };
      }
      throw createAxiosError(404);
    });

    renderAtRoute('/student/assessment/assess-ai-75/workspace');

    expect(
      await screen.findByText(
        /Persisted conceptual direction for shortest-path routing/i
      )
    ).toBeInTheDocument();

    expect(screen.getByText('Hints Used: 1 / 3')).toBeInTheDocument();
    expect(screen.getByText('Session Total: 2')).toBeInTheDocument();

    // Expand Hint Request History log across all session questions
    const historyToggle = screen.getByRole('button', {
      name: /Hint Request History \(2\)/i,
    });
    await user.click(historyToggle);

    const historyRegion = screen.getByLabelText(/Session hint request history/i);
    expect(
      within(historyRegion).getByText('Latency-Aware Multi-Hop Routing')
    ).toBeInTheDocument();
    expect(
      within(historyRegion).getByText('Thread-Safe Segmented LRU Cache')
    ).toBeInTheDocument();
  });

  it('4. displays ONLY the official AI efficiency score returned by the backend (never calculating it client-side) and explains the metric via an accessible interest-triggered tooltip', async () => {
    const user = userEvent.setup();
    seedAuthenticatedStudent();

    // Case A: Backend returns null ai_efficiency_score despite hints_used = 2 and final_score = 92.
    // Frontend MUST NOT calculate a score — it must show Pending Backend Score.
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/assessment/assess-unscored-eff/results') {
        return {
          data: {
            success: true,
            results: {
              assessment_id: 'assess-unscored-eff',
              assessment_title: 'Unscored Efficiency Verification',
              completion_status: 'completed',
              final_score: 92,
              coding_score: 94,
              ai_efficiency_score: null,
              correct_test_cases: 10,
              failed_test_cases: 0,
              total_test_cases: 10,
              time_taken_seconds: 900,
              total_hints_used: 2,
              hint_levels_used: [1, 2],
              hints_viewed: true,
              question_performance: [],
            },
          },
        };
      }
      if (url === '/api/assessment/assess-official-eff/results') {
        return {
          data: {
            success: true,
            results: {
              assessment_id: 'assess-official-eff',
              assessment_title: 'Backend-Scored Efficiency Verification',
              completion_status: 'completed',
              final_score: 90,
              coding_score: 95,
              ai_efficiency_score: 83,
              correct_test_cases: 12,
              failed_test_cases: 0,
              total_test_cases: 12,
              time_taken_seconds: 1100,
              total_hints_used: 1,
              hint_levels_used: [1],
              hints_viewed: true,
              question_performance: [],
            },
          },
        };
      }
      throw createAxiosError(404);
    });

    const firstRender = renderAtRoute(
      '/student/assessment/assess-unscored-eff/results'
    );

    expect(
      await screen.findByRole('heading', {
        name: /Unscored Efficiency Verification/i,
      })
    ).toBeInTheDocument();

    expect(screen.getByTestId('backend-ai-efficiency-value')).toHaveTextContent(
      'Pending Backend Score'
    );
    expect(
      screen.getByText('Hint 1: Conceptual Direction')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Hint 2: Relevant Algorithm or Approach')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Yes — Hints Requested / Viewed')
    ).toBeInTheDocument();

    // Verify interestfor + popover="hint" attributes and WCAG 1.4.13 Escape dismiss
    const tooltipTrigger = screen.getByRole('button', {
      name: /Explain AI Efficiency Score metric/i,
    });
    expect(tooltipTrigger).toHaveAttribute('interestfor');
    expect(tooltipTrigger).not.toHaveAttribute('aria-describedby');

    const tooltipId = tooltipTrigger.getAttribute('interestfor')!;
    const popoverEl = document.getElementById(tooltipId)!;
    expect(popoverEl).toHaveAttribute('popover', 'hint');
    expect(popoverEl).not.toHaveAttribute('role');

    await user.click(tooltipTrigger);
    expect(popoverEl.className).toContain(':popover-open');
    expect(popoverEl).toHaveTextContent(/never calculated in the frontend/i);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(popoverEl.className).not.toContain(':popover-open');

    firstRender.unmount();

    // Case B: Backend supplies official ai_efficiency_score = 83 -> displayed verbatim
    renderAtRoute('/student/assessment/assess-official-eff/results');
    expect(
      await screen.findByRole('heading', {
        name: /Backend-Scored Efficiency Verification/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByTestId('backend-ai-efficiency-value')).toHaveTextContent(
      '83 / 100'
    );
  });

  it('5. renders loading skeleton, all 15 analytics metrics and 5 charts from backend data, and displays a clean empty state when zero assessments are completed', async () => {
    seedAuthenticatedStudent();

    let resolveAnalytics!: (value: unknown) => void;
    const deferredPromise = new Promise((resolve) => {
      resolveAnalytics = resolve;
    });

    const getSpy = vi.spyOn(api, 'get').mockImplementation((url: string) => {
      if (url === '/api/analytics/student') {
        return deferredPromise as ReturnType<typeof api.get>;
      }
      return Promise.reject(createAxiosError(404));
    });

    const view = renderAtRoute('/student/analytics');

    // Loading skeleton shown while request is pending
    expect(
      screen.getByText(/Loading analytics dashboard/i)
    ).toBeInTheDocument();

    // Resolve with full analytics dataset
    resolveAnalytics({ data: fullAnalyticsFixture });

    expect(
      await screen.findByText('Overall Assessment Score')
    ).toBeInTheDocument();

    // Verify all 15 metrics render accurately
    const primaryMetrics = screen.getByLabelText('Primary performance metrics');
    expect(within(primaryMetrics).getByText('87')).toBeInTheDocument(); // Overall score
    expect(within(primaryMetrics).getByText('91')).toBeInTheDocument(); // Coding score
    expect(within(primaryMetrics).getByText('84')).toBeInTheDocument(); // Backend AI efficiency score
    expect(within(primaryMetrics).getByText('4')).toBeInTheDocument(); // Total completed
    expect(within(primaryMetrics).getByText(/85%/)).toBeInTheDocument(); // Average score
    expect(within(primaryMetrics).getByText(/Peak 96%/)).toBeInTheDocument(); // Highest score

    const secondaryMetrics = screen.getByLabelText(
      'Detailed operational and trajectory metrics'
    );
    expect(within(secondaryMetrics).getByText('80%')).toBeInTheDocument(); // Completion rate
    expect(
      within(secondaryMetrics).getByText('41 Correct')
    ).toBeInTheDocument(); // Correct test cases
    expect(within(secondaryMetrics).getByText('4 Failed')).toBeInTheDocument(); // Failed test cases
    expect(within(secondaryMetrics).getByText('27m 30s')).toBeInTheDocument(); // Avg completion time
    expect(within(secondaryMetrics).getByText('+14.5%')).toBeInTheDocument(); // Improvement over time
    expect(within(secondaryMetrics).getByText('89 / 100')).toBeInTheDocument(); // Consistency across assessments
    expect(
      screen.getAllByText('Distributed Graph Systems').length
    ).toBeGreaterThanOrEqual(1); // Recent history
    expect(
      screen.getAllByText('Graph Algorithms').length
    ).toBeGreaterThanOrEqual(1); // Topic-wise
    expect(screen.getAllByText('Medium').length).toBeGreaterThanOrEqual(1); // Difficulty-wise

    // Verify all 5 required charts render
    expect(
      screen.getByRole('img', { name: /Score trend over time chart/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Topic-wise performance chart/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Difficulty-wise performance chart/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Assessment completion history chart/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: /Coding score versus AI efficiency score chart/i,
      })
    ).toBeInTheDocument();

    view.unmount();

    // Verify zero-assessment empty state
    getSpy.mockResolvedValueOnce({
      data: {
        success: true,
        analytics: {
          total_assessments_completed: 0,
          recent_history: [],
        },
      },
    });

    renderAtRoute('/student/analytics');
    expect(
      await screen.findByRole('heading', {
        name: /No Completed Assessments Yet/i,
      })
    ).toBeInTheDocument();
  });

  it('6 & 7. loads student assessment history, filters by Date, Score, and Assessment Status, and navigates to individual assessment result details', async () => {
    const user = userEvent.setup();
    seedAuthenticatedStudent();

    const nowIso = new Date().toISOString();
    const sixtyDaysAgoIso = new Date(
      Date.now() - 60 * 24 * 60 * 60 * 1000
    ).toISOString();

    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/analytics/history') {
        return {
          data: {
            success: true,
            history: [
              {
                assessment_id: 'hist-recent-high',
                title: 'High-Throughput Event Streaming Assessment',
                date: nowIso,
                overall_score: 94,
                coding_score: 96,
                ai_efficiency_score: 91,
                duration_seconds: 1800,
                question_count: 3,
                completion_status: 'completed',
                topics: ['Kafka', 'Python'],
              },
              {
                assessment_id: 'hist-old-partial',
                title: 'Legacy Monolith Refactoring Benchmark',
                date: sixtyDaysAgoIso,
                overall_score: 58,
                coding_score: 62,
                ai_efficiency_score: null,
                duration_seconds: 2400,
                question_count: 2,
                completion_status: 'partially_completed',
                topics: ['Java'],
              },
            ],
          },
        };
      }
      if (url === '/api/assessment/hist-recent-high/results') {
        return {
          data: {
            success: true,
            results: {
              assessment_id: 'hist-recent-high',
              assessment_title: 'High-Throughput Event Streaming Assessment',
              completion_status: 'completed',
              final_score: 94,
              coding_score: 96,
              ai_efficiency_score: 91,
              correct_test_cases: 15,
              failed_test_cases: 0,
              total_test_cases: 15,
              time_taken_seconds: 1800,
              total_hints_used: 1,
              hint_levels_used: [1],
              question_performance: [
                {
                  question_id: 'q-stream-1',
                  title: 'Partitioned Consumer Offset Tracker',
                  difficulty: 'Hard',
                  verdict: 'AC',
                  score: 94,
                  passed_tests: 15,
                  failed_tests: 0,
                  total_tests: 15,
                  hints_used: 1,
                },
              ],
            },
          },
        };
      }
      throw createAxiosError(404);
    });

    renderAtRoute('/student/history');

    expect(
      await screen.findByText('High-Throughput Event Streaming Assessment')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Legacy Monolith Refactoring Benchmark')
    ).toBeInTheDocument();
    expect(screen.getByText('91 / 100')).toBeInTheDocument();
    expect(screen.getByText('30m 0s')).toBeInTheDocument();
    expect(screen.getByText('3 Questions')).toBeInTheDocument();

    // Filter by Date Range: Last 7 Days -> hides 60-day-old assessment
    await user.selectOptions(
      screen.getByLabelText(/Filter by date range/i),
      '7d'
    );
    expect(
      screen.getByText('High-Throughput Event Streaming Assessment')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Legacy Monolith Refactoring Benchmark')
    ).not.toBeInTheDocument();

    // Reset filters -> both visible again
    await user.click(screen.getByRole('button', { name: /Reset Filters/i }));
    expect(
      screen.getByText('Legacy Monolith Refactoring Benchmark')
    ).toBeInTheDocument();

    // Filter by Score Threshold: 80+ -> shows only 94-score assessment
    await user.selectOptions(screen.getByLabelText(/Filter by score/i), '80');
    expect(
      screen.queryByText('Legacy Monolith Refactoring Benchmark')
    ).not.toBeInTheDocument();

    // Filter by Assessment Status: Partially Completed (with score reset)
    await user.selectOptions(screen.getByLabelText(/Filter by score/i), 'all');
    await user.selectOptions(
      screen.getByLabelText(/Filter by assessment status/i),
      'partially_completed'
    );
    expect(
      screen.getByText('Legacy Monolith Refactoring Benchmark')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('High-Throughput Event Streaming Assessment')
    ).not.toBeInTheDocument();

    // Reset and open individual assessment results
    await user.click(screen.getByRole('button', { name: /Reset Filters/i }));
    const viewResultLinks = screen.getAllByRole('link', {
      name: /View Results/i,
    });
    await user.click(viewResultLinks[0]);

    expect(
      await screen.findByText(/Q1\. Partitioned Consumer Offset Tracker/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('backend-ai-efficiency-value')).toHaveTextContent(
      '91 / 100'
    );
  });

  it('8, 9 & 10. previews public profile without private leaks, updates profile details, switches visibility (Private / Public / Shareable Link), and copies shareable URL', async () => {
    const user = userEvent.setup();
    seedAuthenticatedStudent();

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/profile/me') {
        return { data: studentProfileFixture };
      }
      throw createAxiosError(404);
    });

    const patchSpy = vi
      .spyOn(api, 'patch')
      // 1st visibility update: Enable Sharing -> Shareable Link
      .mockResolvedValueOnce({
        data: {
          success: true,
          profile: {
            ...studentProfileFixture.profile,
            visibility: 'shareable_link',
            is_sharing_enabled: true,
            share_slug: 'zaheed-shareef-75',
          },
        },
      })
      // 2nd visibility update: Switch to Public
      .mockResolvedValueOnce({
        data: {
          success: true,
          profile: {
            ...studentProfileFixture.profile,
            visibility: 'public',
            is_sharing_enabled: true,
            share_slug: 'zaheed-shareef-75',
          },
        },
      })
      // 3rd visibility update: Disable Sharing -> Private
      .mockResolvedValueOnce({
        data: {
          success: true,
          profile: {
            ...studentProfileFixture.profile,
            visibility: 'private',
            is_sharing_enabled: false,
            share_slug: null,
          },
        },
      });

    const putSpy = vi.spyOn(api, 'put').mockResolvedValueOnce({
      data: {
        success: true,
        profile: {
          ...studentProfileFixture.profile,
          headline: 'Principal Systems & AI Infrastructure Engineer',
        },
      },
    });

    renderAtRoute('/student/profile');

    expect(
      await screen.findByRole('heading', {
        name: /Student Profile & Public Sharing/i,
      })
    ).toBeInTheDocument();

    // Update profile headline and save
    const headlineInput = screen.getByLabelText(/Professional Headline/i);
    await user.clear(headlineInput);
    await user.type(
      headlineInput,
      'Principal Systems & AI Infrastructure Engineer'
    );
    await user.click(
      screen.getByRole('button', { name: /Save Profile Details/i })
    );

    expect(putSpy).toHaveBeenCalledWith(
      '/api/profile/me',
      expect.objectContaining({
        display_name: 'Zaheed Shareef',
        headline: 'Principal Systems & AI Infrastructure Engineer',
      })
    );
    expect(
      await screen.findByText(/Public profile details updated successfully/i)
    ).toBeInTheDocument();

    // Enable Sharing -> generates Shareable Link URL & allows copying
    await user.click(screen.getByRole('button', { name: /Enable Sharing/i }));
    expect(patchSpy).toHaveBeenCalledWith('/api/profile/visibility', {
      visibility: 'shareable_link',
      is_sharing_enabled: true,
    });

    const shareUrlInput = (await screen.findByLabelText(
      /Public profile URL/i
    )) as HTMLInputElement;
    expect(shareUrlInput.value).toContain('/profile/zaheed-shareef-75');

    await user.click(
      screen.getByRole('button', { name: /Copy Profile URL/i })
    );
    expect(writeTextMock).toHaveBeenCalledWith(shareUrlInput.value);
    expect(screen.getByText(/Copied URL!/i)).toBeInTheDocument();

    // Switch visibility radio to Public
    await user.click(screen.getByRole('radio', { name: /Public/i }));
    expect(patchSpy).toHaveBeenCalledWith('/api/profile/visibility', {
      visibility: 'public',
      is_sharing_enabled: true,
    });
    expect(
      await screen.findByText(/Profile visibility updated to Public/i)
    ).toBeInTheDocument();

    // Preview Public Profile -> displays all 10 public profile sections and zero private email/tokens
    await user.click(
      screen.getByRole('button', { name: /Preview Public Profile/i })
    );
    const previewArticle = screen.getByRole('article', {
      name: /Public profile for Zaheed Shareef/i,
    });
    expect(
      within(previewArticle).getByText('GateCode Adaptive Sandbox')
    ).toBeInTheDocument();
    expect(
      within(previewArticle).getByText('95+ Distinction in Graph Algorithms')
    ).toBeInTheDocument();
    expect(
      within(previewArticle).getByText(/89 \/ 100 · High Stability/i)
    ).toBeInTheDocument();
    expect(
      within(previewArticle).getByText(/\+14\.5% · Accelerating Mastery/i)
    ).toBeInTheDocument();
    // Private email and JWT token MUST NOT appear inside the public profile preview card
    expect(
      within(previewArticle).queryByText(/zaheed\.private@cbit\.ac\.in/i)
    ).not.toBeInTheDocument();
    expect(
      within(previewArticle).queryByText(/SECRET_SIGNATURE/i)
    ).not.toBeInTheDocument();

    // Exit preview and Disable Sharing -> returns to Private and hides share URL
    await user.click(
      screen.getByRole('button', { name: /Exit Public Preview/i })
    );
    await user.click(screen.getByRole('button', { name: /Disable Sharing/i }));
    expect(patchSpy).toHaveBeenLastCalledWith('/api/profile/visibility', {
      visibility: 'private',
      is_sharing_enabled: false,
    });
    await waitFor(() => {
      expect(
        screen.queryByLabelText(/Public profile URL/i)
      ).not.toBeInTheDocument();
    });
  });

  it('11. enforces private profile access restrictions (403 and private visibility) and strips accidental private fields on public profile views', async () => {
    // Unauthenticated external visitor
    const getSpy = vi
      .spyOn(api, 'get')
      // 1st visit: Backend returns 403 Forbidden for private profile
      .mockRejectedValueOnce(
        createAxiosError(403, { detail: 'Profile is private' })
      )
      // 2nd visit: Public shareable profile (even if upstream payload contains email/token, client strips them!)
      .mockResolvedValueOnce({
        data: {
          success: true,
          profile: {
            ...studentProfileFixture.profile,
            visibility: 'shareable_link',
            is_sharing_enabled: true,
            share_slug: 'zaheed-public-75',
            email: 'leaked-private-email@cbit.ac.in',
            access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiMTIzIn0.LEAKED_TOKEN_SIG',
          },
        },
      });

    const restrictedView = renderAtRoute('/profile/zaheed-private-slug');

    expect(
      await screen.findByRole('heading', {
        name: /This Student Profile is Private/i,
      })
    ).toBeInTheDocument();
    expect(screen.queryByText('Zaheed Shareef')).not.toBeInTheDocument();

    restrictedView.unmount();

    // Visit permitted shareable profile -> renders public sections while stripping leaked email & token
    renderAtRoute('/profile/zaheed-public-75');

    expect(
      await screen.findByRole('heading', { name: 'Zaheed Shareef' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('GateCode Verified Candidate Profile')
    ).toBeInTheDocument();
    expect(screen.getByText('84 / 100')).toBeInTheDocument();
    expect(
      screen.queryByText(/leaked-private-email@cbit\.ac\.in/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/LEAKED_TOKEN_SIG/i)).not.toBeInTheDocument();
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('12. provides mobile-responsive workspace navigation and keyboard-accessible responsive table containers', async () => {
    seedAuthenticatedStudent();

    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/analytics/history') {
        return {
          data: {
            success: true,
            history: fullAnalyticsFixture.analytics.recent_history,
          },
        };
      }
      throw createAxiosError(404);
    });

    renderAtRoute('/student/history');

    expect(
      await screen.findByText('Distributed Graph Systems')
    ).toBeInTheDocument();

    // Mobile secondary navigation bar exposes all student routes cleanly
    const mobileNav = screen.getByRole('navigation', {
      name: /Mobile workspace navigation/i,
    });
    expect(
      within(mobileNav).getByRole('link', { name: /Analytics/i })
    ).toHaveAttribute('href', '/student/analytics');
    expect(
      within(mobileNav).getByRole('link', { name: /History/i })
    ).toHaveAttribute('href', '/student/history');
    expect(
      within(mobileNav).getByRole('link', { name: /Profile/i })
    ).toHaveAttribute('href', '/student/profile');

    // Container-query responsive table wrapper is focusable for mobile/narrow overflow scrolling
    const responsiveRegion = screen.getByRole('region', {
      name: /Student technical assessment performance history/i,
    });
    expect(responsiveRegion).toHaveAttribute('tabindex', '0');
    expect(responsiveRegion.className).toContain('responsive-table-wrapper');
  });
});

