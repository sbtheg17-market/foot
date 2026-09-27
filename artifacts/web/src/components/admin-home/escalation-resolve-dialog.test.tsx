import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import EscalationResolveDialog from './escalation-resolve-dialog';
import { useUpdateSupportEscalation } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { axeViolations } from '../../test/axe';

vi.mock('@workspace/api-client-react', () => ({
  useUpdateSupportEscalation: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const mockUpdate = vi.mocked(useUpdateSupportEscalation);
const updateMutate = vi.fn();

function arm({ pending = false } = {}) {
  mockUpdate.mockReturnValue({ mutate: updateMutate, isPending: pending } as unknown as ReturnType<typeof useUpdateSupportEscalation>);
}

const item = {
  id: 1,
  subject: 'Booking dispute — booking #6',
  status: 'open' as const,
  bookingId: 6,
  createdAt: '2026-09-27T02:05:14.472Z',
  updatedAt: '2026-09-27T02:05:14.472Z',
  requester: { userId: 33, firstName: 'Jane', lastName: 'Morrison', role: 'client' as const },
  messageCount: 1,
  latestMessage: { message: 'The visit ran 20 minutes short.', createdAt: '2026-09-27T02:05:14.472Z', fromAdmin: false },
};

type MutateCall = [
  { ticketId: number; data: { status: string; resolutionNote?: string } },
  { onSuccess: (r: unknown) => void; onError: (e: unknown) => void },
];

describe('EscalationResolveDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    arm();
  });

  it('shows the ticket facts and latest message', async () => {
    const { baseElement } = render(<EscalationResolveDialog item={item} open onOpenChange={vi.fn()} />);
    expect(screen.getByTestId('escalation-title')).toHaveTextContent('Support request #1');
    expect(screen.getByTestId('escalation-subject')).toHaveTextContent('Booking dispute — booking #6');
    expect(screen.getByTestId('escalation-status')).toHaveTextContent('open');
    expect(screen.getByTestId('escalation-latest-message')).toHaveTextContent('The visit ran 20 minutes short.');
    expect(screen.getByText(/Booking corrections and suspensions are not done from here/)).toBeInTheDocument();
    expect(await axeViolations(baseElement)).toEqual([]);
  });

  it('requires a written outcome before resolving, then records it', () => {
    const onDecided = vi.fn();
    const onOpenChange = vi.fn();
    render(<EscalationResolveDialog item={item} open onOpenChange={onOpenChange} onDecided={onDecided} />);
    const submit = screen.getByTestId('escalation-submit');
    expect(submit).toBeDisabled();
    expect(submit).toHaveTextContent('Resolve request');

    fireEvent.change(screen.getByTestId('escalation-note'), { target: { value: '   ' } });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByTestId('escalation-note'), { target: { value: '  Refunded the shortfall; provider reminded of visit length.  ' } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    const [vars, handlers] = updateMutate.mock.calls[0] as MutateCall;
    expect(vars).toEqual({ ticketId: 1, data: { status: 'resolved', resolutionNote: 'Refunded the shortfall; provider reminded of visit length.' } });

    act(() => handlers.onSuccess({ ticket: { id: 1, status: 'resolved' } }));
    expect(toast.success).toHaveBeenCalledWith('Request resolved', expect.anything());
    expect(onDecided).toHaveBeenCalledWith('resolved', { ticket: { id: 1, status: 'resolved' } });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('marks in progress without a note', () => {
    render(<EscalationResolveDialog item={item} open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('escalation-choose-progress'));
    const submit = screen.getByTestId('escalation-submit');
    expect(submit).toBeEnabled();
    expect(submit).toHaveTextContent('Save as in progress');
    fireEvent.click(submit);
    const [vars] = updateMutate.mock.calls[0] as MutateCall;
    expect(vars).toEqual({ ticketId: 1, data: { status: 'in_progress' } });
  });

  it('explains a 404 in plain language and keeps the dialog open', () => {
    const onOpenChange = vi.fn();
    render(<EscalationResolveDialog item={item} open onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByTestId('escalation-note'), { target: { value: 'done' } });
    fireEvent.click(screen.getByTestId('escalation-submit'));
    const [, handlers] = updateMutate.mock.calls[0] as MutateCall;
    act(() => handlers.onError({ status: 404, error: 'Ticket not found' }));
    expect(screen.getByTestId('escalation-error')).toHaveTextContent('no longer exists');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('disables actions while an update is in flight', () => {
    arm({ pending: true });
    render(<EscalationResolveDialog item={item} open onOpenChange={vi.fn()} />);
    expect(screen.getByTestId('escalation-submit')).toBeDisabled();
    expect(screen.getByTestId('escalation-cancel')).toBeDisabled();
  });
});
