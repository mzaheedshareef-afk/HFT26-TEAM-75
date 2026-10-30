import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import { AuthProvider } from '../context/AuthContext';
import { AppRoutes } from '../App';
import { api } from '../services/api';
import { sanitizeGuardedHint } from '../services/assistantService';
import { formatSourceCode } from '../components/assessment/CodeEditorPanel';

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
  allowed_languages: ['python', 'java', 'c++', 'typescript'],
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
      constraints: [
        'Time limit: 2000ms',
        'Memory limit: 256MB',
        '1 <= capacity <= 10^6',
      ],
      starter_code: {
        python: 'def solve():\n    # Q1 python starter\n    pass\n',
        java: 'public class Main {\n    public static void main(String[] args) {\n        // Q1 java starter\n    }\n}\n',
        'c++': '#include <iostream>\nint main() {\nint tokens = 10;\nreturn 0;\n}\n',
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

describe('Personalized Technical Assessment & Coding Workspace Frontend', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
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

    // Simulate fallback to GET /api/assessment/assess-75 when /start returns 404
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
    expect(screen.getByText('Java 21')).toBeInTheDocument();
    expect(screen.getByText('C++ 20')).toBeInTheDocument();
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

    expect(
      await screen.findByRole('heading', {
        name: /Rate Limiter Token Bucket Implementation/i,
      })
    ).toBeInTheDocument();
  });

  it('supports Python, Java, and C++ language selection with backend starter code, code formatting, and preserves drafts across questions', async () => {
    const user = userEvent.setup();
    seedAuthenticatedStudent();

    // Direct unit check on deterministic formatter for Python, Java, and C++
    expect(
      formatSourceCode(
        'public class Main {\npublic static void main(String[] args) {\nSystem.out.println("ok");\n}\n}',
        'java'
      )
    ).toBe(
      'public class Main {\n    public static void main(String[] args) {\n        System.out.println("ok");\n    }\n}\n'
    );
    expect(
      formatSourceCode('def run():\n\treturn 42   \n\n\n\n', 'python')
    ).toBe('def run():\n    return 42\n');

    vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: {
        success: true,
        assessment: sampleBackendAssessment,
      },
    });

    renderAtRoute('/student/assessment/assess-75/workspace');

    expect(
      await screen.findByRole('heading', {
        name: /Rate Limiter Token Bucket Implementation/i,
      })
    ).toBeInTheDocument();

    // Selected programming language displayed in workspace header
    expect(screen.getByText('Selected: Python 3.12')).toBeInTheDocument();
    expect(screen.getByText('Backend Starter')).toBeInTheDocument();
    expect(screen.getByText('1 <= capacity <= 10^6')).toBeInTheDocument();

    const langSelect = screen.getByRole('combobox', {
      name: /^programming language$/i,
    });
    const editor = screen.getByLabelText(/solution code editor/i);
    expect(editor).toHaveValue('def solve():\n    # Q1 python starter\n    pass\n');

    // Switch to Java -> loads backend Java starter code
    await user.selectOptions(langSelect, 'java');
    expect(screen.getByText('Selected: Java 21')).toBeInTheDocument();
    expect(editor).toHaveValue(
      'public class Main {\n    public static void main(String[] args) {\n        // Q1 java starter\n    }\n}\n'
    );

    // Switch to C++ -> loads backend C++ starter code ("c++" alias normalized to "cpp")
    await user.selectOptions(langSelect, 'cpp');
    expect(screen.getByText('Selected: C++ 20')).toBeInTheDocument();
    expect(editor).toHaveValue(
      '#include <iostream>\nint main() {\nint tokens = 10;\nreturn 0;\n}\n'
    );

    // Click Format button -> indents C++ block while keeping #include flush-left
    await user.click(screen.getByRole('button', { name: /format code/i }));
    expect(editor).toHaveValue(
      '#include <iostream>\nint main() {\n    int tokens = 10;\n    return 0;\n}\n'
    );
    expect(screen.getByText('Draft Saved')).toBeInTheDocument();

    // Navigate to Question 2 and back to Question 1 -> formatted C++ draft is preserved
    await user.click(screen.getByRole('button', { name: /next question/i }));
    expect(
      await screen.findByRole('heading', {
        name: /Async Task Dependency Resolver/i,
      })
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /previous question/i })
    );
    expect(screen.getByLabelText(/solution code editor/i)).toHaveValue(
      '#include <iostream>\nint main() {\n    int tokens = 10;\n    return 0;\n}\n'
    );
  });

  it('displays execution status, stdout, stderr, public test case results, compilation errors (CE), and timeout messages (TLE) when running code', async () => {
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
      // 1st run: Compilation Error
      .mockResolvedValueOnce({
        data: {
          success: true,
          question_id: 'q-token-bucket',
          overall_verdict: 'CE',
          passed_count: 0,
          total_count: 1,
          compile_error: "Main.java:4: error: ';' expected\nint x = 1\n         ^",
          results: [],
        },
      })
      // 2nd run: Timeout (TLE)
      .mockResolvedValueOnce({
        data: {
          success: true,
          question_id: 'q-token-bucket',
          overall_verdict: 'TLE',
          timed_out: true,
          passed_count: 0,
          total_count: 1,
          total_time_ms: 2000,
          results: [
            {
              test_case_id: 'tc-1',
              is_hidden: false,
              passed: false,
              verdict: 'TLE',
              timed_out: true,
              execution_time_ms: 2000,
              input: '10 1.0\n5\n6',
              expected_output: 'True\nFalse',
              actual_output: '',
            },
          ],
        },
      })
      // 3rd run: Public test case pass with stdout, stderr warning, execution time & memory
      .mockResolvedValueOnce({
        data: {
          success: true,
          question_id: 'q-token-bucket',
          overall_verdict: 'AC',
          passed_count: 1,
          total_count: 1,
          total_time_ms: 24,
          memory_used_mb: 34.2,
          results: [
            {
              test_case_id: 'tc-1',
              is_hidden: false,
              passed: true,
              verdict: 'AC',
              execution_time_ms: 24,
              memory_used_mb: 34.2,
              input: '10 1.0\n5\n6',
              expected_output: 'True\nFalse',
              actual_output: 'True\nFalse',
              stderr: 'DeprecationWarning: debug trace active',
            },
          ],
        },
      });

    renderAtRoute('/student/assessment/assess-75/workspace');

    expect(
      await screen.findByRole('heading', {
        name: /Rate Limiter Token Bucket Implementation/i,
      })
    ).toBeInTheDocument();

    // 1. Run Code -> Compilation Error
    await user.click(screen.getByRole('button', { name: /^run code$/i }));
    expect(
      await screen.findByText(/Compilation \/ Syntax Error/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Main\.java:4: error: ';' expected/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/CE · Compilation Error/i)).toBeInTheDocument();

    // 2. Run Code -> Timeout (TLE)
    await user.click(screen.getByRole('button', { name: /^run code$/i }));
    expect(
      await screen.findByText(/Execution Timed Out \(Time Limit Exceeded\)/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/TLE · Time Limit Exceeded/i).length).toBeGreaterThanOrEqual(1);

    // 3. Run Code -> Public Test Case AC with stdout, stderr, time & memory
    await user.click(screen.getByRole('button', { name: /^run code$/i }));
    expect(await screen.findByText(/Passed 1 \/ 1/i)).toBeInTheDocument();
    expect(screen.getByText('24 ms')).toBeInTheDocument();
    expect(screen.getByText('34.2 MB')).toBeInTheDocument();
    expect(screen.getByText(/Public Test Case #1/i)).toBeInTheDocument();
    expect(screen.getByText('Standard Output (stdout)')).toBeInTheDocument();
    expect(screen.getByText('Standard Error (stderr)')).toBeInTheDocument();
    expect(
      screen.getByText(/DeprecationWarning: debug trace active/i)
    ).toBeInTheDocument();

    expect(postSpy).toHaveBeenCalledTimes(3);
    expect(postSpy).toHaveBeenLastCalledWith(
      '/api/assessment/run',
      expect.objectContaining({
        assessment_id: 'assess-75',
        question_id: 'q-token-bucket',
        language: 'python',
      })
    );
  });

  it('submits final solution, handles network errors honestly, prevents duplicate submissions, and re-enables submit after code changes', async () => {
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
      // 1st attempt: Network error
      .mockRejectedValueOnce(createAxiosError(undefined))
      // 2nd attempt: Successful grading response
      .mockResolvedValueOnce({
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
            failed_tests: 0,
            total_tests: 6,
            execution_time_ms: 31,
            memory_used_mb: 38.4,
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
      });

    renderAtRoute('/student/assessment/assess-75/workspace');

    expect(
      await screen.findByRole('heading', {
        name: /Rate Limiter Token Bucket Implementation/i,
      })
    ).toBeInTheDocument();

    const editor = screen.getByLabelText(/solution code editor/i);
    await user.clear(editor);
    await user.click(editor);
    await user.paste('print("True\\nFalse")');

    // 1. Network error on submit -> shows Submission Failed alert and stays retryable
    const submitBtn = screen.getByRole('button', { name: /^submit solution$/i });
    await user.click(submitBtn);

    expect(await screen.findByText('Submission Failed')).toBeInTheDocument();
    expect(screen.getByText(/unable to reach the server/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^submit solution$/i })
    ).toBeEnabled();

    // 2. Retry submit -> succeeds and displays Submission Status + Final Grading Summary
    await user.click(screen.getByRole('button', { name: /^submit solution$/i }));

    expect(
      await screen.findByText(/Submission Status: Graded \(94 \/ 100\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Optimal constant-time token refill arithmetic/i)
    ).toBeInTheDocument();
    expect(screen.getByText('6 Passed')).toBeInTheDocument();
    expect(screen.getByText('0 Failed')).toBeInTheDocument();
    expect(screen.getByText('31 ms')).toBeInTheDocument();
    expect(screen.getByText('38.4 MB')).toBeInTheDocument();

    // Duplicate submission prevented: button transitions to disabled "Solution Submitted"
    const lockedBtn = screen.getByRole('button', {
      name: /^solution submitted$/i,
    });
    expect(lockedBtn).toBeDisabled();
    expect(postSpy).toHaveBeenCalledTimes(2);

    // Modifying code unlocks "Submit Solution" again
    await user.click(editor);
    await user.paste('\n# updated');
    expect(
      screen.getByRole('button', { name: /^submit solution$/i })
    ).toBeEnabled();
    expect(
      screen.getByText(/Draft modified since last submission/i)
    ).toBeInTheDocument();
  });

  it('requests progressive AI hints, tracks hint usage, redacts leaked solution code, and never fakes responses on error', async () => {
    const user = userEvent.setup();
    seedAuthenticatedStudent();

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

    await user.click(
      screen.getByRole('button', { name: /request hint \(tier 2\)/i })
    );
    expect(
      await screen.findByText(/unable to reach the server/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Hints Used: 1 \/ 3/i)).toBeInTheDocument();
  });

  it('displays final score, passed/failed test cases, execution time, memory usage when supplied by backend, question-wise results, and completion status', async () => {
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
              total_execution_time_ms: 86,
              peak_memory_mb: 44.8,
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
                  execution_time_ms: 34,
                  memory_used_mb: 39.2,
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
                  execution_time_ms: 52,
                  memory_used_mb: 44.8,
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
    expect(screen.getByText('11 Passed')).toBeInTheDocument();
    expect(screen.getByText('1 Failed')).toBeInTheDocument();
    expect(screen.getByText('86 ms')).toBeInTheDocument();
    expect(screen.getByText('24m 15s')).toBeInTheDocument();
    expect(screen.getByText('Memory Usage')).toBeInTheDocument();
    expect(screen.getByText('44.8')).toBeInTheDocument();
    expect(screen.getByText('34 ms')).toBeInTheDocument();
    expect(screen.getByText('39.2 MB')).toBeInTheDocument();
    expect(screen.getByText('52 ms')).toBeInTheDocument();
    expect(
      screen.getByText(/Q1\. Rate Limiter Token Bucket Implementation/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Q2\. Async Task Dependency Resolver/i)
    ).toBeInTheDocument();
    expect(screen.getByText('96 / 100')).toBeInTheDocument();
    expect(screen.getByText('80 / 100')).toBeInTheDocument();
  });

  it('omits memory usage metrics cleanly on the results page when not supplied by backend', async () => {
    seedAuthenticatedStudent();

    vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: {
        success: true,
        result: {
          assessment_id: 'assess-no-mem',
          assessment_title: 'Systems Coding Evaluation',
          completion_status: 'partially_completed',
          final_score: 75,
          correct_test_cases: 3,
          failed_test_cases: 1,
          total_test_cases: 4,
          time_taken_seconds: 620,
          total_hints_used: 0,
          question_performance: [
            {
              question_id: 'q-1',
              title: 'Consistent Hashing Ring',
              difficulty: 'Medium',
              verdict: 'WA',
              score: 75,
              passed_tests: 3,
              failed_tests: 1,
              total_tests: 4,
              hints_used: 0,
            },
          ],
        },
      },
    });

    renderAtRoute('/student/assessment/assess-no-mem/results');

    expect(
      await screen.findByRole('heading', {
        name: /Systems Coding Evaluation/i,
      })
    ).toBeInTheDocument();

    expect(screen.getByText('Partially Completed')).toBeInTheDocument();
    expect(screen.getByText('3 Passed')).toBeInTheDocument();
    expect(screen.getByText('1 Failed')).toBeInTheDocument();
    expect(screen.getByText('10m 20s')).toBeInTheDocument();
    expect(screen.queryByText('Memory Usage')).not.toBeInTheDocument();
  });
});
