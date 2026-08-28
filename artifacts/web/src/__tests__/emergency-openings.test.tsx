/**
 * Emergency openings section — provider availability page.
 *
 * Covers: loading/empty/list states, truthful urgent-only badge, service
 * labels, create payload normalization (empty service selection omitted),
 * delete flow, honest server-error surfacing (409 bookings_exist), and an
 * axe accessibility scan of the section.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmergencyOpeningsSection, { formatOpeningDate } from '../components/emergency-openings-section';
import {
  useListMyEmergencyOpenings,
  useCreateEmergencyOpening,
  useDeleteEmergencyOpening,
  useListMyServices,
} from '@workspace/api-client-react';
import { toast } from 'sonner';
import { axeViolations } from '../test/axe';

vi.mock('@workspace/api-client-react', () => ({
  useListMyEmergencyOpenings: vi.fn(),
  useCreateEmergencyOpening: vi.fn(),
  useDeleteEmergencyOpening: vi.fn(),
  useListMyServices: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

const mockList = vi.mocked(useListMyEmergencyOpenings);
const mockCreate = vi.mocked(useCreateEmergencyOpening);
const mockDelete = vi.mocked(useDeleteEmergencyOpening);
const mockServices = vi.mocked(useListMyServices);

const services = {
  services: [
    { id: 1, title: 'Home Foot Care', isActive: true },
    { id: 2, title: 'Nail Trim', isActive: true },
    { id: 3, title: 'Old Service', isActive: false },
  ],
};

const openings = {
  openings: [
    { id: 10, date: '2027-01-10', startTime: '10:00', endTime: '12:00', serviceIds: null, urgentOnly: false },
    { id: 11, date: '2027-01-17', startTime: '18:00', endTime: '20:00', serviceIds: [1], urgentOnly: true },
  ],
};

function arrange(overrides: {
  list?: Partial<ReturnType<typeof useListMyEmergencyOpenings>>;
  createMutate?: ReturnType<typeof vi.fn>;
  deleteMutate?: ReturnType<typeof vi.fn>;
} = {}) {
  mockList.mockReturnValue({ data: openings, isLoading: false, ...overrides.list } as never);
  mockServices.mockReturnValue({ data: services } as never);
  mockCreate.mockReturnValue({ mutate: overrides.createMutate ?? vi.fn(), isPending: false } as never);
  mockDelete.mockReturnValue({ mutate: overrides.deleteMutate ?? vi.fn(), isPending: false } as never);
  return render(<EmergencyOpeningsSection />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('formatOpeningDate', () => {
  it('formats a plain calendar date without timezone drift', () => {
    expect(formatOpeningDate('2027-01-10')).toMatch(/Jan 10/);
  });
});

describe('EmergencyOpeningsSection', () => {
  it('shows a loading spinner while fetching', () => {
    arrange({ list: { data: undefined, isLoading: true } as never });
    expect(screen.getByTestId('emergency-openings-loading')).toBeTruthy();
  });

  it('shows a calm empty state when there are no openings', () => {
    arrange({ list: { data: { openings: [] }, isLoading: false } as never });
    expect(screen.getByTestId('emergency-openings-empty').textContent).toContain('No upcoming emergency openings');
  });

  it('lists openings with time window, service label, and urgent badge only when set', () => {
    arrange();
    const row10 = screen.getByTestId('emergency-opening-row-10');
    expect(row10.textContent).toContain('10:00–12:00');
    expect(row10.textContent).toContain('All services');
    expect(screen.queryByTestId('emergency-opening-urgent-badge-10')).toBeNull();

    const row11 = screen.getByTestId('emergency-opening-row-11');
    expect(row11.textContent).toContain('Home Foot Care');
    expect(screen.getByTestId('emergency-opening-urgent-badge-11').textContent).toContain('Urgent only');
  });

  it('submits a create payload and omits an empty service restriction', () => {
    const createMutate = vi.fn();
    arrange({ createMutate });
    fireEvent.click(screen.getByTestId('emergency-opening-add-btn'));
    fireEvent.change(screen.getByTestId('emergency-opening-date-input'), { target: { value: '2027-02-01' } });
    fireEvent.change(screen.getByTestId('emergency-opening-start-input'), { target: { value: '08:00' } });
    fireEvent.change(screen.getByTestId('emergency-opening-end-input'), { target: { value: '09:30' } });
    fireEvent.submit(screen.getByTestId('emergency-opening-form'));

    expect(createMutate).toHaveBeenCalledTimes(1);
    const payload = createMutate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(payload.data).toEqual({
      date: '2027-02-01',
      startTime: '08:00',
      endTime: '09:30',
      urgentOnly: false,
    });
    expect('serviceIds' in payload.data).toBe(false);
  });

  it('includes selected services and the urgent flag in the payload', () => {
    const createMutate = vi.fn();
    arrange({ createMutate });
    fireEvent.click(screen.getByTestId('emergency-opening-add-btn'));
    fireEvent.click(screen.getByTestId('emergency-opening-service-2'));
    fireEvent.click(screen.getByTestId('emergency-opening-urgent-checkbox'));
    fireEvent.submit(screen.getByTestId('emergency-opening-form'));

    const payload = createMutate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(payload.data['serviceIds']).toEqual([2]);
    expect(payload.data['urgentOnly']).toBe(true);
  });

  it('only offers ACTIVE services in the restriction picker', () => {
    arrange();
    fireEvent.click(screen.getByTestId('emergency-opening-add-btn'));
    expect(screen.getByTestId('emergency-opening-service-1')).toBeTruthy();
    expect(screen.queryByTestId('emergency-opening-service-3')).toBeNull();
  });

  it('deletes an opening via the row action', () => {
    const deleteMutate = vi.fn();
    arrange({ deleteMutate });
    fireEvent.click(screen.getByTestId('emergency-opening-delete-10'));
    expect(deleteMutate).toHaveBeenCalledWith({ openingId: 10 }, expect.anything());
  });

  it('surfaces the honest server error when deletion is guarded by bookings', () => {
    const deleteMutate = vi.fn((_vars, opts: { onError: (e: unknown) => void }) => {
      opts.onError({
        status: 409,
        data: { error: '1 active booking is scheduled during this opening. Cancel or reschedule it first — deleting the opening will not cancel appointments.', reason: 'bookings_exist' },
      });
    });
    arrange({ deleteMutate });
    fireEvent.click(screen.getByTestId('emergency-opening-delete-11'));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(expect.stringContaining('Cancel or reschedule'));
  });

  it('has no basic accessibility violations', async () => {
    const { container } = arrange();
    fireEvent.click(screen.getByTestId('emergency-opening-add-btn'));
    expect(await axeViolations(container)).toEqual([]);
  });
});
