import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CredentialDecisionDialog from './credential-decision-dialog';
import { useReviewVerificationDoc } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { axeViolations } from '../../test/axe';

vi.mock('@workspace/api-client-react', () => ({
  useReviewVerificationDoc: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const mockReview = vi.mocked(useReviewVerificationDoc);
const reviewMutate = vi.fn();

function arm({ pending = false } = {}) {
  mockReview.mockReturnValue({ mutate: reviewMutate, isPending: pending } as unknown as ReturnType<typeof useReviewVerificationDoc>);
}

const item = {
  doc: {
    id: 5,
    providerId: 11,
    docType: 'insurance' as const,
    fileName: 'qa-test-insurance-placeholder',
    status: 'pending' as const,
    reviewerNotes: 'Uploaded from my phone',
    submittedAt: '2026-09-27T02:05:01.165Z',
    reviewedAt: null,
  },
  provider: {
    id: 11,
    userId: 29,
    city: 'Testville',
    verificationStatus: 'under_review' as const,
    firstName: 'QA',
    lastName: 'Provider',
    email: 'qa.provider@example.test',
  },
};

type MutateCall = [
  { docId: number; data: { status: string; reviewerNotes?: string; updateProviderStatus?: string } },
  { onSuccess: (r: unknown) => void; onError: (e: unknown) => void },
];

describe('CredentialDecisionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    arm();
  });

  it('shows document facts, the provider upload note and the profile-flip choice', async () => {
    const { baseElement } = render(
      <CredentialDecisionDialog item={item} open onOpenChange={vi.fn()} otherPendingDocs={0} />,
    );
    expect(screen.getByTestId('credential-title')).toHaveTextContent('Review credential #5');
    expect(screen.getByTestId('credential-doc-type')).toHaveTextContent('insurance');
    expect(screen.getByTestId('credential-profile-status')).toHaveTextContent('under review');
    expect(screen.getByTestId('credential-file')).toHaveTextContent('qa-test-insurance-placeholder');
    expect(screen.getByTestId('credential-upload-note')).toHaveTextContent('Uploaded from my phone');
    expect(screen.getByTestId('credential-flip-checkbox')).toBeChecked();
    expect(screen.getByTestId('credential-flip-profile')).toHaveTextContent('profile verification as approved');
    expect(await axeViolations(baseElement)).toEqual([]);
  });

  it('approves and flips the profile by default', () => {
    const onDecided = vi.fn();
    const onOpenChange = vi.fn();
    render(<CredentialDecisionDialog item={item} open onOpenChange={onOpenChange} otherPendingDocs={0} onDecided={onDecided} />);
    fireEvent.change(screen.getByTestId('credential-notes'), { target: { value: '  policy number verified  ' } });
    fireEvent.click(screen.getByTestId('credential-submit'));
    expect(reviewMutate).toHaveBeenCalledTimes(1);
    const [vars, handlers] = reviewMutate.mock.calls[0] as MutateCall;
    expect(vars).toEqual({ docId: 5, data: { status: 'approved', reviewerNotes: 'policy number verified', updateProviderStatus: 'approved' } });

    act(() => handlers.onSuccess({ doc: { id: 5, status: 'approved' } }));
    expect(toast.success).toHaveBeenCalledWith('Credential approved', expect.objectContaining({
      description: expect.stringMatching(/Profile verification is now approved/),
    }));
    expect(onDecided).toHaveBeenCalledWith('approved', { doc: { id: 5, status: 'approved' } });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('leaves the profile untouched when the flip is unticked and says so', () => {
    render(<CredentialDecisionDialog item={item} open onOpenChange={vi.fn()} otherPendingDocs={2} />);
    expect(screen.getByTestId('credential-flip-profile')).toHaveTextContent('2 other documents still pending');
    fireEvent.click(screen.getByTestId('credential-flip-checkbox'));
    fireEvent.click(screen.getByTestId('credential-submit'));
    const [vars, handlers] = reviewMutate.mock.calls[0] as MutateCall;
    expect(vars).toEqual({ docId: 5, data: { status: 'approved', reviewerNotes: undefined, updateProviderStatus: undefined } });
    act(() => handlers.onSuccess({ doc: { id: 5, status: 'approved' } }));
    expect(toast.success).toHaveBeenCalledWith('Credential approved', expect.objectContaining({
      description: expect.stringMatching(/2 more documents from this provider still need a decision/),
    }));
  });

  it('rejects with the profile set to rejected', () => {
    render(<CredentialDecisionDialog item={item} open onOpenChange={vi.fn()} otherPendingDocs={0} />);
    fireEvent.click(screen.getByTestId('credential-choose-reject'));
    expect(screen.getByTestId('credential-flip-profile')).toHaveTextContent('profile verification to rejected');
    expect(screen.getByTestId('credential-submit')).toHaveTextContent('Reject credential');
    fireEvent.click(screen.getByTestId('credential-submit'));
    const [vars] = reviewMutate.mock.calls[0] as MutateCall;
    expect(vars.data).toEqual({ status: 'rejected', reviewerNotes: undefined, updateProviderStatus: 'rejected' });
  });

  it('records on the document only when the profile is already approved', () => {
    const approved = { ...item, provider: { ...item.provider, verificationStatus: 'approved' as const } };
    render(<CredentialDecisionDialog item={approved} open onOpenChange={vi.fn()} otherPendingDocs={0} />);
    expect(screen.getByTestId('credential-profile-note')).toHaveTextContent('already approved');
    expect(screen.queryByTestId('credential-flip-checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('credential-submit'));
    const [vars] = reviewMutate.mock.calls[0] as MutateCall;
    expect(vars.data.updateProviderStatus).toBeUndefined();
  });

  it('explains a 404 in plain language and keeps the dialog open', () => {
    const onOpenChange = vi.fn();
    render(<CredentialDecisionDialog item={item} open onOpenChange={onOpenChange} otherPendingDocs={0} />);
    fireEvent.click(screen.getByTestId('credential-submit'));
    const [, handlers] = reviewMutate.mock.calls[0] as MutateCall;
    act(() => handlers.onError({ status: 404, error: 'Verification document not found' }));
    expect(screen.getByTestId('credential-error')).toHaveTextContent('no longer exists');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('disables actions while a decision is in flight', () => {
    arm({ pending: true });
    render(<CredentialDecisionDialog item={item} open onOpenChange={vi.fn()} otherPendingDocs={0} />);
    expect(screen.getByTestId('credential-submit')).toBeDisabled();
    expect(screen.getByTestId('credential-cancel')).toBeDisabled();
  });
});
