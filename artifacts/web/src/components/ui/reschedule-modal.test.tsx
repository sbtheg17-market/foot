import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import RescheduleModal from './reschedule-modal';
import {
  useGetProviderSlots,
  useUpdateBookingStatus,
  useCreateRescheduleRequest,
} from '@workspace/api-client-react';
import { toast } from 'sonner';
import { axeViolations } from '../../test/axe';

vi.mock('@workspace/api-client-react', () => ({
  useGetProviderSlots: vi.fn(),
  useUpdateBookingStatus: vi.fn(),
  useCreateRescheduleRequest: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const mockSlots = vi.mocked(useGetProviderSlots);
const mockUpdate = vi.mocked(useUpdateBookingStatus);
const mockProposal = vi.mocked(useCreateRescheduleRequest);

const SLOT_CURRENT = '2026-09-10T14:00:00.000Z';
const SLOT_OPEN = '2026-09-10T15:00:00.000Z';
const SLOT_TAKEN = '2026-09-10T16:00:00.000Z';

const slotsData = {
  timezone: 'America/Toronto',
  slots: [
    { start: SLOT_CURRENT, available: true },
    { start: SLOT_OPEN, available: true },
    { start: SLOT_TAKEN, available: false },
  ],
};

const refetchSlots = vi.fn();
const updateMutate = vi.fn();
const proposalMutate = vi.fn();

function arm({
  loading = false,
  slots = slotsData,
  updatePending = false,
  proposalPending = false,
}: {
  loading?: boolean;
  slots?: typeof slotsData | { timezone: string; slots: never[] };
  updatePending?: boolean;
  proposalPending?: boolean;
} = {}) {
  mockSlots.mockReturnValue({
    data: loading ? undefined : slots,
    isLoading: loading,
    refetch: refetchSlots,
  } as unknown as ReturnType<typeof useGetProviderSlots>);
  mockUpdate.mockReturnValue({
    mutate: updateMutate,
    isPending: updatePending,
  } as unknown as ReturnType<typeof useUpdateBookingStatus>);
  mockProposal.mockReturnValue({
    mutate: proposalMutate,
    isPending: proposalPending,
  } as unknown as ReturnType<typeof useCreateRescheduleRequest>);
}

const onClose = vi.fn();
const onSuccess = vi.fn();

const baseProps = {
  bookingId: 7,
  providerId: 1,
  providerName: 'Sarah Chen',
  service: { id: 1, title: 'Nail trim', priceCents: 4500, durationMinutes: 60 },
  currentScheduledAt: SLOT_CURRENT,
  onClose,
  onSuccess,
};

beforeEach(() => {
  vi.clearAllMocks();
  arm();
});

describe('RescheduleModal — loading and empty states', () => {
  it('shows an accessible loading indicator while slots load', () => {
    arm({ loading: true });
    render(<RescheduleModal {...baseProps} />);
    const loadingEl = screen.getByTestId('reschedule-slots-loading');
    expect(loadingEl).toBeInTheDocument();
    expect(loadingEl).toHaveAttribute('role', 'status');
  });

  it('shows an empty state when the day has no slots', () => {
    arm({ slots: { timezone: 'America/Toronto', slots: [] } });
    render(<RescheduleModal {...baseProps} />);
    expect(screen.getByTestId('reschedule-no-slots')).toHaveTextContent(
      /no available times/i,
    );
  });
});

describe('RescheduleModal — timezone display', () => {
  it('labels slot times with the marketplace timezone', () => {
    render(<RescheduleModal {...baseProps} />);
    expect(screen.getByTestId('reschedule-timezone-label')).toHaveTextContent(
      'Times shown in America/Toronto',
    );
  });

  it('labels the current appointment in the marketplace timezone', () => {
    render(<RescheduleModal {...baseProps} />);
    // 14:00 UTC on 2026-09-10 is 10:00 a.m. EDT in Toronto.
    expect(screen.getByTestId('reschedule-current-time')).toHaveTextContent(/10:00/);
  });
});

describe('RescheduleModal — slot rules', () => {
  it('disables the current appointment slot and marks it non-color ("current" text + label)', () => {
    render(<RescheduleModal {...baseProps} />);
    const current = screen.getByTestId(`reschedule-slot-${SLOT_CURRENT}`);
    expect(current).toBeDisabled();
    expect(current).toHaveTextContent('current');
    expect(current).toHaveAccessibleName(/current appointment time, unavailable/i);
  });

  it('disables occupied slots with an explicit unavailable label', () => {
    render(<RescheduleModal {...baseProps} />);
    const taken = screen.getByTestId(`reschedule-slot-${SLOT_TAKEN}`);
    expect(taken).toBeDisabled();
    expect(taken).toHaveAccessibleName(/unavailable/i);
  });

  it('keeps submit disabled until an available slot is chosen', () => {
    render(<RescheduleModal {...baseProps} />);
    const submit = screen.getByTestId('reschedule-submit-button');
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByTestId(`reschedule-slot-${SLOT_OPEN}`));
    expect(submit).toBeEnabled();
  });
});

describe('RescheduleModal — client reschedule submit', () => {
  it('submits the exact server slot ISO through the status contract', () => {
    render(<RescheduleModal {...baseProps} />);
    fireEvent.click(screen.getByTestId(`reschedule-slot-${SLOT_OPEN}`));
    fireEvent.click(screen.getByTestId('reschedule-submit-button'));
    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate.mock.calls[0][0]).toEqual({
      bookingId: 7,
      data: { status: 'rescheduled', scheduledAt: SLOT_OPEN },
    });
  });

  it('confirms success and hands control back to the caller', () => {
    render(<RescheduleModal {...baseProps} />);
    fireEvent.click(screen.getByTestId(`reschedule-slot-${SLOT_OPEN}`));
    fireEvent.click(screen.getByTestId('reschedule-submit-button'));
    updateMutate.mock.calls[0][1].onSuccess();
    expect(toast.success).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('recovers in place when the slot was just taken: clears the pick and refreshes the grid', () => {
    render(<RescheduleModal {...baseProps} />);
    fireEvent.click(screen.getByTestId(`reschedule-slot-${SLOT_OPEN}`));
    fireEvent.click(screen.getByTestId('reschedule-submit-button'));
    act(() =>
      updateMutate.mock.calls[0][1].onError({
        status: 409,
        data: { error: 'This time overlaps another appointment for this provider.' },
      }),
    );
    expect(toast.info).toHaveBeenCalledWith(
      'That time is no longer available. Please choose another slot.',
    );
    expect(refetchSlots).toHaveBeenCalled();
    expect(screen.getByTestId('reschedule-submit-button')).toBeDisabled();
  });

  it('closes safely on a 409 state conflict (booking changed underneath)', () => {
    render(<RescheduleModal {...baseProps} />);
    fireEvent.click(screen.getByTestId(`reschedule-slot-${SLOT_OPEN}`));
    fireEvent.click(screen.getByTestId('reschedule-submit-button'));
    updateMutate.mock.calls[0][1].onError({
      status: 409,
      data: { error: 'Invalid status transition.' },
    });
    expect(toast.info).toHaveBeenCalledWith(
      'This booking can no longer be rescheduled — refreshing.',
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('handles unauthorized access without leaking details', () => {
    render(<RescheduleModal {...baseProps} />);
    fireEvent.click(screen.getByTestId(`reschedule-slot-${SLOT_OPEN}`));
    fireEvent.click(screen.getByTestId('reschedule-submit-button'));
    updateMutate.mock.calls[0][1].onError({ status: 403, data: { error: 'Forbidden' } });
    expect(toast.error).toHaveBeenCalledWith('You do not have access to this booking.');
    expect(onClose).toHaveBeenCalled();
  });

  it('never re-submits while a request is pending (duplicate-submit protection)', () => {
    arm({ updatePending: true });
    render(<RescheduleModal {...baseProps} />);
    const submit = screen.getByTestId('reschedule-submit-button');
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(updateMutate).not.toHaveBeenCalled();
  });
});

describe('RescheduleModal — provider consent-first proposal', () => {
  it('creates a proposal (never a direct time change) with a stable idempotency key', () => {
    render(<RescheduleModal {...baseProps} perspective="provider" />);
    fireEvent.change(screen.getByTestId('reschedule-reason-input'), {
      target: { value: 'Earlier visit ran long' },
    });
    fireEvent.click(screen.getByTestId(`reschedule-slot-${SLOT_OPEN}`));
    fireEvent.click(screen.getByTestId('reschedule-submit-button'));
    expect(proposalMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate).not.toHaveBeenCalled();
    const args = proposalMutate.mock.calls[0][0];
    expect(args.bookingId).toBe(7);
    expect(args.data.proposedScheduledAt).toBe(SLOT_OPEN);
    expect(args.data.reason).toBe('Earlier visit ran long');
    expect(typeof args.data.idempotencyKey).toBe('string');
    expect(args.data.idempotencyKey.length).toBeGreaterThan(10);
  });

  it('surfaces the single-pending-proposal rule and closes', () => {
    render(<RescheduleModal {...baseProps} perspective="provider" />);
    fireEvent.click(screen.getByTestId(`reschedule-slot-${SLOT_OPEN}`));
    fireEvent.click(screen.getByTestId('reschedule-submit-button'));
    proposalMutate.mock.calls[0][1].onError({
      status: 409,
      data: { error: "A time change is already awaiting the client's response." },
    });
    expect(toast.info).toHaveBeenCalledWith(
      'A proposal is already awaiting this client — they need to respond first.',
    );
    expect(onClose).toHaveBeenCalled();
  });
});

describe('RescheduleModal — accessibility', () => {
  it('is a labeled modal dialog', () => {
    render(<RescheduleModal {...baseProps} />);
    const dialog = screen.getByRole('dialog', { name: /reschedule appointment/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('moves focus into the dialog on open', () => {
    render(<RescheduleModal {...baseProps} />);
    expect(screen.getByTestId('reschedule-modal-close')).toHaveFocus();
  });

  it('closes on Escape', () => {
    render(<RescheduleModal {...baseProps} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape mid-submit so an in-flight request is never orphaned', () => {
    arm({ updatePending: true });
    render(<RescheduleModal {...baseProps} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('slot buttons expose selection state to assistive tech (aria-pressed)', () => {
    render(<RescheduleModal {...baseProps} />);
    const open = screen.getByTestId(`reschedule-slot-${SLOT_OPEN}`);
    expect(open).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(open);
    expect(open).toHaveAttribute('aria-pressed', 'true');
  });

  it('has no axe violations (loaded slot grid)', async () => {
    const { container } = render(<RescheduleModal {...baseProps} />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('has no axe violations (empty state)', async () => {
    arm({ slots: { timezone: 'America/Toronto', slots: [] } });
    const { container } = render(<RescheduleModal {...baseProps} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
