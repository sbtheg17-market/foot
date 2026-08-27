/**
 * Provider onboarding — verification step (VerificationStep) — web tests.
 *
 * Regression coverage for the "Internal server error" blocker on document
 * submission: field-specific validation copy, bounded reference/notes,
 * loading + disabled submit (double-tap prevention), safe server-error copy
 * (never the raw "Internal server error"), preserved form values after a
 * recoverable failure, support link on true server failures, focus
 * management, success confirmation, and axe accessibility scans.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VerificationStep } from '../pages/onboarding/provider';
import { useGetMyVerification, useSubmitVerificationDoc } from '@workspace/api-client-react';
import { axeViolations } from '../test/axe';

vi.mock('wouter', () => ({
  useLocation: () => ['/onboarding/provider', vi.fn()],
}));
vi.mock('@workspace/api-client-react', () => ({
  useGetMyVerification: vi.fn(),
  useSubmitVerificationDoc: vi.fn(),
  useCreateApplicationService: vi.fn(),
  useCreateProviderApplication: vi.fn(),
  useDeleteApplicationService: vi.fn(),
  useGetApplicationAvailability: vi.fn(),
  useGetMe: vi.fn(),
  useGetProviderApplication: vi.fn(),
  useGetProviderApplicationCompletion: vi.fn(),
  useListApplicationServices: vi.fn(),
  useSetApplicationAvailability: vi.fn(),
  useSubmitProviderApplication: vi.fn(),
  useUpdateApplicationService: vi.fn(),
  useUpdateProviderApplication: vi.fn(),
}));
vi.mock('@/components/support-contact-link', () => ({
  default: ({ testId }: { testId: string }) => (
    <a data-testid={testId} href="mailto:support@example.test">
      Need help?
    </a>
  ),
}));

const mockVerification = vi.mocked(useGetMyVerification);
const mockSubmitDoc = vi.mocked(useSubmitVerificationDoc);

type MutateCallbacks = {
  onSuccess?: (res: unknown) => void;
  onError?: (err: unknown) => void;
};

function setupSubmit(
  impl?: (payload: unknown, callbacks: MutateCallbacks) => void,
  { isPending = false } = {},
) {
  const mutate = vi.fn((payload: unknown, callbacks: MutateCallbacks) => {
    impl?.(payload, callbacks);
  });
  mockSubmitDoc.mockReturnValue({
    mutate,
    isPending,
  } as unknown as ReturnType<typeof useSubmitVerificationDoc>);
  return mutate;
}

function renderStep() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <VerificationStep onNext={vi.fn()} onBack={vi.fn()} />
    </QueryClientProvider>,
  );
}

function openForm() {
  fireEvent.click(screen.getByTestId('verification-add-doc-btn'));
}

function fillReference(value: string) {
  fireEvent.change(screen.getByTestId('verification-reference-input'), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerification.mockReturnValue({
    data: { verificationStatus: 'pending', docs: [] },
    isLoading: false,
  } as unknown as ReturnType<typeof useGetMyVerification>);
});

describe('verification step form', () => {
  it('renders the purpose copy, type selection, and form fields', () => {
    setupSubmit();
    renderStep();
    expect(
      screen.getByText(/Submit the reference details for one credential/i),
    ).toBeTruthy();
    openForm();
    const select = screen.getByTestId('verification-doc-type-select') as HTMLSelectElement;
    expect(select.value).toBe('license');
    fireEvent.change(select, { target: { value: 'insurance' } });
    expect(select.value).toBe('insurance');
    expect(screen.getByTestId('verification-reference-input')).toBeTruthy();
    expect(screen.getByTestId('verification-notes-input')).toBeTruthy();
  });

  it('submits a valid document with trimmed values', () => {
    const mutate = setupSubmit();
    renderStep();
    openForm();
    fillReference('  License #RPN-12345  ');
    fireEvent.change(screen.getByTestId('verification-notes-input'), {
      target: { value: '  issued 2024  ' },
    });
    fireEvent.click(screen.getByTestId('verification-submit-btn'));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]![0]).toEqual({
      data: { docType: 'license', fileName: 'License #RPN-12345', notes: 'issued 2024' },
    });
  });

  it('shows the success confirmation and honest under-review copy after submission', () => {
    setupSubmit((_payload, cb) => cb.onSuccess?.({}));
    renderStep();
    openForm();
    fillReference('License #RPN-12345');
    fireEvent.click(screen.getByTestId('verification-submit-btn'));
    const status = screen.getByTestId('verification-success-status');
    expect(status.textContent).toContain('Document submitted.');
    expect(status.textContent).toContain('still under review');
  });
});

describe('validation copy and focus', () => {
  it('requires a document reference, focuses the error, and never calls the API', () => {
    const mutate = setupSubmit();
    renderStep();
    openForm();
    fireEvent.click(screen.getByTestId('verification-submit-btn'));
    const alert = screen.getByTestId('verification-error-alert');
    expect(alert.textContent).toContain('Enter a document reference.');
    expect(document.activeElement).toBe(alert);
    expect(mutate).not.toHaveBeenCalled();
  });

  it('enforces the reference length bound with clear copy', () => {
    const mutate = setupSubmit();
    renderStep();
    openForm();
    fillReference('x'.repeat(201));
    fireEvent.click(screen.getByTestId('verification-submit-btn'));
    expect(screen.getByTestId('verification-error-alert').textContent).toContain(
      'Keep the reference within the allowed length',
    );
    expect(mutate).not.toHaveBeenCalled();
  });

  it('shows the field-specific server message for a 400 response', () => {
    setupSubmit((_payload, cb) =>
      cb.onError?.({ status: 400, data: { error: 'docType must be one of: license, insurance, certification, other.' } }),
    );
    renderStep();
    openForm();
    fillReference('License #RPN-12345');
    fireEvent.click(screen.getByTestId('verification-submit-btn'));
    expect(screen.getByTestId('verification-error-alert').textContent).toContain(
      'docType must be one of',
    );
  });
});

describe('recoverable server failure', () => {
  it('shows safe copy (never "Internal server error"), a support link, and preserves entered values', () => {
    setupSubmit((_payload, cb) => cb.onError?.({ status: 500, data: { error: 'Internal server error' } }));
    renderStep();
    openForm();
    fillReference('License #RPN-12345');
    fireEvent.change(screen.getByTestId('verification-notes-input'), { target: { value: 'context' } });
    fireEvent.click(screen.getByTestId('verification-submit-btn'));

    const alert = screen.getByTestId('verification-error-alert');
    expect(alert.textContent).toContain("We couldn't submit this document right now.");
    expect(alert.textContent).toContain('Your information has not been lost.');
    expect(alert.textContent).not.toContain('Internal server error');
    expect(screen.getByTestId('verification-support-link')).toBeTruthy();

    const input = screen.getByTestId('verification-reference-input') as HTMLInputElement;
    const notes = screen.getByTestId('verification-notes-input') as HTMLTextAreaElement;
    expect(input.value).toBe('License #RPN-12345');
    expect(notes.value).toBe('context');
  });
});

describe('loading and duplicate-submission prevention', () => {
  it('disables the submit button and shows the loading label while pending', () => {
    setupSubmit(undefined, { isPending: true });
    renderStep();
    openForm();
    const button = screen.getByTestId('verification-submit-btn') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Submitting…');
  });

  it('ignores a double tap while a submission is pending', () => {
    const mutate = setupSubmit(undefined, { isPending: true });
    renderStep();
    openForm();
    fillReference('License #RPN-12345');
    const button = screen.getByTestId('verification-submit-btn');
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mutate).not.toHaveBeenCalled();
  });
});

describe('accessibility', () => {
  it('has no axe violations with the form open', async () => {
    setupSubmit();
    const { container } = renderStep();
    openForm();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('has no axe violations in the error state', async () => {
    setupSubmit((_payload, cb) => cb.onError?.({ status: 500, data: null }));
    const { container } = renderStep();
    openForm();
    fillReference('License #RPN-12345');
    fireEvent.click(screen.getByTestId('verification-submit-btn'));
    expect(await axeViolations(container)).toEqual([]);
  });
});
