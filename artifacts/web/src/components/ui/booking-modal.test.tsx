import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import BookingModal from './booking-modal';
import { useCreateBooking, useGetProviderSlots } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { axeViolations } from '../../test/axe';

vi.mock('@workspace/api-client-react', () => ({
  useCreateBooking: vi.fn(),
  useGetProviderSlots: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('wouter', () => ({
  useLocation: () => ['/', vi.fn()],
}));

const mockSlots = vi.mocked(useGetProviderSlots);
const mockCreate = vi.mocked(useCreateBooking);

const SLOT_OPEN = '2026-09-10T15:00:00.000Z';
const SLOT_TAKEN = '2026-09-10T16:00:00.000Z';

const slotsData = {
  timezone: 'America/Toronto',
  slots: [
    { start: SLOT_OPEN, available: true },
    { start: SLOT_TAKEN, available: false },
  ],
};

const refetchSlots = vi.fn();
const createMutate = vi.fn();

function arm({ loading = false, slots = slotsData, pending = false } = {}) {
  mockSlots.mockReturnValue({
    data: loading ? undefined : slots,
    isLoading: loading,
    refetch: refetchSlots,
  } as unknown as ReturnType<typeof useGetProviderSlots>);
  mockCreate.mockReturnValue({
    mutate: createMutate,
    isPending: pending,
  } as unknown as ReturnType<typeof useCreateBooking>);
}

const baseProps = {
  providerId: 1,
  providerName: 'Sarah Chen',
  service: { id: 1, title: 'Nail trim', priceCents: 4500, durationMinutes: 60 },
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

function fillAddress() {
  fireEvent.change(screen.getByTestId('booking-address-input'), {
    target: { value: '12 Cedar Ave' },
  });
  fireEvent.change(screen.getByTestId('booking-city-input'), {
    target: { value: 'Toronto' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  arm();
});

describe('BookingModal — states', () => {
  it('shows the empty state when a date has no slots', () => {
    arm({ slots: { timezone: 'America/Toronto', slots: [] } });
    render(<BookingModal {...baseProps} />);
    expect(screen.getByTestId('booking-no-slots')).toBeInTheDocument();
  });

  it('labels slot times with the marketplace timezone', () => {
    render(<BookingModal {...baseProps} />);
    expect(screen.getByTestId('booking-timezone-label')).toHaveTextContent(
      'Times shown in America/Toronto',
    );
  });

  it('disables occupied slots', () => {
    render(<BookingModal {...baseProps} />);
    expect(screen.getByTestId(`booking-slot-${SLOT_TAKEN}`)).toBeDisabled();
  });

  it('keeps submit disabled until a slot is picked', () => {
    render(<BookingModal {...baseProps} />);
    const submit = screen.getByTestId('booking-submit-button');
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByTestId(`booking-slot-${SLOT_OPEN}`));
    expect(submit).toBeEnabled();
  });
});

describe('BookingModal — booking submit', () => {
  it('requires the address before submitting', () => {
    render(<BookingModal {...baseProps} />);
    fireEvent.click(screen.getByTestId(`booking-slot-${SLOT_OPEN}`));
    fireEvent.click(screen.getByTestId('booking-submit-button'));
    expect(toast.error).toHaveBeenCalledWith('Please fill in the address and city.');
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('submits the exact server slot ISO (never a client-parsed datetime)', () => {
    render(<BookingModal {...baseProps} />);
    fillAddress();
    fireEvent.click(screen.getByTestId(`booking-slot-${SLOT_OPEN}`));
    fireEvent.click(screen.getByTestId('booking-submit-button'));
    expect(createMutate).toHaveBeenCalledTimes(1);
    const args = createMutate.mock.calls[0][0];
    expect(args.data.scheduledAt).toBe(SLOT_OPEN);
    expect(args.data.providerId).toBe(1);
    expect(args.data.serviceId).toBe(1);
    expect(args.data.address).toBe('12 Cedar Ave');
    expect(args.data.city).toBe('Toronto');
  });

  it('recovers when the slot was just taken: clears the pick and refreshes the grid', () => {
    render(<BookingModal {...baseProps} />);
    fillAddress();
    fireEvent.click(screen.getByTestId(`booking-slot-${SLOT_OPEN}`));
    fireEvent.click(screen.getByTestId('booking-submit-button'));
    act(() =>
      createMutate.mock.calls[0][1].onError({
        status: 409,
        data: { error: 'Provider unavailable.', reason: 'provider_unavailable' },
      }),
    );
    expect(toast.info).toHaveBeenCalledWith(
      'That time is no longer available. Please choose another slot.',
    );
    expect(refetchSlots).toHaveBeenCalled();
    expect(screen.getByTestId('booking-submit-button')).toBeDisabled();
  });

  it('explains a duplicate booking instead of showing database internals', () => {
    render(<BookingModal {...baseProps} />);
    fillAddress();
    fireEvent.click(screen.getByTestId(`booking-slot-${SLOT_OPEN}`));
    fireEvent.click(screen.getByTestId('booking-submit-button'));
    createMutate.mock.calls[0][1].onError({
      status: 409,
      data: {
        error: 'You already have an active request…',
        reason: 'duplicate_booking',
        bookingId: 5,
      },
    });
    expect(toast.info).toHaveBeenCalledWith(
      'You already have a booking for this time. Check your bookings.',
    );
  });

  it('blocks duplicate submits while pending', () => {
    arm({ pending: true });
    render(<BookingModal {...baseProps} />);
    expect(screen.getByTestId('booking-submit-button')).toBeDisabled();
  });
});

describe('BookingModal — accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(<BookingModal {...baseProps} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
