import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import { AuthProvider } from '../context/AuthContext';
import { AppRoutes } from '../App';
import { api } from '../services/api';

function renderAtRoute(initialRoute = '/') {
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
  data?: Record<string, unknown>,
  code = 'ERR_BAD_REQUEST'
): AxiosError {
  const headers = new AxiosHeaders();
  const config = { headers };

  if (status === undefined) {
    return new AxiosError('Network Error', 'ERR_NETWORK', config);
  }

  return new AxiosError(
    `Request failed with status code ${status}`,
    code,
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

describe('GateCode Frontend Authentication Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders responsive landing page with mobile menu toggle and auth links', async () => {
    const user = userEvent.setup();
    renderAtRoute('/');

    expect(
      screen.getByRole('heading', {
        name: /evaluate engineering talent by what they actually build/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: /start as candidate/i })
    ).toHaveAttribute('href', '/student/signup');
    expect(
      screen.getByRole('link', { name: /hire with gatecode/i })
    ).toHaveAttribute('href', '/company/signup');

    // Responsive mobile menu button opens and closes cleanly
    const mobileMenuButton = screen.getByRole('button', {
      name: /open navigation menu/i,
    });
    await user.click(mobileMenuButton);
    expect(
      screen.getByRole('button', { name: /close navigation menu/i })
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('blocks empty submissions and displays required field errors without calling API', async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(api, 'post');

    renderAtRoute('/student/signup');

    await user.click(
      screen.getByRole('button', { name: /create candidate account/i })
    );

    expect(screen.getByText('Full name is required.')).toBeInTheDocument();
    expect(screen.getByText('Email address is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(
      screen.getByText('Please confirm your password.')
    ).toBeInTheDocument();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('validates invalid email format after user interaction and clears once corrected', async () => {
    const user = userEvent.setup();
    renderAtRoute('/student/login');

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'not-an-email');

    // Deferred validation: no premature error before blur or submit
    expect(
      screen.queryByText(/please enter a valid email address/i)
    ).not.toBeInTheDocument();

    await user.tab();
    expect(
      screen.getByText(/please enter a valid email address/i)
    ).toBeInTheDocument();

    // Clears immediately once corrected
    await user.clear(emailInput);
    await user.type(emailInput, 'candidate@example.com');
    expect(
      screen.queryByText(/please enter a valid email address/i)
    ).not.toBeInTheDocument();
  });

  it('detects password mismatch and supports show/hide password toggle', async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(api, 'post');

    renderAtRoute('/company/signup');

    await user.type(screen.getByLabelText(/company name/i), 'Acme Corp');
    await user.type(
      screen.getByLabelText(/official email/i),
      'hr@acmecorp.com'
    );

    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmInput = screen.getByLabelText(/^confirm password$/i);

    expect(passwordInput).toHaveAttribute('type', 'password');

    // Toggle show password
    await user.click(screen.getByRole('button', { name: /^show password$/i }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    await user.type(passwordInput, 'SecurePass123');
    await user.type(confirmInput, 'DifferentPass123');

    await user.click(
      screen.getByRole('button', { name: /create company account/i })
    );

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('displays backend error message for incorrect credentials (401)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'post').mockRejectedValueOnce(
      createAxiosError(401, {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      })
    );

    renderAtRoute('/student/login');

    await user.type(
      screen.getByLabelText(/email address/i),
      'candidate@example.com'
    );
    await user.type(screen.getByLabelText(/^password$/i), 'WrongPassword123');
    await user.click(
      screen.getByRole('button', { name: /sign in as candidate/i })
    );

    expect(
      await screen.findByText('Invalid email or password')
    ).toBeInTheDocument();
  });

  it('displays duplicate signup error message when email already exists (409)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'post').mockRejectedValueOnce(
      createAxiosError(409, {
        detail: 'An account with this email is already registered.',
      })
    );

    renderAtRoute('/student/signup');

    await user.type(screen.getByLabelText(/full name/i), 'Zaheed Shareef');
    await user.type(
      screen.getByLabelText(/email address/i),
      'existing@example.com'
    );
    await user.type(screen.getByLabelText(/^password$/i), 'Password123!');
    await user.type(
      screen.getByLabelText(/^confirm password$/i),
      'Password123!'
    );

    await user.click(
      screen.getByRole('button', { name: /create candidate account/i })
    );

    expect(
      await screen.findByText(
        'An account with this email is already registered.'
      )
    ).toBeInTheDocument();
  });

  it('displays clear connection message when backend is unavailable', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'post').mockRejectedValueOnce(createAxiosError(undefined));

    renderAtRoute('/company/login');

    await user.type(
      screen.getByLabelText(/official email/i),
      'talent@company.com'
    );
    await user.type(screen.getByLabelText(/^password$/i), 'CompanyPass123');
    await user.click(
      screen.getByRole('button', { name: /sign in to company portal/i })
    );

    expect(
      await screen.findByText(/unable to reach the server/i)
    ).toBeInTheDocument();
  });

  it('navigates to student dashboard placeholder after successful student login and shows loading state', async () => {
    const user = userEvent.setup();

    let resolveLogin!: (value: unknown) => void;
    vi.spyOn(api, 'post').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        })
    );

    renderAtRoute('/student/login');

    await user.type(
      screen.getByLabelText(/email address/i),
      'candidate@example.com'
    );
    await user.type(screen.getByLabelText(/^password$/i), 'StrongPass123');
    await user.click(
      screen.getByRole('button', { name: /sign in as candidate/i })
    );

    // Loading state indicator shown while request is in flight
    expect(
      screen.getByRole('button', { name: /signing in/i })
    ).toBeDisabled();

    resolveLogin({
      data: {
        success: true,
        access_token: 'JWT_STUDENT_TOKEN',
        token_type: 'bearer',
        user: {
          id: 'user_101',
          name: 'Candidate',
          email: 'candidate@example.com',
          role: 'student',
        },
      },
    });

    expect(
      await screen.findByRole('heading', { name: /welcome, candidate/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/student dashboard placeholder/i)
    ).toBeInTheDocument();
    expect(localStorage.getItem('gatecode_access_token')).toBe(
      'JWT_STUDENT_TOKEN'
    );
  });

  it('navigates to company dashboard placeholder after successful company login', async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
      data: {
        success: true,
        access_token: 'JWT_COMPANY_TOKEN',
        token_type: 'bearer',
        user: {
          id: 'comp_202',
          name: 'Acme Engineering',
          email: 'talent@acme.io',
          role: 'company',
        },
      },
    });

    renderAtRoute('/company/login');

    await user.type(screen.getByLabelText(/official email/i), 'talent@acme.io');
    await user.type(screen.getByLabelText(/^password$/i), 'CompanySecret99');
    await user.click(
      screen.getByRole('button', { name: /sign in to company portal/i })
    );

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/api/auth/company/login', {
        email: 'talent@acme.io',
        official_email: 'talent@acme.io',
        password: 'CompanySecret99',
      });
    });

    expect(
      await screen.findByRole('heading', {
        name: /welcome, acme engineering/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/company dashboard placeholder/i)
    ).toBeInTheDocument();
  });

  it('redirects unauthenticated visitors away from protected dashboard routes', () => {
    renderAtRoute('/student/dashboard');
    expect(
      screen.getByRole('heading', { name: /sign in to candidate portal/i })
    ).toBeInTheDocument();
  });
});
