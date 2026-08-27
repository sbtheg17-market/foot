/**
 * Registration page (/signup) — web tests.
 *
 * Regression coverage for the mobile "Internal server error" blocker:
 * duplicate-submission prevention, safe server-error copy (never the raw
 * "Internal server error"), duplicate-email guidance, field-specific 400
 * guidance, focus management on failure, loading state, role selection,
 * success routing, and axe accessibility scans.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Register from '../pages/register';
import { useRegister } from '@workspace/api-client-react';
import { axeViolations } from '../test/axe';

const setLocation = vi.fn();
vi.mock('wouter', () => ({
  useLocation: () => ['/signup', setLocation],
  Link: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@workspace/api-client-react', () => ({
  useRegister: vi.fn(),
  RegisterRequestRoleIntent: { client: 'client', provider: 'provider' },
}));
vi.mock('@/components/support-contact-link', () => ({
  default: ({ testId }: { testId: string }) => (
    <a data-testid={testId} href="mailto:support@example.test">
      Need help?
    </a>
  ),
}));

const mockUseRegister = vi.mocked(useRegister);

type MutateCallbacks = {
  onSuccess?: (res: unknown) => void;
  onError?: (err: unknown) => void;
  onSettled?: () => void;
};

function setupMutate(impl?: (payload: unknown, callbacks: MutateCallbacks) => void) {
  const mutate = vi.fn((payload: unknown, callbacks: MutateCallbacks) => {
    impl?.(payload, callbacks);
  });
  mockUseRegister.mockReturnValue({
    mutate,
    isPending: false,
  } as unknown as ReturnType<typeof useRegister>);
  return mutate;
}

function fillForm() {
  fireEvent.change(screen.getByTestId('register-first-name-input'), {
    target: { value: 'Stan' },
  });
  fireEvent.change(screen.getByTestId('register-last-name-input'), {
    target: { value: 'Bent' },
  });
  fireEvent.change(screen.getByTestId('register-email-input'), {
    target: { value: 'stan.test@example.test' },
  });
  fireEvent.change(screen.getByTestId('register-password-input'), {
    target: { value: 'password123' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe('registration success', () => {
  it('registers a client and routes to discover with the token stored', () => {
    const mutate = setupMutate((_payload, callbacks) => {
      callbacks.onSuccess?.({ token: 'test-token', user: { role: 'client' } });
      callbacks.onSettled?.();
    });
    render(<Register />);
    fillForm();
    fireEvent.click(screen.getByTestId('register-submit-button'));

    expect(mutate).toHaveBeenCalledTimes(1);
    const payload = mutate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(payload.data.roleIntent).toBe('client');
    expect(payload.data.email).toBe('stan.test@example.test');
    expect(localStorage.getItem('oncallfoot_token')).toBe('test-token');
    expect(setLocation).toHaveBeenCalledWith('/discover');
  });

  it('registers a provider and routes to provider onboarding', () => {
    const mutate = setupMutate((_payload, callbacks) => {
      callbacks.onSuccess?.({
        token: 'test-token',
        user: { role: 'provider', providerApplication: { status: 'draft' } },
      });
      callbacks.onSettled?.();
    });
    render(<Register />);
    fillForm();
    fireEvent.click(screen.getByTestId('register-role-provider'));
    expect(screen.getByTestId('register-role-provider')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('register-submit-button'));

    const payload = mutate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(payload.data.roleIntent).toBe('provider');
    expect(setLocation).toHaveBeenCalledWith('/onboarding/provider');
    // One-time onboarding welcome flag so the provider sees a clear next step.
    expect(sessionStorage.getItem('oncallfoot_provider_welcome')).toBe('1');
  });

  it('does not set the provider welcome flag for client signups', () => {
    setupMutate((_payload, callbacks) => {
      callbacks.onSuccess?.({ token: 'test-token', user: { role: 'client' } });
      callbacks.onSettled?.();
    });
    render(<Register />);
    fillForm();
    fireEvent.click(screen.getByTestId('register-submit-button'));
    expect(sessionStorage.getItem('oncallfoot_provider_welcome')).toBeNull();
  });
});

describe('registration input validation', () => {
  it('shows a local error for a short password without calling the API', () => {
    const mutate = setupMutate();
    render(<Register />);
    fillForm();
    fireEvent.change(screen.getByTestId('register-password-input'), {
      target: { value: 'short' },
    });
    fireEvent.submit(screen.getByTestId('register-submit-button').closest('form')!);
    expect(screen.getByTestId('register-error')).toHaveTextContent(
      'Password must be at least 8 characters.',
    );
    expect(mutate).not.toHaveBeenCalled();
  });

  it('shows field-specific guidance from a 400 validation response', () => {
    setupMutate((_payload, callbacks) => {
      callbacks.onError?.({
        status: 400,
        data: {
          error: 'Invalid input.',
          details: { fieldErrors: { email: ['Invalid email address'] } },
        },
      });
      callbacks.onSettled?.();
    });
    render(<Register />);
    fillForm();
    fireEvent.click(screen.getByTestId('register-submit-button'));
    expect(screen.getByTestId('register-error')).toHaveTextContent(
      'Email: Invalid email address',
    );
  });
});

describe('registration failure handling', () => {
  it('prevents duplicate submissions while a request is in flight', () => {
    // The mutate mock never settles — simulates an in-flight request.
    const mutate = setupMutate();
    render(<Register />);
    fillForm();
    const form = screen.getByTestId('register-submit-button').closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('shows safe account-exists guidance on 409', () => {
    setupMutate((_payload, callbacks) => {
      callbacks.onError?.({
        status: 409,
        data: { error: 'An account with that email already exists.' },
      });
      callbacks.onSettled?.();
    });
    render(<Register />);
    fillForm();
    fireEvent.click(screen.getByTestId('register-submit-button'));
    const alert = screen.getByTestId('register-error');
    expect(alert).toHaveTextContent('An account with that email already exists.');
    expect(alert).toHaveTextContent('You can sign in below instead.');
  });

  it('never surfaces "Internal server error" — shows friendly copy plus support contact', () => {
    setupMutate((_payload, callbacks) => {
      callbacks.onError?.({ status: 500, data: { error: 'Internal server error' } });
      callbacks.onSettled?.();
    });
    render(<Register />);
    fillForm();
    fireEvent.click(screen.getByTestId('register-submit-button'));
    const alert = screen.getByTestId('register-error');
    expect(alert).toHaveTextContent(
      "We couldn't create your account right now. Please try again.",
    );
    expect(alert).not.toHaveTextContent('Internal server error');
    expect(screen.getByTestId('register-support-link')).toBeInTheDocument();
  });

  it('moves focus to the error summary when submission fails', () => {
    setupMutate((_payload, callbacks) => {
      callbacks.onError?.({ status: 500, data: null });
      callbacks.onSettled?.();
    });
    render(<Register />);
    fillForm();
    fireEvent.click(screen.getByTestId('register-submit-button'));
    expect(screen.getByTestId('register-error')).toHaveFocus();
  });

  it('allows a retry after a failure', () => {
    let failNext = true;
    const mutate = setupMutate((_payload, callbacks) => {
      if (failNext) {
        failNext = false;
        callbacks.onError?.({ status: 500, data: null });
      } else {
        callbacks.onSuccess?.({ token: 'retry-token', user: { role: 'client' } });
      }
      callbacks.onSettled?.();
    });
    render(<Register />);
    fillForm();
    fireEvent.click(screen.getByTestId('register-submit-button'));
    expect(screen.getByTestId('register-error')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('register-submit-button'));
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('oncallfoot_token')).toBe('retry-token');
  });
});

describe('registration loading state', () => {
  it('disables the submit button and shows a spinner while pending', () => {
    mockUseRegister.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    } as unknown as ReturnType<typeof useRegister>);
    render(<Register />);
    const button = screen.getByTestId('register-submit-button');
    expect(button).toBeDisabled();
    expect(screen.getByRole('status', { name: 'Creating your account' })).toBeInTheDocument();
  });
});

describe('registration accessibility', () => {
  it('has no axe violations on the form', async () => {
    setupMutate();
    const { container } = render(<Register />);
    const violations = await axeViolations(container);
    expect(violations).toEqual([]);
  });

  it('has no axe violations with the error summary shown', async () => {
    setupMutate((_payload, callbacks) => {
      callbacks.onError?.({ status: 500, data: null });
      callbacks.onSettled?.();
    });
    const { container } = render(<Register />);
    fillForm();
    fireEvent.click(screen.getByTestId('register-submit-button'));
    const violations = await axeViolations(container);
    expect(violations).toEqual([]);
  });
});
