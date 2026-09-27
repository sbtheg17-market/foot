import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScorecardCard from './scorecard-card';
import { useGetMyProviderScorecard } from '@workspace/api-client-react';
import { axeViolations } from '../../test/axe';

vi.mock('@workspace/api-client-react', () => ({
  useGetMyProviderScorecard: vi.fn(),
}));

const mockHook = vi.mocked(useGetMyProviderScorecard);

const counts = (over: Record<string, unknown> = {}) => ({
  total: 6, completed: 4, cancelled: 1, noShow: 1, awaitingOutcome: 0, resolved: 6,
  distinctClients: 3, repeatClients: 1, reviews: { count: 2, averageRating: 4.5 },
  rates: { completion: 0.667, cancellation: 0.167, noShow: 0.167 },
  ...over,
});

const data = {
  windowDays: 30,
  windowStart: '2026-08-28T12:00:00.000Z',
  windowEnd: '2026-09-27T12:00:00.000Z',
  minimumForRates: 5,
  isDemo: true,
  last30: counts({ total: 2, completed: 1, cancelled: 0, noShow: 0, awaitingOutcome: 1, resolved: 1, distinctClients: 1, repeatClients: 0, reviews: { count: 0, averageRating: null }, rates: null }),
  allTime: counts(),
  suggestions: [{ gap: 'unresolved_past_visits' as const, message: '1 past visit in the last 30 days has no recorded outcome. Mark it.' }],
  updatedAt: '2026-09-27T12:00:00.000Z',
};

function arm(state: Partial<{ data: typeof data; isLoading: boolean; isError: boolean }>) {
  mockHook.mockReturnValue({ data: undefined, isLoading: false, isError: false, ...state } as unknown as ReturnType<typeof useGetMyProviderScorecard>);
}

describe('ScorecardCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders exact counts, the insufficient-data rate note, the demo badge and one suggestion', async () => {
    arm({ data });
    const { baseElement } = render(<ScorecardCard />);
    expect(screen.getByTestId('scorecard-demo-badge')).toHaveTextContent('Demo account');
    expect(screen.getByTestId('scorecard-last30-completed')).toHaveTextContent('1');
    expect(screen.getByTestId('scorecard-last30-awaiting-outcome')).toHaveTextContent('1');
    expect(screen.getByTestId('scorecard-last30-rates')).toHaveTextContent('Rates appear after 5 resolved visits (1 of 5 so far).');
    expect(screen.getByTestId('scorecard-alltime-repeat-clients')).toHaveTextContent('1 of 3');
    expect(screen.getByTestId('scorecard-alltime-reviews')).toHaveTextContent('2 · 4.5');
    expect(screen.getByTestId('scorecard-alltime-rates')).toHaveTextContent('Of 6 resolved visits: 67% completed · 17% cancelled · 17% no-show');
    expect(screen.getByTestId('scorecard-suggestion-unresolved-past-visits')).toHaveTextContent('no recorded outcome');
    expect(await axeViolations(baseElement)).toEqual([]);
  });

  it('shows the honest empty state before the first booking', () => {
    arm({ data: { ...data, isDemo: false, allTime: counts({ total: 0 }), suggestions: [] } });
    render(<ScorecardCard />);
    expect(screen.getByTestId('scorecard-empty')).toHaveTextContent('no estimates are shown');
    expect(screen.queryByTestId('scorecard-demo-badge')).not.toBeInTheDocument();
  });

  it('says so when nothing stands out', () => {
    arm({ data: { ...data, suggestions: [] } });
    render(<ScorecardCard />);
    expect(screen.getByTestId('scorecard-no-suggestions')).toBeInTheDocument();
  });

  it('handles loading and error states', () => {
    arm({ isLoading: true });
    const { unmount } = render(<ScorecardCard />);
    expect(screen.getByTestId('scorecard-loading')).toBeInTheDocument();
    unmount();
    arm({ isError: true });
    render(<ScorecardCard />);
    expect(screen.getByTestId('scorecard-error')).toBeInTheDocument();
  });
});
