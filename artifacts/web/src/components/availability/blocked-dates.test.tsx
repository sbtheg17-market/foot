/**
 * Blocked dates (availability exceptions, Phase B) component tests.
 *
 * Covers: empty state, list rendering with private reason, add flow payload
 * (trimmed reason, omitted when blank), delete flow payload, disabled state
 * while pending, explainer copy about existing bookings, and error toasts
 * surfacing server messages.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BlockedDates, { blockedDateLabel } from './blocked-dates';
import { axeViolations } from '../../test/axe';
import {
  useListMyAvailabilityExceptions,
  useCreateMyAvailabilityException,
  useDeleteMyAvailabilityException,
} from '@workspace/api-client-react';
import { toast } from 'sonner';

vi.mock('@workspace/api-client-react', () => ({
  useListMyAvailabilityExceptions: vi.fn(),
  useCreateMyAvailabilityException: vi.fn(),
  useDeleteMyAvailabilityException: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockList = vi.mocked(useListMyAvailabilityExceptions);
const mockCreate = vi.mocked(useCreateMyAvailabilityException);
const mockDelete = vi.mocked(useDeleteMyAvailabilityException);

const createMutate = vi.fn();
const deleteMutate = vi.fn();

function setup(
  exceptions: Array<{ id: number; providerId: number; date: string; type: string; reason: string | null }>,
  opts: { isLoading?: boolean; createPending?: boolean } = {},
) {
  mockList.mockReturnValue({
    data: opts.isLoading ? undefined : { exceptions },
    isLoading: opts.isLoading ?? false,
  } as never);
  mockCreate.mockReturnValue({
    mutate: createMutate,
    isPending: opts.createPending ?? false,
  } as never);
  mockDelete.mockReturnValue({ mutate: deleteMutate, isPending: false } as never);

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BlockedDates />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('blockedDateLabel', () => {
  it('formats a YYYY-MM-DD date without timezone day drift', () => {
    expect(blockedDateLabel('2099-01-05')).toMatch(/Jan/);
    expect(blockedDateLabel('2099-01-05')).toMatch(/5/);
  });

  it('falls back to the raw value for garbage input', () => {
    expect(blockedDateLabel('garbage')).toBe('garbage');
  });
});

describe('BlockedDates', () => {
  it('shows a truthful empty state and the existing-bookings note', () => {
    setup([]);
    expect(screen.getByTestId('blocked-dates-empty')).toBeInTheDocument();
    expect(screen.getByTestId('blocked-dates-explainer').textContent).toMatch(
      /Existing bookings are not cancelled/,
    );
  });

  it('renders blocked dates with the private reason', () => {
    setup([
      { id: 7, providerId: 1, date: '2099-06-01', type: 'blocked', reason: 'Vacation' },
      { id: 8, providerId: 1, date: '2099-06-02', type: 'blocked', reason: null },
    ]);
    expect(screen.getByTestId('blocked-date-row-7')).toHaveTextContent('Vacation');
    expect(screen.getByTestId('blocked-date-row-8')).toBeInTheDocument();
    expect(screen.queryByTestId('blocked-dates-empty')).not.toBeInTheDocument();
  });

  it('submits the picked date with a trimmed reason', () => {
    setup([]);
    fireEvent.change(screen.getByTestId('blocked-date-input'), {
      target: { value: '2099-06-01' },
    });
    fireEvent.change(screen.getByTestId('blocked-date-reason-input'), {
      target: { value: '  Course day  ' },
    });
    fireEvent.click(screen.getByTestId('blocked-date-add-btn'));
    expect(createMutate).toHaveBeenCalledWith(
      { data: { date: '2099-06-01', reason: 'Course day' } },
      expect.anything(),
    );
  });

  it('omits reason entirely when blank', () => {
    setup([]);
    fireEvent.change(screen.getByTestId('blocked-date-input'), {
      target: { value: '2099-06-01' },
    });
    fireEvent.click(screen.getByTestId('blocked-date-add-btn'));
    expect(createMutate).toHaveBeenCalledWith(
      { data: { date: '2099-06-01' } },
      expect.anything(),
    );
  });

  it('refuses to submit without a date', () => {
    setup([]);
    fireEvent.click(screen.getByTestId('blocked-date-add-btn'));
    expect(createMutate).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Pick a date to block');
  });

  it('deletes by exception id', () => {
    setup([
      { id: 42, providerId: 1, date: '2099-06-01', type: 'blocked', reason: null },
    ]);
    fireEvent.click(screen.getByTestId('blocked-date-delete-btn-42'));
    expect(deleteMutate).toHaveBeenCalledWith({ exceptionId: 42 }, expect.anything());
  });

  it('surfaces the server error message on create failure', () => {
    setup([]);
    createMutate.mockImplementation((_vars, callbacks) => {
      callbacks?.onError?.({ data: { error: 'This date is already blocked.' } });
    });
    fireEvent.change(screen.getByTestId('blocked-date-input'), {
      target: { value: '2099-06-01' },
    });
    fireEvent.click(screen.getByTestId('blocked-date-add-btn'));
    expect(toast.error).toHaveBeenCalledWith('This date is already blocked.');
  });

  it('disables the add button while a mutation is pending', () => {
    setup([], { createPending: true });
    expect(screen.getByTestId('blocked-date-add-btn')).toBeDisabled();
  });

  it('accessibility: no axe violations', async () => {
    const { container } = setup([
      { id: 7, providerId: 1, date: '2099-06-01', type: 'blocked', reason: 'Vacation' },
    ]);
    expect(await axeViolations(container)).toEqual([]);
  });
});
