/**
 * Blocked ranges (vacation / time off) section — provider availability page.
 *
 * Covers: loading/empty/list states, range label formatting, private-note
 * display (owner-only surface), create payload normalization (empty note
 * omitted, note trimmed), delete flow, honest server-error surfacing
 * (409 bookings_exist / emergency_opening_conflict), and an axe scan.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BlockedRangesSection, { formatRangeLabel } from '../components/blocked-ranges-section';
import {
  useListMyBlockedRanges,
  useCreateBlockedRange,
  useDeleteBlockedRange,
} from '@workspace/api-client-react';
import { toast } from 'sonner';
import { axeViolations } from '../test/axe';

vi.mock('@workspace/api-client-react', () => ({
  useListMyBlockedRanges: vi.fn(),
  useCreateBlockedRange: vi.fn(),
  useDeleteBlockedRange: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

const mockList = vi.mocked(useListMyBlockedRanges);
const mockCreate = vi.mocked(useCreateBlockedRange);
const mockDelete = vi.mocked(useDeleteBlockedRange);

const ranges = {
  ranges: [
    { id: 20, startDate: '2027-07-05', endDate: '2027-07-09', reason: 'Family vacation' },
    { id: 21, startDate: '2027-08-02', endDate: '2027-08-02', reason: null },
  ],
};

function arrange(overrides: {
  list?: Partial<ReturnType<typeof useListMyBlockedRanges>>;
  createMutate?: ReturnType<typeof vi.fn>;
  deleteMutate?: ReturnType<typeof vi.fn>;
} = {}) {
  mockList.mockReturnValue({ data: ranges, isLoading: false, ...overrides.list } as never);
  mockCreate.mockReturnValue({ mutate: overrides.createMutate ?? vi.fn(), isPending: false } as never);
  mockDelete.mockReturnValue({ mutate: overrides.deleteMutate ?? vi.fn(), isPending: false } as never);
  return render(<BlockedRangesSection />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('formatRangeLabel', () => {
  it('formats multi-day ranges and collapses single days, without timezone drift', () => {
    expect(formatRangeLabel('2027-07-05', '2027-07-09')).toMatch(/Jul 5.*–.*Jul 9/);
    expect(formatRangeLabel('2027-08-02', '2027-08-02')).toMatch(/Aug 2/);
    expect(formatRangeLabel('2027-08-02', '2027-08-02')).not.toContain('–');
  });
});

describe('BlockedRangesSection', () => {
  it('shows a loading spinner while fetching', () => {
    arrange({ list: { data: undefined, isLoading: true } as never });
    expect(screen.getByTestId('blocked-ranges-loading')).toBeTruthy();
  });

  it('shows a calm empty state when there is no time off', () => {
    arrange({ list: { data: { ranges: [] }, isLoading: false } as never });
    expect(screen.getByTestId('blocked-ranges-empty').textContent).toContain('No upcoming time off');
  });

  it('lists ranges with the private note only when present', () => {
    arrange();
    const row20 = screen.getByTestId('blocked-range-row-20');
    expect(row20.textContent).toMatch(/Jul 5.*Jul 9/);
    expect(screen.getByTestId('blocked-range-reason-20').textContent).toContain('Family vacation');
    expect(screen.getByTestId('blocked-range-reason-20').textContent).toContain('private');

    expect(screen.getByTestId('blocked-range-row-21')).toBeTruthy();
    expect(screen.queryByTestId('blocked-range-reason-21')).toBeNull();
  });

  it('submits a create payload with a trimmed note', () => {
    const createMutate = vi.fn();
    arrange({ createMutate });
    fireEvent.click(screen.getByTestId('blocked-range-add-btn'));
    fireEvent.change(screen.getByTestId('blocked-range-start-input'), { target: { value: '2027-09-06' } });
    fireEvent.change(screen.getByTestId('blocked-range-end-input'), { target: { value: '2027-09-10' } });
    fireEvent.change(screen.getByTestId('blocked-range-reason-input'), { target: { value: '  Course week  ' } });
    fireEvent.submit(screen.getByTestId('blocked-range-form'));

    expect(createMutate).toHaveBeenCalledTimes(1);
    const payload = createMutate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(payload.data).toEqual({
      startDate: '2027-09-06',
      endDate: '2027-09-10',
      reason: 'Course week',
    });
  });

  it('omits an empty note from the payload', () => {
    const createMutate = vi.fn();
    arrange({ createMutate });
    fireEvent.click(screen.getByTestId('blocked-range-add-btn'));
    fireEvent.change(screen.getByTestId('blocked-range-reason-input'), { target: { value: '   ' } });
    fireEvent.submit(screen.getByTestId('blocked-range-form'));

    const payload = createMutate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect('reason' in payload.data).toBe(false);
  });

  it('deletes a range via the row action', () => {
    const deleteMutate = vi.fn();
    arrange({ deleteMutate });
    fireEvent.click(screen.getByTestId('blocked-range-delete-20'));
    expect(deleteMutate).toHaveBeenCalledWith({ rangeId: 20 }, expect.anything());
  });

  it('surfaces the honest server error when creation is guarded by bookings', () => {
    const createMutate = vi.fn((_vars, opts: { onError: (e: unknown) => void }) => {
      opts.onError({
        status: 409,
        data: { error: '2 active bookings are scheduled during this time off. Cancel or reschedule them first — blocking time off will not cancel appointments.', reason: 'bookings_exist' },
      });
    });
    arrange({ createMutate });
    fireEvent.click(screen.getByTestId('blocked-range-add-btn'));
    fireEvent.submit(screen.getByTestId('blocked-range-form'));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(expect.stringContaining('Cancel or reschedule'));
  });

  it('surfaces the emergency-opening mutual-exclusion error verbatim', () => {
    const createMutate = vi.fn((_vars, opts: { onError: (e: unknown) => void }) => {
      opts.onError({
        status: 409,
        data: { error: '1 emergency opening falls inside this time off (first: 2027-09-07 18:00–20:00). Delete it first — emergency openings and time off cannot overlap.', reason: 'emergency_opening_conflict' },
      });
    });
    arrange({ createMutate });
    fireEvent.click(screen.getByTestId('blocked-range-add-btn'));
    fireEvent.submit(screen.getByTestId('blocked-range-form'));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(expect.stringContaining('cannot overlap'));
  });

  it('has no basic accessibility violations', async () => {
    const { container } = arrange();
    fireEvent.click(screen.getByTestId('blocked-range-add-btn'));
    expect(await axeViolations(container)).toEqual([]);
  });
});
