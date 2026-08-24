import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RescheduleProposalCard from './reschedule-proposal-card';
import {
  useListRescheduleRequests,
  useAcceptRescheduleRequest,
  useDeclineRescheduleRequest,
  useGetReschedulingHistory,
} from '@workspace/api-client-react';
import { toast } from 'sonner';
import { axeViolations } from '../../test/axe';

vi.mock('@workspace/api-client-react', () => ({
  useListRescheduleRequests: vi.fn(),
  useAcceptRescheduleRequest: vi.fn(),
  useDeclineRescheduleRequest: vi.fn(),
  useGetReschedulingHistory: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const mockList = vi.mocked(useListRescheduleRequests);
const mockAccept = vi.mocked(useAcceptRescheduleRequest);
const mockDecline = vi.mocked(useDeclineRescheduleRequest);
const mockHistory = vi.mocked(useGetReschedulingHistory);

const pendingProposal = {
  id: 3,
  status: 'pending',
  proposedScheduledAt: '2026-09-12T15:00:00.000Z',
  originalScheduledAt: '2026-09-10T14:00:00.000Z',
  deadlineAt: '2026-09-08T14:00:00.000Z',
  reason: 'An earlier visit ran long',
};

const historyEntry = {
  id: 11,
  requesterRole: 'provider',
  originalScheduledAt: '2026-08-01T14:00:00.000Z',
  newScheduledAt: '2026-08-02T14:00:00.000Z',
  reason: 'Storm day',
};

const refetch = vi.fn();
const acceptMutate = vi.fn();
const declineMutate = vi.fn();
const onChanged = vi.fn();

function arm({
  loading = false,
  error = false,
  proposals = [pendingProposal],
  history = [] as (typeof historyEntry)[],
  acceptPending = false,
  declinePending = false,
} = {}) {
  mockList.mockReturnValue({
    data: loading || error ? undefined : { proposals },
    isLoading: loading,
    isError: error,
    refetch,
  } as unknown as ReturnType<typeof useListRescheduleRequests>);
  mockHistory.mockReturnValue({
    data: { history },
  } as unknown as ReturnType<typeof useGetReschedulingHistory>);
  mockAccept.mockReturnValue({
    mutate: acceptMutate,
    isPending: acceptPending,
  } as unknown as ReturnType<typeof useAcceptRescheduleRequest>);
  mockDecline.mockReturnValue({
    mutate: declineMutate,
    isPending: declinePending,
  } as unknown as ReturnType<typeof useDeclineRescheduleRequest>);
}

const baseProps = {
  bookingId: 7,
  isClient: true,
  timezone: 'America/Toronto',
  onChanged,
};

beforeEach(() => {
  vi.clearAllMocks();
  arm();
});

describe('RescheduleProposalCard — loading, empty and error states', () => {
  it('renders nothing while loading (no flash of stale consent UI)', () => {
    arm({ loading: true });
    const { container } = render(<RescheduleProposalCard {...baseProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there is no pending proposal and no history', () => {
    arm({ proposals: [], history: [] });
    const { container } = render(<RescheduleProposalCard {...baseProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a retryable error state when proposals cannot load', () => {
    arm({ error: true });
    render(<RescheduleProposalCard {...baseProps} />);
    expect(screen.getByTestId('reschedule-proposal-error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe('RescheduleProposalCard — consent-first display', () => {
  it('shows proposed, original and deadline instants in the marketplace timezone', () => {
    render(<RescheduleProposalCard {...baseProps} />);
    // 15:00Z → 11:00 a.m. EDT; original 14:00Z → 10:00 a.m. EDT.
    expect(screen.getByTestId('proposal-proposed-time')).toHaveTextContent(/11:00/);
    expect(screen.getByTestId('proposal-original-time')).toHaveTextContent(/10:00/);
    expect(screen.getByTestId('proposal-original-time')).toHaveTextContent(/stays/i);
    expect(screen.getByTestId('proposal-deadline')).toHaveTextContent(
      /no change happens automatically/i,
    );
    expect(screen.getByTestId('proposal-reason')).toHaveTextContent(
      'An earlier visit ran long',
    );
  });

  it('gives the client accept and decline actions', () => {
    render(<RescheduleProposalCard {...baseProps} />);
    expect(screen.getByTestId('proposal-accept-button')).toBeEnabled();
    expect(screen.getByTestId('proposal-decline-button')).toBeEnabled();
  });

  it('shows the provider a read-only awaiting state with no accept/decline', () => {
    render(<RescheduleProposalCard {...baseProps} isClient={false} />);
    expect(screen.getByTestId('reschedule-proposal-card')).toHaveTextContent(
      /awaiting the client/i,
    );
    expect(screen.queryByTestId('proposal-accept-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('proposal-decline-button')).not.toBeInTheDocument();
  });
});

describe('RescheduleProposalCard — accept/decline behavior', () => {
  it('accept resolves the pending proposal by id', () => {
    render(<RescheduleProposalCard {...baseProps} />);
    fireEvent.click(screen.getByTestId('proposal-accept-button'));
    expect(acceptMutate).toHaveBeenCalledTimes(1);
    expect(acceptMutate.mock.calls[0][0]).toEqual({ requestId: 3 });
    acceptMutate.mock.calls[0][1].onSuccess();
    expect(toast.success).toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalled();
    expect(refetch).toHaveBeenCalled();
  });

  it('decline keeps the original time and says so when it is still feasible', () => {
    render(<RescheduleProposalCard {...baseProps} />);
    fireEvent.click(screen.getByTestId('proposal-decline-button'));
    declineMutate.mock.calls[0][1].onSuccess({ originalTimeFeasible: true });
    expect(toast.success).toHaveBeenCalledWith(
      'Proposal declined — your original appointment is unchanged.',
    );
  });

  it('decline warns with the support message when the original time is no longer feasible', () => {
    render(<RescheduleProposalCard {...baseProps} />);
    fireEvent.click(screen.getByTestId('proposal-decline-button'));
    declineMutate.mock.calls[0][1].onSuccess({
      originalTimeFeasible: false,
      supportMessage: 'Your original time is no longer available — contact support.',
    });
    expect(toast.warning).toHaveBeenCalledWith(
      'Your original time is no longer available — contact support.',
    );
  });

  it('a stale accept (409 race) refreshes instead of pretending success', () => {
    render(<RescheduleProposalCard {...baseProps} />);
    fireEvent.click(screen.getByTestId('proposal-accept-button'));
    acceptMutate.mock.calls[0][1].onError({ status: 409 });
    expect(toast.info).toHaveBeenCalledWith(
      'This proposal was already resolved — refreshing.',
    );
    expect(refetch).toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalled();
  });

  it('disables both actions while either mutation is pending (no double resolution)', () => {
    arm({ acceptPending: true });
    render(<RescheduleProposalCard {...baseProps} />);
    expect(screen.getByTestId('proposal-accept-button')).toBeDisabled();
    expect(screen.getByTestId('proposal-decline-button')).toBeDisabled();
    fireEvent.click(screen.getByTestId('proposal-decline-button'));
    expect(declineMutate).not.toHaveBeenCalled();
  });
});

describe('RescheduleProposalCard — history timeline', () => {
  it('renders the append-only accepted-change history', () => {
    arm({ history: [historyEntry] });
    render(<RescheduleProposalCard {...baseProps} />);
    const entry = screen.getByTestId('history-entry-11');
    expect(entry).toHaveTextContent(/provider/i);
    expect(entry).toHaveTextContent(/moved/i);
    expect(entry).toHaveTextContent('Storm day');
  });
});

describe('RescheduleProposalCard — accessibility', () => {
  it('pending proposal and history are labeled regions', () => {
    arm({ history: [historyEntry] });
    render(<RescheduleProposalCard {...baseProps} />);
    expect(
      screen.getByRole('region', { name: /pending reschedule proposal/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: /rescheduling history/i }),
    ).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    arm({ history: [historyEntry] });
    const { container } = render(<RescheduleProposalCard {...baseProps} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
