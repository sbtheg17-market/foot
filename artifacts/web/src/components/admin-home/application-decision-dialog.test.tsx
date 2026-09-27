import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ApplicationDecisionDialog from './application-decision-dialog';
import { useApproveProviderApplication, useRejectProviderApplication } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { axeViolations } from '../../test/axe';

vi.mock('@workspace/api-client-react', () => ({
  useApproveProviderApplication: vi.fn(),
  useRejectProviderApplication: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('wouter', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const mockApprove = vi.mocked(useApproveProviderApplication);
const mockReject = vi.mocked(useRejectProviderApplication);
const approveMutate = vi.fn();
const rejectMutate = vi.fn();

function arm({ pending = false } = {}) {
  mockApprove.mockReturnValue({ mutate: approveMutate, isPending: pending } as unknown as ReturnType<typeof useApproveProviderApplication>);
  mockReject.mockReturnValue({ mutate: rejectMutate, isPending: false } as unknown as ReturnType<typeof useRejectProviderApplication>);
}

const item = {
  application: {
    id: 5,
    status: 'under_review' as const,
    currentStep: 'submitted',
    submittedAt: '2026-08-27T18:34:40.656Z',
    reviewedAt: null,
    createdAt: '2026-08-27T18:00:00.000Z',
    updatedAt: '2026-08-27T18:34:40.656Z',
  },
  applicant: {
    userId: 42,
    firstName: 'Scraps',
    lastName: 'Footcare',
    email: 'scraps@example.com',
    providerProfileId: 9,
    city: 'Burlington',
    verificationStatus: 'under_review',
  },
};

describe('ApplicationDecisionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    arm();
  });

  it('shows applicant facts, pending docs and the two-part gate note', async () => {
    const { baseElement } = render(
      <ApplicationDecisionDialog item={item} open onOpenChange={vi.fn()} pendingDocs={1} />,
    );
    expect(screen.getByTestId('decision-title')).toHaveTextContent('Decide application #5');
    expect(screen.getByTestId('decision-pending-docs')).toHaveTextContent('1 document');
    expect(screen.getByTestId('decision-verification-status')).toHaveTextContent('under review');
    expect(screen.getByTestId('decision-gate-note')).toHaveTextContent('profile verification is also approved');
    expect(screen.getByText(/never shown to the provider/i)).toBeInTheDocument();
    expect(await axeViolations(baseElement)).toEqual([]);
  });

  it('approves with optional private notes', () => {
    const onDecided = vi.fn();
    const onOpenChange = vi.fn();
    render(<ApplicationDecisionDialog item={item} open onOpenChange={onOpenChange} pendingDocs={0} onDecided={onDecided} />);
    fireEvent.change(screen.getByTestId('decision-notes'), { target: { value: '  checked license  ' } });
    fireEvent.click(screen.getByTestId('decision-submit'));
    expect(approveMutate).toHaveBeenCalledTimes(1);
    const [vars, handlers] = approveMutate.mock.calls[0] as [
      { applicationId: number; data: { reviewerNotes?: string } },
      { onSuccess: (r: unknown) => void },
    ];
    expect(vars).toEqual({ applicationId: 5, data: { reviewerNotes: 'checked license' } });
    expect(rejectMutate).not.toHaveBeenCalled();

    act(() => handlers.onSuccess({ application: { id: 5, status: 'approved' } }));
    expect(toast.success).toHaveBeenCalledWith('Application approved', expect.objectContaining({
      description: expect.stringMatching(/Verification page/),
    }));
    expect(onDecided).toHaveBeenCalledWith('approve', { application: { id: 5, status: 'approved' } });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('blocks rejection until a provider-visible reason is entered, then sends it', () => {
    render(<ApplicationDecisionDialog item={item} open onOpenChange={vi.fn()} pendingDocs={0} />);
    fireEvent.click(screen.getByTestId('decision-choose-reject'));
    const submit = screen.getByTestId('decision-submit');
    expect(submit).toBeDisabled();
    expect(submit).toHaveTextContent('Reject application');

    fireEvent.change(screen.getByTestId('decision-reason'), { target: { value: '   ' } });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByTestId('decision-reason'), { target: { value: 'Insurance certificate expired.' } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(rejectMutate).toHaveBeenCalledTimes(1);
    const [vars] = rejectMutate.mock.calls[0] as [{ applicationId: number; data: { rejectionReason: string; reviewerNotes?: string } }];
    expect(vars).toEqual({ applicationId: 5, data: { rejectionReason: 'Insurance certificate expired.', reviewerNotes: undefined } });
    expect(approveMutate).not.toHaveBeenCalled();
  });

  it('explains a 409 conflict in plain language and keeps the dialog open', () => {
    const onOpenChange = vi.fn();
    render(<ApplicationDecisionDialog item={item} open onOpenChange={onOpenChange} pendingDocs={0} />);
    fireEvent.click(screen.getByTestId('decision-submit'));
    const [, handlers] = approveMutate.mock.calls[0] as [unknown, { onError: (e: unknown) => void }];
    act(() => handlers.onError({ status: 409, error: 'Applications in status "approved" cannot be decided' }));
    expect(screen.getByTestId('decision-error')).toHaveTextContent('no longer under review');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('disables actions while a decision is in flight', () => {
    arm({ pending: true });
    render(<ApplicationDecisionDialog item={item} open onOpenChange={vi.fn()} pendingDocs={0} />);
    expect(screen.getByTestId('decision-submit')).toBeDisabled();
    expect(screen.getByTestId('decision-cancel')).toBeDisabled();
  });
});
