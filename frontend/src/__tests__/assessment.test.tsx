import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import { AuthProvider } from '../context/AuthContext';
import { AppRoutes } from '../App';
import { api } from '../services/api';
import { sanitizeGuardedHint } from '../services/assistantService';

function seedAuthenticatedStudent() {
  localStorage.setItem('gatecode_access_token', 'JWT_STUDENT_TOKEN');
  localStorage.setItem(
    'gatecode_auth_user',
    JSON.stringify({
      id: 'student_101',
      name: 'Zaheed Candidate',
      email: 'zaheed@cbit.ac.in',
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

const sampleBackendAssessment = {
  id: 'assess-75',
  user_id: 'student_101',
  portfolio_id: 'port-123',
  title: 'Backend Engineering Assessment: FastAPI & Async Systems',
  target_role: 'Backend Engineer',
  difficulty: 'medium',
  status: 'ready',
  total_time_limit_minutes: 45,
  question_count: 2,
  allowed_languages: ['python', 'typescript'],
  questions: [
    {
      id: 'q-token-bucket',
      order_index: 1,
      title: 'Rate Limiter Token Bucket Implementation',
      description:
        'Implement a deterministic TokenBucket rate limiter supporting burst capacity and steady refill rate.',
      difficulty: 'medium',
      category: 'Concurrency & Systems',
      target_skill: 'Python / Asyncio',
      starter_code: {
        python: 'def solve():\n    # Q1 starter\n    pass\n',
        typescript: 'function solve(): void {\n  // Q1 ts starter\n}\n',
      },
      sample_test_cases: [
        {
          input: '10 1.0\n5\n6',
          expected_output: 'True\nFalse',
          explanation:
            'Consuming 5 tokens succeeds; consuming 6 fails with 5 left.',
        },
      ],
      total_test_cases_count: 6,
      hidden_test_cases_count: 5,
      time_limit_seconds: 2.0,
      memory_limit_mb: 256,
    },
    {
      id: 'q-dag-toposort',
      order_index: 2,
      title: 'Async Task Dependency Resolver',
      description:
        'Determine a valid execution order for a directed acyclic graph of microservice build tasks.',
      difficulty: 'hard',
      category: 'Graph Algorithms',
      target_skill: 'Topological Sort',
      starter_code: {
        python: 'def solve_dag():\n    # Q2 starter\n    pass\n',
      },
      sample_test_cases: [
        {
          input: '3\nA->B\nB->C',
          expected_output: 'A B C',
        },
      ],
      time_limit_seconds: 1.5,
      memory_limit_mb: 256,
    },
  ],
  created_at: '2026-10-31T01:00:00Z',
};

describe('Personalized Technical Assessment Frontend', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('protects student assessment routes from unauthenticated access', () => {
    renderAtRoute('/student/assessment/results');
    expect(
      screen.getByRole('heading', { name: /sign in to candidate portal/i })
    ).toBeInTheDocument();
  });

  it('displays available personalized assessments in the student dashboard with title, difficulty, duration, topics, status, and Start Assessment button', async () => {
    seedAuthenticatedStudent();

    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/portfolio/me') {
        return {
          data: {
            success: true,
            portfolio: {
              id: 'port-123',
              githubUrl: 'https://github.com/zaheed/async-engine',
              primaryLanguages: ['Python', 'TypeScript'],
              frameworks: ['FastAPI'],
              status: 'ready',
            },
          },
        };
      }
      if (url === '/api/submissions/latest') {
        throw createAxiosError(404);
      }
      if (url === '/api/assessment') {
        return {
          data: {
            success: true,
            assessments: [sampleBackendAssessment],
          },
        };
      }
      throw createAxiosError(404);
    });

    renderAtRoute('/student/dashboard');

    expect(
      await screen.findByText(
        'Backend Engineering Assessment: FastAPI & Async Systems'
      )
    ).toBeInTheDocument();

    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('45 mins')).toBeInTheDocument();
    expect(screen.getByText('2 Questions')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Concurrency & Systems')).toBeInTheDocument();
    expect(screen.getByText('Graph Algorithms')).toBeInTheDocument();

    const startLink = screen.getByRole('link', { name: /start assessment/i });
    expect(startLink).toHaveAttribute(
      'href',
      '/student/assessment/assess-75/instructions'
    );
  });

  it('renders assessment instructions with duration, question count, allowed languages, rules, timer info, and gates start behind confirmation', async () => {
    const user = userEvent.setup();
    seedAuthenticatedStudent();

    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/assessment/assess-75') {
        return {
          data: {
            success: true,
            assessment: sampleBackendAssessment,
          },
        };
      }
      throw createAxiosError(404);
    });

    // Simulate Vasil's contract where /start is 404 and startAssessment falls back to GET /api/assessment/assess-75
    vi.spyOn(api, 'post').mockRejectedValueOnce(createAxiosError(404));

    renderAtRoute('/student/assessment/assess-75/instructions');

    expect(
      await screen.findByRole('heading', {
        name: /Backend Engineering Assessment: FastAPI & Async Systems/i,
      })
    ).toBeInTheDocument();

    expect(screen.getByText('45 Minutes')).toBeInTheDocument();
    expect(screen.getByText('2 Coding Questions')).toBeInTheDocument();
    expect(screen.getByText('Python 3.12')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /timer information/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /assessment rules & evaluation criteria/i,
      })
    ).toBeInTheDocument();

    const beginBtn = screen.getByRole('button', {
      name: /begin timed assessment/i,
    });
    expect(beginBtn).toBeDisabled();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);

    await user.click(checkboxes[0]);
    expect(beginBtn).toBeDisabled();

    await user.click(checkboxes[1]);
    expect(beginBtn).toBeEnabled();

    await user.click(beginBtn);

    // Navigates into the coding workspace with Question 1 loaded
    expect(
      await screen.findByRole('heading', {
        name: /Rate Limiter Token Bucket Implementation/i,
      })
    ).toBeInTheDocument();
  });

  it('supports coding workspace navigation, preserves code drafts across questions, runs code, and submits answers', async () => {
    const user = userEvent.setup();
    seedAuthenticatedStudent();

    vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: {
        success: true,
        assessment: sampleBackendAssessment,
      },
    });

    const postSpy = vi
      .spyOn(api, 'post')
      .mockImplementation(async (url: string) => {
        if (url === '/api/assessment/run') {
          return {
            data: {
              success: true,
              question_id: 'q-token-bucket',
              overall_verdict: 'AC',
              passed_count: 1,
              total_count: 1,
              results: [
                {
                  test_case_id: 'tc-1',
                  is_hidden: false,
                  passed: true,
                  verdict: 'AC',
                  execution_time_ms: 18,
                  expected_output: 'True\nFalse',
                  actual_output: 'True\nFalse',
                },
              ],
            },
          };
        }
        if (url === '/api/submissions') {
          return {
            data: {
              success: true,
              summary: {
                submission_id: 'sub-900',
                assessment_id: 'assess-75',
                question_id: 'q-token-bucket',
                question_title: 'Rate Limiter Token Bucket Implementation',
                deterministic_score: 100,
                overall_score: 94,
                passed_tests: 6,
                total_tests: 6,
                overall_verdict: 'AC',
                efficiency: {
                  detected_time_complexity: 'O(1)',
                  detected_space_complexity: 'O(1)',
                  optimality_score: 10,
                  cleanliness_score: 9,
                  feedback: 'Optimal constant-time token refill arithmetic.',
                },
              },
            },
          };
        }
        throw createAxiosError(404);
      });

    renderAtRoute('/student/assessment/assess-75/workspace');

    // Verify problem description, difficulty badge, examples, constraints, test case info, and timer
    expect(
      await screen.findByRole('heading', {
        name: /Rate Limiter Token Bucket Implementation/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText(/1 Public Sample Case/i)).toBeInTheDocument();
    expect(screen.getByText(/5 Hidden Evaluation Cases/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Execution Timeout: 2000 ms/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('timer', { name: /assessment time remaining/i })
    ).toBeInTheDocument();

    // Edit code on Question 1
    const editor = screen.getByLabelText(/solution code editor/i);
    await user.clear(editor);
    await user.click(editor);
    await user.paste('print("True\\nFalse")');
    expect(editor).toHaveValue('print("True\\nFalse")');

    // Navigate to Question 2 using Next question button
    await user.click(screen.getByRole('button', { name: /next question/i }));
    expect(
      await screen.findByRole('heading', {
        name: /Async Task Dependency Resolver/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Hard')).toBeInTheDocument();

    // Navigate back to Question 1 and verify code draft was preserved
    await user.click(
      screen.getByRole('button', { name: /previous question/i })
    );
    expect(
      await screen.findByRole('heading', {
        name: /Rate Limiter Token Bucket Implementation/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/solution code editor/i)).toHaveValue(
      'print("True\\nFalse")'
    );

    // Run Code
    await user.click(screen.getByRole('button', { name: /^run code$/i }));
    expect(await screen.findByText(/Passed 1 \/ 1/i)).toBeInTheDocument();
    expect(postSpy).toHaveBeenCalledWith(
      '/api/assessment/run',
      expect.objectContaining({
        assessment_id: 'assess-75',
        question_id: 'q-token-bucket',
        language: 'python',
      })
    );

    // Submit Answer
    await user.click(screen.getByRole('button', { name: /^submit answer$/i }));
    expect(
      await screen.findByText(/Optimal constant-time token refill arithmetic/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /view results/i })
    ).toBeInTheDocument();
  });

  it('requests progressive AI hints, tracks hint usage, redacts leaked solution code, and never fakes responses on error', async () => {
    const user = userEvent.setup();
    seedAuthenticatedStudent();

    // Unit check on client-side leak-prevention guardrail
    const sanitized = sanitizeGuardedHint(
      'Track elapsed timestamps between calls.\n```python\ndef consume(self, tokens):\n    self.refill()\n    if self.tokens >= tokens:\n        self.tokens -= tokens\n        return True\n```'
    );
    expect(sanitized.redacted).toBe(true);
    expect(sanitized.content).not.toContain('self.tokens -= tokens');
    expect(sanitized.content).toContain('redacted by Guarded AI Tutor');

    vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: {
        success: true,
        assessment: sampleBackendAssessment,
      },
    });

    const postSpy = vi
      .spyOn(api, 'post')
      .mockResolvedValueOnce({
        data: {
          success: true,
          hint: {
            hint_id: 'h-1',
            level: 1,
            category_label: 'Level 1 · Conceptual Intuition',
            content:
              'Instead of running a background timer thread, compute replenished tokens lazily using timestamp deltas on each consume() call.',
          },
        },
      })
      .mockRejectedValueOnce(createAxiosError(undefined));

    renderAtRoute('/student/assessment/assess-75/workspace');

    expect(
      await screen.findByText(/Hints Used: 0 \/ 3/i)
    ).toBeInTheDocument();

    // Request Tier 1 hint
    await user.click(
      screen.getByRole('button', { name: /request hint \(tier 1\)/i })
    );

    expect(
      await screen.findByText(/compute replenished tokens lazily/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Hints Used: 1 \/ 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Session Total: 1/i)).toBeInTheDocument();
    expect(postSpy).toHaveBeenCalledWith(
      '/api/assistant/hint',
      expect.objectContaining({
        assessment_id: 'assess-75',
        question_id: 'q-token-bucket',
        hint_level: 1,
        allow_solution: false,
      })
    );

    // Request Tier 2 hint when backend is offline -> displays honest error without incrementing or faking
    await user.click(
      screen.getByRole('button', { name: /request hint \(tier 2\)/i })
    );
    expect(
      await screen.findByText(/unable to reach the server/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Hints Used: 1 \/ 3/i)).toBeInTheDocument();
  });

  it('displays comprehensive assessment results including final score, correct/failed test cases, time taken, question-wise performance, AI hint usage, and completion status', async () => {
    seedAuthenticatedStudent();

    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/assessment/assess-75/results') {
        return {
          data: {
            success: true,
            results: {
              assessment_id: 'assess-75',
              assessment_title:
                'Backend Engineering Assessment: FastAPI & Async Systems',
              completion_status: 'completed',
              final_score: 88,
              deterministic_score: 90,
              correct_test_cases: 11,
              failed_test_cases: 1,
              total_test_cases: 12,
              time_taken_seconds: 1455,
              time_limit_seconds: 2700,
              total_hints_used: 2,
              completed_at: '2026-10-31T01:40:00Z',
              question_performance: [
                {
                  question_id: 'q-token-bucket',
                  title: 'Rate Limiter Token Bucket Implementation',
                  difficulty: 'Medium',
                  verdict: 'AC',
                  score: 96,
                  passed_tests: 6,
                  failed_tests: 0,
                  total_tests: 6,
                  hints_used: 1,
                  detected_time_complexity: 'O(1)',
                },
                {
                  question_id: 'q-dag-toposort',
                  title: 'Async Task Dependency Resolver',
                  difficulty: 'Hard',
                  verdict: 'WA',
                  score: 80,
                  passed_tests: 5,
                  failed_tests: 1,
                  total_tests: 6,
                  hints_used: 1,
                  detected_time_complexity: 'O(V + E)',
                },
              ],
            },
          },
        };
      }
      throw createAxiosError(404);
    });

    renderAtRoute('/student/assessment/assess-75/results');

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /Backend Engineering Assessment: FastAPI & Async Systems/i,
        })
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText('11 Correct')).toBeInTheDocument();
    expect(screen.getByText('1 Failed')).toBeInTheDocument();
    expect(screen.getByText('24m 15s')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(
      screen.getByText(/Q1\. Rate Limiter Token Bucket Implementation/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Q2\. Async Task Dependency Resolver/i)
    ).toBeInTheDocument();
    expect(screen.getByText('96 / 100')).toBeInTheDocument();
    expect(screen.getByText('80 / 100')).toBeInTheDocument();
  });
});

